const API = "https://en.wikipedia.org/w/api.php";

async function request(params) {
  const url = new URL(API);
  url.search = new URLSearchParams({action: "query", format: "json", formatversion: "2", origin: "*", ...params});
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Wikipedia search failed (${response.status}).`);
  return response.json();
}

export async function fetchCompanyWikipediaExtract(companyName) {
  const search = await request({list: "search", srsearch: companyName, srnamespace: "0", srlimit: "1"});
  const selected = search.query.search[0];
  if (!selected) throw new Error("Wikipedia found no matching page.");
  const detail = await request({prop: "extracts|info", pageids: String(selected.pageid), exintro: "1", explaintext: "1", inprop: "url"});
  const page = detail.query.pages[0];
  if (!page?.extract?.trim()) throw new Error("Wikipedia returned no usable page text.");
  return {title: page.title, url: page.fullurl, extract: page.extract};
}
