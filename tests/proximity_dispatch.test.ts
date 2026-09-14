import { describe, it, expect, vi } from 'vitest';
import { ProximityDispatchService, DispatchWorkerCandidate, DispatchBookingPayload } from '../src/services/dispatch/proximityDispatchService';

describe('ProximityDispatchService (Milestone 2 - R1, AC1)', () => {
  const mockBooking: DispatchBookingPayload = {
    id: 'bk_test_101',
    bookingNumber: 'BK-TEST-101',
    serviceName: 'AC Deep Clean & Filter Replacement',
    serviceCategoryId: 'cat_hvac',
    customerName: 'Aditi Verma',
    customerLatitude: 25.3176, // Varanasi Center
    customerLongitude: 82.9739,
    address: 'Orderly Bazar, Varanasi',
    totalAmount: 1500.0,
    scheduledDate: '2026-09-15',
    scheduledTimeSlot: '10:00 - 12:00'
  };

  const mockWorkers: DispatchWorkerCandidate[] = [
    {
      id: 'w1_close_prime',
      userId: 'u1',
      name: 'Ravi Verma',
      phone: '+919876543210',
      latitude: 25.3250,
      longitude: 82.9900, // ~1.82 km away
      serviceCategoryId: 'cat_hvac',
      status: 'ONLINE',
      isVerified: true,
      rating: 4.9,
      workingRadiusKm: 10.0
    },
    {
      id: 'w2_medium_range',
      userId: 'u2',
      name: 'Sunil Kumar',
      phone: '+919876543211',
      latitude: 25.2900,
      longitude: 82.9300, // ~5.38 km away
      serviceCategoryId: 'cat_hvac',
      status: 'ONLINE',
      isVerified: true,
      rating: 4.7,
      workingRadiusKm: 10.0
    },
    {
      id: 'w3_far_outside',
      userId: 'u3',
      name: 'Rajesh Pandey',
      phone: '+919876543212',
      latitude: 25.5500,
      longitude: 83.2000, // ~34.4 km away
      serviceCategoryId: 'cat_hvac',
      status: 'ONLINE',
      isVerified: true,
      rating: 5.0,
      workingRadiusKm: 10.0
    },
    {
      id: 'w4_skill_mismatch',
      userId: 'u4',
      name: 'Karan Carpenter',
      phone: '+919876543213',
      latitude: 25.3180,
      longitude: 82.9740, // ~0.05 km away
      serviceCategoryId: 'cat_carpenter',
      status: 'ONLINE',
      isVerified: true,
      rating: 5.0
    },
    {
      id: 'w5_offline',
      userId: 'u5',
      name: 'Deepak Offline',
      phone: '+919876543214',
      latitude: 25.3190,
      longitude: 82.9750, // ~0.18 km away
      serviceCategoryId: 'cat_hvac',
      status: 'OFFLINE',
      isVerified: true,
      rating: 4.8
    },
    {
      id: 'w6_unverified',
      userId: 'u6',
      name: 'Unverified Pro',
      phone: '+919876543215',
      latitude: 25.3190,
      longitude: 82.9750,
      serviceCategoryId: 'cat_hvac',
      status: 'ONLINE',
      isVerified: false,
      rating: 4.8
    },
    {
      id: 'w7_declined_twice',
      userId: 'u7',
      name: 'Anil Decliner',
      phone: '+919876543216',
      latitude: 25.3200,
      longitude: 82.9760,
      serviceCategoryId: 'cat_hvac',
      status: 'ONLINE',
      isVerified: true,
      rating: 4.8,
      pastDeclinesForJob: 2
    }
  ];

  it('should calculate accurate Haversine geodesic distance', () => {
    const dist = ProximityDispatchService.calculateDistance(28.6139, 77.2090, 19.0760, 72.8777);
    expect(dist).toBeGreaterThan(1130);
    expect(dist).toBeLessThan(1165);
  });

  it('should filter eligible workers matching category, online, verified, and inside radius', () => {
    const matched = ProximityDispatchService.matchWorkersForBooking(mockBooking, mockWorkers, 10.0);

    expect(matched).toHaveLength(2);
    expect(matched[0].id).toBe('w1_close_prime');
    expect(matched[1].id).toBe('w2_medium_range');
  });

  it('should strictly exclude workers outside the 10km radius', () => {
    const matched = ProximityDispatchService.matchWorkersForBooking(mockBooking, mockWorkers, 10.0);
    const hasOutsideWorker = matched.some((w) => w.id === 'w3_far_outside');
    expect(hasOutsideWorker).toBe(false);
  });

  it('should strictly exclude workers with category mismatch, offline, unverified, or >= 2 declines', () => {
    const matched = ProximityDispatchService.matchWorkersForBooking(mockBooking, mockWorkers, 10.0);
    const matchedIds = matched.map((w) => w.id);

    expect(matchedIds).not.toContain('w4_skill_mismatch');
    expect(matchedIds).not.toContain('w5_offline');
    expect(matchedIds).not.toContain('w6_unverified');
    expect(matchedIds).not.toContain('w7_declined_twice');
  });

  it('should rank closer worker with high rating higher', () => {
    const matched = ProximityDispatchService.matchWorkersForBooking(mockBooking, mockWorkers, 10.0);
    expect(matched[0].distanceKm).toBeLessThan(matched[1].distanceKm!);
    expect(matched[0].score!).toBeGreaterThan(matched[1].score!);
  });

  it('should broadcast socket alerts only to matched worker rooms', async () => {
    const matched = ProximityDispatchService.matchWorkersForBooking(mockBooking, mockWorkers, 10.0);

    const emittedRooms: string[][] = [];
    const emittedEvents: Array<{ event: string; payload: any }> = [];

    const mockIo = {
      to: (rooms: string[]) => {
        emittedRooms.push(rooms);
        return {
          emit: (event: string, payload: any) => {
            emittedEvents.push({ event, payload });
          }
        };
      }
    };

    const result = await ProximityDispatchService.broadcastJobNotification(mockBooking, matched, mockIo);

    expect(result.sentCount).toBe(2);
    expect(result.recipientWorkerIds).toEqual(['w1_close_prime', 'w2_medium_range']);

    // Check payload fields
    const bookingAssignedEvent = emittedEvents.find((e) => e.event === 'booking:assigned');
    expect(bookingAssignedEvent).toBeDefined();
    expect(bookingAssignedEvent?.payload.bookingId).toBe('bk_test_101');
    expect(bookingAssignedEvent?.payload.estimatedEarnings).toBe(1200); // 80% of 1500
    expect(typeof bookingAssignedEvent?.payload.distanceKm).toBe('number');
  });
});
