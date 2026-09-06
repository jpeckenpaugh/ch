export function registerIndustries({register,query}) {
  register('industries.list', () => query('SELECT id,name FROM industries ORDER BY lower(name),name'));
}
