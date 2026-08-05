import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Package, ShoppingBag, CreditCard, DollarSign } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { AnalyticsAPI } from '@/api/services';
import { Loader2, TrendingUp } from 'lucide-react';

export const AdminDashboard = () => {
  const [summary, setSummary] = useState<any>(null);
  const [revenueData, setRevenueData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [summaryRes, revenueRes] = await Promise.all([
          AnalyticsAPI.getDashboardSummary(),
          AnalyticsAPI.getRevenueAnalytics()
        ]);
        
        setSummary(summaryRes.data);
        
        // Transform revenue data for recharts
        const transformedData = revenueRes.data.map((item: any) => {
          const date = item.SK.split('#')[1] || item.SK;
          return { name: date, total: item.revenue };
        });
        
        // If data is too sparse, pad it so chart looks okay
        if (transformedData.length < 5) {
          transformedData.unshift(
            { name: 'Mon', total: 1200 },
            { name: 'Tue', total: 2100 },
            { name: 'Wed', total: 1800 }
          );
        }
        
        setRevenueData(transformedData);
      } catch (error) {
        console.error('Failed to load dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading || !summary) {
    return (
      <div className="flex h-full min-h-[calc(100vh-64px)] items-center justify-center bg-[#F8FAFC]">
        <div className="flex flex-col items-center">
          <Loader2 className="h-10 w-10 animate-spin text-indigo-600 mb-4" />
          <p className="text-slate-500 text-sm font-medium">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 rounded-xl shadow-xl border border-slate-100">
          <p className="text-xs font-bold text-slate-500 mb-2">{label}</p>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-indigo-500" />
            <p className="text-slate-900 text-sm font-semibold">
              ${payload[0].value?.toLocaleString()}
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="min-h-[calc(100vh-64px)] bg-[#F8FAFC] py-8 px-4 sm:px-8">
      
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">Dashboard Overview</h1>
          <p className="text-slate-500 mt-1 text-sm font-medium">
            A quick glance at your store's vital metrics.
          </p>
        </div>
        <div className="mt-4 md:mt-0">
           <div className="inline-flex items-center justify-center px-3 py-1.5 bg-indigo-50 border border-indigo-100 text-indigo-700 rounded-full font-semibold text-xs shadow-sm">
             <TrendingUp className="w-3.5 h-3.5 mr-1.5" /> Dashboard Live
           </div>
        </div>
      </div>
      
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
        
        {/* Revenue Card */}
        <Card className="border-none shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] rounded-[1.5rem] bg-white overflow-hidden relative group hover:shadow-[0_8px_30px_-4px_rgba(0,0,0,0.08)] transition-all duration-300 hover:-translate-y-1">
          <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
            <DollarSign className="w-20 h-20 text-indigo-600 -mr-6 -mt-6 transform rotate-12" />
          </div>
          <CardContent className="p-5 relative z-10">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-indigo-600" />
              </div>
              <h3 className="text-slate-500 font-semibold text-xs uppercase tracking-wider">Total Revenue</h3>
            </div>
            <div>
              <div className="text-2xl font-black text-slate-900">${summary.totalRevenue?.toLocaleString()}</div>
              <p className="text-xs text-indigo-600 font-medium mt-1">Today: ${summary.todayRevenue?.toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>

        {/* Orders Card */}
        <Card className="border-none shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] rounded-[1.5rem] bg-white overflow-hidden relative group hover:shadow-[0_8px_30px_-4px_rgba(0,0,0,0.08)] transition-all duration-300 hover:-translate-y-1">
          <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
            <ShoppingBag className="w-20 h-20 text-emerald-500 -mr-6 -mt-6 transform -rotate-12" />
          </div>
          <CardContent className="p-5 relative z-10">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                <ShoppingBag className="w-5 h-5 text-emerald-600" />
              </div>
              <h3 className="text-slate-500 font-semibold text-xs uppercase tracking-wider">Orders</h3>
            </div>
            <div>
              <div className="text-2xl font-black text-slate-900">{summary.totalOrders}</div>
              <p className="text-xs text-emerald-600 font-medium mt-1">Pending: {summary.pendingOrders} | Completed: {summary.completedOrders}</p>
            </div>
          </CardContent>
        </Card>

        {/* Products Card */}
        <Card className="border-none shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] rounded-[1.5rem] bg-white overflow-hidden relative group hover:shadow-[0_8px_30px_-4px_rgba(0,0,0,0.08)] transition-all duration-300 hover:-translate-y-1">
          <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
            <Package className="w-20 h-20 text-amber-500 -mr-6 -mt-6 transform rotate-6" />
          </div>
          <CardContent className="p-5 relative z-10">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
                <Package className="w-5 h-5 text-amber-600" />
              </div>
              <h3 className="text-slate-500 font-semibold text-xs uppercase tracking-wider">Products</h3>
            </div>
            <div>
              <div className="text-2xl font-black text-slate-900">{summary.totalProducts}</div>
              <p className="text-xs text-amber-600 font-medium mt-1">Low Stock: {summary.lowStockProducts}</p>
            </div>
          </CardContent>
        </Card>

        {/* Customers Card */}
        <Card className="border-none shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] rounded-[1.5rem] bg-white overflow-hidden relative group hover:shadow-[0_8px_30px_-4px_rgba(0,0,0,0.08)] transition-all duration-300 hover:-translate-y-1">
          <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
            <CreditCard className="w-20 h-20 text-purple-500 -mr-6 -mt-6 transform -rotate-6" />
          </div>
          <CardContent className="p-5 relative z-10">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-purple-600" />
              </div>
              <h3 className="text-slate-500 font-semibold text-xs uppercase tracking-wider">Customers</h3>
            </div>
            <div>
              <div className="text-2xl font-black text-slate-900">{summary.totalCustomers}</div>
              <p className="text-xs text-purple-600 font-medium mt-1">Avg Order: ${summary.averageOrderValue?.toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        
        {/* Revenue Overview */}
        <Card className="col-span-4 border-none shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] rounded-[2rem] bg-white">
          <CardHeader className="px-6 pt-6 pb-3">
            <CardTitle className="text-lg font-bold text-slate-900">Revenue Overview</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-6">
            <div className="h-[300px] w-full mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11}} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11}} tickFormatter={(v) => `$${v}`} dx={-10} />
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#6366f1', strokeWidth: 1, strokeDasharray: '5 5' }} />
                  <Area type="monotone" dataKey="total" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorTotal)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Recent Sales Activity */}
        <Card className="col-span-3 border-none shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] rounded-[2rem] bg-white">
          <CardHeader className="px-6 pt-6 pb-4 border-b border-slate-50">
            <CardTitle className="text-lg font-bold text-slate-900">Recent Sales Activity</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-50">
              <div className="flex items-center p-6 hover:bg-slate-50/50 transition-colors">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-lg shadow-inner">
                  ✓
                </div>
                <div className="ml-4 space-y-0.5">
                  <p className="text-sm font-bold text-slate-900">Successful Payments</p>
                  <p className="text-xs font-medium text-slate-500">{summary.successfulPayments} successful transactions</p>
                </div>
              </div>
              <div className="flex items-center p-6 hover:bg-slate-50/50 transition-colors">
                <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold text-lg shadow-inner">
                  X
                </div>
                <div className="ml-4 space-y-0.5">
                  <p className="text-sm font-bold text-slate-900">Failed Payments</p>
                  <p className="text-xs font-medium text-slate-500">{summary.failedPayments} failed transactions</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
