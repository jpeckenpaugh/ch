export function error(status,message) { return Object.assign(new Error(message),{status,detail:message}); }
export function required(value,field) { if(typeof value!=='string'||!value.trim())throw error(422,`${field} must not be empty`);return value.trim(); }
export function optional(value,field) { if(value==null)return null;if(typeof value!=='string')throw error(422,`${field} must be a string`);return value; }
export function now() { return new Date().toISOString().replace(/\.\d{3}Z$/,'Z'); }
export function existing(query,table,id,message) {const row=query(`SELECT * FROM ${table} WHERE id=?`,[id])[0];if(!row)throw error(404,message);return row;}
export function owner(query,table,companyId,id,label) {
 existing(query,'companies',companyId,'Company not found');
 const row=query(`SELECT * FROM ${table} WHERE company_id=? AND id=?`,[companyId,id])[0];if(!row)throw error(404,`${label} not found`);return row;
}
export function date(value) {
 const text=required(value,'published_at');const parts=/^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
 if(!parts)throw error(422,'published_at must be a valid YYYY-MM-DD date');
 const [,y,m,d]=parts.map(Number);const leap=y%4===0&&(y%100!==0||y%400===0);const days=[31,leap?29:28,31,30,31,30,31,31,30,31,30,31];
 if(y<1||m<1||m>12||d<1||d>days[m-1])throw error(422,'published_at must be a valid YYYY-MM-DD date');return text;
}
export function scraped(value,fallback=false) {if(value==null)return fallback;if(typeof value!=='boolean')throw error(422,'is_scraped must be a boolean');return value;}
