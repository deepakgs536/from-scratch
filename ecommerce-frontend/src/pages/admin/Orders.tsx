import { useEffect, useState } from 'react';
import { OrderAPI, ProductAPI, UserAPI } from '@/api/services';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { PackageCheck, Truck, X } from 'lucide-react';

export const AdminOrders = () => {
  const [orders, setOrders] = useState<any[]>([]);
  const [productNames, setProductNames] = useState<Record<string, string>>({});
  const [userNames, setUserNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const response = await OrderAPI.getAllOrders();
      // sort by date descending
      const sortedOrders = response.data.data.sort((a: any, b: any) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      setOrders(sortedOrders);
      
      const allProductIds = [...new Set(sortedOrders.flatMap((order: any) => order.items?.map((i: any) => i.productId) || []))];
      const namesMap: Record<string, string> = {};
      
      await Promise.all(allProductIds.map(async (pId) => {
        try {
          const pRes = await ProductAPI.getById(pId as string, true);
          if (pRes.data?.data?.name) {
            namesMap[pId as string] = pRes.data.data.name;
          }
        } catch(e) {}
      }));
      setProductNames(namesMap);
      
      const allUserIds = [...new Set(sortedOrders.map((order: any) => order.userId).filter(Boolean))];
      const usersMap: Record<string, string> = {};
      await Promise.all(allUserIds.map(async (uId) => {
        try {
          const uRes = await UserAPI.getProfile(uId as string, true);
          if (uRes.data?.data?.name) {
            usersMap[uId as string] = uRes.data.data.name;
          }
        } catch (e) {}
      }));
      setUserNames(usersMap);
      
    } catch (error) {
      toast.error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (orderId: string, newStatus: string) => {
    setUpdating(orderId);
    try {
      await OrderAPI.updateOrderStatus(orderId, newStatus);
      setOrders(orders.map(o => o.orderId === orderId ? { ...o, status: newStatus } : o));
      toast.success(`Order ${orderId} marked as ${newStatus}`);
    } catch (error) {
      toast.error('Failed to update order status');
    } finally {
      setUpdating(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING': return <Badge variant="secondary">Pending</Badge>;
      case 'PAID': return <Badge className="bg-blue-500 hover:bg-blue-600">Paid</Badge>;
      case 'SHIPPED': return <Badge className="bg-purple-500 hover:bg-purple-600">Shipped</Badge>;
      case 'DELIVERED': return <Badge className="bg-green-500 hover:bg-green-600">Delivered</Badge>;
      case 'CANCELLED': return <Badge variant="destructive">Cancelled</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };



  return (
    <div className="min-h-[calc(100vh-64px)] bg-[#F8FAFC] py-8 px-4 sm:px-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">Orders Management</h1>
          <p className="text-slate-500 mt-1 text-sm font-medium">View and process customer orders.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card className="border-none shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] rounded-[1.5rem] bg-white overflow-hidden hover:-translate-y-1 transition-all duration-300">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-slate-900">{loading ? '-' : orders.length}</div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] rounded-[1.5rem] bg-white overflow-hidden hover:-translate-y-1 transition-all duration-300">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-amber-500 uppercase tracking-wider">To Process (Paid)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-slate-900">
              {loading ? '-' : orders.filter(o => o.status === 'PAID').length}
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] rounded-[1.5rem] bg-white overflow-hidden hover:-translate-y-1 transition-all duration-300">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-blue-500 uppercase tracking-wider">In Transit</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-slate-900">
              {loading ? '-' : orders.filter(o => o.status === 'SHIPPED').length}
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] rounded-[1.5rem] bg-white overflow-hidden hover:-translate-y-1 transition-all duration-300">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-emerald-500 uppercase tracking-wider">Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-slate-900">
              {loading ? '-' : `$${orders.reduce((acc, curr) => acc + (curr.total_amount || 0), 0).toFixed(2)}`}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-none shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] rounded-[2rem] bg-white overflow-hidden">
        <CardHeader className="px-6 pt-6 pb-3 border-b border-slate-50">
          <CardTitle className="text-lg font-bold text-slate-900">Recent Orders</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-50 hover:bg-transparent">
                    <TableHead className="font-semibold text-slate-500">Order / Items</TableHead>
                    <TableHead className="font-semibold text-slate-500">Date</TableHead>
                    <TableHead className="font-semibold text-slate-500">Customer</TableHead>
                    <TableHead className="font-semibold text-slate-500">Total</TableHead>
                    <TableHead className="font-semibold text-slate-500">Status</TableHead>
                    <TableHead className="text-right font-semibold text-slate-500">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map(order => {
                    let orderTitle = `Order #${order.orderId.substring(0,8).toUpperCase()}`;
                    if (order.items && order.items.length > 0) {
                      const firstId = order.items[0].productId;
                      const firstName = productNames[firstId] || order.items[0].name || `Unknown Item`;
                      orderTitle = order.items.length === 1 ? firstName : `${firstName} + ${order.items.length - 1} more`;
                    }

                    return (
                    <TableRow 
                      key={order.orderId}
                      className="border-slate-50 hover:bg-slate-50/50 cursor-pointer transition-colors"
                      onClick={() => setSelectedOrder(order)}
                    >
                      <TableCell>
                        <p className="font-bold text-slate-900 text-sm truncate max-w-[200px]">{orderTitle}</p>
                        <p className="font-mono text-xs text-slate-400 mt-0.5">{order.orderId.substring(0, 8)}</p>
                      </TableCell>
                      <TableCell className="text-slate-500 font-medium text-sm">{order.created_at ? format(new Date(order.created_at), 'MMM dd, yyyy') : 'N/A'}</TableCell>
                      <TableCell>
                        <p className="font-bold text-sm text-slate-900">{userNames[order.userId] || 'Unknown User'}</p>
                      </TableCell>
                      <TableCell className="font-bold text-slate-900 text-sm">${(order.total_amount || 0).toFixed(2)}</TableCell>
                      <TableCell><div className="scale-90 origin-left">{getStatusBadge(order.status)}</div></TableCell>
                      <TableCell className="text-right space-x-2">
                        {order.status === 'PAID' && (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="text-blue-600 border-blue-200 hover:bg-blue-50"
                            disabled={updating === order.orderId}
                            onClick={(e) => {
                              e.stopPropagation();
                              updateStatus(order.orderId, 'SHIPPED');
                            }}
                          >
                            <Truck className="h-4 w-4 mr-1" /> Ship
                          </Button>
                        )}
                        {order.status === 'SHIPPED' && (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="text-green-600 border-green-200 hover:bg-green-50"
                            disabled={updating === order.orderId}
                            onClick={(e) => {
                              e.stopPropagation();
                              updateStatus(order.orderId, 'DELIVERED');
                            }}
                          >
                            <PackageCheck className="h-4 w-4 mr-1" /> Deliver
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                    );
                  })}
                  {orders.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        No orders found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Order Details Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <Card className="w-full max-w-2xl shadow-2xl border-0 ring-1 ring-border/50 max-h-[90vh] overflow-y-auto">
            <CardHeader className="bg-muted/30 pb-4 border-b flex flex-row items-center justify-between sticky top-0 z-10 backdrop-blur-md">
              <div>
                <CardTitle>Order Details</CardTitle>
                <p className="font-mono text-xs text-muted-foreground mt-1">{selectedOrder.orderId}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setSelectedOrder(null)} className="h-8 w-8 rounded-full">
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              <div className="flex justify-between items-center p-4 bg-muted/30 rounded-lg border">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Amount</p>
                  <p className="text-3xl font-black">${(selectedOrder.total_amount || 0).toFixed(2)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-muted-foreground mb-1">Order Status</p>
                  {getStatusBadge(selectedOrder.status)}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6 text-sm">
                <div>
                  <p className="text-muted-foreground mb-1 font-semibold">Customer</p>
                  <p className="font-medium">{userNames[selectedOrder.userId] || 'Unknown User'}</p>
                  <p className="text-xs text-muted-foreground mt-1">ID: {selectedOrder.userId}</p>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1 font-semibold">Order Date</p>
                  <p className="font-medium">{selectedOrder.created_at ? format(new Date(selectedOrder.created_at), 'PPP pp') : 'N/A'}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-muted-foreground mb-1 font-semibold">Shipping Address</p>
                  {selectedOrder.shipping_address ? (
                    <div className="bg-muted/20 p-3 rounded-md border">
                      <p>{selectedOrder.shipping_address.street}</p>
                      <p>{selectedOrder.shipping_address.city}, {selectedOrder.shipping_address.state} {selectedOrder.shipping_address.zip}</p>
                    </div>
                  ) : (
                    <p className="italic text-muted-foreground">No address provided</p>
                  )}
                </div>
              </div>

              <div>
                <p className="font-semibold mb-3 border-b pb-2">Order Items</p>
                <div className="space-y-3">
                  {selectedOrder.items?.map((item: any, i: number) => {
                    const itemName = productNames[item.productId] || item.name || 'Unknown Item';
                    return (
                    <div key={i} className="flex justify-between items-center bg-muted/10 p-3 rounded border">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-muted rounded flex items-center justify-center text-xs font-mono shrink-0">
                          <PackageCheck className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="font-medium text-sm text-slate-900">{itemName}</p>
                          <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                            <span>ID: {item.productId.substring(0, 8)}...</span>
                            <span>•</span>
                            <span>Qty: {item.quantity}</span>
                          </div>
                        </div>
                      </div>
                      <p className="font-semibold">${(item.price * item.quantity || item.price_at_addition * item.quantity || 0).toFixed(2)}</p>
                    </div>
                  )})}
                </div>
              </div>

            </CardContent>
            <div className="flex justify-end p-4 bg-muted/10 border-t mt-2 rounded-b-xl sticky bottom-0 z-10 backdrop-blur-md">
              <Button variant="outline" onClick={() => setSelectedOrder(null)}>Close</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
