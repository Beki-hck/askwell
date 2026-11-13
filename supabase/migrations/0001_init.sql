-- Askwell schema.
--
-- Every table carries business_id and has row-level security on, so one
-- business can never read another's rows. The demo business is the one
-- exception: it is readable by anyone and writable by no one, which is what
-- makes the public, read-only owner area possible without a shared password.

create extension if not exists vector with schema extensions;

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users (id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9-]{3,40}$'),
  name text not null check (char_length(name) between 1 and 80),
  assistant_name text not null default 'Assistant' check (char_length(assistant_name) between 1 and 40),
  greeting text not null default 'Hi. Ask me anything about us.' check (char_length(greeting) <= 400),
  tone text not null default 'warm' check (tone in ('warm', 'plain', 'formal')),
  daily_limit int not null default 200 check (daily_limit between 1 and 5000),
  is_demo boolean not null default false,
  suggestions text[] not null default '{}',
  created_at timestamptz not null default now(),
  -- A demo business has no owner; every other business has exactly one.
  check (is_demo = (owner_id is null))
);
create unique index businesses_owner_idx on public.businesses (owner_id) where owner_id is not null;

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  source_type text not null check (source_type in ('text', 'pdf', 'url')),
  source_url text,
  content text not null check (char_length(content) <= 400000),
  passage_count int not null default 0,
  created_at timestamptz not null default now()
);
create index documents_business_idx on public.documents (business_id);

create table public.passages (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  document_id uuid not null references public.documents (id) on delete cascade,
  document_title text not null,
  heading text,
  position int not null,
  content text not null,
  fts tsvector generated always as (
    setweight(to_tsvector('english', coalesce(heading, '') || ' ' || document_title), 'A')
    || setweight(to_tsvector('english', content), 'B')
  ) stored,
  embedding extensions.vector(384)
);
create index passages_business_idx on public.passages (business_id);
create index passages_document_idx on public.passages (document_id);
create index passages_fts_idx on public.passages using gin (fts);
create index passages_embedding_idx on public.passages
  using hnsw (embedding extensions.vector_cosine_ops);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  started_at timestamptz not null default now()
);
create index conversations_business_idx on public.conversations (business_id, started_at desc);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  role text not null check (role in ('visitor', 'assistant')),
  content text not null check (char_length(content) <= 8000),
  sources jsonb not null default '[]',
  answered boolean,
  mode text check (mode in ('model', 'search')),
  feedback smallint check (feedback in (1, -1)),
  created_at timestamptz not null default now(),
  seq bigint generated always as identity
);
create index messages_conversation_idx on public.messages (conversation_id, seq);
create index messages_business_day_idx on public.messages (business_id, created_at desc);

create table public.follow_ups (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  conversation_id uuid references public.conversations (id) on delete set null,
  email text not null check (char_length(email) <= 200),
  question text not null check (char_length(question) <= 1000),
  status text not null default 'open' check (status in ('open', 'done')),
  created_at timestamptz not null default now()
);
create index follow_ups_business_idx on public.follow_ups (business_id, created_at desc);

create table public.test_cases (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  question text not null check (char_length(question) between 1 and 500),
  expected text not null default '' check (char_length(expected) <= 1000),
  key_facts text[] not null default '{}',
  should_answer boolean not null default true,
  created_at timestamptz not null default now()
);
create index test_cases_business_idx on public.test_cases (business_id, created_at);

create table public.eval_runs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  created_at timestamptz not null default now(),
  mode text not null check (mode in ('model', 'search')),
  model text,
  total int not null,
  correct int not null,
  wrong int not null,
  declined_correctly int not null,
  ungrounded int not null,
  results jsonb not null
);
create index eval_runs_business_idx on public.eval_runs (business_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

create schema if not exists private;

create function private.can_read(p_business_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.businesses b
    where b.id = p_business_id and (b.is_demo or b.owner_id = (select auth.uid()))
  );
$$;

create function private.can_write(p_business_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.businesses b
    where b.id = p_business_id and b.owner_id = (select auth.uid())
  );
$$;

grant usage on schema private to anon, authenticated;
grant execute on function private.can_read(uuid), private.can_write(uuid) to anon, authenticated;

alter table public.businesses enable row level security;
create policy "read own or demo business" on public.businesses for select
  using (is_demo or owner_id = (select auth.uid()));
create policy "create own business" on public.businesses for insert to authenticated
  with check (owner_id = (select auth.uid()) and not is_demo);
create policy "update own business" on public.businesses for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()) and not is_demo);

