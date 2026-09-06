import { validateRanking } from "./schema.js";

export function buildPrompt({company, existingNews, candidates, requested}) {
  const instruction = `You rank candidate news articles for Company Hub. Return exactly one JSON object and no Markdown, explanation, thought text, or code fence. Use this exact schema: {"ranked_candidate_ids":[1,2],"reject_ids":[3,4]}. Every candidate ID must appear at most once. Rank direct, substantive, credible, recent, and distinct coverage high. Reject tangential, trivial, duplicate, or unsupported items.`;
  const task = `${instruction}\n\nCompany: ${company.name}\nDescription: ${company.description || "Not provided"}\nRequested articles: ${requested}\n\nExisting news (avoid duplicate events):\n${JSON.stringify(existingNews)}\n\nCandidates:\n${JSON.stringify(candidates)}`;
  // Gemma 4 E2B's no-thinking single-turn template. The raw generation must
  // begin after the model turn, not after an unstructured text prompt.
  return `<|turn>user\n${task}<turn|>\n<|turn>model\n`;
}

export async function rankWithRetry({model, context, onAttempt}) {
  const prompt = buildPrompt(context);
  const rawResponses = [];
  let raw = await model.complete(prompt);
  rawResponses.push(raw);
  try { return {ranking: validateRanking(raw, context.candidates), raw, attempts: 1, prompt}; }
  catch (firstError) {
    onAttempt?.(firstError);
    const repairPrompt = `${prompt}\nYour previous answer was invalid. Start your response with { and return only valid JSON using ranked_candidate_ids and reject_ids.`;
    raw = await model.complete(repairPrompt);
    rawResponses.push(raw);
    try { return {ranking: validateRanking(raw, context.candidates), raw, attempts: 2, prompt, rawResponses}; }
    catch (error) { error.rawResponses = rawResponses; error.prompt = prompt; throw error; }
  }
}
