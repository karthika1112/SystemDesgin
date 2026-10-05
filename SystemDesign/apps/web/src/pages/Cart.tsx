import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

export default function Cart() {
  const [cart, setCart] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      api.get('/cart').then(res => setCart(res.data)).finally(() => setLoading(false));
    }
  }, [user]);

  if (!user) return <div className="text-center mt-20">Please login to view your cart.</div>;
  if (loading) return <div className="text-center mt-20">Loading cart...</div>;

  return (
    <div className="max-w-4xl mx-auto mt-8">
      <h2 className="text-3xl font-black mb-8">Your Cart</h2>
      {!cart || !cart.items || cart.items.length === 0 ? (
        <div className="text-center text-gray-500 py-10 border rounded bg-gray-50">Cart is empty.</div>
      ) : (
        <div className="space-y-4">
          {cart.items.map((item: any) => (
            <div key={item.id} className="border p-4 rounded flex justify-between items-center">
              <div>
                <h3 className="font-bold">{item.product?.name || 'Product'}</h3>
                <p className="text-sm text-gray-500">Qty: {item.quantity}</p>
              </div>
              <div className="font-bold">${Number(item.price) * item.quantity}</div>
            </div>
          ))}
          <div className="text-right mt-6">
            <button className="btn-primary">Checkout Cart</button>
          </div>
        </div>
      )}
    </div>
  );
}
