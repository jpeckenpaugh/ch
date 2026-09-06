import {required,optional,error,existing,owner} from './validation.js';
export function locationOperations({register,query,run}) {
 const get=id=>query('SELECT l.id,l.company_id,l.label,l.address,l.city,l.country_code,l.type,c.name AS country_name FROM locations l LEFT JOIN countries c ON c.code=l.country_code WHERE l.id=?',[id])[0];
 function values(companyId,data,id=null) {
  const label=required(data.label,'label'),city=required(data.city,'city'),country=required(data.country_code,'country_code');
  if(!['Headquarters','Office','Plant','Other'].includes(data.type))throw error(422,'Invalid location type');
  if(!query('SELECT code FROM countries WHERE code=?',[country]).length)throw error(422,'Unknown country_code');
  if(data.type==='Headquarters'&&query("SELECT id FROM locations WHERE company_id=? AND type='Headquarters' AND (? IS NULL OR id<>?)",[companyId,id,id]).length)throw error(422,'Company already has a Headquarters');
  return [label,optional(data.address,'address'),city,country,data.type];
 }
 function add(companyId,data) {
  existing(query,'companies',companyId,'Company not found');
  run('INSERT INTO locations(company_id,label,address,city,country_code,type) VALUES (?,?,?,?,?,?)',[companyId,...values(companyId,data)]);
  return get(query('SELECT last_insert_rowid() AS id')[0].id);
 }
 register('locations.add',({companyId,data})=>add(companyId,data),true);
 register('locations.update',({companyId,id,data})=>{owner(query,'locations',companyId,id,'Location');run('UPDATE locations SET label=?,address=?,city=?,country_code=?,type=? WHERE id=?',[...values(companyId,data,id),id]);return get(id);},true);
 register('locations.delete',({companyId,id})=>{owner(query,'locations',companyId,id,'Location');run('DELETE FROM locations WHERE id=?',[id]);return null;},true);
 return {add};
}
