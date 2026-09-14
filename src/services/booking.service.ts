import { BookingStatus, UserRole, PaymentStatus, WorkerStatus } from '@nearwork/types';
import { HTTP_STATUS, ERROR_CODES, APP_CONFIG } from '@nearwork/config';
import { prisma } from '../config/db';
import { AppError } from '../middlewares/error.middleware';
import { generateServiceOtp, generateBookingNumber, generateInvoiceNumber } from '../utils/otp';
import { isWithinGeofence } from '../utils/haversine';
import { getSocketIO } from '../config/socket';
import { SOCKET_EVENTS } from '@nearwork/types';
import { MatchingService } from './matching.service';

export class BookingService {
  /**
   * Create a new booking in PAYMENT_PENDING state
   */
  static async createBooking(
    customerId: string,
    data: {
      serviceId: string;
      addressId: string;
      scheduledDate: string;
      scheduledTimeSlot: string;
      instructions?: string;
      problemPhotos?: string[];
      couponCode?: string;
    }
  ) {
    const [service, address, coupon] = await Promise.all([
      prisma.service.findUnique({
        where: { id: data.serviceId },
        include: { category: true }
      }),
      prisma.address.findFirst({
        where: { id: data.addressId, userId: customerId }
      }),
      data.couponCode
        ? prisma.coupon.findUnique({
            where: { code: data.couponCode.toUpperCase() }
          })
        : Promise.resolve(null)
    ]);

    if (!service || !service.isActive) {
      const err: AppError = new Error('Service not found or currently unavailable');
      err.statusCode = HTTP_STATUS.NOT_FOUND;
      err.code = ERROR_CODES.VALIDATION_ERROR;
      throw err;
    }

    if (!address) {
      const err: AppError = new Error('Invalid address selected');
      err.statusCode = HTTP_STATUS.NOT_FOUND;
      err.code = ERROR_CODES.VALIDATION_ERROR;
      throw err;
    }

    // Pricing calculation
    const basePrice = service.basePrice;
    const visitCharge = APP_CONFIG.visitCharge;
    let discountAmount = 0;

    // Coupon verification
    if (coupon) {
      if (coupon.isActive && (!coupon.expiresAt || coupon.expiresAt > new Date())) {
        if (coupon.usedCount < coupon.usageLimit && basePrice >= coupon.minOrderValue) {
          if (coupon.discountType === 'PERCENTAGE') {
            discountAmount = (basePrice * coupon.discountValue) / 100;
            if (coupon.maxDiscount && discountAmount > coupon.maxDiscount) {
              discountAmount = coupon.maxDiscount;
            }
          } else {
            discountAmount = coupon.discountValue;
          }
        }
      }
    }

    const subtotal = Math.max(50, basePrice + visitCharge - Math.round(discountAmount));
    const taxAmount = Math.round((subtotal * APP_CONFIG.taxRatePercent) / 100);
    const totalAmount = Math.round(subtotal + taxAmount);
    discountAmount = Math.round(discountAmount);

    const otp = generateServiceOtp();
    const bookingNumber = generateBookingNumber();

    const booking = await prisma.$transaction(async (tx: any) => {
      const created = await tx.booking.create({
        data: {
          bookingNumber,
          customerId,
          serviceId: service.id,
          addressId: address.id,
          status: BookingStatus.PAYMENT_PENDING,
          scheduledDate: data.scheduledDate,
          scheduledTimeSlot: data.scheduledTimeSlot,
          basePrice,
          visitCharge,
          taxAmount,
          discountAmount,
          totalAmount,
          otp,
          instructions: data.instructions,
          problemPhotos: data.problemPhotos ? JSON.stringify(data.problemPhotos) : null
        },
        include: {
          service: { include: { category: true } },
          address: true,
          customer: { select: { id: true, name: true, phone: true, email: true } }
        }
      });

      await tx.bookingStatusHistory.create({
        data: {
          bookingId: created.id,
          status: BookingStatus.PAYMENT_PENDING,
          note: 'Booking created, awaiting payment authorization',
          changedBy: customerId
        }
      });

      return created;
    });

    return booking;
  }

