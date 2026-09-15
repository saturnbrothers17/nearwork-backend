import { WorkerStatus, WorkerVerificationStatus, BookingStatus } from '../../packages/types/src/index';
import { APP_CONFIG } from '../../packages/config/src/index';
import { prisma } from '../config/db';
import { calculateDistanceKm } from '../utils/haversine';
import { getSocketIO } from '../config/socket';
import { SOCKET_EVENTS } from '../../packages/types/src/index';

export interface ScoredWorker {
  workerId: string;
  userId: string;
  name: string;
  phone: string;
  rating: number;
  totalJobs: number;
  distanceKm: number;
  score: number;
  currentLat: number;
  currentLng: number;
}

export class MatchingService {
  /**
   * Finds and ranks suitable workers for a booking based on skills, location, rating, and availability
   */
  static async findEligibleWorkers(
    serviceCategoryId: string,
    customerLat: number,
    customerLng: number,
    scheduledDate: string,
    scheduledTimeSlot: string,
    targetRadiusKm: number = 10.0
  ): Promise<ScoredWorker[]> {
    // 1. Fetch verified, online workers with the matching skill category
    let workers = await prisma.workerProfile.findMany({
      where: {
        status: WorkerStatus.ONLINE,
        verificationStatus: WorkerVerificationStatus.VERIFIED,
        skills: {
          some: {
            categoryId: serviceCategoryId
          }
        }
      },
      include: {
        user: { select: { id: true, name: true, phone: true } },
        skills: { where: { categoryId: serviceCategoryId } },
        availability: true,
        bookings: {
          where: {
            scheduledDate: scheduledDate,
            status: {
              in: [
                BookingStatus.WORKER_ACCEPTED,
                BookingStatus.WORKER_EN_ROUTE,
                BookingStatus.WORKER_ARRIVED,
                BookingStatus.SERVICE_STARTED
              ]
            }
          }
        }
      }
    });

    // Fallback: If no specialized worker is online, dispatch to all online verified workers
    if (!workers || workers.length === 0) {
      workers = await prisma.workerProfile.findMany({
        where: {
          status: WorkerStatus.ONLINE,
          verificationStatus: WorkerVerificationStatus.VERIFIED
        },
        include: {
          user: { select: { id: true, name: true, phone: true } },
          skills: true,
          availability: true,
          bookings: {
            where: {
              scheduledDate: scheduledDate,
              status: {
                in: [
                  BookingStatus.WORKER_ACCEPTED,
                  BookingStatus.WORKER_EN_ROUTE,
                  BookingStatus.WORKER_ARRIVED,
                  BookingStatus.SERVICE_STARTED
                ]
              }
            }
          }
        }
      });
    }

    if (!workers || workers.length === 0) {
      return [];
    }

    const dayOfWeek = new Date(scheduledDate).getDay();
    const scoredList: ScoredWorker[] = [];

    for (const worker of workers) {
      // Check overlapping active job
      const hasSlotConflict = worker.bookings.some(
        (b: any) => b.scheduledTimeSlot === scheduledTimeSlot
      );
      if (hasSlotConflict) {
        continue; // Overlapping job
      }

      // Check location & working radius
      const workerLat = worker.currentLat ?? customerLat;
      const workerLng = worker.currentLng ?? customerLng;

      const distanceKm = calculateDistanceKm(
        customerLat,
        customerLng,
        workerLat,
        workerLng
      );

      // Proximity radius filter: strictly suppress workers outside target radius (10.0 - 15.0 km)
      const maxRadius = (worker as any).workingRadiusKm
        ? Math.min((worker as any).workingRadiusKm, targetRadiusKm)
        : targetRadiusKm;
      if (distanceKm > maxRadius) {
        continue;
      }

      // Calculate matching score
      const distanceScore = Math.max(0, 30 - distanceKm) * 2; // closer = higher
      const ratingScore = (worker.averageRating || 5.0) * 6; // 0 to 30
      const experienceScore = Math.min(worker.experienceYears, 10) * 2; // 0 to 20
      const workloadPenalty = worker.bookings.length * 5;

      const totalScore = distanceScore + ratingScore + experienceScore - workloadPenalty;

      scoredList.push({
        workerId: worker.id,
        userId: worker.user.id,
        name: worker.user.name,
        phone: worker.user.phone,
        rating: worker.averageRating,
        totalJobs: worker.totalJobsCompleted,
        distanceKm: Math.round(distanceKm * 10) / 10,
        score: Math.round(totalScore * 10) / 10,
        currentLat: workerLat,
        currentLng: workerLng
      });
    }

    // Sort descending by score
    scoredList.sort((a, b) => b.score - a.score);
    return scoredList;
  }

