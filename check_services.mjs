const TURSO_DATABASE_URL = 'https://nearwork-db-aihunters.aws-ap-south-1.turso.io';
const TURSO_AUTH_TOKEN = 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODcyNTMxMjgsImlkIjoiMDFhMDIwOTYtNWMwMS03ZGVkLTgyNzktOGIwZTQ2YWM1Y2M0Iiwia2lkIjoieDVHRXUwcUI1SmhFTTNFZHctVXRaMG5iOGUta2VORnZ0aUZndGpuSXZHQSIsInJpZCI6IjI4MTY0MTlmLTUxOGQtNDQyMC1hYmZlLTI2NmUyMmQ1YzdhNCJ9.rkBcq3pPBrXiyANwesrpD2T6Yhz61lYU1CD_4chi9LRpuSr_N2m8_QydWwzbf-EmDxsxfacSlKTQ5iWEDKP5Bg';

async function q(sql) {
  const res = await fetch(TURSO_DATABASE_URL + '/v2/pipeline', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + TURSO_AUTH_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ requests: [{ type: 'execute', stmt: { sql } }, { type: 'close' }] })
  });
  const data = await res.json();
  const rows = data.results?.[0]?.response?.result?.rows || [];
  const cols = data.results?.[0]?.response?.result?.cols || [];
  return rows.map(row => { const o = {}; cols.forEach((c,i) => o[c.name] = row[i]?.value); return o; });
}

async function main() {
  const cats = await q('SELECT id, name, slug FROM "ServiceCategory"');
  console.log('CATEGORIES:', JSON.stringify(cats, null, 2));
  const srvs = await q('SELECT id, name, basePrice, categoryId, imageUrl FROM "Service"');
  console.log('SERVICES:', JSON.stringify(srvs, null, 2));
}
main().catch(console.error);
