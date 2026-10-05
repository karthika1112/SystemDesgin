import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';

type Product = { id: string, name: string, price: number, description: string, inventory: { availableQuantity: number } };

export default function Products() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/products').then(res => setProducts(res.data)).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-center py-20">Loading amazing deals...</div>;

  return (
    <div>
      <h1 className="text-3xl font-black mb-8">Active Drops</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {products.map(p => (
          <Link to={`/product/${p.id}`} key={p.id} className="block group cursor-pointer border rounded-lg overflow-hidden bg-white hover:shadow-lg transition">
            <div className="h-48 bg-gray-200 flex items-center justify-center text-gray-400 group-hover:scale-105 transition-transform duration-500">
              [Product Image Placeholder]
            </div>
            <div className="p-4">
              <h3 className="text-lg font-bold">{p.name}</h3>
              <p className="text-gray-600 text-sm mb-2 h-10 overflow-hidden">{p.description}</p>
              <div className="flex justify-between items-center">
                <span className="text-xl font-bold">${p.price}</span>
                {p.inventory && p.inventory.availableQuantity < 50 && (
                  <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded font-bold">Low Stock: {p.inventory.availableQuantity} left!</span>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