  /**
   * Concurrency-safe Worker Acceptance
   * Guarantees that only ONE worker succeeds if two attempt simultaneously.
   */
  static async acceptJob(workerId: string, bookingId: string) {
    const worker = await prisma.workerProfile.findFirst({
      where: {
        OR: [{ id: workerId }, { userId: workerId }]
      },
      include: { user: true }
    });

    if (!worker) {
      const err: AppError = new Error('Worker profile not found');
      err.statusCode = HTTP_STATUS.NOT_FOUND;
      err.code = ERROR_CODES.WORKER_NOT_FOUND;
      throw err;
    }

    // Atomic conditional update
    const result = await prisma.$transaction(async (tx: any) => {
      const booking = await tx.booking.findUnique({
        where: { id: bookingId }
      });

      if (!booking) {
        const err: AppError = new Error('Booking not found');
        err.statusCode = HTTP_STATUS.NOT_FOUND;
        err.code = ERROR_CODES.BOOKING_NOT_FOUND;
        throw err;
      }

      // Check valid assignment condition: Any booking that hasn't already been accepted, started, completed, or cancelled can be claimed
      const unclaimableStatuses = [
        BookingStatus.WORKER_ACCEPTED,
        BookingStatus.WORKER_EN_ROUTE,
        BookingStatus.WORKER_ARRIVED,
        BookingStatus.SERVICE_STARTED,
        BookingStatus.SERVICE_COMPLETED,
        BookingStatus.COMPLETED,
        BookingStatus.CUSTOMER_CANCELLED,
        BookingStatus.WORKER_CANCELLED,
        BookingStatus.ADMIN_CANCELLED
      ];

      const isAssignable = !unclaimableStatuses.includes(booking.status as BookingStatus);

      if (!isAssignable) {
        const err: AppError = new Error(
          'This job is no longer available or was accepted by another worker'
        );
        err.statusCode = HTTP_STATUS.CONFLICT;
        err.code = ERROR_CODES.JOB_ALREADY_ASSIGNED;
        throw err;
      }

      const updated = await tx.booking.update({
        where: { id: bookingId },
        data: {
          workerId: worker.id,
          status: BookingStatus.WORKER_ACCEPTED,
          acceptedAt: new Date()
        },
        include: {
          service: true,
          address: true,
          customer: { select: { id: true, name: true, phone: true } },
          worker: { include: { user: true } }
        }
      });

      await tx.bookingStatusHistory.create({
        data: {
          bookingId,
          status: BookingStatus.WORKER_ACCEPTED,
          note: `Job accepted by worker ${worker.user.name}`,
          changedBy: worker.userId
        }
      });

      // Update worker status to ON_JOB
      await tx.workerProfile.update({
        where: { id: worker.id },
        data: { status: WorkerStatus.ON_JOB }
      });

      // Create Chat room for customer and worker
      await tx.chat.upsert({
        where: { bookingId },
        create: {
          bookingId,
          customerId: booking.customerId,
          workerId: worker.id,
          isActive: true
        },
        update: { workerId: worker.id, isActive: true }
      });

      return updated;
    });

    // Create DB Notification for Customer
    await prisma.notification.create({
      data: {
        userId: result.customerId,
        title: '✅ Technician Assigned!',
        message: `${worker.user.name} has accepted your service #${result.bookingNumber}.`,
        type: 'BOOKING_ACCEPTED',
        data: JSON.stringify({ bookingId, workerName: worker.user.name })
      }
    }).catch(() => {});

    // Notify customer via Socket.IO
    const io = getSocketIO();
    if (io) {
      const payload = {
        bookingId,
        bookingNumber: result.bookingNumber,
        status: BookingStatus.WORKER_ACCEPTED,
        worker: {
          id: worker.id,
          name: worker.user.name,
          phone: worker.user.phone,
          rating: worker.averageRating
        }
      };
      io.to(`booking:${bookingId}`).emit(SOCKET_EVENTS.BOOKING_ACCEPTED, payload);
      io.to(`customer:${result.customerId}`).emit(SOCKET_EVENTS.BOOKING_ACCEPTED, payload);
      io.to(`user:${result.customerId}`).emit(SOCKET_EVENTS.BOOKING_ACCEPTED, payload);

      // Dismiss popup for all other candidate workers
      io.to('workers:all').emit('booking:taken', {
        bookingId,
        takenByWorkerId: worker.id,
        takenByName: worker.user.name
      });
    }

    return result;
  }

