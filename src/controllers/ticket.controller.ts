import { Request, Response, NextFunction } from 'express';
import { HTTP_STATUS } from '@nearwork/config';
import { prisma } from '../config/db';
import crypto from 'crypto';

export class TicketController {
  static async createTicket(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { bookingId, category, subject, description } = req.body;
      const ticketNumber = `TKT-${Date.now()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;

      const ticket = await prisma.supportTicket.create({
        data: {
          ticketNumber,
          userId,
          bookingId: bookingId || null,
          category,
          subject,
          description
        }
      });

      res.status(HTTP_STATUS.CREATED).json({
        success: true,
        message: 'Support ticket created successfully',
        data: ticket
      });
    } catch (error) {
      next(error);
    }
  }

  static async getMyTickets(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const tickets = await prisma.supportTicket.findMany({
        where: { userId },
        include: { booking: true },
        orderBy: { createdAt: 'desc' }
      });
      res.status(HTTP_STATUS.OK).json({ success: true, data: tickets });
    } catch (error) {
      next(error);
    }
  }

  static async getAllTickets(req: Request, res: Response, next: NextFunction) {
    try {
      const tickets = await prisma.supportTicket.findMany({
        include: {
          user: { select: { name: true, email: true, phone: true, role: true } },
          booking: true
        },
        orderBy: { createdAt: 'desc' }
      });
      res.status(HTTP_STATUS.OK).json({ success: true, data: tickets });
    } catch (error) {
      next(error);
    }
  }

  static async updateTicketStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { status, adminNotes } = req.body;

      const ticket = await prisma.supportTicket.update({
        where: { id },
        data: { status, adminNotes }
      });

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Ticket updated',
        data: ticket
      });
    } catch (error) {
      next(error);
    }
  }
}