  /**
   * Dispatches a booking job request to the top-ranked candidate worker
   */
  static async assignNextWorker(bookingId: string): Promise<boolean> {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        service: { select: { categoryId: true, name: true, basePrice: true } },
        address: true,
        customer: { select: { name: true, phone: true } }
      }
    });

    if (!booking) return false;

    // Search eligible workers
    const rankedWorkers = await this.findEligibleWorkers(
      booking.service.categoryId,
      booking.address.latitude,
      booking.address.longitude,
      booking.scheduledDate,
      booking.scheduledTimeSlot
    );

    // Query past decline history for this booking
    const declinedHistory = await prisma.bookingStatusHistory.findMany({
      where: {
        bookingId,
        status: BookingStatus.SEARCHING_WORKER,
        changedBy: { not: null }
      },
      select: { changedBy: true }
    });

    const declineCountMap: Record<string, number> = {};
    for (const h of declinedHistory) {
      if (h.changedBy) {
        declineCountMap[h.changedBy] = (declineCountMap[h.changedBy] || 0) + 1;
      }
    }

    // Filter out workers who have declined this booking 2 times or more
    const availableCandidates = rankedWorkers.filter(
      (w) => (declineCountMap[w.workerId] || 0) < 2 && (declineCountMap[w.userId] || 0) < 2
    );

    if (availableCandidates.length === 0) {
      // All eligible workers declined -> keep booking searchable
      await prisma.booking.update({
        where: { id: bookingId },
        data: {
          workerId: null,
          status: BookingStatus.SEARCHING_WORKER
        }
      });
      return false;
    }

    // Keep status SEARCHING_WORKER so any of the dispatched workers can claim it (First-To-Accept Wins)
    await prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: BookingStatus.SEARCHING_WORKER,
        workerId: null
      }
    });

    // Broadcast to ALL available online candidate workers simultaneously
    const io = getSocketIO();
    for (const candidate of availableCandidates) {
      // Create in-app Notification record
      prisma.notification.create({
        data: {
          userId: candidate.userId,
          title: '⚡ New Service Job Available!',
          message: `New booking for ${booking.service.name} in ${booking.address.city}. Quickest to accept gets the job!`,
          type: 'JOB_ASSIGNMENT',
          data: JSON.stringify({ link: `/job/${booking.id}` })
        }
      }).catch(() => {});

      if (io) {
        const alertPayload = {
          bookingId: booking.id,
          bookingNumber: booking.bookingNumber,
          serviceName: booking.service.name,
          customerName: booking.customer.name,
          scheduledDate: booking.scheduledDate,
          scheduledTimeSlot: booking.scheduledTimeSlot,
          address: `${booking.address.addressLine}, ${booking.address.city}`,
          distanceKm: candidate.distanceKm,
          estimatedEarnings: Math.round(booking.totalAmount * 0.8), // 80% to worker
          expiresInSeconds: APP_CONFIG.jobAcceptanceTimeoutSeconds
        };

        const targetRooms = [
          `worker:${candidate.workerId}`,
          `worker:${candidate.userId}`,
          `user:${candidate.userId}`
        ];

        io.to(targetRooms).emit(SOCKET_EVENTS.BOOKING_ASSIGNED, alertPayload);
        io.to(targetRooms).emit('booking:assigned', alertPayload);
        io.to(targetRooms).emit('booking:dispatch', alertPayload);
        io.to(targetRooms).emit('new_job_notification', alertPayload);
        io.to(targetRooms).emit('job_broadcast', alertPayload);
      }
    }

    return true;
  }
}