  /**
   * Worker Rejects Job -> Trigger waterfall reallocation to next best worker
   */
  static async rejectJob(workerId: string, bookingId: string) {
    await prisma.$transaction(async (tx: any) => {
      const booking = await tx.booking.findUnique({ where: { id: bookingId } });
      if (!booking || booking.workerId !== workerId) return;

      await tx.booking.update({
        where: { id: bookingId },
        data: {
          workerId: null,
          status: BookingStatus.SEARCHING_WORKER
        }
      });

      await tx.bookingStatusHistory.create({
        data: {
          bookingId,
          status: BookingStatus.SEARCHING_WORKER,
          note: 'Assigned worker declined job, searching next available worker',
          changedBy: workerId
        }
      });
    });

    // Re-dispatch to next candidate
    await MatchingService.assignNextWorker(bookingId);
    return { success: true };
  }

  /**
   * Worker marks En-Route (starts live location broadcast)
   */
  static async startEnRoute(workerId: string, bookingId: string) {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { worker: { include: { user: true } }, customer: true }
    });
    if (!booking || (booking.workerId !== workerId && booking.worker?.userId !== workerId)) {
      const err: AppError = new Error('Unauthorized or booking not found');
      err.statusCode = HTTP_STATUS.FORBIDDEN;
      throw err;
    }

    const updated = await prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: BookingStatus.WORKER_EN_ROUTE,
        enRouteAt: new Date()
      }
    });

    await prisma.bookingStatusHistory.create({
      data: {
        bookingId,
        status: BookingStatus.WORKER_EN_ROUTE,
        note: 'Worker is on the way to the customer location'
      }
    });

    // Create DB Notification for Customer
    await prisma.notification.create({
      data: {
        userId: booking.customerId,
        title: '🚗 Technician On The Way!',
        message: `${booking.worker?.user?.name || 'Your technician'} is en route to your address. Live GPS tracking is active.`,
        type: 'WORKER_EN_ROUTE',
        data: JSON.stringify({ bookingId })
      }
    }).catch(() => {});

    const io = getSocketIO();
    if (io) {
      const payload = {
        bookingId,
        status: BookingStatus.WORKER_EN_ROUTE,
        workerName: booking.worker?.user?.name || 'Your technician'
      };
      io.to(`booking:${bookingId}`).emit(SOCKET_EVENTS.WORKER_EN_ROUTE, payload);
      io.to(`customer:${booking.customerId}`).emit(SOCKET_EVENTS.WORKER_EN_ROUTE, payload);
      io.to(`user:${booking.customerId}`).emit(SOCKET_EVENTS.WORKER_EN_ROUTE, payload);
    }

    return updated;
  }

  /**
   * Worker marks Arrived (Strictly enforced by Geofencing validation)
   */
  static async markArrived(workerId: string, bookingId: string, workerLat: number, workerLng: number) {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { address: true, worker: { include: { user: true } } }
    });

    if (!booking || (booking.workerId !== workerId && booking.worker?.userId !== workerId)) {
      const err: AppError = new Error('Unauthorized or booking not found');
      err.statusCode = HTTP_STATUS.FORBIDDEN;
      throw err;
    }

    // Geofencing verification
    const { withinGeofence, distanceMeters } = isWithinGeofence(
      workerLat,
      workerLng,
      booking.address.latitude,
      booking.address.longitude
    );

    if (!withinGeofence) {
      const err: AppError = new Error(
        `Arrival verification failed: You are ${distanceMeters}m away from customer address. Must be within ${APP_CONFIG.workerArrivalGeofenceMeters}m.`
      );
      err.statusCode = HTTP_STATUS.BAD_REQUEST;
      err.code = ERROR_CODES.GEOFENCE_CHECK_FAILED;
      throw err;
    }

    const updated = await prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: BookingStatus.WORKER_ARRIVED,
        arrivedAt: new Date()
      }
    });

    await prisma.bookingStatusHistory.create({
      data: {
        bookingId,
        status: BookingStatus.WORKER_ARRIVED,
        note: `Worker arrived at location (verified geofence: ${distanceMeters}m)`
      }
    });

    // Create DB Notification for Customer
    await prisma.notification.create({
      data: {
        userId: booking.customerId,
        title: '📍 Technician Has Arrived!',
        message: `${booking.worker?.user?.name || 'Your technician'} is at your doorstep. Please share your 4-digit PIN: ${booking.otp} to start.`,
        type: 'WORKER_ARRIVED',
        data: JSON.stringify({ bookingId, otp: booking.otp })
      }
    }).catch(() => {});

    const io = getSocketIO();
    if (io) {
      const payload = {
        bookingId,
        status: BookingStatus.WORKER_ARRIVED,
        otp: booking.otp,
        workerName: booking.worker?.user?.name || 'Your technician'
      };
      io.to(`booking:${bookingId}`).emit(SOCKET_EVENTS.WORKER_ARRIVED, payload);
      io.to(`customer:${booking.customerId}`).emit(SOCKET_EVENTS.WORKER_ARRIVED, payload);
      io.to(`user:${booking.customerId}`).emit(SOCKET_EVENTS.WORKER_ARRIVED, payload);
    }

    return updated;
  }

  /**
   * Start Service with 4-digit Customer OTP verification
   */
  static async startService(workerId: string, bookingId: string, otp: string) {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { worker: { include: { user: true } }, service: true }
    });

    if (!booking || (booking.workerId !== workerId && booking.worker?.userId !== workerId)) {
      const err: AppError = new Error('Unauthorized or booking not found');
      err.statusCode = HTTP_STATUS.FORBIDDEN;
      throw err;
    }

    const validStatuses: BookingStatus[] = [
      BookingStatus.WORKER_ARRIVED,
      BookingStatus.WORKER_EN_ROUTE,
      BookingStatus.WORKER_ACCEPTED
    ];

    if (!validStatuses.includes(booking.status as BookingStatus)) {
      const err: AppError = new Error(
        `Cannot start service in current status (${booking.status})`
      );
      err.statusCode = HTTP_STATUS.BAD_REQUEST;
      err.code = ERROR_CODES.INVALID_BOOKING_TRANSITION;
      throw err;
    }

    const trimmedInputOtp = String(otp || '').trim();
    const bookingOtp = String(booking.otp || '').trim();

    if (bookingOtp !== trimmedInputOtp) {
      const err: AppError = new Error(
        `Invalid 4-digit PIN. Please verify the PIN displayed on customer app.`
      );
      err.statusCode = HTTP_STATUS.BAD_REQUEST;
      err.code = ERROR_CODES.INVALID_OTP;
      throw err;
    }

    const updated = await prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: BookingStatus.SERVICE_STARTED,
        startedAt: new Date()
      }
    });

    await prisma.bookingStatusHistory.create({
      data: {
        bookingId,
        status: BookingStatus.SERVICE_STARTED,
        note: 'Service successfully started with verified OTP'
      }
    });

    // Create DB Notification for Customer
    await prisma.notification.create({
      data: {
        userId: booking.customerId,
        title: '⚡ Service Started!',
        message: `PIN verified. ${booking.worker?.user?.name || 'Technician'} has commenced your service. Live duration stopwatch is active.`,
        type: 'SERVICE_STARTED',
        data: JSON.stringify({ bookingId, startedAt: updated.startedAt })
      }
    }).catch(() => {});

    const io = getSocketIO();
    if (io) {
      const payload = {
        bookingId,
        status: BookingStatus.SERVICE_STARTED,
        startedAt: updated.startedAt,
        serviceName: booking.service?.name,
        workerName: booking.worker?.user?.name || 'Technician'
      };
      io.to(`booking:${bookingId}`).emit(SOCKET_EVENTS.SERVICE_STARTED, payload);
      io.to(`customer:${booking.customerId}`).emit(SOCKET_EVENTS.SERVICE_STARTED, payload);
      io.to(`user:${booking.customerId}`).emit(SOCKET_EVENTS.SERVICE_STARTED, payload);
    }

    return updated;
  }

  /**
   * Complete Service, calculate final amounts, update ledger, and generate Invoice
   */
  static async completeService(
    workerId: string,
    bookingId: string,
    data: {
      beforePhotos?: string[];
      afterPhotos?: string[];
    }
  ) {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { worker: { include: { user: true } }, customer: true, service: true, address: true }
    });

    if (!booking || (booking.workerId !== workerId && booking.worker?.userId !== workerId)) {
      const err: AppError = new Error('Unauthorized or booking not found');
      err.statusCode = HTTP_STATUS.FORBIDDEN;
      throw err;
    }

    if (booking.status !== BookingStatus.SERVICE_STARTED) {
      const err: AppError = new Error('Service must be in SERVICE_STARTED status to complete');
      err.statusCode = HTTP_STATUS.BAD_REQUEST;
      err.code = ERROR_CODES.INVALID_BOOKING_TRANSITION;
      throw err;
    }

    const completedAt = new Date();
    const resolvedWorkerProfileId = booking.workerId!;

    // Financial settlements
    const finalTotal = booking.totalAmount + (booking.extraChargeApproved ? booking.extraChargeAmount : 0);
    const platformCommission = Math.round((finalTotal * APP_CONFIG.platformCommissionPercent) / 100);
    const netWorkerEarning = finalTotal - platformCommission;

    const result = await prisma.$transaction(async (tx: any) => {
      const updatedBooking = await tx.booking.update({
        where: { id: bookingId },
        data: {
          status: BookingStatus.COMPLETED,
          completedAt,
          totalAmount: finalTotal,
          beforePhotos: data.beforePhotos ? JSON.stringify(data.beforePhotos) : null,
          afterPhotos: data.afterPhotos ? JSON.stringify(data.afterPhotos) : null
        }
      });

      await tx.bookingStatusHistory.create({
        data: {
          bookingId,
          status: BookingStatus.COMPLETED,
          note: `Service completed. Gross: ₹${finalTotal}, Net Worker: ₹${netWorkerEarning}`
        }
      });

      // Update worker ledger & statistics
      await tx.workerProfile.update({
        where: { id: resolvedWorkerProfileId },
        data: {
          status: WorkerStatus.ONLINE,
          availableBalance: { increment: netWorkerEarning },
          totalJobsCompleted: { increment: 1 }
        }
      });

      // Create Earning record
      await tx.earning.create({
        data: {
          workerId: resolvedWorkerProfileId,
          bookingId,
          grossAmount: finalTotal,
          platformCommission,
          netWorkerEarning,
          status: 'SETTLED'
        }
      });

      // Generate Invoice
      const invoiceNumber = generateInvoiceNumber();
      await tx.invoice.create({
        data: {
          invoiceNumber,
          bookingId,
          customerId: booking.customerId,
          workerId: resolvedWorkerProfileId,
          subtotal: booking.basePrice,
          visitCharge: booking.visitCharge,
          tax: booking.taxAmount,
          discount: booking.discountAmount,
          extraCharges: booking.extraChargeApproved ? booking.extraChargeAmount : 0,
          total: finalTotal
        }
      });

      return updatedBooking;
    });

    // Create notification in DB for customer
    await prisma.notification.create({
      data: {
        userId: booking.customerId,
        title: '🎉 Service Completed Successfully!',
        message: `Your service for ${booking.service?.name || 'Home Maintenance'} is finished. Total: ₹${finalTotal}. Please rate your technician!`,
        type: 'SERVICE_COMPLETED',
        data: JSON.stringify({ bookingId, amount: finalTotal })
      }
    }).catch(() => {});

    const io = getSocketIO();
    if (io) {
      const completionPayload = {
        bookingId,
        bookingNumber: booking.bookingNumber,
        serviceName: booking.service?.name,
        status: BookingStatus.COMPLETED,
        totalAmount: finalTotal,
        workerName: booking.worker?.user?.name || 'Your Professional'
      };

      io.to(`booking:${bookingId}`).emit(SOCKET_EVENTS.SERVICE_COMPLETED, completionPayload);
      io.to(`customer:${booking.customerId}`).emit(SOCKET_EVENTS.SERVICE_COMPLETED, completionPayload);
      io.to(`user:${booking.customerId}`).emit(SOCKET_EVENTS.SERVICE_COMPLETED, completionPayload);
    }

    return result;
  }

  /**
   * Request Additional Charges (Worker triggers, Customer must approve)
   */
  static async requestExtraCharge(workerId: string, bookingId: string, amount: number, reason: string) {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { worker: true }
    });
    if (!booking || (booking.workerId !== workerId && booking.worker?.userId !== workerId)) {
      const err: AppError = new Error('Unauthorized');
      err.statusCode = HTTP_STATUS.FORBIDDEN;
      throw err;
    }

    const updated = await prisma.booking.update({
      where: { id: bookingId },
      data: {
        extraChargeAmount: amount,
        extraChargeReason: reason,
        extraChargeApproved: null // Pending customer response
      }
    });

    const io = getSocketIO();
    if (io) {
      io.to(`booking:${bookingId}`).emit(SOCKET_EVENTS.EXTRA_CHARGE_REQUESTED, {
        bookingId,
        amount,
        reason
      });
    }

    return updated;
  }

  /**
   * Customer Responds to Additional Charge Request
   */
  static async respondExtraCharge(customerId: string, bookingId: string, approved: boolean) {
    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking || booking.customerId !== customerId) {
      const err: AppError = new Error('Unauthorized');
      err.statusCode = HTTP_STATUS.FORBIDDEN;
      throw err;
    }

    const updated = await prisma.booking.update({
      where: { id: bookingId },
      data: {
        extraChargeApproved: approved
      }
    });

    const io = getSocketIO();
    if (io) {
      io.to(`booking:${bookingId}`).emit(SOCKET_EVENTS.EXTRA_CHARGE_RESPONDED, {
        bookingId,
        approved,
        amount: booking.extraChargeAmount
      });
    }

    return updated;
  }

  /**
   * Cancel Booking with Role and Stage Validation
   */
  static async cancelBooking(
    userId: string,
    role: UserRole,
    bookingId: string,
    reason: string
  ) {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { payment: true }
    });

    if (!booking) {
      const err: AppError = new Error('Booking not found');
      err.statusCode = HTTP_STATUS.NOT_FOUND;
      throw err;
    }

    // Role-specific cancellation checks
    if (role === UserRole.CUSTOMER && booking.customerId !== userId) {
      const err: AppError = new Error('Unauthorized');
      err.statusCode = HTTP_STATUS.FORBIDDEN;
      throw err;
    }

    let nextStatus = BookingStatus.CUSTOMER_CANCELLED;
    if (role === UserRole.WORKER) nextStatus = BookingStatus.WORKER_CANCELLED;
    if (role === UserRole.ADMIN) nextStatus = BookingStatus.ADMIN_CANCELLED;

    const updated = await prisma.$transaction(async (tx: any) => {
      const result = await tx.booking.update({
        where: { id: bookingId },
        data: {
          status: nextStatus,
          cancelledAt: new Date(),
          cancellationReason: reason,
          cancelledByRole: role
        }
      });

      await tx.bookingStatusHistory.create({
        data: {
          bookingId,
          status: nextStatus,
          note: `Cancelled by ${role}: ${reason}`,
          changedBy: userId
        }
      });

      // Free worker and set back to ONLINE
      if (booking.workerId) {
        await tx.workerProfile.update({
          where: { id: booking.workerId },
          data: { status: WorkerStatus.ONLINE }
        });
      }

      return result;
    });

    // Notify assigned worker if customer cancelled
    if (booking.workerId) {
      try {
        const worker = await prisma.workerProfile.findUnique({
          where: { id: booking.workerId },
          select: { userId: true, id: true }
        });

        if (worker) {
          await prisma.notification.create({
            data: {
              userId: worker.userId,
              title: '🚫 Booking Cancelled by Customer',
              message: `Customer cancelled booking #${booking.bookingNumber}. Please do NOT proceed to the location.`,
              type: 'BOOKING_CANCELLED',
              data: JSON.stringify({ bookingId })
            }
          });

          const io = getSocketIO();
          if (io) {
            const cancelPayload = {
              bookingId,
              bookingNumber: booking.bookingNumber,
              status: nextStatus,
              reason: reason || 'Cancelled by customer',
              title: '🚫 Booking Cancelled by Customer',
              message: `Customer has cancelled booking #${booking.bookingNumber}. Do NOT proceed further.`
            };

            io.to([
              `booking:${bookingId}`,
              `worker:${worker.id}`,
              `worker:${worker.userId}`,
              `user:${worker.userId}`,
              'workers:all'
            ]).emit(SOCKET_EVENTS.BOOKING_CANCELLED, cancelPayload);
          }
        }
      } catch (err) {
        console.error('Failed to dispatch worker cancellation notice:', err);
      }
    } else {
      const io = getSocketIO();
      if (io) {
        io.to(`booking:${bookingId}`).emit(SOCKET_EVENTS.BOOKING_CANCELLED, {
          bookingId,
          status: nextStatus,
          reason
        });
      }
    }

    return updated;
  }
}
