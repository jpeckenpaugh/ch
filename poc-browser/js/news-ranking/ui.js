import { fixtures, fixtureById } from "./fixtures/index.js";
import { rankBaseline } from "./baseline.js";
import { createGemmaRanker, webGpuAvailable } from "./model/gemma.js";
import { runFixture, scoreFixture } from "./controller.js";
import { esc } from "../app.js";

function ids(items) { return items.join(", ") || "—"; }
function fixtureOptions(active) { return fixtures.map((fixture) => `<option value="${fixture.id}" ${fixture.id === active.id ? "selected" : ""}>${esc(fixture.name)}</option>`).join(""); }

export async function renderNewsRanking(container) {
  let fixture = fixtures[0];
  container.innerHTML = `<div class="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
    <div><h1 class="h3 mb-1">Local news ranking benchmark</h1><p class="text-secondary mb-0">Phase 1 only: fixture data, no Company Hub reads or writes.</p></div>
    <span class="badge text-bg-light border">WebGPU ${webGpuAvailable() ? "available" : "not detected"}</span>
  </div>
  <div class="card"><div class="card-body">
    <label class="form-label" for="ranking-fixture">Fixture</label><select class="form-select mb-3" id="ranking-fixture">${fixtureOptions(fixture)}</select>
    <div class="row g-3 small text-secondary mb-3"><div class="col-md-4"><strong class="text-body">Expected strong candidates</strong><br><span id="expected-top"></span></div><div class="col-md-4"><strong class="text-body">Obvious rejects</strong><br><span id="expected-rejects"></span></div><div class="col-md-4"><strong class="text-body">Candidates</strong><br>10 structured articles</div></div>
    <div class="d-flex gap-2 flex-wrap"><button class="btn btn-outline-secondary" id="run-baseline">Run deterministic baseline</button><button class="btn btn-primary" id="run-gemma" ${webGpuAvailable() ? "" : "disabled"}>Run Gemma locally</button></div>
    <p class="small text-secondary mt-3 mb-0">Gemma loads from its normal model host after you start it; the download can be large. Debug output remains in this page only.</p>
  </div></div><div id="ranking-status" class="mt-4"></div><details class="mt-3" id="ranking-debug"><summary>Development debug output</summary><pre class="bg-light border rounded p-3 mt-2 small text-wrap" id="ranking-debug-output">No run yet.</pre></details>`;
  const expectedTop = container.querySelector("#expected-top"); const expectedRejects = container.querySelector("#expected-rejects"); const status = container.querySelector("#ranking-status"); const debug = container.querySelector("#ranking-debug-output");
  const updateFixture = () => { fixture = fixtureById(container.querySelector("#ranking-fixture").value); expectedTop.textContent = ids(fixture.acceptableTop); expectedRejects.textContent = ids(fixture.obviousRejects); status.innerHTML = ""; };
  updateFixture(); container.querySelector("#ranking-fixture").addEventListener("change", updateFixture);
  container.querySelector("#run-baseline").addEventListener("click", () => {
    const ranked = rankBaseline(fixture.candidates); const score = scoreFixture(fixture, {ranked_candidate_ids: ranked, reject_ids: []});
    status.innerHTML = resultHtml("Deterministic baseline", ranked, [], score, "No model loaded."); debug.textContent = JSON.stringify({fixture, ranked, score}, null, 2);
  });
  container.querySelector("#run-gemma").addEventListener("click", async (event) => {
    event.currentTarget.disabled = true; status.innerHTML = `<div class="alert alert-info">Preparing Gemma…</div>`;
    const events = [];
    try {
      const model = await createGemmaRanker({onProgress: (message) => { events.push(message); status.innerHTML = `<div class="alert alert-info">${esc(message)}</div>`; }});
      const run = await runFixture({fixture, model, onAttempt: (error) => events.push(`Retrying after validation failure: ${error.message}`)});
      const score = scoreFixture(fixture, run.ranking);
      status.innerHTML = resultHtml(`${model.model} · ${model.backend}`, run.ranking.ranked_candidate_ids, run.ranking.reject_ids, score, `Loaded in ${model.loadMilliseconds} ms; ranked in ${run.rankingMilliseconds} ms; ${run.attempts} attempt(s).`);
      debug.textContent = JSON.stringify({fixture, prompt: run.prompt, rawModelOutput: run.raw, validatedRanking: run.ranking, selected: run.selected, baseline: run.baseline, score, events}, null, 2);
    } catch (error) { status.innerHTML = `<div class="alert alert-danger">${esc(error.message)}</div>`; debug.textContent = JSON.stringify({fixture, events, error: error.message}, null, 2); }
    finally { event.currentTarget.disabled = false; }
  });
}

function resultHtml(title, ranked, rejected, score, detail) { return `<div class="card"><div class="card-body"><h2 class="h5">${esc(title)}</h2><p class="mb-2"><strong>Ranked IDs:</strong> ${esc(ids(ranked))}<br><strong>Rejected IDs:</strong> ${esc(ids(rejected))}</p><p class="mb-2 small text-secondary">Top-three label hits: ${score.topThreeHits}/3 · obvious rejects kept out of top three or rejected: ${score.obviousRejectHits}/4</p><p class="mb-0 small text-secondary">${esc(detail)}</p></div></div>`; }
