const { createClient } = require('@libsql/client/web');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const TURSO_URL = process.env.TURSO_DATABASE_URL || 'libsql://nearwork-db-nearwork.aws-ap-south-1.turso.io';
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN || 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODcyMDQ0NjUsImlkIjoiMDFhMDFkYWYtZjAwMS03YzAyLTlkNTctZWNlMmExM2E4ZmE3Iiwia2lkIjoicnNLV3JGRXBCSUw5ZUtLNl9mY2lHelFrdy1jLXpud3NlVFBSc204ckNhVSIsInJpZCI6ImQ5MmZkOTgwLTZmOGQtNDk0Mi1hOGY0LWZkZjQ0NmY0MDViMiJ9.dkducrMTmaRdjbaegej6930ixn9oTir5k-JnHukOkbSrebnLANfSzDMvnzkT4gqYMClQyDfffKEqCuL784nNBA';
const JWT_SECRET = process.env.JWT_ACCESS_SECRET || 'nearwork_jwt_super_secure_access_secret_2026_key';
const JWT_REFRESH = process.env.JWT_REFRESH_SECRET || 'nearwork_jwt_super_secure_refresh_secret_2026_key';

const db = createClient({ url: TURSO_URL, authToken: TURSO_TOKEN });

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept');
}

