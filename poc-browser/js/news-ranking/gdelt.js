import { normalizeCandidates, normalizeText, validDate } from "./normalize.js";

const GDELT_DOC_URL = "https://api.gdeltproject.org/api/v2/doc/doc";
const CACHE_PREFIX = "company-hub:gdelt:";
const CACHE_TTL_MS = 15 * 60 * 1000;
const REQUEST_GAP_MS = 5 * 1000;
const RATE_LIMIT_COOLDOWN_MS = 5 * 60 * 1000;
let lastRequestAt = 0;
let rateLimitedUntil = 0;

function cacheKey(companyName) {
  return `${CACHE_PREFIX}${normalizeText(companyName).toLowerCase()}`;
}

function browserStorage() {
  try { return window.localStorage; } catch { return null; }
}

function cachedCandidates(companyName) {
  const storage = browserStorage();
  if (!storage) return null;
  try {
    const cached = JSON.parse(storage.getItem(cacheKey(companyName)) || "null");
    if (!cached || !Array.isArray(cached.candidates) || Date.now() - cached.savedAt > CACHE_TTL_MS) return null;
    return cached.candidates;
  } catch { return null; }
}

function cacheCandidates(companyName, candidates) {
  const storage = browserStorage();
  if (!storage) return;
  try { storage.setItem(cacheKey(companyName), JSON.stringify({ savedAt: Date.now(), candidates })); } catch { /* Storage is optional. */ }
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function gdeltDate(value) {
  const compact = String(value ?? "").match(/^(\d{4})(\d{2})(\d{2})/);
  if (!compact) return null;
  const date = `${compact[1]}-${compact[2]}-${compact[3]}`;
  return validDate(date) ? date : null;
}

export function gdeltUrl(companyName, { format = "json", callback } = {}) {
  const url = new URL(GDELT_DOC_URL);
  const params = new URLSearchParams({
    query: `"${normalizeText(companyName)}"`, mode: "ArtList", format,
    maxrecords: "25", timespan: "30d", sort: "HybridRel",
  });
  if (callback) params.set("callback", callback);
  url.search = params.toString();
  return url.toString();
}

export function requestGdeltJsonp(url, { documentImpl = document, timeoutMs = 30000 } = {}) {
  return new Promise((resolve, reject) => {
    const callback = `companyHubGdelt${Date.now()}${Math.random().toString(36).slice(2)}`;
    const script = documentImpl.createElement("script");
    const parent = documentImpl.head || documentImpl.body;
    const cleanup = () => { clearTimeout(timer); delete window[callback]; script.remove(); };
    const timer = setTimeout(() => { cleanup(); reject(new Error("GDELT did not respond in time. Try again shortly.")); }, timeoutMs);
    window[callback] = (payload) => { cleanup(); resolve(payload); };
    script.onerror = () => { cleanup(); reject(new Error("Unable to load GDELT search results.")); };
    const requestUrl = new URL(url);
    requestUrl.searchParams.set("format", "jsonp");
    requestUrl.searchParams.set("callback", callback);
    script.src = requestUrl.toString();
    parent.appendChild(script);
  });
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

export async function collectNewsCandidates({ company, limit = 10, fetchImpl = fetch, jsonpImpl } = {}) {
  if (!normalizeText(company?.name)) throw new Error("Company name is required to search GDELT.");
  if (typeof window !== "undefined" && typeof document !== "undefined") {
    const cached = cachedCandidates(company.name);
    if (cached) return cached.slice(0, limit);
    if (Date.now() < rateLimitedUntil) {
      const seconds = Math.ceil((rateLimitedUntil - Date.now()) / 1000);
      throw new Error(`GDELT is temporarily rate-limiting this browser. Try again in about ${seconds} seconds.`);
    }
    const delay = Math.max(0, REQUEST_GAP_MS - (Date.now() - lastRequestAt));
    if (delay) await wait(delay);
    lastRequestAt = Date.now();
    let payload;
    try { payload = await (jsonpImpl ?? requestGdeltJsonp)(gdeltUrl(company.name)); }
    catch (error) {
      // JSONP script loads do not expose an HTTP status to the browser. GDELT's
      // public endpoint reports 429 this way, so prevent repeated retries.
      rateLimitedUntil = Date.now() + RATE_LIMIT_COOLDOWN_MS;
      throw new Error("GDELT is temporarily rate-limiting searches. Try again in about 5 minutes.");
    }
    const candidates = mapGdeltArticles(payload);
    cacheCandidates(company.name, candidates);
    return candidates.slice(0, limit);
  }
  let response;
  try { response = await fetchImpl(gdeltUrl(company.name), { headers: { Accept: "application/json" } }); }
  catch (error) { throw new Error(`Unable to reach GDELT: ${error.message}`); }
  if (response.status === 429) throw new Error("GDELT is temporarily rate-limiting searches. Wait a moment and try again.");
  if (!response.ok) throw new Error(`GDELT search failed (${response.status}).`);
  let payload;
  try { payload = await response.json(); } catch { throw new Error("GDELT returned an unreadable response."); }
  return mapGdeltArticles(payload).slice(0, limit);
}
