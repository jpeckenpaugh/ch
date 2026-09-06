// Canonical server schema; no browser-specific tables are added to snapshots.
export const SCHEMA_REVISION = '0003_sprint03_roles';
export const EXPECTED_TABLES = {
  alembic_version: ['version_num'],
  companies: ['id', 'name', 'industry_id', 'website', 'contact_email', 'contact_phone', 'description', 'created_at', 'updated_at'],
  industries: ['id', 'name', 'created_at'],
  countries: ['id', 'code', 'name', 'created_at'],
  locations: ['id', 'company_id', 'label', 'address', 'city', 'country_code', 'type'],
  references: ['id', 'company_id', 'title', 'url', 'description', 'added_by', 'created_at', 'updated_at'],
  news_articles: ['id', 'company_id', 'title', 'source', 'url', 'published_at', 'summary', 'created_at', 'updated_at', 'is_scraped'],
  artifacts: ['id', 'company_id'],
  users: ['id', 'email'],
  oauth_accounts: ['id', 'user_id'],
  access_tokens: ['token', 'user_id'],
};

function rows(database, sql) {
  const statement = database.prepare(sql);
  try {
    const result = [];
    while (statement.step()) result.push(statement.getAsObject());
    return result;
  } finally { statement.free(); }
}

export function validateSchema(database) {
  const tables = new Set(rows(database, "SELECT name FROM sqlite_master WHERE type='table'").map(row => row.name));
  for (const [table, columns] of Object.entries(EXPECTED_TABLES)) {
    if (!tables.has(table)) throw new Error(`This is not a Company Hub database: missing ${table}.`);
    const present = new Set(rows(database, `PRAGMA table_info("${table}")`).map(row => row.name));
    if (columns.some(column => !present.has(column))) {
      throw new Error(`This Company Hub database has an incompatible ${table} table.`);
    }
  }
  const revisions = rows(database, 'SELECT version_num FROM alembic_version');
  if (revisions.length !== 1 || revisions[0].version_num !== SCHEMA_REVISION) {
    throw new Error('This Company Hub database uses an unsupported schema version.');
  }
}

// Caller owns closing the returned candidate. Validation never touches the live DB.
export function openValidatedImport(SQL, input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const signature = 'SQLite format 3\0';
  if (bytes.length < 100 || [...signature].some((char, index) => bytes[index] !== char.charCodeAt(0))) {
    throw new Error('Choose a valid SQLite database file.');
  }
  let candidate;
  try {
    candidate = new SQL.Database(bytes);
    validateSchema(candidate);
    const integrity = rows(candidate, 'PRAGMA integrity_check');
    if (integrity.length !== 1 || integrity[0].integrity_check !== 'ok') {
      throw new Error('This SQLite database failed its integrity check.');
    }
    if (rows(candidate, 'PRAGMA foreign_key_check').length) {
      throw new Error('This Company Hub database contains broken relationships.');
    }
    candidate.run('PRAGMA foreign_keys=ON');
    return candidate;
  } catch (error) {
    candidate?.close();
    throw error;
  }
}
