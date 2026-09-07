import { normalizeCandidates, normalizeText, validDate } from "./normalize.js";

const GDELT_DOC_URL = "https://api.gdeltproject.org/api/v2/doc/doc";

function gdeltDate(value) {
  const compact = String(value ?? "").match(/^(\d{4})(\d{2})(\d{2})/);
  if (!compact) return null;
  const date = `${compact[1]}-${compact[2]}-${compact[3]}`;
  return validDate(date) ? date : null;
}

export function gdeltUrl(companyName) {
  const url = new URL(GDELT_DOC_URL);
  url.search = new URLSearchParams({
    query: `"${normalizeText(companyName)}"`, mode: "ArtList", format: "json",
    maxrecords: "25", timespan: "30d", sort: "HybridRel",
  }).toString();
  return url.toString();
}

export function mapGdeltArticles(payload) {
  return normalizeCandidates((payload?.articles || []).map((article, index) => ({
    candidate_id: index + 1,
    title: article?.title,
    publisher: article?.domain || article?.sourcecountry || "GDELT source",
    url: article?.url,
    published_at: gdeltDate(article?.seendate),
    snippet: `GDELT discovery result from ${article?.domain || "a news source"}.`,
  })));
}

export async function collectNewsCandidates({ company, limit = 10, fetchImpl = fetch }) {
  if (!normalizeText(company?.name)) throw new Error("Company name is required to search GDELT.");
  let response;
  try { response = await fetchImpl(gdeltUrl(company.name), { headers: { Accept: "application/json" } }); }
  catch (error) { throw new Error(`Unable to reach GDELT: ${error.message}`); }
  if (response.status === 429) throw new Error("GDELT is temporarily rate-limiting searches. Wait a moment and try again.");
  if (!response.ok) throw new Error(`GDELT search failed (${response.status}).`);
  let payload;
  try { payload = await response.json(); } catch { throw new Error("GDELT returned an unreadable response."); }
  return mapGdeltArticles(payload).slice(0, limit);
}
