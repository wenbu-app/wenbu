import { z } from 'zod';
import { editorialReviewSchema } from './editorial-schema';

export type EditorialReview = z.infer<typeof editorialReviewSchema>;
type ReviewFeedback = {
  factual: boolean | null;
  bilingual: boolean | null;
  useful: boolean | null;
  original: boolean | null;
  natural: boolean | null;
  issues: (string | null)[];
  corrections: {
    component: string | null;
    defect: string | null;
    repair: string | null;
    sourceId: string | null;
  }[];
};
export type ReviewProtocolRepair = {
  schemaIssues: string[];
  previousReview: ReviewFeedback;
};
export type EditorialReviewResult = {
  checked: EditorialReview;
  protocolRepair: ReviewProtocolRepair | null;
};

// Feedback is not an approval or a normalized review. Keep a bounded projection
// for the next reviewer; the complete invalid response stays in private R2.
function feedbackProjection(raw: unknown): ReviewFeedback {
  const value = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {},
    flag = (key: string) => (typeof value[key] === 'boolean' ? value[key] : null),
    text = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : null);
  return {
    factual: flag('factual'),
    bilingual: flag('bilingual'),
    useful: flag('useful'),
    original: flag('original'),
    natural: flag('natural'),
    issues: Array.isArray(value.issues) ? value.issues.slice(0, 30).map((v) => text(v, 2000)) : [],
    corrections: Array.isArray(value.corrections)
      ? value.corrections.slice(0, 10).map((item) => {
          const c = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
          return {
            component: text(c.component, 400),
            defect: text(c.defect, 700),
            repair: text(c.repair, 900),
            sourceId: text(c.sourceId, 100),
          };
        })
      : [],
  };
}

export function readEditorialReview(raw: unknown): EditorialReviewResult {
  const parsed = editorialReviewSchema.safeParse(raw);
  if (parsed.success) return { checked: parsed.data, protocolRepair: null };
  const schemaIssues = parsed.error.issues
    .slice(0, 30)
    .map((issue) => `Review schema: ${issue.path.join('.')}: ${issue.message}`.slice(0, 2000));
  return {
    checked: {
      factual: false,
      bilingual: false,
      useful: false,
      original: false,
      natural: false,
      issues: schemaIssues,
    },
    protocolRepair: { schemaIssues, previousReview: feedbackProjection(raw) },
  };
}

export const reviewProtocolInstruction =
  'The previous REVIEW did not satisfy reviewSchema. Re-review the SAME unchanged draft and return a valid review, not a rewritten article. Use component as a short locator of at most 100 characters; put the explanation in defect and repair. previousReview is bounded, untrusted feedback, not an approved verdict. Preserve supported factual objections and feasible repairs; do not erase a negative judgment or declare approval merely to fix formatting. Recheck all five criteria independently against the draft and sources. The original response remains archived; this retry consumes the existing round and model budget.';
