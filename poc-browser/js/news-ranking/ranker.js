import { validateRanking } from "./schema.js";

export function buildPrompt({company, existingNews, candidates, requested}) {
  return `Rank candidate news articles for Company Hub. Return JSON only with ranked_candidate_ids and reject_ids.\n\nCompany: ${company.name}\nDescription: ${company.description || "Not provided"}\nRequested articles: ${requested}\n\nExisting news (avoid duplicate events):\n${JSON.stringify(existingNews)}\n\nCandidates (rank direct, substantive, credible, recent, distinct coverage high; reject tangential, trivial, duplicate, or unsupported items):\n${JSON.stringify(candidates)}`;
}

export async function rankWithRetry({model, context, onAttempt}) {
  const prompt = buildPrompt(context);
  let raw = await model.complete(prompt);
  try { return {ranking: validateRanking(raw, context.candidates), raw, attempts: 1, prompt}; }
  catch (firstError) {
    onAttempt?.(firstError);
    raw = await model.complete(`${prompt}\n\nYour previous response was invalid. Return only a valid JSON object with every candidate ID used at most once.`);
    return {ranking: validateRanking(raw, context.candidates), raw, attempts: 2, prompt};
  }
}
