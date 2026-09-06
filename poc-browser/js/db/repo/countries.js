export function registerCountries({register,query}) {
  register('countries.list', () => query('SELECT code,name FROM countries ORDER BY lower(name),name'));
}
