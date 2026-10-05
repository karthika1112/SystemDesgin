import React from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { CheckCircle, XCircle, AlertCircle } from 'lucide-react';

export default function PaymentResult() {
  const [searchParams] = useSearchParams();
  const status = searchParams.get('status');
  const orderId = searchParams.get('orderId');
  const reason = searchParams.get('reason');

  return (
    <div className="max-w-md mx-auto mt-20 text-center bg-white p-8 border rounded-lg shadow-sm">
      {status === 'success' && (
        <>
          <CheckCircle className="w-20 h-20 text-green-500 mx-auto mb-6" />
          <h2 className="text-3xl font-black mb-2 text-green-600">Payment Successful!</h2>
          <p className="text-gray-600 mb-6">Your order <span className="font-mono bg-gray-100 p-1 rounded">{orderId}</span> has been confirmed and is being processed.</p>
        </>
      )}
      
      {status === 'failed' && (
        <>
          <XCircle className="w-20 h-20 text-red-500 mx-auto mb-6" />
          <h2 className="text-3xl font-black mb-2 text-red-600">Payment Failed</h2>
          <p className="text-gray-600 mb-6">{reason || 'Your card was declined or had insufficient funds.'}</p>
          <p className="text-sm font-bold text-gray-500 mb-6">Your reservation has been released.</p>
        </>
      )}

      {status === 'timeout' && (
        <>
          <AlertCircle className="w-20 h-20 text-yellow-500 mx-auto mb-6" />
          <h2 className="text-3xl font-black mb-2 text-yellow-600">Payment Processing...</h2>
          <p className="text-gray-600 mb-6">The gateway timed out, but we are still verifying your payment in the background. Check your orders page shortly.</p>
        </>
      )}

      <div className="flex gap-4 justify-center mt-8">
        <Link to="/orders" className="btn-primary flex-1 text-center">View Orders</Link>
        <Link to="/" className="border border-gray-300 bg-white text-gray-700 font-bold py-2 px-4 rounded hover:bg-gray-50 transition flex-1 text-center">Continue Shopping</Link>
      </div>
    </div>
  );
}
