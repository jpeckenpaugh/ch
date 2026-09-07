function json(text) {
  const source = String(text ?? "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const start = source.indexOf("{"); const end = source.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("Gemma did not return a JSON object.");
  try { return JSON.parse(source.slice(start, end + 1)); } catch { throw new Error("Gemma returned malformed JSON."); }
}

function nullable(value) { return typeof value === "string" && value.trim() ? value.trim() : null; }

export function buildCompanyInfoPrompt({companyName, extract, industries}) {
  const task = `Extract only the requested Company Hub fields from the Wikipedia text below. Use only information explicitly supported by the source text. Return null for any field not explicitly supported. Do not infer, guess, supplement, or add fields.\n\nReturn exactly one JSON object and no Markdown, explanation, thought text, or code fence:\n{"industry":"string or null","headquarters":{"city":"string or null","region":"string or null","country_code":"string or null"},"contact_email":"string or null","contact_phone":"string or null","description":"string or null"}\n\nAllowed industry values: ${JSON.stringify(industries)}\nCompany name: ${companyName}\n\nWikipedia text:\n${extract}`;
  return `<|turn>user\n${task}<turn|>\n<|turn>model\n`;
}

export async function extractCompanyInfo({model, companyName, extract, industries}) {
  const prompt = buildCompanyInfoPrompt({companyName, extract, industries});
  const started = performance.now();
  const rawResponses = [await model.complete(prompt)];
  let value;
  try { value = json(rawResponses[0]); }
  catch (firstError) {
    const repairPrompt = `${prompt}\nYour previous response was invalid. Return only one valid JSON object using exactly these fields: industry, headquarters, website, contact_email, contact_phone, description.`;
    rawResponses.push(await model.complete(repairPrompt));
    try { value = json(rawResponses[1]); }
    catch (error) {
      error.prompt = prompt;
      error.rawResponses = rawResponses;
      error.generationMilliseconds = Math.round(performance.now() - started);
      throw error;
    }
  }
  const headquarters = value?.headquarters && typeof value.headquarters === "object" ? {
    city: nullable(value.headquarters.city), region: nullable(value.headquarters.region), country_code: nullable(value.headquarters.country_code)?.toUpperCase() ?? null,
  } : null;
  return {industry: nullable(value?.industry), headquarters, contact_email: nullable(value?.contact_email), contact_phone: nullable(value?.contact_phone), description: nullable(value?.description), prompt, rawResponses, generationMilliseconds: Math.round(performance.now() - started)};
}

export async function extractCompanyWebsite({model, companyName}) {
  const prompt = `<|turn>user\nReturn the official public website for this company.\n\nReturn exactly one JSON object and no Markdown, explanation, thought text, or code fence:\n{"website":"string or null"}\n\nCompany name: ${companyName}<turn|>\n<|turn>model\n`;
  const started = performance.now();
  const rawResponses = [await model.complete(prompt)];
  let value;
  try { value = json(rawResponses[0]); }
  catch {
    const repairPrompt = `${prompt}\nYour previous response was invalid. Return only one valid JSON object using exactly the website field.`;
    rawResponses.push(await model.complete(repairPrompt));
    try { value = json(rawResponses[1]); }
    catch (error) { error.prompt = prompt; error.rawResponses = rawResponses; error.generationMilliseconds = Math.round(performance.now() - started); throw error; }
  }
  return {website: nullable(value?.website), prompt, rawResponses, generationMilliseconds: Math.round(performance.now() - started)};
}
