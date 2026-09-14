import { describe, it, expect } from 'vitest';
import { calculateDistanceKm, isWithinGeofence, estimateEtaMinutes } from '../src/utils/haversine';
import { generateServiceOtp, generateBookingNumber, generateInvoiceNumber } from '../src/utils/otp';
import { generateTokens, verifyAccessToken } from '../src/utils/jwt';
import { UserRole, BookingStatus } from '@nearwork/types';

describe('NearWork Core System & Geofencing Tests', () => {
  it('should accurately calculate Haversine distance in kilometers', () => {
    // Gorakhpur Civil Lines (26.7606, 83.3732) to Mohaddipur (26.7650, 83.3800) ~ 0.83 km
    const dist = calculateDistanceKm(26.7606, 83.3732, 26.7650, 83.3800);
    expect(dist).toBeGreaterThan(0.5);
    expect(dist).toBeLessThan(1.5);
  });

  it('should enforce geofencing within 150 meters for arrival verification', () => {
    // Exact same coordinates (0m) -> within geofence
    const check1 = isWithinGeofence(26.7606, 83.3732, 26.7606, 83.3732);
    expect(check1.withinGeofence).toBe(true);
    expect(check1.distanceMeters).toBe(0);

    // Far away coordinates (10km) -> outside geofence
    const check2 = isWithinGeofence(26.7606, 83.3732, 26.8500, 83.4500);
    expect(check2.withinGeofence).toBe(false);
    expect(check2.distanceMeters).toBeGreaterThan(150);
  });

  it('should estimate urban travel ETA accurately', () => {
    const eta = estimateEtaMinutes(3.5); // 3.5 km
    expect(eta).toBeGreaterThanOrEqual(8);
    expect(eta).toBeLessThanOrEqual(20);
  });

  it('should generate cryptographically secure 4-digit service PIN OTPs', () => {
    const otp = generateServiceOtp();
    expect(otp).toHaveLength(4);
    expect(Number(otp)).toBeGreaterThanOrEqual(1000);
    expect(Number(otp)).toBeLessThanOrEqual(9999);
  });

  it('should generate unique booking and invoice reference identifiers', () => {
    const bookingNum = generateBookingNumber();
    const invNum = generateInvoiceNumber();

    expect(bookingNum).toMatch(/^NW-\d{8}-[A-F0-9]{4}$/);
    expect(invNum).toMatch(/^INV-\d{8}-[A-F0-9]{4}$/);
  });

  it('should sign and verify JWT tokens and preserve role payload', () => {
    const payload = {
      userId: 'test-user-id-123',
      email: 'customer@nearwork.com',
      role: UserRole.CUSTOMER,
      name: 'Sandeep Sharma'
    };

    const { accessToken, refreshToken } = generateTokens(payload);
    expect(accessToken).toBeDefined();
    expect(refreshToken).toBeDefined();

    const decoded = verifyAccessToken(accessToken);
    expect(decoded.userId).toBe(payload.userId);
    expect(decoded.role).toBe(UserRole.CUSTOMER);
    expect(decoded.email).toBe(payload.email);
  });
});
