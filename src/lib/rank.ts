import type { Passage, ScoredPassage } from "./types";
import { tokens } from "./text";

const K1 = 1.4;
const B = 0.35;
const HEADING_WEIGHT = 3;
// Unrelated texts still score about 0.75 with gte-small, so only the part above that counts.
const SIMILARITY_BASE = 0.78;
const SIMILARITY_WEIGHT = 40;

/**
 * BM25 keyword ranking over passages, with the heading and document title
 * counted several times so a section's subject outweighs a passing mention.
 *
 * This is the search used when no database is configured, and the keyword half
 * of the hybrid search when one is (see supabase/migrations for the SQL half).
 */
export function rankPassages(
  query: string,
  passages: (Passage & { similarity?: number | null })[],
  k = 4,
): ScoredPassage[] {
  const q = [...new Set(tokens(query))];
  if (!passages.length) return [];

  const docs = passages.map((p) => {
    const body = tokens(p.content);
    const head = tokens(`${p.heading ?? ""} ${p.documentTitle}`);
    const tf = new Map<string, number>();
    for (const t of body) tf.set(t, (tf.get(t) ?? 0) + 1);
    for (const t of head) tf.set(t, (tf.get(t) ?? 0) + HEADING_WEIGHT);
    return { tf, length: body.length + head.length * HEADING_WEIGHT };
  });

  const avg = docs.reduce((n, d) => n + d.length, 0) / docs.length;
  const idf = new Map<string, number>();
  for (const t of q) {
    const n = docs.filter((d) => d.tf.has(t)).length;
    idf.set(t, Math.log(1 + (docs.length - n + 0.5) / (n + 0.5)));
  }
  const totalWeight = q.reduce((sum, t) => sum + idf.get(t)!, 0);

  const scored = passages.map((p, i) => {
    const d = docs[i];
    let score = 0;
    let weight = 0;
    for (const t of q) {
      const f = d.tf.get(t);
      if (!f) continue;
      const w = idf.get(t)!;
      weight += w;
      score += (w * f * (K1 + 1)) / (f + K1 * (1 - B + (B * d.length) / avg));
    }
    // Reward passages that cover more of the question, not one word many times.
    const coverage = totalWeight ? weight / totalWeight : 0;
    score *= 0.5 + 0.5 * coverage;
    // A close match by meaning lifts a passage that shares few words with the question.
    score += Math.max(0, (p.similarity ?? 0) - SIMILARITY_BASE) * SIMILARITY_WEIGHT;
    return { ...p, score, coverage };
  });

  return scored
    .filter((p) => p.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}

/**
 * Whether the best passage is a strong enough match to answer from.
 * Below this the assistant declines instead of guessing.
 *
 * The coverage test is what stops "Can I pay with Bitcoin?" being answered
 * from the payments page: the passage matches "pay", but the word that carries
 * the question appears nowhere in the documents.
 */
export function isConfident(ranked: ScoredPassage[]): boolean {
  const top = ranked[0];
  if (!top) return false;
  if ((top.similarity ?? 0) >= SIMILARITY_FLOOR) return true;
  return top.score >= 1.2 && top.coverage >= 0.55;
}

/** Cosine similarity above which a meaning-based match is trusted on its own. */
export const SIMILARITY_FLOOR = 0.865;
