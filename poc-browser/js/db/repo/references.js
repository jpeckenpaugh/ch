import {required,optional,now,existing,owner} from './validation.js';
export function registerReferences({register,query,run}) {
 const get=id=>query('SELECT id,company_id,title,url,description,added_by,created_at,updated_at FROM "references" WHERE id=?',[id])[0];
 const values=data=>[required(data.title,'title'),required(data.url,'url'),optional(data.description,'description')];
 register('references.add',({companyId,data})=>{existing(query,'companies',companyId,'Company not found');const at=now();run('INSERT INTO "references"(company_id,title,url,description,added_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?)',[companyId,...values(data),'Workspace owner',at,at]);return get(query('SELECT last_insert_rowid() AS id')[0].id);},true);
 register('references.update',({companyId,id,data})=>{owner(query,'"references"',companyId,id,'Reference');run('UPDATE "references" SET title=?,url=?,description=?,updated_at=? WHERE id=?',[...values(data),now(),id]);return get(id);},true);
 register('references.delete',({companyId,id})=>{owner(query,'"references"',companyId,id,'Reference');run('DELETE FROM "references" WHERE id=?',[id]);return null;},true);
}
