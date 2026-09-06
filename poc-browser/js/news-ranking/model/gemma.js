// The library and weights are fetched only after the user explicitly starts a Gemma benchmark.
// This keeps the static POC small and leaves normal Company Hub use unaffected.
const MODEL_ID = "onnx-community/gemma-4-E2B-it-ONNX";
// Gemma 4 support was added in Transformers.js 4.0.1; pin a current 4.x
// release rather than silently loading an older runtime from a broad CDN tag.
const TRANSFORMERS_URL = "https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.2.0/+esm";

export function webGpuAvailable() { return typeof navigator !== "undefined" && Boolean(navigator.gpu); }

function progressMessage(event) {
  const file = event?.file ? `: ${event.file}` : "";
  if (Number.isFinite(event?.loaded) && Number.isFinite(event?.total) && event.total > 0) {
    return `Model ${event.status}${file} (${Math.round((event.loaded / event.total) * 100)}%)`;
  }
  return `Model ${event?.status ?? "loading"}${file}`;
}

export async function createGemmaRanker({onProgress} = {}) {
  if (!webGpuAvailable()) throw new Error("WebGPU is required for the Gemma benchmark in this POC.");
  const started = performance.now();
  onProgress?.("Loading the WebGPU inference runtime…");
  let transformers;
  try { transformers = await import(TRANSFORMERS_URL); }
  catch (error) { throw new Error(`Unable to load the browser inference runtime: ${error.message}`); }
  onProgress?.("Downloading or opening Gemma 4 E2B weights…");
  let generator;
  try {
    generator = await transformers.pipeline("text-generation", MODEL_ID, {
      device: "webgpu", dtype: "q4f16",
      progress_callback: (event) => event?.status && onProgress?.(progressMessage(event)),
    });
  } catch (error) { throw new Error(`Gemma could not initialize on this browser/device: ${error.message}`); }
  return {
    backend: "WebGPU",
    model: "Gemma 4 E2B (q4f16 ONNX)",
    loadMilliseconds: Math.round(performance.now() - started),
    async complete(prompt) {
      const output = await generator(prompt, {max_new_tokens: 280, do_sample: false, return_full_text: false});
      return Array.isArray(output) ? output[0]?.generated_text : output?.generated_text;
    },
  };
}
