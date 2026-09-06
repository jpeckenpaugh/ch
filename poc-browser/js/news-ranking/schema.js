function jsonObject(text) {
  const trimmed = String(text ?? "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("Model did not return a JSON object");
  try { return JSON.parse(trimmed.slice(start, end + 1)); } catch { throw new Error("Model returned malformed JSON"); }
}

function ids(items, field, allowed, seen) {
  if (!Array.isArray(items)) throw new Error(`Model response is missing ${field}`);
  return items.map((item) => typeof item === "object" ? item.candidate_id : item).map((id) => {
    if (!Number.isInteger(id) || !allowed.has(id) || seen.has(id)) throw new Error("Model returned an invalid or duplicate candidate ID");
    seen.add(id); return id;
  });
}

export function validateRanking(raw, candidates) {
  const value = typeof raw === "string" ? jsonObject(raw) : raw;
  const allowed = new Set(candidates.map((item) => item.candidate_id));
  const seen = new Set();
  const rankedSource = value.ranked_candidate_ids ?? value.ranked_candidates;
  const rejectSource = value.reject_ids ?? value.rejects;
  const ranked_candidate_ids = ids(rankedSource, "ranked candidates", allowed, seen);
  const reject_ids = ids(rejectSource, "rejects", allowed, seen);
  return {ranked_candidate_ids, reject_ids};
}
