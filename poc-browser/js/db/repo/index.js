import {registerCompanies} from './companies.js';
import {registerCountries} from './countries.js';
import {registerIndustries} from './industries.js';
// Helpers are closures over the current worker DB, never a retained DB handle.
export function registerOperations(context) {
  registerCompanies(context);
  registerCountries(context);
  registerIndustries(context);
}
