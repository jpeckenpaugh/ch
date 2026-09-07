import { validateRankedCandidates, validateRejections } from "./schema.js";

function gemmaTurn(task) {
  // Gemma 4 E2B's no-thinking single-turn template. The raw generation must
  // begin after the model turn, not after an unstructured text prompt.
  return `<|turn>user\n${task}<turn|>\n<|turn>model\n`;
}

export function buildRejectionPrompt({company, candidates}) {
  const instruction = `You screen candidate news articles for Company Hub.\n\nReject an article only when it is not directly about the company, is tangential, trivial, unsupported, or unsuitable for a company-intelligence workspace. Retain every article that meets this suitability threshold.\n\nReturn exactly one JSON object and no Markdown, explanation, thought text, or code fence.\n\nRequired JSON format:\n{"reject_ids":[3,4]}\n\nRules:\n- Use only candidate IDs provided below.\n- Include each rejected ID at most once.\n- Omit viable candidates from reject_ids.`;
  return gemmaTurn(`${instruction}\n\nCompany: ${company.name}\nDescription: ${company.description || "Not provided"}\n\nCandidates:\n${JSON.stringify(candidates)}`);
}

export function buildRankingPrompt({company, candidates, requested}) {
  const instruction = `You rank viable candidate news articles for Company Hub.\n\nRank direct, substantive, credible, recent, and distinct coverage high.\n\nReturn exactly one JSON object and no Markdown, explanation, thought text, or code fence.\n\nRequired JSON format:\n{"ranked_candidate_ids":[1,2,3]}\n\nRules:\n- Use only candidate IDs provided below.\n- Include every candidate ID exactly once.\n- Put IDs in best-to-worst order.`;
  return gemmaTurn(`${instruction}\n\nCompany: ${company.name}\nDescription: ${company.description || "Not provided"}\nRequested articles: ${requested}\n\nCandidates:\n${JSON.stringify(candidates)}`);
}

async function completeWithRetry({model, prompt, validate, repairFields, onAttempt}) {
  const rawResponses = [];
  let raw = await model.complete(prompt);
  rawResponses.push(raw);
  try { return {result: validate(raw), raw, attempts: 1, prompt}; }
  catch (firstError) {
    onAttempt?.(firstError);
    const repairPrompt = `${prompt}\nYour previous answer was invalid. Start your response with { and return only valid JSON using ${repairFields}.`;
    raw = await model.complete(repairPrompt);
    rawResponses.push(raw);
    try { return {result: validate(raw), raw, attempts: 2, prompt, rawResponses}; }
    catch (error) { error.rawResponses = rawResponses; error.prompt = prompt; throw error; }
  }
}

export async function rejectWithRetry({model, context, onAttempt}) {
  const prompt = buildRejectionPrompt(context);
  const run = await completeWithRetry({model, prompt, validate: raw => validateRejections(raw, context.candidates), repairFields: "reject_ids", onAttempt});
  return {...run, rejection: run.result};
}

export async function rankWithRetry({model, context, onAttempt}) {
  const prompt = buildRankingPrompt(context);
  const run = await completeWithRetry({model, prompt, validate: raw => validateRankedCandidates(raw, context.candidates), repairFields: "ranked_candidate_ids", onAttempt});
  return {...run, ranking: run.result};
}
