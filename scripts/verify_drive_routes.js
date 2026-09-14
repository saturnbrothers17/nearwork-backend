/**
 * Test REST Routes for Google Drive and Media Storage
 */
const http = require('http');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const { app } = require('../dist/index'); // Test compiled build

async function testRoutes() {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`Testing Express routes against ${baseUrl}...`);

  const axios = require('axios');

  try {
    // 1. Status endpoint
    console.log('Testing GET /api/v1/drive/status...');
    const statusRes = await axios.get(`${baseUrl}/api/v1/drive/status`);
    console.log('  Status OK:', statusRes.data.success, 'Counts:', statusRes.data.recordCounts);

    // 2. Users list
    console.log('Testing GET /api/v1/drive/users...');
    const usersRes = await axios.get(`${baseUrl}/api/v1/drive/users`);
    console.log('  Users OK:', usersRes.data.success, 'Count:', usersRes.data.count);

    // 3. Services list
    console.log('Testing GET /api/v1/drive/services...');
    const servicesRes = await axios.get(`${baseUrl}/api/v1/drive/services`);
    console.log('  Services OK:', servicesRes.data.success, 'Count:', servicesRes.data.count);

    // 4. Workers list
    console.log('Testing GET /api/v1/drive/workers...');
    const workersRes = await axios.get(`${baseUrl}/api/v1/drive/workers`);
    console.log('  Workers OK:', workersRes.data.success, 'Count:', workersRes.data.count);

    // 5. Bookings list
    console.log('Testing GET /api/v1/drive/bookings...');
    const bookingsRes = await axios.get(`${baseUrl}/api/v1/drive/bookings`);
    console.log('  Bookings OK:', bookingsRes.data.success, 'Count:', bookingsRes.data.count);

    // 6. Resumable upload session
    console.log('Testing POST /api/v1/storage/upload-session...');
    const sessionRes = await axios.post(`${baseUrl}/api/v1/storage/upload-session`, {
      filename: 'sample_resumable_test.jpg',
      mimeType: 'image/jpeg'
    });
    console.log('  Upload session OK:', Boolean(sessionRes.data.data.uploadUrl));

    console.log('\n🎉 ALL EXPRESS REST ROUTE TESTS PASSED!');
  } finally {
    server.close();
  }
}

testRoutes().catch(err => {
  console.error('Route test error:', err.response?.data || err.message);
  process.exit(1);
});
