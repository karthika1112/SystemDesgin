import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { v4 as uuidv4 } from 'uuid';

type Product = { id: string, name: string, price: number, description: string, inventory: { availableQuantity: number } };

export default function ProductDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [reserving, setReserving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get(`/products/${id}`).then(res => setProduct(res.data)).catch(() => setError('Product not found')).finally(() => setLoading(false));
  }, [id]);

  const handleFlashSaleBuyNow = async () => {
    if (!user) {
      navigate('/auth');
      return;
    }
    
    setError('');
    setReserving(true);
    
    // Front-end generated idempotency key protects against double-clicks
    const idempotencyKey = uuidv4();
    
    try {
      const res = await api.post('/reservations', 
        { productId: product!.id, quantity: 1 }, 
        { headers: { 'Idempotency-Key': idempotencyKey } }
      );
      
      // Navigate to checkout securely holding the guaranteed reservation token
      navigate(`/checkout?reservationId=${res.data.id}`);
    } catch (err: any) {
      if (err.response?.status === 422) {
        setError('OUT OF STOCK! You missed it.');
      } else if (err.response?.status === 409) {
        setError('Processing request... please wait.');
      } else {
        setError(err.response?.data?.message || 'Server error while reserving.');
      }
    } finally {
      setReserving(false);
    }
  };

  if (loading) return <div>Loading...</div>;
  if (!product) return <div className="text-red-500">{error}</div>;

  const isOutOfStock = product.inventory && product.inventory.availableQuantity <= 0;

  return (
    <div className="max-w-4xl mx-auto flex flex-col md:flex-row gap-8 mt-8">
      <div className="w-full md:w-1/2 h-96 bg-gray-200 rounded-lg flex items-center justify-center text-gray-500 text-xl font-bold">
        {product.name} Image
      </div>
      <div className="w-full md:w-1/2 flex flex-col justify-center">
        {product.inventory && product.inventory.availableQuantity <= 100 && !isOutOfStock && (
          <div className="inline-block bg-red-600 text-white text-xs font-black px-3 py-1 uppercase tracking-widest mb-4 rounded-full self-start animate-pulse">
            ⚡ Flash Sale - Only {product.inventory.availableQuantity} available!
          </div>
        )}
        <h1 className="text-4xl font-black mb-4">{product.name}</h1>
        <p className="text-gray-600 mb-8 leading-relaxed">{product.description}</p>
        <div className="text-3xl font-bold mb-8">${product.price}</div>
        
        {error && <div className="bg-red-100 text-red-800 p-4 rounded mb-6 font-bold">{error}</div>}
        
        <button 
          onClick={handleFlashSaleBuyNow} 
          disabled={reserving || isOutOfStock}
          className={`w-full py-4 text-xl uppercase tracking-wider ${isOutOfStock ? 'bg-gray-400 text-gray-200 cursor-not-allowed rounded' : 'btn-flash'}`}
        >
          {isOutOfStock ? 'Sold Out' : reserving ? 'Securing Inventory...' : 'Buy Now'}
        </button>
      </div>
    </div>
  );
}
