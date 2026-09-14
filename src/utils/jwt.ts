import jwt from 'jsonwebtoken';
import { JwtPayload, UserRole } from '@nearwork/types';
import { ENV } from '../config/environment';

export const generateTokens = (payload: {
  userId: string;
  email: string;
  role: UserRole;
  workerId?: string;
  adminId?: string;
  name?: string;
}) => {
  const accessToken = jwt.sign(payload, ENV.JWT_SECRET, {
    expiresIn: ENV.JWT_EXPIRES_IN as any
  });

  const refreshToken = jwt.sign(
    { userId: payload.userId, role: payload.role },
    ENV.JWT_REFRESH_SECRET,
    { expiresIn: ENV.JWT_REFRESH_EXPIRES_IN as any }
  );

  return { accessToken, refreshToken };
};

export const verifyAccessToken = (token: string): JwtPayload => {
  return jwt.verify(token, ENV.JWT_SECRET) as JwtPayload;
};

export const verifyRefreshToken = (token: string): { userId: string; role: UserRole } => {
  return jwt.verify(token, ENV.JWT_REFRESH_SECRET) as { userId: string; role: UserRole };
};
