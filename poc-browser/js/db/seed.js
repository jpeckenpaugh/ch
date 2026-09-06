let cached;
export async function seedBytes(SQL, probe) {
  if (!cached) {
    if (probe) {
      const db = new SQL.Database();
      try { db.run('CREATE TABLE probe (id INTEGER PRIMARY KEY AUTOINCREMENT, value TEXT NOT NULL)'); cached = db.export(); }
      finally { db.close(); }
    } else {
      const response = await fetch(new URL('../../data/seed.db', import.meta.url));
      if (!response.ok) throw new Error(`Unable to load workspace seed (${response.status})`);
      cached = new Uint8Array(await response.arrayBuffer());
    }
  }
  return cached;
}
