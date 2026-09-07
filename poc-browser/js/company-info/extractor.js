function json(text) {
  const source = String(text ?? "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const start = source.indexOf("{"); const end = source.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("Gemma did not return a JSON object.");
  try { return JSON.parse(source.slice(start, end + 1)); } catch { throw new Error("Gemma returned malformed JSON."); }
}

function nullable(value) { return typeof value === "string" && value.trim() ? value.trim() : null; }

export function buildCompanyInfoPrompt({companyName, extract, industries}) {
  const task = `Extract only the requested Company Hub fields from the Wikipedia text below. Use only information explicitly supported by the source text. Return null for any field not explicitly supported. Do not infer, guess, supplement, or add fields.\n\nReturn exactly one JSON object and no Markdown, explanation, thought text, or code fence:\n{"industry":"string or null","headquarters":{"city":"string or null","region":"string or null","country_code":"string or null"},"website":"string or null","contact_email":"string or null","contact_phone":"string or null","description":"string or null"}\n\nAllowed industry values: ${JSON.stringify(industries)}\nCompany name: ${companyName}\n\nWikipedia text:\n${extract}`;
  return `<|turn>user\n${task}<turn|>\n<|turn>model\n`;
}

export async function extractCompanyInfo({model, companyName, extract, industries}) {
  const prompt = buildCompanyInfoPrompt({companyName, extract, industries});
  const value = json(await model.complete(prompt));
  const headquarters = value?.headquarters && typeof value.headquarters === "object" ? {
    city: nullable(value.headquarters.city), region: nullable(value.headquarters.region), country_code: nullable(value.headquarters.country_code)?.toUpperCase() ?? null,
  } : null;
  return {industry: nullable(value?.industry), headquarters, website: nullable(value?.website), contact_email: nullable(value?.contact_email), contact_phone: nullable(value?.contact_phone), description: nullable(value?.description), prompt};
}
