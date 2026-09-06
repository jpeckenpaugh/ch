import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import initSqlJs from '../vendor/sql.js/sql-wasm.js';
import {registerOperations} from '../js/db/repo/index.js';
const SQL=await initSqlJs({locateFile:()=>new URL('../vendor/sql.js/sql-wasm.wasm',import.meta.url).pathname});
const db=new SQL.Database(await readFile(new URL('../data/seed.db',import.meta.url)));
db.run('PRAGMA foreign_keys=ON');
const operations=new Map();
const query=(sql,params=[])=>{const stmt=db.prepare(sql);try{stmt.bind(params);const rows=[];while(stmt.step())rows.push(stmt.getAsObject());return rows;}finally{stmt.free();}};
registerOperations({register:(name,handler,write=false)=>operations.set(name,{handler,write}),query,run:(sql,params=[])=>db.run(sql,params)});
async function call(name,payload={}) {
 const entry=operations.get(name);assert.ok(entry,`Registered ${name}`);
 if(!entry.write)return entry.handler(payload);
 db.run('BEGIN');try{const result=await entry.handler(payload);db.run('COMMIT');return result;}catch(error){db.run('ROLLBACK');throw error;}
}
const rejects=(name,payload,status)=>assert.rejects(call(name,payload),error=>error.status===status);
const timestamp=value=>assert.match(value,/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
let checks=0;
async function check(name,fn){await fn();checks++;console.log(`PASS ${name}`);}
const companyData={name:'Contract company',industry_id:1,website:'https://example.test',contact_email:'a@example.test',contact_phone:'123',description:'Description'};
const locationData={label:'HQ',city:'London',country_code:'GB',type:'Headquarters',address:'Road'};
const referenceData={title:' Reference ',url:' https://example.test/reference ',description:'Details'};
const newsData={title:' News ',source:' Source ',url:' https://example.test/news ',published_at:'2024-02-29',summary:'Summary',is_scraped:true};
try {
 const company=await call('companies.create',{data:companyData});
 const other=await call('companies.create',{data:{name:'Other'}});
 await check('company validation and full replacement',async()=>{
  await rejects('companies.create',{data:null},422);
  await rejects('companies.create',{data:{name:'Invalid aggregate'},locations:[null]},422);
  timestamp(company.created_at);timestamp(company.updated_at);assert.equal(company.is_complete,true);
  await rejects('companies.create',{data:{name:'  '}},422);
  await rejects('companies.update',{id:company.id,data:{name:'ok',industry_id:99999}},422);
  await rejects('companies.create',{data:{name:'ok',industry_id:99999}},422);
  const replaced=await call('companies.update',{id:company.id,data:{name:' Replacement '}});
  assert.equal(replaced.name,'Replacement');assert.equal(replaced.industry,null);
  for(const key of ['website','contact_email','contact_phone','description'])assert.equal(replaced[key],null);
  assert.equal(replaced.created_at,company.created_at);assert.equal(replaced.is_complete,false);timestamp(replaced.updated_at);
 });
 const parentTimestamp=(await call('companies.get',{id:company.id})).updated_at;
 const hq=await call('locations.add',{companyId:company.id,data:locationData});
 await check('location validation, headquarters uniqueness and replacement',async()=>{
  assert.equal(hq.country_name,'United Kingdom');
  await rejects('locations.add',{companyId:company.id,data:locationData},422);
  await rejects('locations.add',{companyId:company.id,data:{...locationData,country_code:'gb',type:'Office'}},422);
  await rejects('locations.add',{companyId:company.id,data:{...locationData,type:'Warehouse'}},422);
  const updated=await call('locations.update',{companyId:company.id,id:hq.id,data:{...locationData,address:undefined,city:' Bath '}});
  assert.equal(updated.address,null);assert.equal(updated.city,'Bath');
  assert.equal((await call('companies.get',{id:company.id})).hq_location,'Bath, GB');
  const branch=await call('locations.add',{companyId:company.id,data:{...locationData,type:'Office'}});
  await rejects('locations.update',{companyId:company.id,id:branch.id,data:locationData},422);
  await call('locations.delete',{companyId:company.id,id:hq.id});
  assert.equal((await call('companies.get',{id:company.id})).hq_location,null);
 });
 const ref=await call('references.add',{companyId:company.id,data:referenceData});
 const news=await call('news.add',{companyId:company.id,data:newsData});
 await check('reference attribution and news dates/flag replacement',async()=>{
  assert.equal(ref.title,'Reference');assert.equal(ref.url,'https://example.test/reference');assert.equal(ref.added_by,'Workspace owner');
  timestamp(ref.created_at);assert.equal(ref.updated_at,ref.created_at);
  const edited=await call('references.update',{companyId:company.id,id:ref.id,data:{title:'Edited',url:'not-a-validated-url',added_by:'forged'}});
  assert.equal(edited.added_by,ref.added_by);assert.equal(edited.created_at,ref.created_at);assert.equal(edited.description,null);timestamp(edited.updated_at);
  assert.equal(news.title,'News');assert.equal(news.source,'Source');assert.equal(news.is_scraped,true);timestamp(news.created_at);
  const data={title:'Edited',source:'Source',url:'not-validated',published_at:'2026-09-06'};
  const editedNews=await call('news.update',{companyId:company.id,id:news.id,data});
  assert.equal(editedNews.is_scraped,true);assert.equal(editedNews.summary,null);assert.equal(editedNews.created_at,news.created_at);timestamp(editedNews.updated_at);
  assert.equal((await call('news.update',{companyId:company.id,id:news.id,data:{...data,is_scraped:null}})).is_scraped,true);
  assert.equal((await call('news.update',{companyId:company.id,id:news.id,data:{...data,is_scraped:false}})).is_scraped,false);
  assert.equal((await call('news.add',{companyId:company.id,data})).is_scraped,false);
  for(const date of ['2023-02-29','2024-02-30','2026-13-01','2026-00-01','2026-01-00','2026-9-01','0000-01-01','not-date'])await rejects('news.add',{companyId:company.id,data:{...data,published_at:date}},422);
 });
 await check('every child resource enforces parent ownership',async()=>{
  const loc=(await call('companies.get',{id:company.id})).locations[0];
  for(const [prefix,id,data] of [['locations',loc.id,locationData],['references',ref.id,referenceData],['news',news.id,newsData]]){
   await rejects(`${prefix}.update`,{companyId:other.id,id,data},404);
   await rejects(`${prefix}.delete`,{companyId:other.id,id},404);
   await rejects(`${prefix}.add`,{companyId:99999,data},404);
   await rejects(`${prefix}.update`,{companyId:company.id,id:99999,data},404);
   await rejects(`${prefix}.delete`,{companyId:company.id,id:99999},404);
   assert.ok((await call('companies.get',{id:company.id}))[prefix==='news'?'news':prefix].some(row=>row.id===id));
  }
 });
 assert.equal((await call('companies.get',{id:company.id})).updated_at,parentTimestamp,'child edits preserve company timestamp');
 await check('industry case uniqueness and joined rename',async()=>{
  const industry=await call('industries.create',{name:' Test industry '});
  await rejects('industries.create',{name:'TEST INDUSTRY'},409);
  await rejects('industries.create',{name:' '},422);
  await rejects('industries.update',{id:industry.id,name:'technology'},409);
  await rejects('industries.update',{id:99999,name:'unknown'},404);
  await call('companies.update',{id:company.id,data:{name:'Company',industry_id:industry.id}});
  await call('industries.update',{id:industry.id,name:'TEST INDUSTRY'});
  assert.equal((await call('companies.get',{id:company.id})).industry.name,'TEST INDUSTRY');
 });
 await check('atomic company/locations rejects without partial company',async()=>{
  const before=await call('companies.list');
  await rejects('companies.create',{data:{name:'Must rollback'},locations:[locationData,locationData]},422);
  assert.deepEqual(await call('companies.list'),before);
  await rejects('companies.create',{data:{name:'Must rollback'},locations:[locationData,{...locationData,type:'Office',country_code:'ZZ'}]},422);
  assert.deepEqual(await call('companies.list'),before);
  const created=await call('companies.create',{data:{name:'Aggregate'},locations:[locationData,{...locationData,type:'Office'}]});
  assert.equal((await call('companies.get',{id:created.id})).locations.length,2);
 });
 await check('deletion cascades and missing objects reject',async()=>{
  await call('companies.delete',{id:company.id});
  for(const table of ['locations','references','news_articles','artifacts'])assert.equal(query(`SELECT count(*) AS n FROM "${table}" WHERE company_id=?`,[company.id])[0].n,0);
  await rejects('companies.get',{id:company.id},404);
  await rejects('companies.update',{id:company.id,data:{name:'Gone'}},404);
  await rejects('companies.delete',{id:company.id},404);
  assert.deepEqual(query('PRAGMA foreign_key_check'),[]);
 });
 console.log(`PASS ${checks} domain contract groups`);
} finally {db.close();}
