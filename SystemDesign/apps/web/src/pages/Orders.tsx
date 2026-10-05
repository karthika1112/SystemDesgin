import React, { useEffect, useState } from 'react';
import { api } from '../services/api';

type Order = {
  id: string;
  status: string;
  totalAmount: number;
  createdAt: string;
  items: Array<{ productId: string, quantity: number, price: number }>;
};

export default function Orders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/orders').then(res => setOrders(res.data)).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-center mt-20">Loading your history...</div>;

  return (
    <div className="max-w-4xl mx-auto mt-8">
      <h2 className="text-3xl font-black mb-8">My Orders</h2>
      
      {orders.length === 0 ? (
        <div className="bg-gray-50 border p-8 text-center rounded text-gray-500">
          You haven't placed any orders yet.
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map(order => (
            <div key={order.id} className="border p-6 rounded bg-white shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
              <div>
                <p className="text-sm text-gray-500">Order #{order.id}</p>
                <p className="text-xs text-gray-400 mb-2">{new Date(order.createdAt).toLocaleString()}</p>
                <div className="font-bold">
                  {order.items.length} items • ${order.totalAmount}
                </div>
              </div>
              <div>
                <span className={`px-4 py-2 rounded-full text-sm font-bold ${
                  order.status === 'CONFIRMED' ? 'bg-green-100 text-green-800' :
                  order.status === 'CANCELLED' ? 'bg-red-100 text-red-800' :
                  order.status === 'PAYMENT_PENDING' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-blue-100 text-blue-800'
                }`}>
                  {order.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
