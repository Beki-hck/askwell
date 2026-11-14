"use client";

import Link from "next/link";
import { useLocalRun } from "@/lib/client/local-run";
import { timeAgo } from "@/lib/format";

interface Summary {
  passed: number;
  total: number;
  createdAt: string;
}

/** The latest test score on the overview: the visitor's own run in the demo, or the last saved one. */
export function LastRun({ businessId, saved }: { businessId: string; saved: Summary | null }) {
  const local = useLocalRun(businessId);
  const mine = local && { passed: local.correct + local.declinedCorrectly, total: local.total, createdAt: local.createdAt };
  const shown = mine && (!saved || mine.createdAt > saved.createdAt) ? mine : saved;

  if (!shown) {
    return (
      <p>
        The tests have not been run yet. <Link href="/dashboard/quality">Run them now</Link>
      </p>
    );
  }
  return (
    <p>
      The last test run passed {shown.passed} of {shown.total} questions,{" "}
      <time dateTime={shown.createdAt} suppressHydrationWarning>
        {timeAgo(shown.createdAt)}
      </time>
      . <Link href="/dashboard/quality">See the results</Link>
    </p>
  );
}
