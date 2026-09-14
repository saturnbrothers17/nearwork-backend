import { Request, Response, NextFunction } from 'express';
import { HTTP_STATUS, ERROR_CODES } from '@nearwork/config';
import { ENV } from '../config/environment';

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
  errors?: Record<string, string[]>;
}

export const errorHandler = (
  err: AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const statusCode = err.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR;
  const code = err.code || ERROR_CODES.INTERNAL_ERROR;
  const message = err.message || 'An unexpected internal server error occurred';

  const response: Record<string, any> = {
    success: false,
    code,
    message
  };

  if (err.errors) {
    response.errors = err.errors;
  }

  if (ENV.NODE_ENV === 'development' && statusCode === HTTP_STATUS.INTERNAL_SERVER_ERROR) {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
};
