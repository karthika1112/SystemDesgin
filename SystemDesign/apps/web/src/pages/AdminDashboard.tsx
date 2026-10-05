import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { Activity, Package, CheckCircle, XCircle, AlertTriangle, Layers, Server } from 'lucide-react';

export default function AdminDashboard() {
  const [metrics, setMetrics] = useState<any>(null);

  // Poll the backend every 3 seconds for real-time-ish dashboard
  useEffect(() => {
    const fetchMetrics = () => api.get('/admin/flash-sale/metrics').then(res => setMetrics(res.data)).catch(() => {});
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 3000);
    return () => clearInterval(interval);
  }, []);

  if (!metrics) return <div className="text-center mt-20 text-xl font-bold animate-pulse">Initializing Command Center...</div>;

  const MetricCard = ({ title, value, icon, bgClass, textClass }: any) => (
    <div className={`p-6 rounded-lg shadow-sm border flex items-center justify-between ${bgClass}`}>
      <div>
        <p className="text-sm uppercase tracking-widest font-bold opacity-75">{title}</p>
        <p className={`text-4xl font-black mt-2 ${textClass}`}>{value}</p>
      </div>
      <div className="opacity-20">{icon}</div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto mt-4">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-4xl font-black flex items-center gap-3">
          <Activity className="w-10 h-10 text-red-600 animate-pulse" />
          Flash Sale Command Center
        </h1>
        <div className="flex items-center gap-2 text-sm font-bold text-gray-500 bg-gray-100 px-4 py-2 rounded-full shadow-inner">
          <div className="w-3 h-3 bg-green-500 rounded-full animate-ping"></div>
          LIVE METRICS
        </div>
      </div>

      <div className="space-y-8">
        {/* INVENTORY FUNNEL */}
        <section>
          <h2 className="text-xl font-bold mb-4 text-gray-700 flex items-center gap-2"><Package /> Physical Inventory</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <MetricCard title="Total Stock" value={metrics.inventory.total} icon={<Layers size={64} />} bgClass="bg-white" textClass="text-gray-900" />
            <MetricCard title="Available" value={metrics.inventory.available} icon={<CheckCircle size={64} />} bgClass="bg-green-50 border-green-200" textClass="text-green-700" />
            <MetricCard title="Reserved" value={metrics.inventory.reserved} icon={<Activity size={64} />} bgClass="bg-yellow-50 border-yellow-200" textClass="text-yellow-700" />
            <MetricCard title="Sold (Completed)" value={metrics.inventory.sold} icon={<Package size={64} />} bgClass="bg-blue-50 border-blue-200" textClass="text-blue-700" />
          </div>
        </section>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* CHECKOUT PERFORMANCE */}
          <section>
            <h2 className="text-xl font-bold mb-4 text-gray-700">Checkout Throughput</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white p-6 border rounded-lg text-center shadow-sm">
                <p className="text-gray-500 text-sm font-bold uppercase mb-2">Reservations</p>
                <div className="flex justify-around">
                  <div className="text-green-600"><span className="text-2xl font-black">{metrics.reservations.success}</span><p className="text-xs">Secured</p></div>
                  <div className="text-red-600"><span className="text-2xl font-black">{metrics.reservations.failed}</span><p className="text-xs">Failed</p></div>
                </div>
              </div>
              
              <div className="bg-white p-6 border rounded-lg text-center shadow-sm">
                <p className="text-gray-500 text-sm font-bold uppercase mb-2">Payments</p>
                <div className="flex justify-around">
                  <div className="text-green-600"><span className="text-2xl font-black">{metrics.payments.success}</span><p className="text-xs">Success</p></div>
                  <div className="text-red-600"><span className="text-2xl font-black">{metrics.payments.failed}</span><p className="text-xs">Failed</p></div>
                </div>
              </div>

              <div className="bg-white p-6 border rounded-lg text-center shadow-sm col-span-2">
                <p className="text-gray-500 text-sm font-bold uppercase mb-2">Final Orders</p>
                <div className="flex justify-around">
                  <div className="text-blue-600"><span className="text-4xl font-black">{metrics.orders.confirmed}</span><p className="text-xs font-bold uppercase mt-1">Confirmed</p></div>
                  <div className="text-gray-600"><span className="text-4xl font-black">{metrics.orders.failed}</span><p className="text-xs font-bold uppercase mt-1">Cancelled</p></div>
                </div>
              </div>
            </div>
          </section>

          {/* SYSTEM HEALTH */}
          <section>
            <h2 className="text-xl font-bold mb-4 text-gray-700 flex items-center gap-2"><Server /> System Health</h2>
            <div className="grid grid-cols-1 gap-4">
              <div className="bg-gray-900 text-white p-6 rounded-lg shadow-sm flex justify-between items-center">
                <div>
                  <p className="text-gray-400 text-sm font-bold uppercase tracking-wider">Outbox Queue Backlog</p>
                  <p className="text-5xl font-black mt-2 text-green-400">{metrics.system.queueBacklog}</p>
                </div>
                <Server size={64} className="opacity-20" />
              </div>
              
              <div className="bg-red-50 border border-red-200 p-6 rounded-lg shadow-sm flex justify-between items-center">
                <div>
                  <p className="text-red-800 text-sm font-bold uppercase tracking-wider">Total Errors / DLQ</p>
                  <p className="text-5xl font-black mt-2 text-red-600">{metrics.system.errorCount}</p>
                </div>
                <AlertTriangle size={64} className="opacity-20 text-red-600" />
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
