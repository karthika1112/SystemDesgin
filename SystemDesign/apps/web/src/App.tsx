import { Routes, Route, Link, useNavigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { ShoppingCart, User as UserIcon } from 'lucide-react';
import Products from './pages/Products';
import ProductDetails from './pages/ProductDetails';
import Checkout from './pages/Checkout';
import PaymentResult from './pages/PaymentResult';
import Orders from './pages/Orders';
import Cart from './pages/Cart';
import OrderDetails from './pages/OrderDetails';
import AdminDashboard from './pages/AdminDashboard';
import ObservabilityDashboard from './pages/ObservabilityDashboard';
import Auth from './pages/Auth';

function App() {
  const { user, logout, loading } = useAuth();
  const navigate = useNavigate();

  if (loading) return <div className="p-8 text-center">Loading SALESTORM...</div>;

  return (
    <div className="min-h-screen flex flex-col">
      <nav className="bg-gray-900 text-white p-4 shadow-md flex justify-between items-center">
        <Link to="/" className="text-2xl font-black tracking-tighter text-red-500 italic">SALESTORM</Link>
        <div className="flex items-center space-x-6">
          <Link to="/" className="hover:text-gray-300">Products</Link>
          {user ? (
            <>
              <Link to="/cart" className="hover:text-gray-300">Cart</Link>
              <Link to="/orders" className="hover:text-gray-300">My Orders</Link>
              {user.role === 'ADMIN' && (
                <>
                  <Link to="/admin" className="hover:text-red-400 font-bold">Admin</Link>
                  <Link to="/observability" className="hover:text-purple-400 font-bold">Telemetry</Link>
                </>
              )}
              <button onClick={() => { logout(); navigate('/auth'); }} className="hover:text-gray-300">Logout ({user.name})</button>
            </>
          ) : (
            <Link to="/auth" className="hover:text-gray-300">Login / Register</Link>
          )}
        </div>
      </nav>
      
      <main className="flex-grow container mx-auto p-4 md:p-8">
        <Routes>
          <Route path="/" element={<Products />} />
          <Route path="/product/:id" element={<ProductDetails />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/payment-result" element={<PaymentResult />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/orders/:id" element={<OrderDetails />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/observability" element={<ObservabilityDashboard />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
