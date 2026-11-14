import Link from "next/link";

export function Wordmark() {
  return (
    <Link href="/" className="wordmark" aria-label="Askwell home">
      Ask<span>well</span>
    </Link>
  );
}

export function SiteNav() {
  return (
    <header className="nav">
      <Wordmark />
      <nav aria-label="Main">
        <Link href="/#how">How it works</Link>
        <Link href="/#quality">Answer quality</Link>
        <Link href="/demo">Demo site</Link>
      </nav>
      <Link className="button nav-cta" href="/dashboard">
        Owner area
      </Link>
    </header>
  );
}
