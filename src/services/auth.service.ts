import bcrypt from 'bcryptjs';
import { UserRole, WorkerStatus, WorkerVerificationStatus } from '@nearwork/types';
import { HTTP_STATUS, ERROR_CODES } from '@nearwork/config';
import { prisma } from '../config/db';
import { generateTokens, verifyRefreshToken } from '../utils/jwt';
import { AppError } from '../middlewares/error.middleware';

export class AuthService {
  /**
   * Register a new Customer
   */
  static async registerCustomer(data: {
    name: string;
    email: string;
    phone: string;
    password: string;
  }) {
    const existing = await prisma.user.findFirst({
      where: { OR: [{ email: data.email }, { phone: data.phone }] }
    });

    if (existing) {
      const err: AppError = new Error('User with this email or phone already exists');
      err.statusCode = HTTP_STATUS.CONFLICT;
      err.code = ERROR_CODES.VALIDATION_ERROR;
      throw err;
    }

    const passwordHash = await bcrypt.hash(data.password, 10);

    const user = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email.toLowerCase(),
        phone: data.phone,
        passwordHash,
        role: UserRole.CUSTOMER
      }
    });

    const tokens = generateTokens({
      userId: user.id,
      email: user.email,
      role: user.role as any,
      name: user.name
    });

    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: tokens.refreshToken }
    });

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role
      },
      tokens
    };
  }

  /**
   * Register a new Worker with KYC and skills
   */
  static async registerWorker(data: {
    name: string;
    email: string;
    phone: string;
    password: string;
    categoryIds: string[];
    experienceYears: number;
    workingRadiusKm: number;
    latitude: number;
    longitude: number;
    address: string;
    idProofType?: string;
    idProofUrl?: string;
    bankAccountNumber?: string;
    bankIfsc?: string;
  }) {
    const existing = await prisma.user.findFirst({
      where: { OR: [{ email: data.email }, { phone: data.phone }] }
    });

    if (existing) {
      const err: AppError = new Error('User with this email or phone already exists');
      err.statusCode = HTTP_STATUS.CONFLICT;
      err.code = ERROR_CODES.VALIDATION_ERROR;
      throw err;
    }

    const passwordHash = await bcrypt.hash(data.password, 10);

    // Create User, WorkerProfile, Skills, and default Schedule in a transaction
    const result = await prisma.$transaction(async (tx: any) => {
      const user = await tx.user.create({
        data: {
          name: data.name,
          email: data.email.toLowerCase(),
          phone: data.phone,
          passwordHash,
          role: UserRole.WORKER
        }
      });

      const workerProfile = await tx.workerProfile.create({
        data: {
          userId: user.id,
          status: WorkerStatus.OFFLINE,
          verificationStatus: WorkerVerificationStatus.PENDING,
          experienceYears: data.experienceYears,
          workingRadiusKm: data.workingRadiusKm,
          currentLat: data.latitude,
          currentLng: data.longitude,
          address: data.address,
          idProofType: data.idProofType,
          idProofUrl: data.idProofUrl,
          bankAccountNumber: data.bankAccountNumber,
          bankIfsc: data.bankIfsc
        }
      });

      // Add skills
      if (data.categoryIds && data.categoryIds.length > 0) {
        await tx.workerSkill.createMany({
          data: data.categoryIds.map((catId) => ({
            workerId: workerProfile.id,
            categoryId: catId,
            experienceYears: data.experienceYears
          }))
        });
      }

      // Add default Mon-Sat 09:00-18:00 schedule
      const defaultSchedule = [0, 1, 2, 3, 4, 5, 6].map((day) => ({
        workerId: workerProfile.id,
        dayOfWeek: day,
        startTime: '09:00',
        endTime: '18:00',
        isOff: day === 0 // Sunday off
      }));

      await tx.workerAvailability.createMany({ data: defaultSchedule });

      return { user, workerProfile };
    });

    const tokens = generateTokens({
      userId: result.user.id,
      email: result.user.email,
      role: result.user.role,
      workerId: result.workerProfile.id,
      name: result.user.name
    });

    await prisma.user.update({
      where: { id: result.user.id },
      data: { refreshToken: tokens.refreshToken }
    });

    return {
      user: {
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
        phone: result.user.phone,
        role: result.user.role,
        workerId: result.workerProfile.id,
        verificationStatus: result.workerProfile.verificationStatus
      },
      tokens
    };
  }

  /**
   * Universal Login with strict password hashing and role verification
   */
  static async login(data: { email: string; password: string; role?: UserRole }) {
    const user = await prisma.user.findUnique({
      where: { email: data.email.toLowerCase() },
      include: {
        workerProfile: {
          select: { id: true, status: true, verificationStatus: true, averageRating: true }
        },
        adminProfile: {
          select: { id: true, department: true }
        }
      }
    });

    if (!user) {
      const err: AppError = new Error('No account found with this email address. Please register or check your email.');
      err.statusCode = HTTP_STATUS.UNAUTHORIZED;
      err.code = ERROR_CODES.AUTH_INVALID_CREDENTIALS;
      throw err;
    }

    if (!user.isActive) {
      const err: AppError = new Error('Account has been deactivated. Please contact support.');
      err.statusCode = HTTP_STATUS.FORBIDDEN;
      err.code = ERROR_CODES.AUTH_FORBIDDEN;
      throw err;
    }

    if (data.role && user.role !== data.role) {
      const err: AppError = new Error(`This account is registered as ${user.role}. Please log in on the correct portal.`);
      err.statusCode = HTTP_STATUS.FORBIDDEN;
      err.code = ERROR_CODES.AUTH_FORBIDDEN;
      throw err;
    }

    const isValidPassword = await bcrypt.compare(data.password, user.passwordHash);
    if (!isValidPassword) {
      const err: AppError = new Error('Incorrect password. Please verify and try again.');
      err.statusCode = HTTP_STATUS.UNAUTHORIZED;
      err.code = ERROR_CODES.AUTH_INVALID_CREDENTIALS;
      throw err;
    }

    const tokens = generateTokens({
      userId: user.id,
      email: user.email,
      role: user.role as any,
      workerId: user.workerProfile?.id,
      adminId: user.adminProfile?.id,
      name: user.name
    });

    // Asynchronously persist refreshToken to Turso without blocking the response
    prisma.user
      .update({
        where: { id: user.id },
        data: { refreshToken: tokens.refreshToken }
      })
      .catch(() => {});

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role as any,
        workerProfile: user.workerProfile,
        adminProfile: user.adminProfile
      },
      tokens
    };
  }

  /**
   * Refresh Token rotation
   */
  static async refresh(refreshToken: string) {
    try {
      const decoded = verifyRefreshToken(refreshToken);
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        include: { workerProfile: true, adminProfile: true }
      });

      if (!user || user.refreshToken !== refreshToken || !user.isActive) {
        const err: AppError = new Error('Invalid or revoked refresh token');
        err.statusCode = HTTP_STATUS.UNAUTHORIZED;
        err.code = ERROR_CODES.AUTH_UNAUTHORIZED;
        throw err;
      }

      const tokens = generateTokens({
        userId: user.id,
        email: user.email,
        role: user.role as any,
        workerId: user.workerProfile?.id,
        adminId: user.adminProfile?.id,
        name: user.name
      });

      await prisma.user.update({
        where: { id: user.id },
        data: { refreshToken: tokens.refreshToken }
      });

      return tokens;
    } catch (e) {
      const err: AppError = new Error('Invalid refresh token');
      err.statusCode = HTTP_STATUS.UNAUTHORIZED;
      err.code = ERROR_CODES.AUTH_UNAUTHORIZED;
      throw err;
    }
  }

  /**
   * Logout user by clearing stored refresh token
   */
  static async logout(userId: string) {
    await prisma.user.update({
      where: { id: userId },
      data: { refreshToken: null }
    });
    return { success: true };
  }
}
