import { prisma } from '../config/db';
import { getSocketIO } from '../config/socket';
import { SOCKET_EVENTS } from '@nearwork/types';
import { AppError } from '../middlewares/error.middleware';
import { HTTP_STATUS } from '@nearwork/config';

export class ChatService {
  /**
   * Send a chat message within an active booking
   */
  static async sendMessage(senderId: string, bookingId: string, message: string, imageUrl?: string) {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { chat: true, customer: true, worker: { include: { user: true } } }
    });

    if (!booking) {
      const err: AppError = new Error('Booking not found');
      err.statusCode = HTTP_STATUS.NOT_FOUND;
      throw err;
    }

    // Verify sender belongs to booking
    const isCustomer = booking.customerId === senderId;
    const isWorker = booking.worker?.userId === senderId;

    if (!isCustomer && !isWorker) {
      const err: AppError = new Error('Unauthorized to chat on this booking');
      err.statusCode = HTTP_STATUS.FORBIDDEN;
      throw err;
    }

    let chat = booking.chat;
    if (!chat) {
      chat = await prisma.chat.create({
        data: {
          bookingId,
          customerId: booking.customerId,
          workerId: booking.workerId || '',
          isActive: true
        }
      });
    }

    const newMsg = await prisma.chatMessage.create({
      data: {
        chatId: chat.id,
        senderId,
        message,
        imageUrl: imageUrl || null
      },
      include: {
        sender: { select: { id: true, name: true, role: true, avatarUrl: true } }
      }
    });

    const recipientUserId = isCustomer ? booking.worker?.userId : booking.customerId;
    const recipientRole = isCustomer ? 'WORKER' : 'CUSTOMER';
    const senderName = newMsg.sender?.name || (isCustomer ? 'Customer' : 'Service Partner');

    // Create DB Notification for recipient
    if (recipientUserId) {
      await prisma.notification.create({
        data: {
          userId: recipientUserId,
          title: `💬 Message from ${senderName}`,
          message: message.length > 80 ? message.substring(0, 77) + '...' : message,
          type: 'CHAT',
          data: JSON.stringify({ bookingId, senderId, senderName })
        }
      }).catch(() => {});
    }

    // Broadcast message via Socket.IO directly to recipient and booking room (Socket.IO deduplicates client sockets in room array)
    const io = getSocketIO();
    if (io) {
      const chatPayload = {
        bookingId,
        message: newMsg,
        senderName,
        senderId,
        recipientUserId
      };

      const rooms = [`booking:${bookingId}`];
      if (recipientUserId) {
        rooms.push(`user:${recipientUserId}`);
      }
      io.to(rooms).emit(SOCKET_EVENTS.CHAT_MESSAGE, chatPayload);
    }

    return newMsg;
  }

  /**
   * Get chat history for a booking
   */
  static async getMessages(userId: string, bookingId: string) {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        chat: {
          include: {
            messages: {
              include: { sender: { select: { id: true, name: true, role: true } } },
              orderBy: { createdAt: 'asc' }
            }
          }
        },
        worker: true
      }
    });

    if (!booking) {
      const err: AppError = new Error('Booking not found');
      err.statusCode = HTTP_STATUS.NOT_FOUND;
      throw err;
    }

    const isCustomer = booking.customerId === userId;
    const isWorker = booking.worker?.userId === userId;

    if (!isCustomer && !isWorker) {
      const err: AppError = new Error('Unauthorized');
      err.statusCode = HTTP_STATUS.FORBIDDEN;
      throw err;
    }

    return booking.chat?.messages || [];
  }
}
