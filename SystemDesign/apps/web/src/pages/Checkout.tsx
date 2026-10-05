import React, { useEffect, useState, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { v4 as uuidv4 } from 'uuid';

export default function Checkout() {
  const [searchParams] = useSearchParams();
  const reservationId = searchParams.get('reservationId');
  const navigate = useNavigate();

  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState('');
  
  // Persist Idempotency key per session to protect against accidental re-renders causing double payments
  const paymentKeyRef = useRef(uuidv4()); 

  useEffect(() => {
    if (!reservationId) {
      navigate('/');
      return;
    }

    // 1. Immediately convert Reservation into a PAYMENT_PENDING Order
    api.post('/checkout', { reservationId })
      .then(res => setOrder(res.data))
      .catch(err => setError(err.response?.data?.message || 'Failed to initiate checkout'))
      .finally(() => setLoading(false));
  }, [reservationId, navigate]);

  const handlePay = async () => {
    setPaying(true);
    setError('');
    
    try {
      // 2. Safely process payment through our robust backend
      await api.post('/payments', 
        { orderId: order.id, amount: Number(order.totalAmount) },
        { headers: { 'Idempotency-Key': paymentKeyRef.current } }
      );
      
      navigate(`/payment-result?status=success&orderId=${order.id}`);
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Payment processing failed';
      if (err.response?.status === 400 && err.response?.data?.status === 'TIMEOUT') {
        navigate(`/payment-result?status=timeout&orderId=${order.id}`);
      } else {
        navigate(`/payment-result?status=failed&orderId=${order.id}&reason=${encodeURIComponent(msg)}`);
      }
    } finally {
      setPaying(false);
    }
  };

  if (loading) return <div className="text-center mt-20">Securing your order...</div>;
  if (error) return <div className="text-red-500 font-bold text-center mt-20">{error}</div>;

  return (
    <div className="max-w-xl mx-auto mt-12 bg-white p-8 border rounded-lg shadow-sm">
      <h2 className="text-2xl font-black mb-6">Complete Checkout</h2>
      
      <div className="bg-gray-50 p-4 rounded mb-6 border">
        <h3 className="font-bold text-gray-700 mb-2">Order Summary</h3>
        <div className="flex justify-between mb-2">
          <span>Order ID:</span>
          <span className="font-mono text-sm">{order.id}</span>
        </div>
        <div className="flex justify-between mb-2">
          <span>Status:</span>
          <span className="font-bold text-orange-600">{order.status}</span>
        </div>
        <hr className="my-4" />
        <div className="flex justify-between text-xl font-black">
          <span>Total:</span>
          <span>${order.totalAmount}</span>
        </div>
      </div>

      <button 
        onClick={handlePay} 
        disabled={paying}
        className="w-full btn-primary py-3 text-lg"
      >
        {paying ? 'Processing Payment securely...' : `Pay $${order.totalAmount}`}
      </button>
    </div>
  );
}
