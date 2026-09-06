export function normalizeText(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

export function normalizeTitle(value) {
  return normalizeText(value).toLocaleLowerCase();
}

export function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function canonicalUrl(value) {
  try {
    const url = new URL(value);
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_|fbclid$|gclid$|mc_)/i.test(key)) url.searchParams.delete(key);
    }
    url.hostname = url.hostname.toLowerCase();
    if ((url.protocol === "https:" && url.port === "443") || (url.protocol === "http:" && url.port === "80")) url.port = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

export function normalizeCandidate(candidate) {
  const normalized = {
    candidate_id: Number(candidate?.candidate_id),
    title: normalizeText(candidate?.title),
    publisher: normalizeText(candidate?.publisher),
    url: canonicalUrl(candidate?.url),
    published_at: normalizeText(candidate?.published_at),
    snippet: normalizeText(candidate?.snippet),
  };
  if (!Number.isInteger(normalized.candidate_id) || normalized.candidate_id < 1 || !normalized.title || !normalized.publisher || !normalized.url || !validDate(normalized.published_at)) return null;
  return normalized;
}

export function normalizeCandidates(candidates) {
  const seenIds = new Set();
  const seenUrls = new Set();
  const seenTitles = new Set();
  return (candidates || []).flatMap((candidate) => {
    const item = normalizeCandidate(candidate);
    if (!item || seenIds.has(item.candidate_id)) return [];
    const titleDate = `${normalizeTitle(item.title)}\u0000${item.published_at}`;
    if (seenUrls.has(item.url) || seenTitles.has(titleDate)) return [];
    seenIds.add(item.candidate_id); seenUrls.add(item.url); seenTitles.add(titleDate);
    return [item];
  }).slice(0, 10);
}

export function normalizeExistingNews(news) {
  return (news || []).flatMap((item) => {
    const title = normalizeText(item?.title);
    const published_at = normalizeText(item?.published_at);
    if (!title || !validDate(published_at)) return [];
    return [{title, published_at}];
  });
}
