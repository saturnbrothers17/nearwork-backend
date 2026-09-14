import { Request, Response, NextFunction } from 'express';
import { UserRole } from '@nearwork/types';
import { HTTP_STATUS, ERROR_CODES } from '@nearwork/config';

export const requireRole = (allowedRoles: UserRole | UserRole[]) => {
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        code: ERROR_CODES.AUTH_UNAUTHORIZED,
        message: 'Authentication required'
      });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        code: ERROR_CODES.AUTH_FORBIDDEN,
        message: `Forbidden: Access restricted to [${roles.join(', ')}] role(s)`
      });
      return;
    }

    next();
  };
};

export const requireCustomer = requireRole(UserRole.CUSTOMER);
export const requireWorker = requireRole(UserRole.WORKER);
export const requireAdmin = requireRole(UserRole.ADMIN);
export const requireAnyAuthenticated = requireRole([UserRole.CUSTOMER, UserRole.WORKER, UserRole.ADMIN]);
