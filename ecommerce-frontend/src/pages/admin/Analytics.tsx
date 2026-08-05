import { useState, useEffect } from 'react';
import { AnalyticsAPI } from '@/api/services';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, DollarSign, Package, CreditCard, Users, CheckCircle, XCircle, TrendingUp, ArrowUpRight } from 'lucide-react';
import { 
  ResponsiveContainer, 
  AreaChart, Area, 
  BarChart, Bar, 
  XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell
} from 'recharts';

export const AdminAnalytics = () => {
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState<any>(null);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const response = await AnalyticsAPI.getGeneratedReport();
        const data = response.data.data || response.data;
        setReportData(data);
      } catch (error) {
        console.error('Failed to load analytics report:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchAnalytics();
  }, []);

  if (loading || !reportData) {
    return (
      <div className="flex h-full min-h-[calc(100vh-64px)] items-center justify-center bg-[#F8FAFC]">
        <div className="flex flex-col items-center">
          <Loader2 className="h-10 w-10 animate-spin text-indigo-600 mb-4" />
          <p className="text-slate-500 text-sm font-medium">Generating your insights...</p>
        </div>
      </div>
    );
  }

  const { users, products, orders, inventory, payments, trends } = reportData;

  const COLORS = ['#6366f1', '#10b981', '#f43f5e', '#f59e0b']; 

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 rounded-xl shadow-xl border border-slate-100">
          <p className="text-xs font-bold text-slate-500 mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
              <p className="text-slate-900 text-sm font-semibold">
                {entry.name === 'revenue' ? '$' : ''}{entry.value?.toLocaleString()}
              </p>
            </div>
          ))}
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
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">Analytics Dashboard</h1>
          <p className="text-slate-500 mt-1 text-sm font-medium">
            Overview of your business performance. <span className="text-slate-400 text-xs ml-2">Updated: {new Date(reportData.generatedAt).toLocaleString()}</span>
          </p>
        </div>
        <div className="mt-4 md:mt-0">
           <div className="inline-flex items-center justify-center px-3 py-1.5 bg-indigo-50 border border-indigo-100 text-indigo-700 rounded-full font-semibold text-xs shadow-sm">
             <TrendingUp className="w-3.5 h-3.5 mr-1.5" /> Live Insights Active
           </div>
        </div>
      </div>

      {/* Top Metric Cards */}
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
              <span className="text-2xl font-black text-slate-900">${orders?.totalRevenue?.toLocaleString() || 0}</span>
              <div className="flex items-center mt-1 text-xs text-indigo-600 font-medium">
                <ArrowUpRight className="w-3 h-3 mr-1" /> From {orders?.total || 0} orders
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Users Card */}
        <Card className="border-none shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] rounded-[1.5rem] bg-white overflow-hidden relative group hover:shadow-[0_8px_30px_-4px_rgba(0,0,0,0.08)] transition-all duration-300 hover:-translate-y-1">
          <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
            <Users className="w-20 h-20 text-emerald-500 -mr-6 -mt-6 transform -rotate-12" />
          </div>
          <CardContent className="p-5 relative z-10">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                <Users className="w-5 h-5 text-emerald-600" />
              </div>
              <h3 className="text-slate-500 font-semibold text-xs uppercase tracking-wider">Total Users</h3>
            </div>
            <div>
              <span className="text-2xl font-black text-slate-900">{users?.total || 0}</span>
              <div className="flex items-center mt-1 text-xs text-emerald-600 font-medium">
                <TrendingUp className="w-3 h-3 mr-1" /> Active customers
              </div>
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
              <span className="text-2xl font-black text-slate-900">{products?.total || 0}</span>
              <div className="flex items-center mt-1 text-xs text-amber-600 font-medium">
                <span className="mr-1">•</span> {inventory?.totalItems || 0} units in stock
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Payments Card */}
        <Card className="border-none shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] rounded-[1.5rem] bg-white overflow-hidden relative group hover:shadow-[0_8px_30px_-4px_rgba(0,0,0,0.08)] transition-all duration-300 hover:-translate-y-1">
          <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
            <CreditCard className="w-20 h-20 text-rose-500 -mr-6 -mt-6 transform -rotate-6" />
          </div>
          <CardContent className="p-5 relative z-10">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-rose-600" />
              </div>
              <h3 className="text-slate-500 font-semibold text-xs uppercase tracking-wider">Payments</h3>
            </div>
            <div>
              <span className="text-2xl font-black text-slate-900">{payments?.total || 0}</span>
              <div className="flex gap-3 items-center mt-1 text-xs font-medium">
                 <span className="flex items-center text-emerald-600"><CheckCircle className="w-3 h-3 mr-1" /> {payments?.successfulCount || 0}</span>
                 <span className="flex items-center text-rose-600"><XCircle className="w-3 h-3 mr-1" /> {payments?.failedCount || 0}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Charts Area */}
      <div className="grid gap-6 md:grid-cols-2 mb-8">
        
        {/* Revenue Trend Chart */}
        <Card className="border-none shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] rounded-[2rem] bg-white">
          <CardHeader className="px-6 pt-6 pb-3">
            <CardTitle className="text-lg font-bold text-slate-900">Revenue Flow</CardTitle>
            <CardDescription className="text-slate-500 text-xs font-medium">Daily revenue generation</CardDescription>
          </CardHeader>
          <CardContent className="px-4 pb-6">
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trends?.revenueTrends || []} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11}} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11}} tickFormatter={(v) => `$${v}`} dx={-10} />
                  <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#6366f1', strokeWidth: 1, strokeDasharray: '5 5' }} />
                  <Area type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={3} fill="url(#colorRev)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Customer Growth Chart */}
        <Card className="border-none shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] rounded-[2rem] bg-white">
          <CardHeader className="px-6 pt-6 pb-3">
            <CardTitle className="text-lg font-bold text-slate-900">Customer Acquisition</CardTitle>
            <CardDescription className="text-slate-500 text-xs font-medium">New users joining the platform</CardDescription>
          </CardHeader>
          <CardContent className="px-4 pb-6">
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trends?.customerGrowth || []} margin={{ top: 20, right: 30, left: 0, bottom: 0 }} barSize={24}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11}} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11}} dx={-10} />
                  <Tooltip content={<CustomTooltip />} cursor={{fill: '#f8fafc'}} />
                  <Bar dataKey="newUsers" fill="#10b981" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Section Grid */}
      <div className="grid gap-6 md:grid-cols-3">
        
        {/* Top Products */}
        <Card className="md:col-span-2 border-none shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] rounded-[2rem] bg-white overflow-hidden">
          <CardHeader className="px-6 pt-6 pb-4 border-b border-slate-50">
            <CardTitle className="text-lg font-bold text-slate-900 flex items-center justify-between">
              Top Performers
              <span className="text-[10px] font-semibold px-2 py-1 bg-slate-100 text-slate-600 rounded-full uppercase tracking-wider">By Revenue</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-50">
              {(trends?.topSellingProducts || []).map((product: any, i: number) => (
                <div key={i} className="flex items-center justify-between p-4 sm:px-6 hover:bg-slate-50/50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-100 to-purple-50 flex items-center justify-center shadow-inner">
                      <span className="text-sm font-black text-indigo-900">#{i+1}</span>
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">{product.name || 'Unknown Product'}</h4>
                      <p className="text-xs font-medium text-slate-400 mt-0.5">ID: {product.productId?.split('-')[0]}...</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-base font-black text-slate-900">${product.revenue?.toLocaleString() || 0}</div>
                    <div className="text-[10px] font-semibold text-emerald-500 mt-1 flex items-center justify-end uppercase tracking-wider">
                      <TrendingUp className="w-3 h-3 mr-1" /> High Demand
                    </div>
                  </div>
                </div>
              ))}
              {(!trends?.topSellingProducts || trends.topSellingProducts.length === 0) && (
                <div className="text-center py-10">
                   <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3">
                     <Package className="w-6 h-6 text-slate-300" />
                   </div>
                   <p className="text-slate-500 text-sm font-medium">No product data available yet.</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Inventory Status */}
        <Card className="border-none shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] rounded-[2rem] bg-white">
          <CardHeader className="px-6 pt-6 pb-2 text-center">
            <CardTitle className="text-lg font-bold text-slate-900">Inventory Health</CardTitle>
            <CardDescription className="text-slate-500 text-xs font-medium mt-1">Real-time stock distribution</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center pb-6">
            <div className="h-[220px] w-full relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={trends?.inventoryStatus || []}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="count"
                    nameKey="status"
                    stroke="none"
                  >
                    {(trends?.inventoryStatus || []).map((_: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              {/* Inner Center Text */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-3xl font-black text-slate-900">{inventory?.totalItems || 0}</span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Total</span>
              </div>
            </div>
            
            {/* Custom Legend */}
            <div className="w-full max-w-[180px] mt-2 space-y-2">
              {(trends?.inventoryStatus || []).map((item: any, i: number) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }}></div>
                    <span className="text-xs font-medium text-slate-600">{item.status}</span>
                  </div>
                  <span className="text-xs font-bold text-slate-900">{item.count}</span>
                </div>
              ))}
            </div>

          </CardContent>
        </Card>

      </div>
    </div>
  );
};
