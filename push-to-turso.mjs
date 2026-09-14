// push-to-turso.mjs
// Reads the generated SQL migration and executes it against Turso via HTTP API

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const TURSO_DATABASE_URL = "https://nearwork-db-aihunters.aws-ap-south-1.turso.io";
const TURSO_AUTH_TOKEN = "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODcyNTMxMjgsImlkIjoiMDFhMDIwOTYtNWMwMS03ZGVkLTgyNzktOGIwZTQ2YWM1Y2M0Iiwia2lkIjoieDVHRXUwcUI1SmhFTTNFZHctVXRaMG5iOGUta2VORnZ0aUZndGpuSXZHQSIsInJpZCI6IjI4MTY0MTlmLTUxOGQtNDQyMC1hYmZlLTI2NmUyMmQ1YzdhNCJ9.rkBcq3pPBrXiyANwesrpD2T6Yhz61lYU1CD_4chi9LRpuSr_N2m8_QydWwzbf-EmDxsxfacSlKTQ5iWEDKP5Bg";

// Read and strip BOM + normalize line endings
const rawSql = readFileSync(join(__dirname, 'prisma', 'turso_migrate.sql'), 'utf8');
const sqlFile = rawSql.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');

// Split on semicolons, keep only real SQL statements
const statements = sqlFile
  .split(';\n')
  .map(s => s.trim())
  .filter(s => {
    const noComments = s.split('\n').filter(l => !l.trim().startsWith('--')).join('\n').trim();
    return noComments.length > 0;
  });

console.log(`📦 Executing ${statements.length} SQL statements against Turso...`);

let success = 0;
let skipped = 0;

for (const stmt of statements) {
  const fullStmt = stmt + ';';
  
  // Skip comment-only statements
  const nonCommentLines = fullStmt.split('\n').filter(l => !l.trim().startsWith('--') && l.trim());
  if (nonCommentLines.length === 0) {
    skipped++;
    continue;
  }
  
  const cleanStmt = fullStmt.split('\n').filter(l => !l.trim().startsWith('--')).join('\n').trim();
  if (!cleanStmt || cleanStmt === ';') {
    skipped++;
    continue;
  }

  const body = JSON.stringify({
    requests: [
      { type: "execute", stmt: { sql: cleanStmt } },
      { type: "close" }
    ]
  });

  const res = await fetch(`${TURSO_DATABASE_URL}/v2/pipeline`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TURSO_AUTH_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body
  });

  const data = await res.json();
  
  if (!res.ok || data.results?.[0]?.type === 'error') {
    const errMsg = data.results?.[0]?.error?.message || JSON.stringify(data);
    // Ignore "already exists" errors
    if (errMsg.includes('already exists') || errMsg.includes('duplicate')) {
      console.log(`⚠️  Skipped (already exists): ${cleanStmt.substring(0, 60)}...`);
      skipped++;
    } else {
      console.error(`❌ Failed: ${cleanStmt.substring(0, 80)}`);
      console.error(`   Error: ${errMsg}`);
    }
  } else {
    console.log(`✅ OK: ${cleanStmt.substring(0, 70).replace(/\n/g, ' ')}...`);
    success++;
  }
}

console.log(`\n🎉 Done! ${success} succeeded, ${skipped} skipped.`);
