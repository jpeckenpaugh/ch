import { excludeExistingNews, normalizeCandidates } from "./normalize.js";
import { rankBaseline } from "./baseline.js";
import { rankWithRetry, rejectWithRetry } from "./ranker.js";

async function screenThenRank({company, candidates, requested, model, onAttempt}) {
  const screening = await rejectWithRetry({model, context: {company, candidates}, onAttempt});
  const rejected = new Set(screening.rejection.reject_ids);
  const viableCandidates = candidates.filter((candidate) => !rejected.has(candidate.candidate_id));
  if (!viableCandidates.length) throw new Error("Gemma rejected every usable news candidate.");
  const rankingRun = await rankWithRetry({model, context: {company, candidates: viableCandidates, requested}, onAttempt});
  return {
    ...rankingRun,
    screening,
    candidates: viableCandidates,
    ranking: {...rankingRun.ranking, reject_ids: screening.rejection.reject_ids},
  };
}

export async function runFixture({fixture, requested = 3, model, onAttempt}) {
  const candidates = normalizeCandidates(fixture.candidates);
  const started = performance.now();
  const result = await screenThenRank({company: fixture.company, candidates, requested, model, onAttempt});
  const selected = result.ranking.ranked_candidate_ids.slice(0, requested);
  return {...result, context: {company: fixture.company, candidates: result.candidates, requested}, selected, baseline: rankBaseline(candidates), rankingMilliseconds: Math.round(performance.now() - started)};
}

export async function runLiveRanking({company, existingNews, requested = 3, model, collectCandidates, onAttempt}) {
  const collected = await collectCandidates({company, existingNews, limit: 10});
  const candidates = excludeExistingNews(normalizeCandidates(collected), existingNews);
  if (!candidates.length) throw new Error("The news provider returned no new usable candidates for this company.");
  const started = performance.now();
  const result = await screenThenRank({company, candidates, requested, model, onAttempt});
  const byId = new Map(result.candidates.map((candidate) => [candidate.candidate_id, candidate]));
  const selected = result.ranking.ranked_candidate_ids.slice(0, requested).map((id) => byId.get(id)).filter(Boolean);
  return {...result, context: {company, candidates: result.candidates, requested}, selected, rankingMilliseconds: Math.round(performance.now() - started)};
}

export function scoreFixture(fixture, ranking) {
  const top = ranking.ranked_candidate_ids.slice(0, 3);
  const rejects = new Set(ranking.reject_ids);
  return {
    topThreeHits: top.filter((id) => fixture.acceptableTop.includes(id)).length,
    obviousRejectHits: fixture.obviousRejects.filter((id) => rejects.has(id) || !top.includes(id)).length,
  };
}
