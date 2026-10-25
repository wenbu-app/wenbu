import { commissioningFeedback } from './editorial-commissioning';

// Compact a copy, never the retained evidence. Whole values are reduced before
// serialization so a size limit cannot cut JSON or turn a source URL into a prefix.
function bounded(value: unknown, items: number, text: number, depth = 0): unknown {
  if (value === null || typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'string')
    return /^https?:\/\//.test(value) ? (value.length <= 2048 ? value : undefined) : value.slice(0, text);
  if (depth >= 6) return undefined;
  if (Array.isArray(value))
    return value
      .slice(0, items)
      .map((v) => bounded(v, items, text, depth + 1))
      .filter((v) => v !== undefined);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .slice(0, 16)
        .flatMap(([key, v]) => {
          const result = bounded(v, items, text, depth + 1);
          return result === undefined ? [] : [[key, result]];
        }),
    );
  return undefined;
}

export function editorialSignalSummary(kind: string, evidence: Record<string, unknown>) {
  const p =
    evidence.production && typeof evidence.production === 'object'
      ? (evidence.production as Record<string, unknown>)
      : null;
  const projection: Record<string, unknown> = {
    sourceUrls: evidence.sourceUrls,
    suggestedTasks: evidence.suggestedTasks,
    queries: evidence.queries,
    topPages: evidence.topPages,
    decisions: evidence.decisions,
    operationalTasks: evidence.operationalTasks,
    production: p
      ? {
          days: Array.isArray(p.days) ? p.days.slice(-2) : [],
          readyTasks: p.readyTasks,
          viableReadyTasks: p.viableReadyTasks,
          reserveTarget: p.reserveTarget,
          failureCounts: p.failureCounts,
          sourceHealth: p.sourceHealth,
        }
      : undefined,
    rejectedCandidates:
      kind === 'topic_planning' ? commissioningFeedback(evidence) : evidence.rejectedCandidates,
  };
  for (const [items, text] of [
    [8, 500],
    [4, 320],
    [2, 220],
    [1, 120],
  ]) {
    const compact = bounded(projection, items, text) as Record<string, unknown>;
    const serialized = JSON.stringify({
      ...compact,
      projection: { bounded: true, fullEvidenceRetained: true },
    });
    if (serialized.length <= 6000) return serialized;
  }
  const compact = bounded(projection, 1, 120) as Record<string, unknown>;
  const metadata = { bounded: true, omittedFields: [] as string[], fullEvidenceRetained: true };
  while (JSON.stringify({ ...compact, projection: metadata }).length > 6000) {
    const key = Object.keys(compact)
      .filter((k) => k !== 'sourceUrls')
      .sort((a, b) => JSON.stringify(compact[b]).length - JSON.stringify(compact[a]).length)[0];
    if (!key) break;
    delete compact[key];
    metadata.omittedFields.push(key);
  }
  return JSON.stringify({ ...compact, projection: metadata });
}
