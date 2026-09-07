import { normalizeCandidates, normalizeText, validDate } from './normalize.js';

const SEARCH_URL = 'https://api.currentsapi.services/v1/search';

function publishedDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function sourceName(article) {
  try { return new URL(article?.url).hostname.replace(/^www\./, ''); }
  catch { return normalizeText(article?.author) || 'Currents News'; }
}

export function currentsSearchUrl(companyName, {limit = 10} = {}) {
  const params = new URLSearchParams({
    keywords: normalizeText(companyName), language: 'en', page_number: '1', page_size: String(limit),
  });
  return `${SEARCH_URL}?${params}`;
}

export function mapCurrentsArticles(payload) {
  return normalizeCandidates((payload?.news || []).map((article, index) => ({
    candidate_id: index + 1,
    title: article?.title,
    publisher: sourceName(article),
    url: article?.url,
    published_at: publishedDate(article?.published),
    snippet: article?.description || '',
  })));
}

export async function collectCurrentsCandidates({company, apiKey, limit = 10, fetchImpl = fetch} = {}) {
  if (!normalizeText(company?.name)) throw new Error('Company name is required to search Currents.');
  if (!normalizeText(apiKey)) throw new Error('Add your Currents API key in Workspace before finding news.');
  let response;
  try {
    response = await fetchImpl(currentsSearchUrl(company.name, {limit}), {headers: {Authorization: `Bearer ${apiKey}`}});
  } catch (error) { throw new Error(`Unable to reach Currents: ${error.message}`); }
  let payload;
  try { payload = await response.json(); } catch { throw new Error(`Currents returned an unreadable response (${response.status}).`); }
  if (response.status === 401) throw new Error('Currents rejected this API key. Update it in Workspace and try again.');
  if (response.status === 429) throw new Error('Currents has reached this key’s request limit. Try again after its quota resets.');
  if (!response.ok || payload?.status === 'error') throw new Error(payload?.msg || payload?.message || `Currents search failed (${response.status}).`);
  return mapCurrentsArticles(payload).slice(0, limit);
}
