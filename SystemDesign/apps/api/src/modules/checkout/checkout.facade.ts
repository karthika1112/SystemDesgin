import { PrismaClient, Prisma } from '@prisma/client';
import { OrderRepository } from '../order/order.repository';

export class CheckoutFacade {
  constructor(
    private prisma: PrismaClient,
    private orderRepo: OrderRepository
  ) {}

  async processCheckout(reservationId: string, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Duplicate Checkout Protection via Repository
      const existing = await this.orderRepo.findByReservation(reservationId, tx);
      if (existing) return existing;

      // 2. Validate Reservation (Ideally moved to a ReservationRepo as well)
      const reservation = await tx.reservation.findUnique({ 
        where: { id: reservationId },
        include: { product: true }
      });

      if (!reservation || reservation.userId !== userId) throw new Error('INVALID_RESERVATION');
      if (reservation.status !== 'PENDING') throw new Error('RESERVATION_NOT_PENDING');
      if (new Date() > new Date(reservation.expiresAt)) throw new Error('RESERVATION_EXPIRED');

      // 3. Create Order natively through Domain Repository
      return this.orderRepo.createOrder(userId, reservation, tx);
    });
  }
}
