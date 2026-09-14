import { Request, Response, NextFunction } from 'express';
import { HTTP_STATUS } from '@nearwork/config';
import { ChatService } from '../services/chat.service';

export class ChatController {
  static async sendMessage(req: Request, res: Response, next: NextFunction) {
    try {
      const senderId = req.user!.id;
      const { bookingId, message, imageUrl } = req.body;
      const result = await ChatService.sendMessage(senderId, bookingId, message, imageUrl);
      res.status(HTTP_STATUS.CREATED).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  static async getMessages(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { bookingId } = req.params;
      const messages = await ChatService.getMessages(userId, bookingId);
      res.status(HTTP_STATUS.OK).json({
        success: true,
        data: messages
      });
    } catch (error) {
      next(error);
    }
  }
}
