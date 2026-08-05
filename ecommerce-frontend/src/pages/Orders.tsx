import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '@/store';
import { OrderAPI, ProductAPI } from '@/api/services';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Package, ChevronRight } from 'lucide-react';

export const Orders = () => {
  const { user } = useSelector((state: RootState) => state.auth);
  const [orders, setOrders] = useState<any[]>([]);
  const [productNames, setProductNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        if (user?.id) {
          const response = await OrderAPI.getUserOrders(user.id);
          // Sort orders by date descending
          const sorted = response.data.data.sort((a: any, b: any) => 
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
          setOrders(sorted);
          
          // Fetch product names for all unique product IDs
          const allProductIds = [...new Set(sorted.flatMap((order: any) => order.items?.map((i: any) => i.productId) || []))];
          const namesMap: Record<string, string> = {};
          
          await Promise.all(allProductIds.map(async (pId) => {
            try {
              const pRes = await ProductAPI.getById(pId as string, true);
              if (pRes.data?.data?.name) {
                namesMap[pId as string] = pRes.data.data.name;
              }
            } catch(e) {
              // Fail silently and fallback to default later
            }
          }));
          
          setProductNames(namesMap);
        }
      } catch (error) {
        toast.error('Failed to load orders');
      } finally {
        setLoading(false);
      }
    };
    fetchOrders();
  }, [user]);

  if (loading) {
    return (
      <div className="container mx-auto py-12 px-6 max-w-5xl space-y-6">
        <Skeleton className="h-10 w-48 mb-8 rounded-full" />
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 w-full rounded-[2rem]" />)}
      </div>
    );
  }

  return (
    <div className="container mx-auto py-12 px-6 max-w-5xl">
      <h1 className="text-3xl font-bold tracking-tight mb-8 text-slate-900">Order History</h1>
      
      {orders.length === 0 ? (
        <Card className="p-12 text-center rounded-[2rem] border-slate-100 shadow-sm bg-white">
          <div className="h-16 w-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
             <Package className="h-8 w-8 text-slate-300" />
          </div>
          <h3 className="text-xl font-bold mb-2 tracking-tight">No orders found</h3>
          <p className="text-slate-500 mb-6 font-medium text-sm">You haven't placed any orders yet.</p>
          <Link to="/products" className="inline-flex items-center justify-center h-10 px-6 rounded-full bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors shadow-sm shadow-primary/20 hover:-translate-y-0.5 duration-300 text-sm">
            Start Shopping
          </Link>
        </Card>
      ) : (
        <div className="space-y-4">
          {orders.map((order, index) => {
            let orderTitle = `Order #${order.orderId.substring(0,8).toUpperCase()}`;
            if (order.items && order.items.length > 0) {
              const firstId = order.items[0].productId;
              const firstName = productNames[firstId] || order.items[0].name || `Unknown Item`;
              orderTitle = order.items.length === 1 ? firstName : `${firstName} + ${order.items.length - 1} more`;
            }
            
            return (
              <motion.div
                key={order.orderId}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: index * 0.05, ease: "easeOut" }}
              >
                <Link to={`/orders/${order.orderId}`} className="block group">
                  <Card className="hover:border-primary/30 transition-all duration-300 cursor-pointer rounded-2xl border border-slate-100 bg-white shadow-sm hover:shadow-md hover:shadow-primary/5">
                    <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 bg-slate-50 rounded-xl flex items-center justify-center border border-slate-100 group-hover:bg-primary/5 transition-colors shrink-0">
                          <Package className="h-6 w-6 text-slate-400 group-hover:text-primary transition-colors" />
                        </div>
                        <div>
                          <h3 className="text-base font-bold text-slate-900 mb-0.5 flex items-center gap-2 truncate max-w-[200px] sm:max-w-xs md:max-w-md">
                            {orderTitle}
                          </h3>
                          <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                            <span>{order.created_at ? format(new Date(order.created_at), 'MMM dd, yyyy') : 'Recently'}</span>
                            <span className="w-1 h-1 rounded-full bg-slate-300" />
                            <span>{order.items?.length || 0} items</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between md:justify-end gap-6 border-t md:border-t-0 pt-4 md:pt-0 border-slate-100">
                        <div className="text-left md:text-right">
                          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">Total</p>
                          <p className="font-bold text-lg text-slate-900">${order.total_amount?.toFixed(2)}</p>
                        </div>
                        <Badge 
                          variant={order.status === 'PAID' || order.status === 'DELIVERED' ? 'default' : (order.status === 'CANCELLED' ? 'destructive' : 'secondary')}
                          className={`px-4 py-1.5 text-sm font-bold shadow-sm ${order.status === 'PAID' ? 'bg-green-500 hover:bg-green-600' : ''}`}
                        >
                          {order.status}
                        </Badge>
                        <ChevronRight className="h-5 w-5 text-slate-300 group-hover:text-primary transition-colors hidden sm:block transform group-hover:translate-x-1" />
                      </div>
                    </div>
                  </Card>
                </Link>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
};
