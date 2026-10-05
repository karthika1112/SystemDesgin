import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { Activity, Zap, ShieldAlert, Database, Clock, Server } from 'lucide-react';

export default function ObservabilityDashboard() {
  const [metrics, setMetrics] = useState<any>(null);

  useEffect(() => {
    const fetchMetrics = () => api.get('/admin/observability').then(res => setMetrics(res.data)).catch(() => {});
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 3000);
    return () => clearInterval(interval);
  }, []);

  if (!metrics) return <div className="text-center mt-20 font-bold animate-pulse">Initializing Observability Grafana...</div>;

  const MetricBox = ({ title, value, icon, color }: any) => (
    <div className={`p-4 rounded border flex items-center justify-between bg-white shadow-sm border-l-4 ${color}`}>
      <div>
        <p className="text-xs uppercase font-bold text-gray-500">{title}</p>
        <p className="text-3xl font-black mt-1 text-gray-800">{value}</p>
      </div>
      <div className="opacity-40">{icon}</div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto mt-4 font-mono">
      <h1 className="text-2xl font-black mb-6 flex items-center gap-3">
        <Activity className="text-purple-600" />
        System Observability & Telemetry
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <MetricBox title="Requests / Sec" value={`${metrics.system.reqPerSec} rps`} icon={<Zap size={40} />} color="border-purple-500" />
        <MetricBox title="Avg Latency" value={`${metrics.system.avgLatencyMs} ms`} icon={<Clock size={40} />} color="border-blue-500" />
        <MetricBox title="Error Rate" value={`${metrics.system.errorRatePct} %`} icon={<ShieldAlert size={40} />} color={metrics.system.errorRatePct > 1 ? "border-red-500 text-red-500" : "border-green-500"} />
        <MetricBox title="MQ Depth" value={metrics.system.messageQueueDepth} icon={<Server size={40} />} color="border-orange-500" />
        <MetricBox title="Active DB Conns" value={metrics.system.databaseActiveConnections} icon={<Database size={40} />} color="border-gray-800" />
        <MetricBox title="Uptime" value={`${metrics.system.uptimeSeconds}s`} icon={<Activity size={40} />} color="border-teal-500" />
      </div>

      <h2 className="text-lg font-bold mb-4 uppercase text-gray-600">Business Telemetry Aggregates</h2>
      <div className="bg-white p-6 rounded border shadow-sm grid grid-cols-3 gap-6 text-center">
        <div>
          <p className="font-bold border-b pb-2 mb-2">Reservations</p>
          <div className="text-green-600">Success: {metrics.business.reservationSuccess}</div>
          <div className="text-red-600">Failure: {metrics.business.reservationFailure}</div>
        </div>
        <div>
          <p className="font-bold border-b pb-2 mb-2">Payments</p>
          <div className="text-green-600">Success: {metrics.business.paymentSuccess}</div>
          <div className="text-red-600">Failure: {metrics.business.paymentFailure}</div>
        </div>
        <div>
          <p className="font-bold border-b pb-2 mb-2">Orders</p>
          <div className="text-green-600">Success: {metrics.business.orderSuccess}</div>
          <div className="text-red-600">Failure: {metrics.business.orderFailure}</div>
        </div>
      </div>
    </div>
  );
}
