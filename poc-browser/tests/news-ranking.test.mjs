import assert from 'node:assert/strict';
import {normalizeCandidates, canonicalUrl, validDate} from '../js/news-ranking/normalize.js';
import {validateRanking} from '../js/news-ranking/schema.js';
import {runFixture} from '../js/news-ranking/controller.js';
import {fixtures} from '../js/news-ranking/fixtures/index.js';

assert.equal(canonicalUrl('https://Example.test/path/?utm_source=x#top'), 'https://example.test/path');
assert.equal(validDate('2026-02-29'), false);
assert.equal(normalizeCandidates([{candidate_id:1,title:' A ',publisher:'P',url:'https://a.test/?utm_x=1',published_at:'2026-09-01',snippet:'x'}, {candidate_id:2,title:'a',publisher:'P',url:'https://b.test',published_at:'2026-09-01',snippet:'x'}]).length, 1);
const candidates = fixtures[0].candidates;
assert.deepEqual(validateRanking('{"ranked_candidate_ids":[1,2],"reject_ids":[3]}', candidates).ranked_candidate_ids, [1,2]);
assert.throws(() => validateRanking('{"ranked_candidate_ids":[1,1],"reject_ids":[]}', candidates));
let calls = 0;
const fake = {complete: async () => ++calls === 1 ? 'nope' : '{"ranked_candidate_ids":[1,2,8],"reject_ids":[4,5,7,9]}' };
const run = await runFixture({fixture: fixtures[0], requested: 2, model: fake});
assert.equal(run.attempts, 2); assert.deepEqual(run.selected, [1,2]);
console.log('PASS news ranking deterministic pipeline');
