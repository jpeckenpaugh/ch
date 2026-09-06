const QUALITY = new Map([
  ["reuters", 5], ["associated press", 5], ["financial times", 5], ["wall street journal", 5],
  ["bloomberg", 5], ["bbc", 4], ["the verge", 3], ["company press room", 2],
]);

export function baselineScore(candidate, now = "2026-09-06") {
  const age = Math.max(0, Math.floor((Date.parse(`${now}T00:00:00Z`) - Date.parse(`${candidate.published_at}T00:00:00Z`)) / 86400000));
  const quality = QUALITY.get(candidate.publisher.toLocaleLowerCase()) ?? 2;
  return quality * 100 - Math.min(age, 90);
}

export function rankBaseline(candidates, now) {
  return [...candidates].sort((a, b) => baselineScore(b, now) - baselineScore(a, now) || a.candidate_id - b.candidate_id).map((item) => item.candidate_id);
}
