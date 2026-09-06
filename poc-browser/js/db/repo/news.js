import {required,optional,now,existing,owner,date,scraped} from './validation.js';
export function registerNews({register,query,run}) {
 const get=id=>{const row=query('SELECT id,company_id,title,source,url,published_at,summary,created_at,updated_at,is_scraped FROM news_articles WHERE id=?',[id])[0];return {...row,is_scraped:!!row.is_scraped};};
 const values=data=>[required(data.title,'title'),required(data.source,'source'),required(data.url,'url'),date(data.published_at),optional(data.summary,'summary')];
 register('news.add',({companyId,data})=>{existing(query,'companies',companyId,'Company not found');const at=now();run('INSERT INTO news_articles(company_id,title,source,url,published_at,summary,created_at,updated_at,is_scraped) VALUES (?,?,?,?,?,?,?,?,?)',[companyId,...values(data),at,at,Number(scraped(data.is_scraped))]);return get(query('SELECT last_insert_rowid() AS id')[0].id);},true);
 register('news.update',({companyId,id,data})=>{const old=owner(query,'news_articles',companyId,id,'News article');run('UPDATE news_articles SET title=?,source=?,url=?,published_at=?,summary=?,updated_at=?,is_scraped=? WHERE id=?',[...values(data),now(),Number(scraped(data.is_scraped,!!old.is_scraped)),id]);return get(id);},true);
 register('news.delete',({companyId,id})=>{owner(query,'news_articles',companyId,id,'News article');run('DELETE FROM news_articles WHERE id=?',[id]);return null;},true);
}
