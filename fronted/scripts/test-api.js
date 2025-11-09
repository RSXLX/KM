// Simple Node test script to verify API calls and logging
// Usage: node scripts/test-api.js

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080/api/v1';

async function run() {
  const results = [];
  const log = (title, obj) => {
    console.log(`\n=== ${title} ===`);
    console.log(typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2));
  };

  try {
    // Markets
    const mRes = await fetch(`${BASE}/compat/markets?page=1&limit=5`);
    const mJson = await mRes.json();
    results.push({ name: 'markets', ok: mRes.ok, status: mRes.status });
    log('Markets response', mJson);
  } catch (e) {
    console.error('Markets error', e);
  }

  try {
    // Database health
    const dRes = await fetch('http://localhost:3000/api/database/health');
    const dJson = await dRes.json();
    results.push({ name: 'db health', ok: dRes.ok, status: dRes.status });
    log('DB Health response', dJson);
  } catch (e) {
    console.error('DB health error', e);
  }

  log('Summary', results);
}

run().catch(console.error);