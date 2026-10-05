import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../services/api';

export default function OrderDetails() {
  const { id } = useParams();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/orders/${id}`).then(res => setOrder(res.data)).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="text-center mt-20">Loading order...</div>;
  if (!order) return <div className="text-center mt-20 text-red-500 font-bold">Order not found</div>;

  return (
    <div className="max-w-3xl mx-auto mt-8 bg-white p-8 rounded shadow-sm border">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-black">Order {order.id.slice(0, 8)}</h2>
        <span className="px-4 py-2 rounded-full font-bold bg-gray-100">{order.status}</span>
      </div>
      
      <div className="mb-8">
        <p className="text-gray-500 mb-4">Placed on {new Date(order.createdAt).toLocaleString()}</p>
        <div className="space-y-3">
          {order.items.map((item: any) => (
            <div key={item.id} className="flex justify-between border-b pb-2">
              <span>{item.quantity}x Product {item.productId.slice(0,8)}</span>
              <span className="font-bold">${item.price}</span>
            </div>
          ))}
        </div>
        <div className="flex justify-between mt-4 text-xl font-black">
          <span>Total</span>
          <span>${order.totalAmount}</span>
        </div>
      </div>

      <div className="flex justify-between mt-8">
        <Link to="/orders" className="text-blue-600 hover:underline">← Back to Orders</Link>
        {order.status === 'PAYMENT_PENDING' && (
          <Link to={`/checkout?reservationId=${order.reservationId}`} className="btn-primary">Pay Now</Link>
        )}
      </div>
    </div>
  );
}
