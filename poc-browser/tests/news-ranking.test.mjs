import assert from 'node:assert/strict';
import {normalizeCandidates, canonicalUrl, validDate} from '../js/news-ranking/normalize.js';
import {validateRanking} from '../js/news-ranking/schema.js';
import {runFixture, runLiveRanking} from '../js/news-ranking/controller.js';
import {gdeltUrl, mapGdeltArticles} from '../js/news-ranking/gdelt.js';
import {currentsSearchUrl, mapCurrentsArticles, collectCurrentsCandidates} from '../js/news-ranking/currents.js';
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
assert.match(run.prompt, /<\|turn>user/); assert.equal(run.rawResponses.length, 2);
const invalid = {complete: async () => 'not json'};
await assert.rejects(() => runFixture({fixture: fixtures[0], requested: 2, model: invalid}), (error) => error.rawResponses?.length === 2 && error.prompt.includes("<|turn>model"));
assert.match(gdeltUrl('Toyota Motor'), /query=%22Toyota\+Motor%22/);
assert.match(gdeltUrl('Toyota Motor',{format:'jsonp',callback:'cb'}), /format=jsonp.*callback=cb/);
const gdeltCandidates = mapGdeltArticles({articles:[
  {title:'Toyota results',domain:'example.com',url:'https://example.com/results?utm_source=x',seendate:'20260906T120000Z'},
  {title:'Toyota results',domain:'example.com',url:'https://example.com/duplicate',seendate:'20260906T130000Z'},
]});
assert.equal(gdeltCandidates.length, 1);
assert.match(currentsSearchUrl('Toyota Motor'), /keywords=Toyota\+Motor/);
const currentsCandidates = mapCurrentsArticles({news:[{title:'Toyota results',author:'Reuters',url:'https://example.com/toyota-results?utm_source=x',published:'2026-09-06 12:00:00 +0000',description:'Quarterly results.'}]});
assert.equal(currentsCandidates[0].publisher, 'example.com');
assert.equal(currentsCandidates[0].published_at, '2026-09-06');
const currentsCollected = await collectCurrentsCandidates({company:{name:'Toyota'},apiKey:'test-key',fetchImpl:async (url, options) => ({ok:true,status:200,json:async()=>({status:'ok',news:[{title:'Toyota result',url:'https://example.com/current',published:'2026-09-06',description:'Current.'}]})})});
assert.equal(currentsCollected.length, 1);
const live = await runLiveRanking({company:{name:'Toyota',description:''},existingNews:[{title:'Old',url:'https://old.test',published_at:'2026-09-01'}],requested:1,model:{complete:async()=>'{"ranked_candidate_ids":[1],"reject_ids":[]}'},collectCandidates:async()=>gdeltCandidates});
assert.equal(live.selected[0].title,'Toyota results');
globalThis.window = {}; globalThis.document = {};
const browserCollected = await (await import('../js/news-ranking/gdelt.js')).collectNewsCandidates({company:{name:'Toyota'},jsonpImpl:async()=>({articles:[{title:'Browser result',domain:'example.com',url:'https://example.com/browser',seendate:'20260906T120000Z'}]})});
assert.equal(browserCollected[0].title,'Browser result');
delete globalThis.window; delete globalThis.document;
console.log('PASS news ranking deterministic pipeline');
