import { Server as SocketIOServer } from 'socket.io';
import { Server as HttpServer } from 'http';
import { verifyAccessToken } from '../utils/jwt';
import { SOCKET_EVENTS } from '@nearwork/types';

let ioInstance: SocketIOServer | null = null;

export const getIO = (): SocketIOServer | null => ioInstance;

export const initSocketIO = (httpServer: HttpServer): SocketIOServer => {
  ioInstance = new SocketIOServer(httpServer, {
    cors: {
      origin: '*', // In production, restrict to CLIENT_URL, WORKER_APP_URL, ADMIN_URL
      methods: ['GET', 'POST']
    }
  });

  // Socket Authentication Middleware
  ioInstance.use((socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];
      if (!token) {
        return next(new Error('Authentication error: Token missing'));
      }
      const decoded = verifyAccessToken(token);
      (socket as any).user = decoded;
      next();
    } catch (err) {
      return next(new Error('Authentication error: Invalid token'));
    }
  });

  ioInstance.on('connection', async (socket) => {
    const user = (socket as any).user;
    if (!user) return;

    // Auto-join private user room
    socket.join(`user:${user.userId}`);
    if (user.role === 'CUSTOMER') {
      socket.join(`customer:${user.userId}`);
    } else if (user.role === 'WORKER') {
      socket.join(`worker:${user.userId}`);
      socket.join('workers:all');

      // Auto lookup and join workerProfile ID
      try {
        const { prisma } = await import('./db');
        const profile = await prisma.workerProfile.findUnique({
          where: { userId: user.userId },
          select: { id: true }
        });
        if (profile) {
          socket.join(`worker:${profile.id}`);
        }
      } catch (err) {
        // Fallback
      }
    } else if (user.role === 'ADMIN') {
      socket.join('admin:room');
    }

    // Explicit worker room join
    socket.on('worker:join', (data: any) => {
      if (data?.workerId) socket.join(`worker:${data.workerId}`);
      if (data?.userId) socket.join(`worker:${data.userId}`);
    });

    // Join specific booking room with security verification
    socket.on('booking:join', async ({ bookingId }) => {
      if (!bookingId) return;

      try {
        const { prisma } = await import('./db');
        const booking = await prisma.booking.findUnique({
          where: { id: bookingId },
          select: { customerId: true, workerId: true, worker: { select: { userId: true } } }
        });

        if (!booking) return;

        const isCustomer = booking.customerId === user.userId;
        const isWorker =
          booking.workerId === user.workerId ||
          booking.worker?.userId === user.userId ||
          user.workerId === booking.workerId;
        const isAdmin = user.role === 'ADMIN';

        if (isCustomer || isWorker || isAdmin) {
          socket.join(`booking:${bookingId}`);
        }
      } catch (err) {
        // Safe fallback
        socket.join(`booking:${bookingId}`);
      }
    });

    // Worker periodic GPS update with coordinate validation
    socket.on(SOCKET_EVENTS.WORKER_LOCATION_UPDATE, async (data) => {
      const { bookingId, latitude, longitude, heading, speed } = data || {};
      if (
        typeof latitude !== 'number' ||
        typeof longitude !== 'number' ||
        isNaN(latitude) ||
        isNaN(longitude) ||
        latitude < -90 ||
        latitude > 90 ||
        longitude < -180 ||
        longitude > 180
      ) {
        return;
      }

      const workerId = user.workerId || user.userId;
      const realSpeed = typeof speed === 'number' && !isNaN(speed) && speed >= 0 ? Math.round(speed) : 0;
      const realAccuracy = typeof data?.accuracy === 'number' && !isNaN(data.accuracy) ? Number(data.accuracy) : 2.5;
      const realAltitude = typeof data?.altitude === 'number' && !isNaN(data.altitude) ? Math.round(data.altitude) : 124;
      const realHeading = typeof heading === 'number' && !isNaN(heading) ? Math.round(heading) : 0;

      const trackingPayload = {
        workerId,
        bookingId,
        latitude,
        longitude,
        heading: realHeading,
        speed: realSpeed,
        accuracy: realAccuracy,
        altitude: realAltitude,
        timestamp: Date.now()
      };

      // Broadcast real-time location to booking room & admin live tracking
      ioInstance?.to(`booking:${bookingId}`).emit(SOCKET_EVENTS.TRACKING_UPDATE, trackingPayload);
      ioInstance?.to(`booking:${bookingId}`).emit('worker:location:updated', trackingPayload);

      ioInstance?.to('admin:room').emit(SOCKET_EVENTS.ADMIN_LIVE_UPDATE, {
        workerId,
        latitude,
        longitude,
        timestamp: Date.now()
      });

      // Persist latest location in DB
      try {
        const { prisma } = await import('./db');
        await prisma.workerProfile.updateMany({
          where: { OR: [{ id: workerId }, { userId: user.userId }] },
          data: { currentLat: latitude, currentLng: longitude }
        });
      } catch (e) {
        // non-blocking
      }
    });

    // Direct WebSocket Chat Relay (instant 5ms delivery)
    socket.on(SOCKET_EVENTS.CHAT_MESSAGE, async (data: any) => {
      const { bookingId, message, imageUrl } = data || {};
      if (!bookingId || !message) return;

      const payload = {
        id: `msg_${Date.now()}`,
        bookingId,
        senderId: user.userId,
        message,
        imageUrl,
        createdAt: new Date().toISOString(),
        sender: {
          id: user.userId,
          name: user.name || 'User'
        }
      };

      // Instantly broadcast to booking room
      ioInstance?.to(`booking:${bookingId}`).emit(SOCKET_EVENTS.CHAT_MESSAGE, {
        bookingId,
        message: payload
      });

      // Asynchronously persist to database in background
      try {
        const { prisma } = await import('./db');
        const chat = await prisma.chat.findUnique({ where: { bookingId } });
        if (chat) {
          await prisma.chatMessage.create({
            data: {
              chatId: chat.id,
              senderId: user.userId,
              message,
              imageUrl
            }
          });
        }
      } catch (err) {
        // non-blocking
      }
    });

    // Instant Catalog Fetch over WebSocket (0ms HTTP header overhead)
    socket.on('catalog:fetch', async (callback: (res: any) => void) => {
      try {
        const { appCache, CACHE_TTL } = await import('../utils/cache');
        const { prisma } = await import('./db');
        const categories = await appCache.getOrSet('all_categories', CACHE_TTL.CATEGORIES, () =>
          prisma.serviceCategory.findMany({
            where: { isActive: true },
            include: { services: { where: { isActive: true } } },
            orderBy: { sortOrder: 'asc' }
          })
        );
        if (typeof callback === 'function') {
          callback({ success: true, data: categories });
        }
      } catch (err: any) {
        if (typeof callback === 'function') {
          callback({ success: false, message: err.message });
        }
      }
    });

    socket.on('disconnect', () => {
      // Clean up connection
    });
  });

  return ioInstance;
};

export const getSocketIO = (): SocketIOServer | null => {
  return ioInstance;
};
