import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { HTTP_STATUS, ERROR_CODES } from '@nearwork/config';

export const validateRequest = (schema: ZodSchema) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      req.body = await schema.parseAsync(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const formattedErrors: Record<string, string[]> = {};
        error.errors.forEach((err) => {
          const path = err.path.join('.');
          if (!formattedErrors[path]) formattedErrors[path] = [];
          formattedErrors[path].push(err.message);
        });

        res.status(HTTP_STATUS.UNPROCESSABLE_ENTITY).json({
          success: false,
          code: ERROR_CODES.VALIDATION_ERROR,
          message: 'Validation failed on input fields',
          errors: formattedErrors
        });
        return;
      }
      next(error);
    }
  };
};
