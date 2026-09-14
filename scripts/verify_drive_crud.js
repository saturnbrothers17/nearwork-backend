/**
 * Comprehensive Verification Script for Near Work Google Drive Unified Backend
 * Verifies:
 * 1. Google OAuth2 Authentication & Root Storage Folder
 * 2. Structured Data (JSON) CRUD on Users, Services, Workers, Bookings
 * 3. Proximity Worker Radius Search (Haversine calculation)
 * 4. Google Drive Persistence & Live Pull Hydration
 * 5. Media Binary Upload, Web View Link, and Direct Stream
 * 6. Media Deletion
 */

const path = require('path');
const axios = require('axios');
const fs = require('fs');

require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config();

const { googleDriveSqlEngine } = require('../src/services/drive/googleDriveSqlEngine');
const { googleStorage } = require('../src/services/drive/googleStorage');

let passedAssertions = 0;
let totalAssertions = 0;

function assert(condition, message) {
  totalAssertions++;
  if (condition) {
    passedAssertions++;
    console.log(`   ✅ PASS: ${message}`);
  } else {
    console.error(`   ❌ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runVerification() {
  console.log('========================================================================');
  console.log('☁️ NEAR WORK: GOOGLE DRIVE UNIFIED BACKEND VERIFICATION');
  console.log('========================================================================\n');

  // STEP 1: INITIALIZE GOOGLE DRIVE ENGINE
  console.log('1️⃣ [STEP 1] Initializing Google Drive SQL Engine & OAuth2 Connection...');
  await googleDriveSqlEngine.init(true);

  assert(Boolean(googleDriveSqlEngine.rootFolderId), `Root storage folder verified (ID: ${googleDriveSqlEngine.rootFolderId})`);
  assert(Boolean(googleDriveSqlEngine.dbFileId), `Master database file verified (ID: ${googleDriveSqlEngine.dbFileId})`);
  assert(Boolean(googleDriveSqlEngine.accessToken), 'OAuth2 access token acquired successfully');
  console.log('');

  // STEP 2: USER CRUD OPERATIONS
  console.log('2️⃣ [STEP 2] Verifying User CRUD on Google Drive...');
  const testUserId = `usr_test_${Date.now()}`;
  const testPhone = '9876543210';
  const testEmail = `test.worker.${Date.now()}@nearwork.test`;

  // Create User
  const createdUser = await googleDriveSqlEngine.createUser({
    id: testUserId,
    name: 'Rajesh Kumar',
    phone: testPhone,
    email: testEmail,
    role: 'WORKER',
    isActive: true
  });
  assert(createdUser.id === testUserId, `User created with ID ${testUserId}`);

  // Read User by ID
  const readUserById = await googleDriveSqlEngine.getUserById(testUserId);
  assert(readUserById && readUserById.name === 'Rajesh Kumar', 'User successfully read by ID');

  // Read User by Phone
  const readUserByPhone = await googleDriveSqlEngine.getUserByPhone(testPhone);
  assert(readUserByPhone && readUserByPhone.id === testUserId, 'User successfully read by phone number index');

  // Read User by Email
  const readUserByEmail = await googleDriveSqlEngine.getUserByEmail(testEmail);
  assert(readUserByEmail && readUserByEmail.id === testUserId, 'User successfully read by email index');

  // Update User
  const updatedUser = await googleDriveSqlEngine.updateUser(testUserId, {
    name: 'Rajesh Kumar Senior',
    avatarUrl: 'https://example.com/avatar_test.png'
  });
  assert(updatedUser.name === 'Rajesh Kumar Senior', 'User updated successfully in memory cache and Google Drive');

  // Verify updated in memory
  const reReadUser = await googleDriveSqlEngine.getUserById(testUserId);
  assert(reReadUser.name === 'Rajesh Kumar Senior', 'Updated user verified in cache');
  console.log('');

  // STEP 3: SERVICE CRUD OPERATIONS
  console.log('3️⃣ [STEP 3] Verifying Service CRUD on Google Drive...');
  const testServiceId = `srv_test_${Date.now()}`;
  const testSlug = `deep-home-cleaning-${Date.now()}`;

  // Create Service
  const createdService = await googleDriveSqlEngine.createService({
    id: testServiceId,
    name: 'Deep Home Cleaning Service',
    slug: testSlug,
    description: 'Comprehensive deep cleaning for residential spaces',
    basePrice: 1499.0,
    durationMinutes: 120,
    isActive: true
  });
  assert(createdService.id === testServiceId, `Service created with ID ${testServiceId}`);

  // Read Service by ID
  const readService = await googleDriveSqlEngine.getServiceById(testServiceId);
  assert(readService && readService.name === 'Deep Home Cleaning Service', 'Service read by ID');

  // Read Service by Slug
  const readServiceBySlug = await googleDriveSqlEngine.getServiceBySlug(testSlug);
  assert(readServiceBySlug && readServiceBySlug.id === testServiceId, 'Service read by slug');

  // Update Service
  const updatedService = await googleDriveSqlEngine.updateService(testServiceId, {
    basePrice: 1799.0
  });
  assert(updatedService.basePrice === 1799.0, 'Service base price updated in database');
  console.log('');

  // STEP 4: WORKER CRUD & PROXIMITY DISPATCH VERIFICATION
  console.log('4️⃣ [STEP 4] Verifying Worker CRUD & Proximity Matching on Google Drive...');
  const testWorkerId = `wrk_test_${Date.now()}`;
  // Customer located at 12.9716, 77.5946 (MG Road, Bangalore)
  const customerLat = 12.9716;
  const customerLng = 77.5946;

  // Nearby worker at 12.9750, 77.6000 (~0.7 km away)
  const createdWorker = await googleDriveSqlEngine.createWorker({
    id: testWorkerId,
    userId: testUserId,
    name: 'Rajesh Kumar Senior',
    skills: [testServiceId],
    status: 'ONLINE',
    experienceYears: 5,
    workingRadiusKm: 15.0,
    currentLat: 12.9750,
    currentLng: 77.6000,
    averageRating: 4.9
  });
  assert(createdWorker.id === testWorkerId, `Worker created with ID ${testWorkerId}`);

  // Far away worker at 13.3000, 77.8000 (~42 km away, outside 15km radius)
  const farWorkerId = `wrk_far_${Date.now()}`;
  await googleDriveSqlEngine.createWorker({
    id: farWorkerId,
    userId: `usr_far_${Date.now()}`,
    name: 'Suresh Distant',
    skills: [testServiceId],
    status: 'ONLINE',
    workingRadiusKm: 15.0,
    currentLat: 13.3000,
    currentLng: 77.8000
  });

  // Test Proximity Search Algorithm
  const nearbyWorkers = await googleDriveSqlEngine.findWorkersByServiceAndRadius(
    testServiceId,
    customerLat,
    customerLng,
    15.0
  );
  assert(
    nearbyWorkers.some((w) => w.id === testWorkerId),
    'Nearby worker identified within 15km radius via Haversine distance'
  );
  assert(
    !nearbyWorkers.some((w) => w.id === farWorkerId),
    'Distant worker (>15km) correctly excluded by proximity filter'
  );

  const matchedWorker = nearbyWorkers.find((w) => w.id === testWorkerId);
  assert(
    matchedWorker.distanceKm !== null && matchedWorker.distanceKm < 2.0,
    `Calculated distance accurate (${matchedWorker.distanceKm} km)`
  );
  console.log('');

  // STEP 5: BOOKINGS CRUD OPERATIONS
  console.log('5️⃣ [STEP 5] Verifying Booking CRUD on Google Drive...');
  const testBookingId = `bok_test_${Date.now()}`;
  const testCustomerId = `usr_cust_${Date.now()}`;

  // Create Booking
  const createdBooking = await googleDriveSqlEngine.createBooking({
    id: testBookingId,
    bookingNumber: `NW-${Date.now().toString().slice(-6)}`,
    customerId: testCustomerId,
    serviceId: testServiceId,
    workerId: testWorkerId,
    status: 'CREATED',
    scheduledDate: '2026-09-15',
    scheduledTimeSlot: '10:00 AM',
    basePrice: 1799.0,
    totalAmount: 1849.0,
    otp: '4821'
  });
  assert(createdBooking.id === testBookingId, `Booking created with ID ${testBookingId}`);

  // Read Booking by ID
  const readBooking = await googleDriveSqlEngine.getBookingById(testBookingId);
  assert(readBooking && readBooking.bookingNumber === createdBooking.bookingNumber, 'Booking read by ID');

  // Read Booking by Customer
  const customerBookings = await googleDriveSqlEngine.getBookingsByCustomer(testCustomerId);
  assert(customerBookings.length > 0 && customerBookings[0].id === testBookingId, 'Booking read by customer query');

  // Update Booking Status
  const updatedBooking = await googleDriveSqlEngine.updateBooking(testBookingId, {
    status: 'WORKER_ACCEPTED',
    acceptedAt: new Date().toISOString()
  });
  assert(updatedBooking.status === 'WORKER_ACCEPTED', 'Booking status updated to WORKER_ACCEPTED');
  console.log('');

  // STEP 6: VERIFY PHYSICAL PERSISTENCE ON GOOGLE DRIVE LIVE CLOUD
  console.log('6️⃣ [STEP 6] Verifying Live Persistence in nearwork_database_master.json on Google Drive...');
  const syncResult = await googleDriveSqlEngine.syncToDriveImmediate();
  assert(syncResult.success === true, 'syncToDriveImmediate() completed successfully');

  // Verify by pulling raw file directly from Google Drive API v3
  const token = await googleDriveSqlEngine.getAccessToken();
  const rawDriveRes = await axios.get(
    `https://www.googleapis.com/drive/v3/files/${googleDriveSqlEngine.dbFileId}?alt=media`,
    {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 20000
    }
  );

  const rawDb = typeof rawDriveRes.data === 'string' ? JSON.parse(rawDriveRes.data) : rawDriveRes.data;
  assert(Array.isArray(rawDb.users), 'Google Drive master file has users array');
  assert(rawDb.users.some((u) => u.id === testUserId), 'Test user physically present in Google Drive master JSON');
  assert(rawDb.services.some((s) => s.id === testServiceId), 'Test service physically present in Google Drive master JSON');
  assert(rawDb.workers.some((w) => w.id === testWorkerId), 'Test worker physically present in Google Drive master JSON');
  assert(rawDb.bookings.some((b) => b.id === testBookingId), 'Test booking physically present in Google Drive master JSON');
  console.log('');

  // STEP 7: CLEANUP STRUCTURED TEST RECORDS
  console.log('7️⃣ [STEP 7] Verifying Delete operations for structured records...');
  const delUserRes = await googleDriveSqlEngine.deleteUser(testUserId);
  assert(delUserRes.success === true, 'User deleted successfully');
  assert((await googleDriveSqlEngine.getUserById(testUserId)) === null, 'User confirmed gone from cache');

  const delSrvRes = await googleDriveSqlEngine.deleteService(testServiceId);
  assert(delSrvRes.success === true, 'Service deleted successfully');

  const delWrkRes = await googleDriveSqlEngine.deleteWorker(testWorkerId);
  await googleDriveSqlEngine.deleteWorker(farWorkerId);
  assert(delWrkRes.success === true, 'Worker deleted successfully');

  const delBokRes = await googleDriveSqlEngine.deleteBooking(testBookingId);
  assert(delBokRes.success === true, 'Booking deleted successfully');
  console.log('');

  // STEP 8: MEDIA FILE BINARY UPLOAD, DIRECT STREAM & DELETION
  console.log('8️⃣ [STEP 8] Verifying Media File Binary Upload, Stream & Deletion on Google Drive...');

  // Create test binary media buffer (1x1 transparent PNG file buffer)
  const pngBuffer = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG signature
    0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, // IHDR header
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
    0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41,
    0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
    0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00,
    0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
    0x42, 0x60, 0x82
  ]);

  const testFilename = `nearwork_verification_badge_${Date.now()}.png`;
  const uploadResult = await googleStorage.uploadFile({
    originalname: testFilename,
    mimetype: 'image/png',
    buffer: pngBuffer,
    size: pngBuffer.length,
    uploadedBy: 'test_verifier',
    metadata: { testCase: 'M1_GoogleDrive_Media_Verification' }
  });

  assert(Boolean(uploadResult.fileId), `Binary media uploaded to Google Drive (fileId: ${uploadResult.fileId})`);
  assert(Boolean(uploadResult.webViewLink), `webViewLink generated: ${uploadResult.webViewLink}`);
  assert(Boolean(uploadResult.streamUrl), `streamUrl generated: ${uploadResult.streamUrl}`);
  assert(Boolean(uploadResult.directDriveUrl), `directDriveUrl generated: ${uploadResult.directDriveUrl}`);

  // Test streaming verification by downloading directly with the media file ID
  const mediaStreamToken = await googleDriveSqlEngine.getAccessToken();
  const streamRes = await axios.get(
    `https://www.googleapis.com/drive/v3/files/${uploadResult.fileId}?alt=media`,
    {
      headers: { Authorization: `Bearer ${mediaStreamToken}` },
      responseType: 'arraybuffer',
      timeout: 25000
    }
  );

  const downloadedBuffer = Buffer.from(streamRes.data);
  assert(
    downloadedBuffer.length === pngBuffer.length,
    `Streamed binary size matches uploaded size exactly (${downloadedBuffer.length} bytes)`
  );
  assert(
    downloadedBuffer.equals(pngBuffer),
    'Streamed binary byte buffer is byte-for-byte identical to original upload'
  );

  // Test Media Deletion
  const deleteResult = await googleStorage.deleteFile(uploadResult.fileId);
  assert(deleteResult.success === true, `Media file ${uploadResult.fileId} deleted from Google Drive`);

  // Confirm file is deleted from Google Drive
  let isDeleted = false;
  try {
    await axios.get(`https://www.googleapis.com/drive/v3/files/${uploadResult.fileId}`, {
      headers: { Authorization: `Bearer ${mediaStreamToken}` },
      timeout: 10000
    });
  } catch (err) {
    if (err.response && err.response.status === 404) {
      isDeleted = true;
    }
  }
  assert(isDeleted, 'Confirmed file is removed (returns HTTP 404 on Google Drive)');
  console.log('');

  // SUMMARY REPORT
  console.log('========================================================================');
  console.log(`🎉 ALL ${passedAssertions}/${totalAssertions} VERIFICATION ASSERTIONS PASSED 100%!`);
  console.log('Google Drive Unified Backend (Structured Data & Media Storage) Verified.');
  console.log('========================================================================');
}

runVerification()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n❌ VERIFICATION RUNTIME ERROR:', err);
    process.exit(1);
  });
