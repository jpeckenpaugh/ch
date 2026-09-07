import {registerCompanies} from './companies.js';
import {registerCountries} from './countries.js';
import {registerIndustries} from './industries.js';
import {locationOperations} from './locations.js';
import {registerReferences} from './references.js';
import {registerNews} from './news.js';
import {registerCompanyWrites} from './company-writes.js';
import {registerSettings} from './settings.js';
import {error} from './validation.js';
// Helpers are closures over the current worker DB, never a retained DB handle.
export function registerOperations(context) {
  const register = context.register;
  context = {...context, register(name, handler, write = false) {
    register(name, (payload = {}) => {
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        throw error(422, 'Operation payload must be an object');
      }
      if (write && !name.startsWith('industries.') && !name.endsWith('.delete')) {
        if (!payload.data || typeof payload.data !== 'object' || Array.isArray(payload.data)) {
          throw error(422, 'Record data must be an object');
        }
        if (name === 'companies.create' && Array.isArray(payload.locations) &&
            payload.locations.some(row => !row || typeof row !== 'object' || Array.isArray(row))) {
          throw error(422, 'Each location must be an object');
        }
      }
      return handler(payload);
    }, write);
  }};
  const companies=registerCompanies(context);
  registerCountries(context);
  registerIndustries(context);
  const locations=locationOperations(context);
  registerReferences(context);
  registerNews(context);
  registerCompanyWrites(context,companies,locations);
  registerSettings(context);
}
