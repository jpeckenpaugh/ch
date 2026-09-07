# POC: Browser-local news ranking with Gemma 4 E2B

## Goal

Prove that Gemma 4 E2B can run locally in the browser and add useful semantic judgment to the `source_news` workflow by ranking a small, already-prepared set of candidate news articles for a known company.

This is not an autonomous-agent POC.

The workflow is intentionally:

```text
deterministic JS
    ↓
local Gemma ranking
    ↓
deterministic validation
```

The model is used only for semantic ranking.

---

## Core question

> Can Gemma 4 E2B, running locally in the browser, reliably identify the best news candidates from a bounded set of 10 structured articles?

If yes, the same pattern can later be reused for other Company Hub judgment tasks.

---

# 1. Scope

Implement only the ranking portion of `source_news`.

Inputs:

```text
company_id
number_of_new_items   // 1–5
```

For Phase 1, use fixed fixtures rather than live search.

Each fixture contains:

* company context
* existing news context
* 10 candidate articles
* expected acceptable top candidates
* obvious rejects / duplicates

Phase 1 does not write to the user's real Company Hub workspace.

---

# 2. Deterministic preprocessing

JavaScript owns all non-semantic work.

For a live workflow, JS would eventually:

1. validate `company_id`
2. validate requested article count
3. load company details
4. load existing news
5. collect candidate articles
6. normalize metadata
7. remove exact duplicates
8. assign stable candidate IDs
9. build the model input

For Phase 1, these inputs come from fixture JSON.

The model does not receive Company Hub tools.

---

# 3. Candidate shape

Use one simple interchange format:

```js
{
  candidate_id: 7,
  title: "...",
  publisher: "...",
  url: "...",
  published_at: "2026-09-05",
  snippet: "..."
}
```

Preprocessing should:

* normalize dates to `YYYY-MM-DD`
* normalize whitespace
* canonicalize URLs where practical
* remove tracker query parameters
* reject malformed candidates
* remove exact canonical-URL duplicates
* remove exact normalized-title/date duplicates

The model should receive no more than 10 candidates per ranking task.

---

# 4. Existing-news context

Do not pass an unbounded company news history.

Provide a bounded normalized context sufficient for semantic duplicate detection, for example:

```js
[
  {
    title: "...",
    published_at: "2026-08-31"
  }
]
```

Prefer recent existing news and cap the list at a reasonable fixed number.

The exact cap is an implementation default for the POC, not a blocking design decision.

---

# 5. Gemma runtime

Use one browser-compatible Gemma 4 E2B build supported by a WebGPU-capable JavaScript inference library.

## Runtime assumptions

* WebGPU is the target backend.
* WASM/CPU fallback is optional and not a success requirement.
* Use a practical quantized browser artifact supported by the selected runtime.
* Do not turn model quantization into a separate research effort.

If the initially selected artifact or runtime cannot execute reliably in-browser, switch to another supported Gemma 4 E2B artifact and document the change.

---

# 6. Model delivery

Load model weights from their normal model host/CDN.

Do not vendor multi-gigabyte model files into the Company Hub repository.

Rely on the runtime/browser cache for subsequent runs.

Record:

* model download size
* first-load time
* cached-load time
* ranking latency
* runtime/backend used

---

# 7. Model task

Gemma receives:

* concise company identity/context
* up to 10 candidate articles
* screening or ranking criteria

Before prompting, JavaScript deterministically removes candidates that match
existing news. Gemma then performs two independent calls: first it screens
candidates for rejection, then it ranks every surviving candidate.

The screening call returns only rejected IDs. It rejects an article only when
it is not directly about the company, is tangential, trivial, unsupported, or
otherwise unsuitable for a company-intelligence workspace. It does not reject
an article merely because another candidate is stronger.

The ranking call receives only survivors and orders every supplied ID from best
to worst. The UI uses the first one to five IDs requested by the user.

Example screening output:

```json
{
  "reject_ids": [3, 5]
}
```

The model does not:

* search the web
* call tools
* access SQLite
* persist data
* decide workflow steps

---

# 8. Output contract

The ranking call returns only ranked IDs:

```json
{
  "ranked_candidate_ids": [7, 2, 9, 4]
}
```

---

# 9. Output validation and retry policy

JavaScript validates model output.

Reject outputs with:

* malformed JSON
* missing required fields
* invalid candidate IDs
* duplicate IDs

Permit one bounded repair/retry pass if output is malformed.

If the second attempt also fails, mark the ranking as failed.

Do not silently repair arbitrary model output.

The screening response may omit any viable ID. The ranking response must include
every surviving candidate ID exactly once. If screening rejects everything,
report that no usable candidate remains rather than forcing selection.

---

# 10. Phase 1 evaluation harness

Phase 1 should be isolated from the real user workspace.

Flow:

```text
fixture JSON
    ↓
Gemma 4 E2B
    ↓
validated ranking JSON
    ↓
evaluation score
```

