// Run isolated suites sequentially: each owns and releases ports 8011/9231.
import {spawn} from 'node:child_process';
import {writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root = fileURLToPath(new URL('../../', import.meta.url));
const suites = [
  'read-contract.test.mjs', 'write-contract.test.mjs', 'import-contract.test.mjs',
  'persistence.test.mjs', 'read-ui.test.mjs', 'write-ui.test.mjs', 'portability.test.mjs',
];
if (process.argv.includes('--metrics')) suites.push('metrics.test.mjs');
const results = [];
for (const suite of suites) {
  const start = Date.now();
  console.log(`Running ${suite}`);
  const exitCode = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [`poc-browser/tests/${suite}`], {cwd: root, stdio:'inherit'});
    child.once('error', reject);
    child.once('exit', (code, signal) => resolve(signal ? 1 : code));
  });
  results.push({suite, exitCode, milliseconds:Date.now()-start});
  if (exitCode !== 0) {
    process.exitCode = 1;
    break;
  }
}
await writeFile(new URL('./stage-5-results.json', import.meta.url), JSON.stringify({testedAt:new Date().toISOString(),results},null,2)+'\n');
if (!process.exitCode) console.log(`PASS all ${results.length} suites`);
