import { Router, Request, Response, NextFunction } from 'express';
// Using require for JS module interoperability
const { googleDriveSqlEngine } = require('../../services/drive/googleDriveSqlEngine');

const router = Router();

// ==========================================
// SYSTEM & STATUS ENDPOINTS
// ==========================================

router.get('/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await googleDriveSqlEngine.init();
    res.status(200).json({
      success: true,
      message: 'Google Drive Unified Backend is operational',
      storageEngine: 'Google 5TB Drive SQL Database Engine',
      rootFolderId: googleDriveSqlEngine.rootFolderId,
      dbFileId: googleDriveSqlEngine.dbFileId,
      lastPullTime: googleDriveSqlEngine.lastPullTime ? new Date(googleDriveSqlEngine.lastPullTime).toISOString() : null,
      lastPushTime: googleDriveSqlEngine.lastPushTime ? new Date(googleDriveSqlEngine.lastPushTime).toISOString() : null,
      recordCounts: {
        users: googleDriveSqlEngine.cache.users.size,
        services: googleDriveSqlEngine.cache.services.size,
        workers: googleDriveSqlEngine.cache.workers.size,
        bookings: googleDriveSqlEngine.cache.bookings.size
      }
    });
  } catch (error) {
    next(error);
  }
});

router.post('/sync', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await googleDriveSqlEngine.syncToDriveImmediate();
    res.status(200).json({
      success: true,
      message: 'Immediate synchronization to Google Drive completed',
      data: result
    });
  } catch (error) {
    next(error);
  }
});

router.post('/pull', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await googleDriveSqlEngine.init(true);
    res.status(200).json({
      success: true,
      message: 'Pulled latest database master snapshot from Google Drive',
      recordCounts: {
        users: googleDriveSqlEngine.cache.users.size,
        services: googleDriveSqlEngine.cache.services.size,
        workers: googleDriveSqlEngine.cache.workers.size,
        bookings: googleDriveSqlEngine.cache.bookings.size
      }
    });
  } catch (error) {
    next(error);
  }
});

// ==========================================
// USERS CRUD ENDPOINTS
// ==========================================

router.get('/users', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const users = await googleDriveSqlEngine.getAllUsers();
    res.status(200).json({ success: true, count: users.length, data: users });
  } catch (error) {
    next(error);
  }
});

router.get('/users/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await googleDriveSqlEngine.getUserById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: `User ${req.params.id} not found on Google Drive` });
    }
    res.status(200).json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
});

router.post('/users', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await googleDriveSqlEngine.createUser(req.body);
    res.status(201).json({ success: true, message: 'User created in Google Drive database', data: user });
  } catch (error) {
    next(error);
  }
});

router.put('/users/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await googleDriveSqlEngine.updateUser(req.params.id, req.body);
    res.status(200).json({ success: true, message: 'User updated in Google Drive database', data: user });
  } catch (error) {
    next(error);
  }
});

router.delete('/users/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await googleDriveSqlEngine.deleteUser(req.params.id);
    res.status(200).json({ success: true, message: 'User deleted from Google Drive database', data: result });
  } catch (error) {
    next(error);
  }
});

// ==========================================
// SERVICES CRUD ENDPOINTS
// ==========================================

router.get('/services', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const services = await googleDriveSqlEngine.getAllServices();
    res.status(200).json({ success: true, count: services.length, data: services });
  } catch (error) {
    next(error);
  }
});

router.get('/services/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const service = await googleDriveSqlEngine.getServiceById(req.params.id);
    if (!service) {
      return res.status(404).json({ success: false, message: `Service ${req.params.id} not found on Google Drive` });
    }
    res.status(200).json({ success: true, data: service });
  } catch (error) {
    next(error);
  }
});

router.post('/services', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const service = await googleDriveSqlEngine.createService(req.body);
    res.status(201).json({ success: true, message: 'Service created in Google Drive database', data: service });
  } catch (error) {
    next(error);
  }
});

router.put('/services/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const service = await googleDriveSqlEngine.updateService(req.params.id, req.body);
    res.status(200).json({ success: true, message: 'Service updated in Google Drive database', data: service });
  } catch (error) {
    next(error);
  }
});

