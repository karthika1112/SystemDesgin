import { PrismaClient, Prisma } from '@prisma/client';

export class OrderRepository {
  constructor(private prisma: PrismaClient) {}

  async findByReservation(reservationId: string, tx?: Prisma.TransactionClient) {
    const db = tx || this.prisma;
    return db.order.findUnique({ where: { reservationId } });
  }

  async createOrder(userId: string, reservation: any, tx?: Prisma.TransactionClient) {
    const db = tx || this.prisma;
    return db.order.create({
      data: {
        userId,
        reservationId: reservation.id,
        status: 'PAYMENT_PENDING',
        totalAmount: Number(reservation.product.price) * reservation.quantity,
        items: {
          create: {
            productId: reservation.productId,
            quantity: reservation.quantity,
            price: reservation.product.price,
          }
        }
      }
    });
  }
}
