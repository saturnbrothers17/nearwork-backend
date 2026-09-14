import { Request, Response, NextFunction } from 'express';
import { HTTP_STATUS } from '@nearwork/config';
import { AuthService } from '../services/auth.service';

export class AuthController {
  static async registerCustomer(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await AuthService.registerCustomer(req.body);
      res.status(HTTP_STATUS.CREATED).json({
        success: true,
        message: 'Customer registered successfully',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  static async registerWorker(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await AuthService.registerWorker(req.body);
      res.status(HTTP_STATUS.CREATED).json({
        success: true,
        message: 'Worker registration submitted for KYC verification',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  static async login(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await AuthService.login(req.body);
      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Logged in successfully',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  static async refresh(req: Request, res: Response, next: NextFunction) {
    try {
      const { refreshToken } = req.body;
      const tokens = await AuthService.refresh(refreshToken);
      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Tokens refreshed',
        data: tokens
      });
    } catch (error) {
      next(error);
    }
  }

  static async logout(req: Request, res: Response, next: NextFunction) {
    try {
      if (req.user) {
        await AuthService.logout(req.user.id);
      }
      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Logged out successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  static async me(req: Request, res: Response, next: NextFunction) {
    try {
      res.status(HTTP_STATUS.OK).json({
        success: true,
        data: req.user
      });
    } catch (error) {
      next(error);
    }
  }
}