router.delete('/services/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await googleDriveSqlEngine.deleteService(req.params.id);
    res.status(200).json({ success: true, message: 'Service deleted from Google Drive database', data: result });
  } catch (error) {
    next(error);
  }
});

// ==========================================
// WORKERS CRUD ENDPOINTS
// ==========================================

router.get('/workers', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workers = await googleDriveSqlEngine.getAllWorkers();
    res.status(200).json({ success: true, count: workers.length, data: workers });
  } catch (error) {
    next(error);
  }
});

router.get('/workers/proximity', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { serviceId, lat, lng, radiusKm } = req.query;
    if (!lat || !lng) {
      return res.status(400).json({ success: false, message: 'lat and lng query parameters are required' });
    }
    const workers = await googleDriveSqlEngine.findWorkersByServiceAndRadius(
      serviceId as string | undefined,
      parseFloat(lat as string),
      parseFloat(lng as string),
      radiusKm ? parseFloat(radiusKm as string) : 15
    );
    res.status(200).json({ success: true, count: workers.length, data: workers });
  } catch (error) {
    next(error);
  }
});

router.get('/workers/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const worker = await googleDriveSqlEngine.getWorkerById(req.params.id);
    if (!worker) {
      return res.status(404).json({ success: false, message: `Worker ${req.params.id} not found on Google Drive` });
    }
    res.status(200).json({ success: true, data: worker });
  } catch (error) {
    next(error);
  }
});

router.post('/workers', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const worker = await googleDriveSqlEngine.createWorker(req.body);
    res.status(201).json({ success: true, message: 'Worker created in Google Drive database', data: worker });
  } catch (error) {
    next(error);
  }
});

router.put('/workers/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const worker = await googleDriveSqlEngine.updateWorker(req.params.id, req.body);
    res.status(200).json({ success: true, message: 'Worker updated in Google Drive database', data: worker });
  } catch (error) {
    next(error);
  }
});

router.delete('/workers/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await googleDriveSqlEngine.deleteWorker(req.params.id);
    res.status(200).json({ success: true, message: 'Worker deleted from Google Drive database', data: result });
  } catch (error) {
    next(error);
  }
});

// ==========================================
// BOOKINGS CRUD ENDPOINTS
// ==========================================

router.get('/bookings', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const bookings = await googleDriveSqlEngine.getAllBookings();
    res.status(200).json({ success: true, count: bookings.length, data: bookings });
  } catch (error) {
    next(error);
  }
});

router.get('/bookings/customer/:customerId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const bookings = await googleDriveSqlEngine.getBookingsByCustomer(req.params.customerId);
    res.status(200).json({ success: true, count: bookings.length, data: bookings });
  } catch (error) {
    next(error);
  }
});

router.get('/bookings/worker/:workerId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const bookings = await googleDriveSqlEngine.getBookingsByWorker(req.params.workerId);
    res.status(200).json({ success: true, count: bookings.length, data: bookings });
  } catch (error) {
    next(error);
  }
});

router.get('/bookings/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const booking = await googleDriveSqlEngine.getBookingById(req.params.id);
    if (!booking) {
      return res.status(404).json({ success: false, message: `Booking ${req.params.id} not found on Google Drive` });
    }
    res.status(200).json({ success: true, data: booking });
  } catch (error) {
    next(error);
  }
});

router.post('/bookings', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const booking = await googleDriveSqlEngine.createBooking(req.body);
    res.status(201).json({ success: true, message: 'Booking created in Google Drive database', data: booking });
  } catch (error) {
    next(error);
  }
});

router.put('/bookings/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const booking = await googleDriveSqlEngine.updateBooking(req.params.id, req.body);
    res.status(200).json({ success: true, message: 'Booking updated in Google Drive database', data: booking });
  } catch (error) {
    next(error);
  }
});

router.delete('/bookings/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await googleDriveSqlEngine.deleteBooking(req.params.id);
    res.status(200).json({ success: true, message: 'Booking deleted from Google Drive database', data: result });
  } catch (error) {
    next(error);
  }
});

export default router;
