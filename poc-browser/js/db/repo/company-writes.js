import {required,optional,now,error,existing} from './validation.js';
export function registerCompanyWrites({register,query,run},{getItem},{add}) {
 function values(data) {
  const name=required(data.name,'name'),industry=data.industry_id??null;
  if(industry!==null&&(!Number.isInteger(industry)||!query('SELECT id FROM industries WHERE id=?',[industry]).length))throw error(422,'Unknown industry_id');
  return [name,industry,...['website','contact_email','contact_phone','description'].map(key=>optional(data[key],key))];
 }
 register('companies.create',({data,locations=[]})=>{
  if(!Array.isArray(locations))throw error(422,'locations must be an array');
  const at=now();run('INSERT INTO companies(name,industry_id,website,contact_email,contact_phone,description,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)',[...values(data),at,at]);
  const id=query('SELECT last_insert_rowid() AS id')[0].id;for(const location of locations)add(id,location);return getItem(id);
 },true);
 register('companies.update',({id,data})=>{existing(query,'companies',id,'Company not found');run('UPDATE companies SET name=?,industry_id=?,website=?,contact_email=?,contact_phone=?,description=?,updated_at=? WHERE id=?',[...values(data),now(),id]);return getItem(id);},true);
 register('companies.delete',({id})=>{existing(query,'companies',id,'Company not found');run('DELETE FROM companies WHERE id=?',[id]);return null;},true);
}