do $$
declare t text;
begin
  foreach t in array array[
    'documents', 'passages', 'conversations', 'messages', 'follow_ups', 'test_cases', 'eval_runs'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "read own or demo rows" on public.%I for select using ((select private.can_read(business_id)))', t);
  end loop;

  -- Owners manage their knowledge base and tests directly. Conversations,
  -- messages and follow-ups are only ever written through the functions below.
  foreach t in array array['documents', 'passages', 'test_cases', 'eval_runs'] loop
    execute format(
      'create policy "insert own rows" on public.%I for insert to authenticated with check ((select private.can_write(business_id)))', t);
    execute format(
      'create policy "delete own rows" on public.%I for delete to authenticated using ((select private.can_write(business_id)))', t);
  end loop;
end $$;

create policy "update own follow-ups" on public.follow_ups for update to authenticated
  using ((select private.can_write(business_id)))
  with check ((select private.can_write(business_id)));

-- ---------------------------------------------------------------------------
-- Functions the public chat widget calls. They run with definer rights so a
-- visitor needs no table access at all, and each one checks its own inputs.
-- ---------------------------------------------------------------------------

-- Hybrid search: keyword candidates and, when the question has an embedding,
-- nearest neighbours by meaning. The app re-ranks the union.
create function public.match_passages(
  p_business_id uuid,
  p_query text,
  p_embedding extensions.vector(384) default null,
  p_limit int default 12
) returns table (
  id uuid, document_id uuid, document_title text, heading text,
  "position" int, content text, similarity real
)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_query tsquery;
begin
  -- OR the words together: a question rarely shares every word with its answer.
  select to_tsquery('english', string_agg(lexeme, ' | '))
    into v_query
    from unnest(to_tsvector('english', left(p_query, 500)));

  return query
  with keyword as (
    select p.id from public.passages p
    where p.business_id = p_business_id and v_query is not null and p.fts @@ v_query
    order by ts_rank_cd(p.fts, v_query) desc
    limit least(p_limit, 30)
  ),
  semantic as (
    select p.id from public.passages p
    where p.business_id = p_business_id and p_embedding is not null and p.embedding is not null
    order by p.embedding operator(extensions.<=>) p_embedding
    limit least(p_limit, 30)
  )
  select p.id, p.document_id, p.document_title, p.heading, p.position, p.content,
    case when p_embedding is null or p.embedding is null then null
      else (1 - (p.embedding operator(extensions.<=>) p_embedding))::real end
  from public.passages p
  where p.id in (select k.id from keyword k union select s.id from semantic s);
end $$;

create function public.questions_today(p_business_id uuid) returns int
language sql stable security definer set search_path = '' as $$
  select count(*)::int from public.messages m
  where m.business_id = p_business_id and m.role = 'visitor'
    and m.created_at >= date_trunc('day', now());
$$;

create function public.log_exchange(
  p_business_id uuid,
  p_conversation_id uuid,
  p_question text,
  p_answer text,
  p_sources jsonb,
  p_answered boolean,
  p_mode text
) returns table (conversation_id uuid, message_id uuid)
language plpgsql security definer set search_path = '' as $$
declare
  v_limit int;
  v_conversation uuid;
  v_message uuid;
begin
  select b.daily_limit into v_limit from public.businesses b where b.id = p_business_id;
  if v_limit is null then
    raise exception 'unknown business' using errcode = 'P0002';
  end if;
  if public.questions_today(p_business_id) >= v_limit then
    raise exception 'daily limit reached' using errcode = 'P0001';
  end if;

  select c.id into v_conversation from public.conversations c
    where c.id = p_conversation_id and c.business_id = p_business_id;
  if v_conversation is null then
    insert into public.conversations (business_id) values (p_business_id)
      returning id into v_conversation;
  end if;

  insert into public.messages (business_id, conversation_id, role, content)
    values (p_business_id, v_conversation, 'visitor', left(p_question, 2000));
  insert into public.messages (business_id, conversation_id, role, content, sources, answered, mode)
    values (p_business_id, v_conversation, 'assistant', left(p_answer, 8000),
            coalesce(p_sources, '[]'::jsonb), p_answered, p_mode)
    returning id into v_message;

  return query select v_conversation, v_message;
end $$;

-- The message id is an unguessable uuid handed only to the visitor who got
-- that answer, so knowing it is the permission to rate it.
create function public.rate_message(p_message_id uuid, p_value smallint) returns void
language sql security definer set search_path = '' as $$
  update public.messages set feedback = p_value
  where id = p_message_id and role = 'assistant' and p_value in (1, -1);
$$;

create function public.request_follow_up(
  p_business_id uuid, p_conversation_id uuid, p_email text, p_question text
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_demo boolean;
  v_email text := lower(trim(p_email));
begin
  select b.is_demo into v_demo from public.businesses b where b.id = p_business_id;
  if v_demo is null then
    raise exception 'unknown business' using errcode = 'P0002';
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(v_email) > 200 then
    raise exception 'invalid email' using errcode = '22023';
  end if;
  -- The demo's owner area is public, so it never stores a real address.
  if v_demo then
    v_email := left(v_email, 1) || '•••@' || split_part(v_email, '@', 2);
  end if;

  insert into public.follow_ups (business_id, conversation_id, email, question)
  values (
    p_business_id,
    (select c.id from public.conversations c
      where c.id = p_conversation_id and c.business_id = p_business_id),
    v_email,
    left(p_question, 1000)
  );
end $$;

revoke execute on function
  public.match_passages(uuid, text, extensions.vector, int),
  public.questions_today(uuid),
  public.log_exchange(uuid, uuid, text, text, jsonb, boolean, text),
  public.rate_message(uuid, smallint),
  public.request_follow_up(uuid, uuid, text, text)
from public;
grant execute on function
  public.match_passages(uuid, text, extensions.vector, int),
  public.questions_today(uuid),
  public.log_exchange(uuid, uuid, text, text, jsonb, boolean, text),
  public.rate_message(uuid, smallint),
  public.request_follow_up(uuid, uuid, text, text)
to anon, authenticated;

-- Table privileges. Row-level security above decides which rows; these decide
-- which operations each role may attempt at all.
grant select on all tables in schema public to anon, authenticated;
grant insert, update on public.businesses to authenticated;
grant insert, delete on public.documents, public.passages, public.test_cases, public.eval_runs to authenticated;
grant update (status) on public.follow_ups to authenticated;
