const selection = `SELECT c.id,c.name,c.industry_id,c.website,c.contact_email,c.contact_phone,
 c.description,c.created_at,c.updated_at,i.name AS industry_name,
 (SELECT l.city || ', ' || l.country_code FROM locations l
  WHERE l.company_id=c.id AND l.type='Headquarters' ORDER BY l.id LIMIT 1) AS hq_location
 FROM companies c LEFT JOIN industries i ON i.id=c.industry_id`;
export function companyItem(row) {
  return {id:row.id,name:row.name,
    industry:row.industry_name === null ? null : {id:row.industry_id,name:row.industry_name},
    hq_location:row.hq_location,website:row.website,contact_email:row.contact_email,
    contact_phone:row.contact_phone,description:row.description,created_at:row.created_at,
    updated_at:row.updated_at,is_complete:!!(row.name && row.industry_id !== null && row.website && row.contact_email && row.contact_phone && row.description),
    artifacts_count:0,logo_url:null};
}
export function registerCompanies({register,query}) {
  function getItem(id) {
    const row = query(`${selection} WHERE c.id=?`, [id])[0];
    if (!row) throw Object.assign(new Error('Company not found'),{status:404,detail:'Company not found'});
    return companyItem(row);
  }
  register('companies.list', ({q,countries} = {}) => {
    const where = [], params = [];
    if (q) { where.push('lower(c.name) LIKE lower(?)'); params.push(`%${q}%`); }
    if (countries?.length) {
      const codes = countries.map(code => code.trim()).filter(Boolean);
      if (!codes.length) return [];
      where.push(`EXISTS (SELECT 1 FROM locations filter_location WHERE filter_location.company_id=c.id AND filter_location.country_code IN (${codes.map(()=>'?').join(',')}))`);
      params.push(...codes);
    }
    return query(`${selection}${where.length ? ` WHERE ${where.join(' AND ')}` : ''} ORDER BY c.id ASC`, params).map(companyItem);
  });
  register('companies.get', ({id}) => ({...getItem(id),
    locations:query(`SELECT l.id,l.company_id,l.label,l.address,l.city,l.country_code,l.type,c.name AS country_name FROM locations l LEFT JOIN countries c ON c.code=l.country_code WHERE l.company_id=? ORDER BY l.id ASC`,[id]),
    references:query('SELECT id,company_id,title,url,description,added_by,created_at,updated_at FROM "references" WHERE company_id=? ORDER BY id DESC',[id]),
    news:query('SELECT id,company_id,title,source,url,published_at,summary,created_at,updated_at,is_scraped FROM news_articles WHERE company_id=? ORDER BY id DESC',[id]).map(row=>({...row,is_scraped:!!row.is_scraped})),
    artifacts:[],
  }));
  return {getItem};
}
