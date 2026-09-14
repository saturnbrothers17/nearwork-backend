import { Request, Response, NextFunction } from 'express';
import { HTTP_STATUS, ERROR_CODES } from '@nearwork/config';
import { JwtPayload, UserRole } from '@nearwork/types';
import { verifyAccessToken } from '../utils/jwt';
import { prisma } from '../config/db';

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload & { id: string };
    }
  }
}

export const authenticateJwt = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        code: ERROR_CODES.AUTH_UNAUTHORIZED,
        message: 'Authentication token required'
      });
      return;
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);

    // Verify user exists and is active
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: { workerProfile: true, adminProfile: true }
    });

    if (!user || !user.isActive) {
      res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        code: ERROR_CODES.USER_NOT_FOUND,
        message: 'User account is deactivated or does not exist'
      });
      return;
    }

    req.user = {
      ...decoded,
      id: user.id,
      workerId: user.workerProfile?.id,
      adminId: user.adminProfile?.id
    };

    next();
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        code: ERROR_CODES.AUTH_TOKEN_EXPIRED,
        message: 'Authentication token has expired'
      });
      return;
    }

    res.status(HTTP_STATUS.UNAUTHORIZED).json({
      success: false,
      code: ERROR_CODES.AUTH_UNAUTHORIZED,
      message: 'Invalid authentication token'
    });
  }
};
