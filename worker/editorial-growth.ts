import { EDITORIAL_POLICY } from './editorial-policy';
import { contentHash, shanghaiDay, type EditorialDocument } from './editorial-schema';
import { editorialDemandLanes, defaultSearchBrief } from '../src/data/editorial-demand';
import { editorialSources, type EditorialTopic } from '../src/data/editorial-topics';
import type { Env } from './types';
import { sourceViable } from './editorial-commissioning';

export async function editorialGrowthStatus(env: Env, now = Date.now()) {
  const day = shanghaiDay(now),
    db = env.ANALYTICS!;
  const since = shanghaiDay(now - 7 * 86400_000);
  const [runs, topics, publications, sources] = await Promise.all([
    db
      .prepare(
        'SELECT slot,status,error_code,model_calls FROM editorial_runs WHERE slot>=? AND slot<? ORDER BY created_at LIMIT 1500',
      )
      .bind(since + '-00', day + '-99')
      .all<{ slot: string; status: string; error_code: string | null; model_calls: number }>(),
    db
      .prepare('SELECT definition_json,status,last_attempt_at FROM editorial_topics')
      .all<{ definition_json: string; status: string; last_attempt_at: number | null }>(),
    db.prepare('SELECT document_json FROM editorial_publications').all<{ document_json: string }>(),
    db
      .prepare('SELECT id,status,checked_at FROM editorial_source_health')
      .all<{ id: string; status: string; checked_at: number }>(),
  ]);
  const days = Array.from({ length: 8 }, (_, i) => {
    const date = shanghaiDay(now - (7 - i) * 86400_000);
    const slots = EDITORIAL_POLICY.hours.map((hour) => `${date}-${String(hour).padStart(2, '0')}`);
    const due = slots.filter(
      (slot) => date < day || Number(slot.slice(-2)) <= new Date(now + 8 * 3600_000).getUTCHours(),
    );
    const published = slots.filter((slot) =>
      runs.results.some((r) => r.slot === slot && r.status === 'published'),
    ).length;
    return {
      day: date,
      target: EDITORIAL_POLICY.dailyTopics,
      due: due.length,
      published,
      remaining: EDITORIAL_POLICY.dailyTopics - published,
      missed: date < day ? EDITORIAL_POLICY.dailyTopics - published : null,
      attempts: runs.results.filter((r) => slots.includes(r.slot)).length,
    };
  });
  const failureCounts: Record<string, number> = {};
  for (const run of runs.results.filter((r) => r.status === 'blocked')) {
    const code = run.error_code ?? 'unknown';
    const bucket = /^(quality_gate:|editorial_schema)/.test(code)
      ? 'quality_or_structure'
      : /source|original_article/.test(code)
        ? 'source_unavailable'
        : /budget/.test(code)
          ? 'model_budget'
          : /^editorial_(?:model_http_\d{3}|provider_paused|model_unconfigured)$/.test(code)
            ? 'model_provider'
            : 'execution';
    failureCounts[bucket] = (failureCounts[bucket] ?? 0) + 1;
  }
  const ready = topics.results.filter((t) => t.status === 'ready');
  const unavailable = new Set(
    sources.results
      .filter((s) => s.status !== 'available' && s.checked_at > now - 86400_000)
      .map((s) => s.id),
  );
  const viableReadyTasks = ready.filter((t) =>
    sourceViable(JSON.parse(t.definition_json) as EditorialTopic, unavailable),
  ).length;
  const docs = publications.results.map((p) => JSON.parse(p.document_json) as EditorialDocument);
  const keywordCoverage = editorialDemandLanes.map((lane) => {
    const tasks = ready
      .map((t) => JSON.parse(t.definition_json) as EditorialTopic)
      .filter((t) => t.tool === lane.tool);
    const briefs = [
      ...tasks.map((t) => t.search ?? defaultSearchBrief(t.tool)),
      ...docs.filter((d) => d.topic.tool === lane.tool && d.topic.search).map((d) => d.topic.search!),
    ];
    return {
      pillar: lane.pillar,
      readyTasks: tasks.length,
      publishedOwners: docs.filter((d) => d.topic.tool === lane.tool).length,
      zh: [...new Set(briefs.flatMap((b) => b.zh))].slice(0, 20),
      en: [...new Set(briefs.flatMap((b) => b.en))].slice(0, 20),
    };
  });
  return {
    checkedAt: new Date(now).toISOString(),
    policyVersion: EDITORIAL_POLICY.version,
    days,
    failureCounts,
    readyTasks: ready.length,
    viableReadyTasks,
    sourceEligibilityBasis:
      'Candidates exclude recently unavailable sources; missing or stale records are not verified availability. Every publication rereads its sources.',
    reserveTarget: 42,
    sourceHealth: {
      available: sources.results.filter((s) => s.status === 'available' && s.checked_at > now - 86400_000)
        .length,
      unavailable: sources.results
        .filter((s) => s.status !== 'available' && s.checked_at > now - 86400_000)
        .map((s) => s.id),
      stale: sources.results.filter((s) => s.checked_at <= now - 86400_000).length,
      missing: Object.keys(editorialSources).filter((id) => !sources.results.some((s) => s.id === id)).length,
    },
    keywordCoverage,
    coverageBasis: 'Editorial briefs and research hypotheses, not measured rankings or keyword volumes.',
    outcomeBoundary:
      'Published bilingual tasks, provider requests, indexed revisions, search visits and server-confirmed use are separate measures.',
  };
}

