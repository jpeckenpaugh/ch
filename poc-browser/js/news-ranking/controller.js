import { normalizeCandidates, normalizeExistingNews } from "./normalize.js";
import { rankBaseline } from "./baseline.js";
import { rankWithRetry } from "./ranker.js";

export async function runFixture({fixture, requested = 3, model, onAttempt}) {
  const candidates = normalizeCandidates(fixture.candidates);
  const context = {company: fixture.company, existingNews: normalizeExistingNews(fixture.existingNews).slice(0, 12), candidates, requested};
  const started = performance.now();
  const result = await rankWithRetry({model, context, onAttempt});
  const selected = result.ranking.ranked_candidate_ids.slice(0, requested);
  return {...result, context, selected, baseline: rankBaseline(candidates), rankingMilliseconds: Math.round(performance.now() - started)};
}

export function scoreFixture(fixture, ranking) {
  const top = ranking.ranked_candidate_ids.slice(0, 3);
  const rejects = new Set(ranking.reject_ids);
  return {
    topThreeHits: top.filter((id) => fixture.acceptableTop.includes(id)).length,
    obviousRejectHits: fixture.obviousRejects.filter((id) => rejects.has(id) || !top.includes(id)).length,
  };
}
