import {required,error,now,existing} from './validation.js';
export function registerIndustries({register,query,run}) {
  register('industries.list', () => query('SELECT id,name FROM industries ORDER BY lower(name),name'));
  const get=id=>query('SELECT id,name FROM industries WHERE id=?',[id])[0];
  function name(value,id=null) {const text=required(value,'name');if(query('SELECT id FROM industries WHERE lower(name)=lower(?) AND (? IS NULL OR id<>?)',[text,id,id]).length)throw error(409,'Industry already exists');return text;}
  register('industries.create',payload=>{run('INSERT INTO industries(name,created_at) VALUES (?,?)',[name(payload.name),now()]);return get(query('SELECT last_insert_rowid() AS id')[0].id);},true);
  register('industries.update',({id,name:value})=>{existing(query,'industries',id,'Industry not found');run('UPDATE industries SET name=? WHERE id=?',[name(value,id),id]);return get(id);},true);
}