No OPFS writes are required in this phase.

This keeps the experiment focused entirely on ranking quality and runtime viability.

---

# 11. Fixture corpus

Create roughly 20 fixture cases across varied companies.

Each case should contain:

* company context
* bounded existing news
* 10 candidate articles
* expected acceptable top candidates
* obvious rejects
* known duplicate-event candidates where useful

Do not create a forced canonical 1–10 human ranking.

Prefer labels such as:

```text
acceptable top 3
obvious reject
duplicate event
borderline / ambiguous
```

This better reflects the inherently subjective nature of news ranking.

---

# 12. Deterministic baseline

Define a simple baseline before evaluating Gemma.

Example:

```text
score =
  source quality tier
  + recency weight
  - duplicate penalty
```

The baseline should already apply deterministic filtering for exact duplicates and malformed records.

Gemma does not need to beat the baseline on every fixture.

The point is to test whether semantic judgment adds useful value beyond simple metadata ranking.

---

# 13. Evaluation criteria

Record:

## Technical

* model download size
* first-load time
* cached-load time
* ranking latency
* valid JSON rate
* retry rate
* crash/OOM rate
* browser/backend used

## Quality

* top-3 agreement with fixture labels
* obvious-junk rejection
* duplicate-event rejection
* relevance of top-ranked items
* consistency across repeated runs
* improvement over deterministic baseline

Run each fixture multiple times at low temperature to observe stability.

---

# 14. Success threshold

Do not over-specify a production hardware envelope yet.

The first POC succeeds if:

1. Gemma 4 E2B runs locally in-browser with WebGPU
2. output is reliably machine-parseable with at most one retry
3. rankings are generally aligned with fixture top-candidate labels
4. obvious junk and duplicate-event candidates are usually rejected or ranked low
5. Gemma provides useful semantic improvement over the deterministic baseline
6. latency is acceptable for an explicit user-triggered workflow
7. repeated runs are reasonably stable
8. no frequent OOM/crash behavior occurs on the development hardware

If ranking quality is poor, do not spend time broadening browser/device support.

---

# 15. Automated testing

Automated tests should not require real WebGPU inference for every run.

Use:

```text
fake ranker
```

for deterministic pipeline tests covering:

* fixture loading
* normalization
* schema validation
* retry logic
* candidate ID validation
* shortfall handling
* reject-all handling
* baseline scoring

Run real Gemma inference as a separate benchmark/manual suite.

---

# 16. Debugging

Provide a development-only debug view that shows:

* fixture name
* model/backend
* prompt payload
* raw model output
* parsed ranking
* validation result
* baseline ranking
* timing metrics

Keep debug data in memory only.

Do not persist prompts or model outputs unless explicitly needed for benchmark artifacts.

---

# 17. Phase 2: integrate with Company Hub

Only after Phase 1 demonstrates useful ranking quality.

Phase 2 replaces fixtures with live prepared candidates.

Flow:

```text
Company Hub profile
    ↓
JS loads company + existing news
    ↓
candidate collector returns 10 normalized articles
    ↓
same Gemma ranker
    ↓
validated ranking
    ↓
preview selected articles
    ↓
user confirms
    ↓
existing addCompanyNews()
    ↓
SQLite / OPFS
```

Use a preview/confirm step initially rather than automatic persistence.

The ranking module itself should not change between Phase 1 and Phase 2.

---

# 18. Phase 2 candidate collector contract

Define the interface now, without implementing live search yet:

```js
async function collectNewsCandidates({
  company,
  existingNews,
  limit: 10
}) {
  return [
    {
      candidate_id,
      title,
      publisher,
      url,
      published_at,
      snippet
    }
  ];
}
```

This keeps future search/scraping/provider choices interchangeable.

---

# 19. Suggested structure

```text
poc-browser/js/news-ranking/
├── controller.js
├── normalize.js
├── baseline.js
├── ranker.js
├── schema.js
├── evaluator.js
├── fixtures/
│   ├── index.js
│   └── cases/
└── model/
    └── gemma.js
```

Optional benchmark output:

```text
poc-browser/docs/
└── gemma-news-ranking.md
```

---

# 20. Explicit non-goals

Do not include:

* autonomous agents
* tool calling
* OpenCode CLI
* `source_company`
* live web search in Phase 1
* Wasmer
* WebContainers
* remote LLM providers
* WASM/CPU fallback guarantees
* broad browser compatibility work
* model fine-tuning
* multi-agent orchestration
* embeddings/vector search
* scheduled news collection
* background execution
* automatic writes to the real workspace during Phase 1

---

# Final thesis

The model is not the workflow engine.

It is a bounded semantic component:

```text
structured candidates
      ↓
Gemma 4 E2B
      ↓
ranked candidate IDs
```

Everything else remains deterministic.

The POC should answer one question:

> **Is Gemma 4 E2B good enough, fast enough, and stable enough in-browser to provide useful semantic ranking over 10 preprocessed Company Hub news candidates?**