function verifyToken(req) {
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) return null;
  try {
    return jwt.verify(auth.split(' ')[1], JWT_SECRET);
  } catch (e) {
    return null;
  }
}

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Parse path
  const url = new URL(req.url, `https://${req.headers.host || 'localhost'}`);
  const path = url.pathname.replace(/^\/api\/v1/, '').replace(/^\/api/, '');

  try {
    // 1. Health
    if (path === '/health' || path === '') {
      return res.status(200).json({
        status: 'UP',
        timestamp: new Date().toISOString(),
        service: 'NearWork Cloud Serverless API',
        database: 'Turso Cloud LibSQL'
      });
    }

    // Parse JSON body
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (e) { body = {}; }
    }
    body = body || {};

    // 2. Auth: Login
    if (path === '/auth/login' && req.method === 'POST') {
      const email = (body.email || '').toLowerCase().trim();
      const password = (body.password || '').trim();

      if (!email || !password) {
        return res.status(400).json({ success: false, message: 'Email and password are required' });
      }

      const userRs = await db.execute({
        sql: 'SELECT id, name, email, phone, role, passwordHash FROM User WHERE email = ?',
        args: [email]
      });

      if (userRs.rows.length === 0) {
        return res.status(401).json({ success: false, message: 'Invalid email or password' });
      }

      const user = userRs.rows[0];
      const isPassValid = await bcrypt.compare(password, user.passwordHash);
      if (!isPassValid) {
        return res.status(401).json({ success: false, message: 'Invalid email or password' });
      }

      let workerProfile = null;
      let adminProfile = null;

      if (user.role === 'WORKER') {
        const wpRs = await db.execute({
          sql: 'SELECT id, status, verificationStatus, currentLat, currentLng, experienceYears, workingRadiusKm FROM WorkerProfile WHERE userId = ?',
          args: [user.id]
        });
        if (wpRs.rows.length > 0) {
          workerProfile = wpRs.rows[0];
        }
      }

      const payload = {
        userId: user.id,
        email: user.email,
        role: user.role,
        workerId: workerProfile?.id,
        name: user.name
      };

      const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: '1d' });
      const refreshToken = jwt.sign({ userId: user.id }, JWT_REFRESH, { expiresIn: '7d' });

      // Save refresh token
      db.execute({
        sql: 'UPDATE User SET refreshToken = ? WHERE id = ?',
        args: [refreshToken, user.id]
      }).catch(() => {});

      return res.status(200).json({
        success: true,
        message: 'Logged in successfully',
        data: {
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            role: user.role,
            isVerified: true,
            workerProfile,
            workerId: workerProfile?.id
          },
          tokens: { accessToken, refreshToken }
        }
      });
    }

    // 3. Services List
    if (path === '/services' && req.method === 'GET') {
      const svcsRs = await db.execute('SELECT s.*, c.name as categoryName FROM Service s LEFT JOIN ServiceCategory c ON s.categoryId = c.id');
      const services = svcsRs.rows.map(s => ({
        ...s,
        category: { id: s.categoryId, name: s.categoryName }
      }));
      return res.status(200).json({ success: true, data: services });
    }

    // 4. Categories List
    if (path === '/services/categories' && req.method === 'GET') {
      const catsRs = await db.execute('SELECT * FROM ServiceCategory');
      return res.status(200).json({ success: true, data: catsRs.rows });
    }

    // 5. Customer Profile
    if (path === '/customer/profile' && req.method === 'GET') {
      const auth = verifyToken(req);
      if (!auth) return res.status(401).json({ success: false, message: 'Unauthorized' });

      const userRs = await db.execute({ sql: 'SELECT id, name, email, phone, role FROM User WHERE id = ?', args: [auth.userId] });
      if (userRs.rows.length === 0) return res.status(404).json({ success: false, message: 'User not found' });
      const user = userRs.rows[0];

      const addrRs = await db.execute({ sql: 'SELECT * FROM Address WHERE userId = ?', args: [auth.userId] });
      user.addresses = addrRs.rows;

      return res.status(200).json({ success: true, data: user });
    }

    // 6. Worker Profile
    if (path === '/worker/profile' && req.method === 'GET') {
      const auth = verifyToken(req);
      if (!auth) return res.status(401).json({ success: false, message: 'Unauthorized' });

      const userRs = await db.execute({ sql: 'SELECT id, name, email, phone, role FROM User WHERE id = ?', args: [auth.userId] });
      const wpRs = await db.execute({ sql: 'SELECT * FROM WorkerProfile WHERE userId = ?', args: [auth.userId] });
      if (wpRs.rows.length === 0) return res.status(404).json({ success: false, message: 'Worker profile not found' });

      const profile = wpRs.rows[0];
      profile.user = userRs.rows[0];
      profile.skills = [];

      return res.status(200).json({ success: true, data: profile });
    }

    // 7. Worker Jobs
    if (path === '/worker/jobs' && req.method === 'GET') {
      const auth = verifyToken(req);
      if (!auth) return res.status(401).json({ success: false, message: 'Unauthorized' });

      const wpRs = await db.execute({ sql: 'SELECT id FROM WorkerProfile WHERE userId = ?', args: [auth.userId] });
      const workerId = wpRs.rows[0]?.id || auth.workerId;

      const jobsRs = await db.execute({
        sql: `SELECT b.*, s.name as serviceName, s.price as servicePrice, a.addressLine, a.city, a.latitude as addrLat, a.longitude as addrLng, u.name as customerName, u.phone as customerPhone
              FROM Booking b
              LEFT JOIN Service s ON b.serviceId = s.id
              LEFT JOIN Address a ON b.addressId = a.id
              LEFT JOIN User u ON b.customerId = u.id
              WHERE b.workerId = ? OR b.status = 'SEARCHING_WORKER'
              ORDER BY b.createdAt DESC LIMIT 20`,
        args: [workerId]
      });

      const jobs = jobsRs.rows.map(j => ({
        ...j,
        service: { id: j.serviceId, name: j.serviceName, price: j.servicePrice },
        address: { id: j.addressId, addressLine: j.addressLine, city: j.city, latitude: j.addrLat, longitude: j.addrLng },
        customer: { id: j.customerId, name: j.customerName, phone: j.customerPhone }
      }));

      return res.status(200).json({ success: true, data: jobs });
    }

    // 8. Customer Bookings
    if (path === '/customer/bookings' && req.method === 'GET') {
      const auth = verifyToken(req);
      if (!auth) return res.status(401).json({ success: false, message: 'Unauthorized' });

      const bRs = await db.execute({
        sql: `SELECT b.*, s.name as serviceName, s.price as servicePrice, a.addressLine, a.city, a.latitude as addrLat, a.longitude as addrLng, wu.name as workerName, wu.phone as workerPhone
              FROM Booking b
              LEFT JOIN Service s ON b.serviceId = s.id
              LEFT JOIN Address a ON b.addressId = a.id
              LEFT JOIN WorkerProfile wp ON b.workerId = wp.id
              LEFT JOIN User wu ON wp.userId = wu.id
              WHERE b.customerId = ?
              ORDER BY b.createdAt DESC`,
        args: [auth.userId]
      });

      const bookings = bRs.rows.map(b => ({
        ...b,
        service: { id: b.serviceId, name: b.serviceName, price: b.servicePrice },
        address: { id: b.addressId, addressLine: b.addressLine, city: b.city, latitude: b.addrLat, longitude: b.addrLng },
        worker: b.workerId ? { id: b.workerId, user: { name: b.workerName, phone: b.workerPhone } } : null
      }));

      return res.status(200).json({ success: true, data: bookings });
    }

    // 9. Single Booking by ID
    const bookingMatch = path.match(/^\/bookings\/([a-zA-Z0-9-]+)$/);
    if (bookingMatch && req.method === 'GET') {
      const bookingId = bookingMatch[1];
      const bRs = await db.execute({
        sql: `SELECT b.*, s.name as serviceName, s.price as servicePrice, s.durationMinutes, a.addressLine, a.city, a.latitude as addrLat, a.longitude as addrLng, wp.currentLat as workerLat, wp.currentLng as workerLng, wp.averageRating as workerRating, wp.totalJobsCompleted as workerJobs, wu.name as workerName, wu.phone as workerPhone, u.name as customerName, u.phone as customerPhone
              FROM Booking b
              LEFT JOIN Service s ON b.serviceId = s.id
              LEFT JOIN Address a ON b.addressId = a.id
              LEFT JOIN WorkerProfile wp ON b.workerId = wp.id
              LEFT JOIN User wu ON wp.userId = wu.id
              LEFT JOIN User u ON b.customerId = u.id
              WHERE b.id = ?`,
        args: [bookingId]
      });

      if (bRs.rows.length === 0) return res.status(404).json({ success: false, message: 'Booking not found' });
      const b = bRs.rows[0];

      return res.status(200).json({
        success: true,
        data: {
          ...b,
          service: { id: b.serviceId, name: b.serviceName, price: b.servicePrice, durationMinutes: b.durationMinutes },
          address: { id: b.addressId, addressLine: b.addressLine, city: b.city, latitude: b.addrLat, longitude: b.addrLng },
          customer: { id: b.customerId, name: b.customerName, phone: b.customerPhone },
          worker: b.workerId ? {
            id: b.workerId,
            currentLat: b.workerLat,
            currentLng: b.workerLng,
            averageRating: b.workerRating,
            totalJobsCompleted: b.workerJobs,
            user: { name: b.workerName, phone: b.workerPhone }
          } : null
        }
      });
    }

    // Default 404 for unhandled API endpoints
    return res.status(404).json({ success: false, message: `Endpoint ${path} not found` });

  } catch (err) {
    console.error('Serverless API error:', err);
    return res.status(500).json({ success: false, message: err.message || 'Internal server error' });
  }
};
