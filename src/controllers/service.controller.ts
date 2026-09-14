import { Request, Response, NextFunction } from 'express';
import { HTTP_STATUS } from '@nearwork/config';
import { prisma } from '../config/db';
import { appCache, CACHE_TTL } from '../utils/cache';

export class ServiceController {
  /**
   * Get all active service categories
   */
  static async getCategories(req: Request, res: Response, next: NextFunction) {
    try {
      const categories = await appCache.getOrSet('all_categories', CACHE_TTL.CATEGORIES, async () => {
        return prisma.serviceCategory.findMany({
          where: { isActive: true },
          include: {
            services: { where: { isActive: true } }
          },
          orderBy: { sortOrder: 'asc' }
        });
      });
      res.status(HTTP_STATUS.OK).json({ success: true, data: categories });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get services by category or search term with filters
   */
  static async getServices(req: Request, res: Response, next: NextFunction) {
    try {
      const { categorySlug, search } = req.query;

      const where: any = { isActive: true };

      if (categorySlug) {
        where.category = { slug: String(categorySlug) };
      }

      if (search) {
        where.OR = [
          { name: { contains: String(search) } },
          { description: { contains: String(search) } }
        ];
      }

      const cacheKey = !search ? `services_${categorySlug || 'all'}` : null;

      const fetchServices = () =>
        prisma.service.findMany({
          where,
          include: { category: true },
          orderBy: { basePrice: 'asc' }
        });

      const services = cacheKey
        ? await appCache.getOrSet(cacheKey, CACHE_TTL.SERVICES, fetchServices)
        : await fetchServices();

      res.status(HTTP_STATUS.OK).json({ success: true, data: services });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get single service details and available time slots
   */
  static async getServiceDetails(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const service = await prisma.service.findUnique({
        where: { id },
        include: { category: true }
      });

      if (!service) {
        res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: 'Service not found'
        });
        return;
      }

      // Pre-configured time slots
      const availableSlots = [
        '09:00 AM',
        '10:00 AM',
        '11:00 AM',
        '12:00 PM',
        '02:00 PM',
        '03:00 PM',
        '04:00 PM',
        '05:00 PM'
      ];

      res.status(HTTP_STATUS.OK).json({
        success: true,
        data: {
          ...service,
          inclusionsList: JSON.parse(service.inclusions || '[]'),
          availableSlots
        }
      });
    } catch (error) {
      next(error);
    }
  }
}
