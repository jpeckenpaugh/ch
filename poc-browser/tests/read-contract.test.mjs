import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import initSqlJs from '../vendor/sql.js/sql-wasm.js';
import {registerOperations} from '../js/db/repo/index.js';
const SQL=await initSqlJs({locateFile:()=>new URL('../vendor/sql.js/sql-wasm.wasm',import.meta.url).pathname});
const db=new SQL.Database(await readFile(new URL('../data/seed.db',import.meta.url)));
db.run('PRAGMA foreign_keys=ON');
const operations=new Map();
const query=(sql,params=[])=>{const stmt=db.prepare(sql);try {stmt.bind(params);const rows=[];while(stmt.step())rows.push(stmt.getAsObject());return rows;}finally{stmt.free();}};
registerOperations({register:(name,handler,write)=>{operations.set(name,handler);},query,run:(sql,params)=>db.run(sql,params)});
const call=(name,payload={})=>operations.get(name)(payload);
try {
 const companies=call('companies.list');assert.equal(companies.length,6);
 assert.deepEqual(companies.map(c=>c.id),[...companies.map(c=>c.id)].sort((a,b)=>a-b));
 const keys=['id','name','industry','hq_location','website','contact_email','contact_phone','description','created_at','updated_at','is_complete','artifacts_count','logo_url'].sort();
 for(const company of companies){assert.deepEqual(Object.keys(company).sort(),keys);assert.equal(typeof company.is_complete,'boolean');assert.equal(company.artifacts_count,0);assert.equal(company.logo_url,null);}
 assert.equal(call('countries.list').length,83);assert.equal(call('industries.list').length,6);
 for(const row of call('countries.list'))assert.deepEqual(Object.keys(row).sort(),['code','name']);
 for(const row of call('industries.list'))assert.deepEqual(Object.keys(row).sort(),['id','name']);
 const profile=call('companies.get',{id:companies[0].id});
 assert.deepEqual(profile.artifacts,[]);assert.ok(profile.locations.length);assert.ok(profile.references.length>=2);assert.ok(profile.news.length>=3);
 for(const name of ['locations','references','news']){const ids=profile[name].map(x=>x.id);assert.deepEqual(ids,[...ids].sort((a,b)=>name==='locations'?a-b:b-a));}
 assert.equal(typeof profile.news[0].is_scraped,'boolean');assert.equal(typeof profile.locations[0].country_name,'string');
 assert.deepEqual(call('companies.list',{q:companies[0].name.toUpperCase()}).map(c=>c.id),[companies[0].id]);
 assert.equal(call('companies.list',{q:'%'}).length,6);assert.equal(call('companies.list',{countries:[]}).length,6);assert.equal(call('companies.list',{countries:null}).length,6);
 assert.deepEqual(call('companies.list',{countries:[' ','']}),[]);assert.deepEqual(call('companies.list',{countries:['ZZ']}),[]);
 const country=profile.locations[0].country_code;const match=call('companies.list',{countries:[country,country]});assert.equal(new Set(match.map(c=>c.id)).size,match.length);assert.ok(match.some(c=>c.id===profile.id));
 assert.deepEqual(call('companies.list',{q:'nonexistent-name-zzzz',countries:[country]}),[]);
 assert.throws(()=>call('companies.get',{id:999999}),error=>error.status===404 && error.message==='Company not found');
 // Controlled fixture changes only in memory cover null derivation and live joins.
 db.run('UPDATE companies SET industry_id=NULL,website=NULL WHERE id=?',[profile.id]);db.run('DELETE FROM locations WHERE company_id=?',[profile.id]);
 const incomplete=call('companies.get',{id:profile.id});assert.equal(incomplete.industry,null);assert.equal(incomplete.hq_location,null);assert.equal(incomplete.is_complete,false);
 db.run("UPDATE companies SET industry_id=1,website=' ',contact_email='a',contact_phone='b',description='c' WHERE id=?",[profile.id]);
 assert.equal(call('companies.get',{id:profile.id}).is_complete,true);
 db.run("UPDATE industries SET name='Renamed industry' WHERE id=1");assert.equal(call('companies.get',{id:profile.id}).industry.name,'Renamed industry');
 const otherCountry=call('countries.list').find(c=>c.code!==country).code;
 db.run("INSERT INTO locations(company_id,label,city,country_code,type) VALUES (?,'Branch','Test city',?,'Office')",[profile.id,otherCountry]);
 assert.ok(call('companies.list',{countries:[otherCountry]}).some(c=>c.id===profile.id));assert.equal(call('companies.get',{id:profile.id}).hq_location,null);
 console.log('PASS read contract: canonical seed, exact keys/types, ordering, wildcard search, filters, profile joins, completeness, 404, live industry rename');
} finally {db.close();}
