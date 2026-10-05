import { PrismaClient } from '@prisma/client';

export type OrderStatus = 'CREATED' | 'PAYMENT_PENDING' | 'CONFIRMED' | 'PROCESSING' | 'SHIPPED' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'CANCELLED';

export class OrderStateService {
  static validTransitions: Record<OrderStatus, OrderStatus[]> = {
    CREATED: ['PAYMENT_PENDING', 'CANCELLED'],
    PAYMENT_PENDING: ['CONFIRMED', 'CANCELLED'],
    CONFIRMED: ['PROCESSING', 'CANCELLED'],
    PROCESSING: ['SHIPPED', 'CANCELLED'],
    SHIPPED: ['OUT_FOR_DELIVERY'],
    OUT_FOR_DELIVERY: ['DELIVERED'],
    DELIVERED: [],
    CANCELLED: []
  };

  static canTransition(current: OrderStatus, next: OrderStatus): boolean {
    return this.validTransitions[current]?.includes(next) ?? false;
  }

  static async transition(orderId: string, nextStatus: OrderStatus, tx: any) {
    const order = await tx.order.findUnique({ 
      where: { id: orderId }, 
      include: { items: true, reservation: true } 
    });
    
    if (!order) throw new Error('Order not found');
    
    const currentStatus = order.status as OrderStatus;

    if (currentStatus === nextStatus) {
      return order; // IDEMPOTENT: already transitioned safely
    }

    if (!this.canTransition(currentStatus, nextStatus)) {
      throw new Error(`INVALID_TRANSITION`);
    }

    const quantity = order.items[0]?.quantity || 0;
    const productId = order.items[0]?.productId;

    // Side Effects Handling
    if (currentStatus === 'PAYMENT_PENDING' && nextStatus === 'CONFIRMED') {
      // Move from reserved to sold
      await tx.inventory.updateMany({
        where: { productId },
        data: { 
          reservedQuantity: { decrement: quantity }, 
          soldQuantity: { increment: quantity }, 
          version: { increment: 1 } 
        }
      });
      if (order.reservationId) {
        await tx.reservation.updateMany({
          where: { id: order.reservationId },
          data: { status: 'CONFIRMED' }
        });
      }
    }

    if (nextStatus === 'CANCELLED') {
      if (currentStatus === 'PAYMENT_PENDING') {
        // Return from reserved to available
        await tx.inventory.updateMany({
          where: { productId },
          data: { 
            reservedQuantity: { decrement: quantity }, 
            availableQuantity: { increment: quantity }, 
            version: { increment: 1 } 
          }
        });
        if (order.reservationId) {
          await tx.reservation.updateMany({
            where: { id: order.reservationId },
            data: { status: 'RELEASED' }
          });
        }
      } else if (currentStatus === 'CONFIRMED' || currentStatus === 'PROCESSING') {
         // Return from sold to available (Admin/manual cancellation)
         await tx.inventory.updateMany({
          where: { productId },
          data: { 
            soldQuantity: { decrement: quantity }, 
            availableQuantity: { increment: quantity }, 
            version: { increment: 1 } 
          }
        });
      }
    }

    const updated = await tx.order.update({
      where: { id: orderId },
      data: { status: nextStatus }
    });
    
    return updated;
  }
}