export async function recordEditorialGrowthReview(env: Env) {
  const day = shanghaiDay(Date.now());
  const production = await editorialGrowthStatus(env);
  const previous = production.days[production.days.length - 2];
  const failures = (
    await env
      .ANALYTICS!.prepare(
        "SELECT slot,topic_id,error_code,review_key FROM editorial_runs WHERE status='blocked' AND updated_at>=? ORDER BY updated_at DESC LIMIT 5",
      )
      .bind(Date.now() - 86400_000)
      .all<{ slot: string; topic_id: string | null; error_code: string | null; review_key: string | null }>()
  ).results;
  const repairFeedback = await Promise.all(
    failures.map(async (failure) => {
      let issues: string[] = [];
      if (failure.review_key && env.ANALYTICS_ARCHIVE) {
        try {
          const object = await env.ANALYTICS_ARCHIVE.get(failure.review_key);
          const review = object ? await object.json<{ issues?: unknown }>() : null;
          if (Array.isArray(review?.issues))
            issues = review.issues
              .filter((x): x is string => typeof x === 'string')
              .slice(0, 3)
              .map((x) => x.slice(0, 300));
        } catch {
          /* The failure receipt is still retained; missing review text is unknown. */
        }
      }
      return {
        slot: failure.slot,
        topic: failure.topic_id,
        error: failure.error_code,
        issues,
        scope: 'recent_24h',
      };
    }),
  );
  const evidence = {
    checkedAt: production.checkedAt,
    production,
    suggestedTasks: [],
    queries: [],
    topPages: [],
    decisions: [
      {
        decision:
          'Replenish supported reader tasks across all six demand lanes, using new owners or substantial additions on existing owners.',
      },
      {
        decision:
          'Use blocked-run defects as concrete repair feedback; unavailable vendor sources need another supported topic, not invented facts.',
      },
      {
        decision:
          'Measure mature 7/14/28-day article-entry sessions and subsequent server success using existing observations; do not infer demand from these briefs.',
      },
    ],
    operationalTasks: {
      previousDayMissed: previous.missed,
      reserveGap: Math.max(0, 42 - production.viableReadyTasks),
      failureCounts: production.failureCounts,
      unavailableSources: production.sourceHealth.unavailable,
      repairFeedback,
    },
    sourceUrls: ['https://wenbu.app/knowledge/index.json', 'https://wenbu.app/capabilities.json'],
  };
  const { checkedAt: _checkedAt, ...snapshot } = production;
  const fingerprint = await contentHash(JSON.stringify({ production: snapshot, repairFeedback }));
  const id = `growth-review-${day}-${fingerprint.slice(0, 24)}`;
  const exists = await env
    .ANALYTICS!.prepare('SELECT id FROM editorial_observations WHERE id=?')
    .bind(id)
    .first();
  if (exists) return { id, status: 'already_recorded' };
  const status = previous.missed || production.viableReadyTasks < 42 ? 'attention' : 'observed';
  await env
    .ANALYTICS!.prepare(
      'INSERT OR IGNORE INTO editorial_observations(id,kind,checked_at,period_start,period_end,status,evidence_json) VALUES(?,?,?,?,?,?,?)',
    )
    .bind(id, 'growth_review', Date.now(), previous.day, previous.day, status, JSON.stringify(evidence))
    .run();
  return {
    id,
    status,
    previousDayMissed: previous.missed,
    reserveGap: Math.max(0, 42 - production.viableReadyTasks),
  };
}
