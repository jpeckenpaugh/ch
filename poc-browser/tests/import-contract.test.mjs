import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import initSqlJs from '../vendor/sql.js/sql-wasm.js';
import {openValidatedImport} from '../js/db/schema.js';
const SQL = await initSqlJs({locateFile: () => new URL('../vendor/sql.js/sql-wasm.wasm', import.meta.url).pathname});
const seed = new Uint8Array(await readFile(new URL('../data/seed.db', import.meta.url)));
const candidate = openValidatedImport(SQL, seed);
assert.equal(candidate.exec('PRAGMA foreign_keys')[0].values[0][0], 1);
candidate.close();
assert.throws(() => openValidatedImport(SQL, new Uint8Array(100)), /valid SQLite/);
assert.throws(() => openValidatedImport(SQL, seed.subarray(0,100)), /./);
for (const [sql, message] of [
  ['UPDATE alembic_version SET version_num="future"', /unsupported schema version/],
  ['DROP TABLE news_articles', /missing news_articles/],
  ['ALTER TABLE companies RENAME COLUMN name TO unrelated', /incompatible companies/],
  ['PRAGMA foreign_keys=OFF; UPDATE companies SET industry_id=999999', /broken relationships/],
]) {
  const invalid = new SQL.Database(seed);
  invalid.run(sql);
  assert.throws(() => openValidatedImport(SQL, invalid.export()), message);
  invalid.close();
}
const unrelated = new SQL.Database();
unrelated.run('CREATE TABLE unrelated(id INTEGER)');
assert.throws(() => openValidatedImport(SQL, unrelated.export()), /not a Company Hub database/);
unrelated.close();
console.log('PASS import validation: canonical, header, truncation, unrelated, missing columns/tables, revision, foreign keys');
