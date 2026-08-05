import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { OrderAPI, ProductAPI, MediaAPI, PaymentAPI } from '@/api/services';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { ArrowLeft, Package, MapPin, Truck, CheckCircle2, CreditCard, Clock, Check } from 'lucide-react';
import { motion } from 'framer-motion';

export const OrderDetails = () => {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<any>(null);
  const [productDetails, setProductDetails] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  
  // Tabs State
  const [activeTab, setActiveTab] = useState<'overview' | 'tracking' | 'edit' | 'payments'>('overview');
  
  // Edit Form State
  const [editForm, setEditForm] = useState({
    street: '', city: '', state: '', zip: '',
    contact_number: '', delivery_instructions: ''
  });
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        if (id) {
          const response = await OrderAPI.getById(id);
          const orderData = response.data.data;
          console.log("[DEBUG] Fetched Order Data from API:", orderData);
          setOrder(orderData);
          if (orderData.shipping_address) {
            setEditForm({
              street: orderData.shipping_address.street || '',
              city: orderData.shipping_address.city || '',
              state: orderData.shipping_address.state || '',
              zip: orderData.shipping_address.zip || '',
              contact_number: orderData.contact_number || '',
              delivery_instructions: orderData.delivery_instructions || ''
            });
          }
          
          // Fetch product details dynamically
          if (orderData.items && orderData.items.length > 0) {
            const allProductIds = [...new Set(orderData.items.map((i: any) => i.productId))];
            const detailsMap: Record<string, any> = {};
            
            await Promise.all(allProductIds.map(async (pId) => {
              try {
                const pRes = await ProductAPI.getById(pId as string, true);
                const pData = pRes.data?.data;
                if (pData) {
                  if (pData.image_url) {
                    try {
                      const mRes = await MediaAPI.getDownloadUrl(pData.image_url);
                      pData.image_url = mRes.data?.url || pData.image_url;
                    } catch(e) {}
                  }
                  detailsMap[pId as string] = pData;
                }
              } catch(e) {}
            }));
            setProductDetails(detailsMap);
          }
        }
      } catch (error) {
        toast.error('Failed to load order details');
      } finally {
        setLoading(false);
      }
    };
    fetchOrder();
  }, [id]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order) return;
    
    setIsUpdating(true);
    try {
      const response = await OrderAPI.updateOrder(order.orderId, {
        shipping_address: {
          street: editForm.street,
          city: editForm.city,
          state: editForm.state,
          zip: editForm.zip
        },
        contact_number: editForm.contact_number,
        delivery_instructions: editForm.delivery_instructions
      });
      setOrder(response.data.data);
      toast.success('Order details updated successfully!');
      setActiveTab('overview');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to update order');
    } finally {
      setIsUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto py-12 px-6 max-w-5xl space-y-8">
        <Skeleton className="h-10 w-48 mb-8 rounded-full" />
        <Skeleton className="h-16 w-full rounded-2xl" />
        <div className="grid md:grid-cols-3 gap-8">
          <div className="md:col-span-2 space-y-4">
            <Skeleton className="h-[400px] w-full rounded-[2rem]" />
          </div>
          <Skeleton className="h-[400px] w-full rounded-[2rem]" />
        </div>
      </div>
    );
  }

  if (!order) {
    return <div className="text-center py-32 text-2xl font-bold">Order not found</div>;
  }

  const stages = ['PENDING', 'PAID', 'SHIPPED', 'DELIVERED'];
  const currentStageIndex = stages.indexOf(order.status);
  
  const isCancelled = order.status === 'CANCELLED';

  const orderTitle = order.items && order.items.length > 0 
    ? (order.items.length === 1 
        ? (productDetails[order.items[0].productId]?.name || order.items[0].name || `Unknown Item`) 
        : `${productDetails[order.items[0].productId]?.name || order.items[0].name || `Unknown Item`} + ${order.items.length - 1} more items`)
    : `Order #${order.orderId.substring(0,8).toUpperCase()}`;

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Package },
    { id: 'tracking', label: 'Tracking', icon: Truck },
    { id: 'edit', label: 'Edit Details', icon: MapPin },
    { id: 'payments', label: 'Payments', icon: CreditCard },
  ];

  return (
    <div className="container mx-auto py-12 px-6 max-w-5xl">
      <Link to="/orders" className="inline-flex items-center text-sm font-semibold text-slate-500 hover:text-primary transition-colors mb-10 bg-white/50 px-4 py-2 rounded-full border border-slate-200/50 backdrop-blur-md">
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Orders
      </Link>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-6 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold tracking-tight mb-1 text-slate-900">
            {orderTitle}
          </h1>
          <p className="text-slate-500 text-sm flex items-center gap-2 font-medium">
            <Clock className="w-4 h-4" />
            Placed on {order.created_at ? format(new Date(order.created_at), 'MMMM dd, yyyy - hh:mm a') : 'Unknown'}
          </p>
        </div>
        <Badge variant={isCancelled ? 'destructive' : (order.status === 'DELIVERED' || order.status === 'PAID' ? 'default' : 'secondary')} className={`text-lg py-2 px-6 font-bold shadow-md rounded-xl ${order.status === 'PAID' ? 'bg-green-500' : ''}`}>
          {order.status}
        </Badge>
      </div>

      {/* Tabs Navigation */}
      <div className="flex overflow-x-auto space-x-2 mb-10 pb-2 no-scrollbar border-b border-slate-200">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center whitespace-nowrap px-6 py-3 text-sm font-bold transition-colors relative rounded-full ${
                isActive ? 'text-primary' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <tab.icon className="w-4 h-4 mr-2" />
              {tab.label}
              {isActive && (
                <motion.div
                  layoutId="activeTabIndicator"
                  className="absolute bottom-[-9px] left-0 right-0 h-1 bg-primary rounded-t-full"
                  initial={false}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
        
        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <Card className="rounded-[2rem] shadow-sm border border-slate-100 bg-white overflow-hidden">
                <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-6">
                  <CardTitle className="flex items-center text-lg font-bold">
                    <Package className="mr-2 h-5 w-5 text-primary" /> Order Items
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {order.items?.map((item: any, idx: number) => (
                    <div key={idx} className="flex justify-between items-center p-6 border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors">
                      <div className="flex items-center gap-6">
                        <div className="w-16 h-16 bg-white rounded-xl flex items-center justify-center border border-slate-100 shadow-sm overflow-hidden shrink-0">
                           {productDetails[item.productId]?.image_url || item.image_url ? (
                              <img src={productDetails[item.productId]?.image_url || item.image_url} alt="Product" className="w-full h-full object-cover" />
                           ) : (
                              <Package className="h-6 w-6 text-slate-300" />
                           )}
                        </div>
                        <div>
                          <p className="font-bold text-base text-slate-900">{productDetails[item.productId]?.name || item.name || 'Unknown Item'}</p>
                          <div className="flex items-center gap-3 mt-1">
                            <Badge variant="secondary" className="text-[10px] rounded-md font-semibold bg-slate-100 text-slate-700">Qty: {item.quantity}</Badge>
                            <span className="text-xs font-semibold text-slate-500">${item.price_at_addition?.toFixed(2)} each</span>
                          </div>
                        </div>
                      </div>
                      <p className="font-bold text-lg text-slate-900">${((item.price_at_addition || 0) * item.quantity).toFixed(2)}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card className="rounded-[2rem] shadow-sm border border-slate-100 bg-white">
                <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-6">
                  <CardTitle className="font-bold">Order Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 p-6">
                  <div className="flex justify-between text-sm font-medium">
                    <span className="text-slate-500">Subtotal</span>
                    <span className="text-slate-900">${order.total_amount?.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-medium">
                    <span className="text-slate-500">Tax(8%)</span>
                    <span className="text-green-600 font-bold">$20</span>
                  </div>
                  <div className="flex justify-between text-sm font-medium">
                    <span className="text-slate-500">Shipping</span>
                    <span className="text-green-600 font-bold">$15</span>
                  </div>
                  <div className="border-t border-slate-100 pt-4 flex justify-between font-black text-xl">
                    <span>Total</span>
                    <span className="text-primary">${order.total_amount?.toFixed(2)}</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-[2rem] shadow-sm border border-slate-100 bg-white">
                <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-6">
                  <CardTitle className="flex items-center text-lg font-bold">
                    <MapPin className="mr-2 h-5 w-5 text-primary" /> Shipping Info
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-4 p-6">
                  {order.shipping_address ? (
                    <div className="space-y-1">
                      <p className="font-bold text-base text-slate-900">{order.shipping_address.street}</p>
                      <p className="text-slate-500 font-medium">{order.shipping_address.city}, {order.shipping_address.state} {order.shipping_address.zip}</p>
                    </div>
                  ) : (
                    <p className="text-slate-400 italic">No address provided.</p>
                  )}
                  {order.contact_number && (
                    <div className="pt-4 border-t border-slate-100 mt-4">
                      <span className="text-slate-400 block text-xs uppercase tracking-wider mb-1 font-bold">Contact</span>
                      <p className="font-medium text-slate-900">{order.contact_number}</p>
                    </div>
                  )}
                  {order.delivery_instructions && (
                    <div className="pt-4 border-t border-slate-100 mt-4">
                      <span className="text-slate-400 block text-xs uppercase tracking-wider mb-1 font-bold">Instructions</span>
                      <p className="italic text-slate-600 font-medium">"{order.delivery_instructions}"</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* TRACKING TAB */}
        {activeTab === 'tracking' && (
          <Card className="rounded-[2rem] shadow-sm border border-slate-100 bg-white max-w-3xl mx-auto overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-6">
              <CardTitle className="text-xl font-bold">Order Progress</CardTitle>
            </CardHeader>
            <CardContent className="p-8 md:p-12">
              {isCancelled ? (
                <div className="text-center py-12">
                  <div className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-red-50 mb-4">
                     <span className="text-3xl">❌</span>
                  </div>
                  <h2 className="text-2xl font-bold text-red-600 mb-2">Order Cancelled</h2>
                  <p className="text-slate-500 text-sm max-w-md mx-auto font-medium leading-relaxed">This order has been cancelled and cannot be fulfilled. If you have been charged, a refund will be issued shortly.</p>
                </div>
              ) : (
                <div className="relative pt-4">
                  {/* Progress Line */}
                  <div className="absolute left-6 top-4 bottom-4 w-1 bg-slate-100 md:w-auto md:h-1 md:top-10 md:left-6 md:right-6 md:bottom-auto z-0 -translate-x-1/2 md:translate-x-0 md:-translate-y-1/2 rounded-full">
                     {/* Colored Progress Line */}
                     <div 
                        className="bg-primary absolute left-0 top-0 transition-all duration-1000 ease-in-out rounded-full"
                        style={{ 
                          width: window.innerWidth >= 768 ? `${Math.max(0, currentStageIndex) * 33.33}%` : '100%',
                          height: window.innerWidth < 768 ? `${Math.max(0, currentStageIndex) * 33.33}%` : '100%'
                        }}
                     />
                  </div>
                  
                  <div className="flex flex-col md:flex-row justify-between relative z-10 gap-8 md:gap-0">
                    {stages.map((stage, idx) => {
                      const isCompleted = currentStageIndex >= idx;
                      const isCurrent = currentStageIndex === idx;
                      return (
                        <div key={stage} className="flex md:flex-col items-center gap-4 md:gap-4 group">
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center border-[3px] transition-all duration-500 shadow-sm
                            ${isCompleted ? 'bg-primary border-primary text-primary-foreground scale-110' : 'bg-white border-slate-200 text-slate-400'}
                            ${isCurrent ? 'ring-4 ring-primary/20 shadow-primary/30' : ''}
                          `}>
                            {isCompleted ? <Check className="w-5 h-5" /> : <span className="font-bold text-base">{idx + 1}</span>}
                          </div>
                          <div className="md:text-center mt-0 md:mt-2">
                            <p className={`font-bold tracking-tight text-sm ${isCompleted ? 'text-slate-900' : 'text-slate-400'}`}>{stage}</p>
                            {isCurrent && <p className="text-xs text-primary font-bold mt-1 animate-pulse">Current Status</p>}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* EDIT DETAILS TAB */}
        {activeTab === 'edit' && (
          <Card className="rounded-[2rem] shadow-sm border border-slate-100 bg-white max-w-2xl mx-auto overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-6">
              <CardTitle className="font-bold text-xl">Update Order Details</CardTitle>
            </CardHeader>
            <CardContent className="p-8">
              {['PAID', 'SHIPPED', 'DELIVERED', 'CANCELLED'].includes(order.status) ? (
                <div className="text-center py-12">
                  <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-slate-50 mb-4 border border-slate-100 shadow-sm">
                    <MapPin className="w-6 h-6 text-slate-400" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">Updates Disabled</h3>
                  <p className="text-slate-500 text-sm font-medium max-w-sm mx-auto leading-relaxed">
                    This order is currently <strong>{order.status}</strong>. Shipping and contact details can only be modified while the order is in PENDING state.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleUpdate} className="space-y-8">
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-sm font-bold text-slate-700">Street Address</label>
                      <Input 
                        placeholder="123 Main St" 
                        value={editForm.street}
                        onChange={(e) => setEditForm({...editForm, street: e.target.value})}
                        required
                        className="bg-slate-50/50 border-slate-200 h-12 rounded-xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700">City</label>
                      <Input 
                        placeholder="City" 
                        value={editForm.city}
                        onChange={(e) => setEditForm({...editForm, city: e.target.value})}
                        required
                        className="bg-slate-50/50 border-slate-200 h-12 rounded-xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700">State / Province</label>
                      <Input 
                        placeholder="State" 
                        value={editForm.state}
                        onChange={(e) => setEditForm({...editForm, state: e.target.value})}
                        required
                        className="bg-slate-50/50 border-slate-200 h-12 rounded-xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700">Zip / Postal Code</label>
                      <Input 
                        placeholder="Zip" 
                        value={editForm.zip}
                        onChange={(e) => setEditForm({...editForm, zip: e.target.value})}
                        required
                        className="bg-slate-50/50 border-slate-200 h-12 rounded-xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700">Contact Number</label>
                      <Input 
                        placeholder="+1 (555) 000-0000" 
                        value={editForm.contact_number}
                        onChange={(e) => setEditForm({...editForm, contact_number: e.target.value})}
                        className="bg-slate-50/50 border-slate-200 h-12 rounded-xl"
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-sm font-bold text-slate-700">Delivery Instructions (Optional)</label>
                      <Input 
                        placeholder="e.g., Leave at front door" 
                        value={editForm.delivery_instructions}
                        onChange={(e) => setEditForm({...editForm, delivery_instructions: e.target.value})}
                        className="bg-slate-50/50 border-slate-200 h-12 rounded-xl"
                      />
                    </div>
                  </div>
                  <Button type="submit" className="w-full h-14 rounded-xl text-lg font-bold shadow-xl shadow-primary/20 hover:-translate-y-1 transition-all duration-300" disabled={isUpdating}>
                    {isUpdating ? 'Saving Changes...' : 'Save Changes'}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        )}

        {/* PAYMENTS TAB */}
        {activeTab === 'payments' && (
          <Card className="rounded-[2rem] shadow-sm border border-slate-100 bg-white max-w-2xl mx-auto overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-6">
              <CardTitle className="flex items-center text-xl font-bold">
                <CreditCard className="mr-2 h-6 w-6 text-primary" /> Payment Information
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
               <div className="p-6 space-y-6">
                 <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl border border-slate-100 bg-slate-50/50 shadow-inner">
                   <div className="space-y-1">
                     <p className="text-xs text-slate-500 uppercase tracking-widest font-bold">Total Amount Due</p>
                     <p className="text-3xl font-bold tracking-tight text-primary">${order.total_amount?.toFixed(2)}</p>
                   </div>
                   <div className="text-left md:text-right">
                     <Badge variant={['PAID', 'SHIPPED', 'DELIVERED'].includes(order.status) ? 'default' : (isCancelled ? 'destructive' : 'secondary')} className={`text-sm py-1 px-3 mb-2 shadow-sm rounded-md ${['PAID', 'SHIPPED', 'DELIVERED'].includes(order.status) ? 'bg-green-500' : ''}`}>
                       {['PAID', 'SHIPPED', 'DELIVERED'].includes(order.status) ? 'Payment Successful' : (isCancelled ? 'Cancelled' : 'Awaiting Payment')}
                     </Badge>
                     <p className="text-xs text-slate-500 font-semibold">Order Ref: {order.orderId.substring(0,8).toUpperCase()}</p>
                   </div>
                 </div>

                 {['PENDING'].includes(order.status) && (
                   <div className="bg-blue-50 p-8 rounded-2xl border border-blue-100 text-center shadow-sm relative overflow-hidden">
                     <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-400 to-primary"></div>
                     <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-white text-primary mb-4 shadow-sm border border-blue-100">
                       <CreditCard className="h-8 w-8" />
                     </div>
                     <h4 className="font-bold text-xl mb-2 text-blue-900">Complete your order</h4>
                     <p className="text-blue-700/80 text-sm font-medium mb-6 max-w-sm mx-auto leading-relaxed">Your order is currently pending. Click below to simulate a payment and initiate shipping.</p>
                     <Button 
                       size="lg" 
                       className="px-10 h-12 rounded-xl text-base font-bold shadow-md shadow-primary/20 hover:-translate-y-1 transition-all duration-300 w-full md:w-auto"
                       disabled={isUpdating}
                       onClick={async () => {
                         console.log("[DEBUG] Attempting to complete payment. Current order object:", order);
                         setIsUpdating(true);
                         try {
                           // Since the GET request to the GSI is failing, we can deterministically
                           // reconstruct the paymentId based on the pattern in your DynamoDB JSON!
                           // orderId: "2aa77d94-1b03-4473-9b9c-d61658bc559e"
                           // paymentId: "pay_auto_2aa77d941b0344739b9cd61658bc559e"
                           const paymentId = `pay_auto_${order.orderId.replace(/-/g, '')}`;
                           console.log("[DEBUG] Reconstructed paymentId:", paymentId);

                           // 1. Update Payment Service directly using the reconstructed ID
                           await PaymentAPI.update(paymentId, {
                             status: 'PAID',
                           });

                           // 2. Then update the Order Service
                           await OrderAPI.updateOrderStatus(order.orderId, 'PAID');
                           
                           setOrder({ ...order, status: 'PAID' });
                           toast.success('Payment completed successfully!');
                         } catch (error) {
                           console.error("Payment Error:", error);
                           toast.error('Payment failed');
                         } finally {
                           setIsUpdating(false);
                         }
                       }}
                     >
                       {isUpdating ? 'Processing...' : 'Complete Payment'}
                     </Button>
                   </div>
                 )}
                 
                 {['PAID', 'SHIPPED', 'DELIVERED'].includes(order.status) && (
                   <div className="flex items-start gap-4 text-sm bg-green-50 p-6 rounded-2xl border border-green-200 relative overflow-hidden">
                     <div className="absolute top-0 left-0 w-1 h-full bg-green-500"></div>
                     <div className="bg-white rounded-full p-1.5 shadow-sm border border-green-100 shrink-0">
                       <CheckCircle2 className="h-6 w-6 text-green-600" />
                     </div>
                     <div>
                       <p className="font-bold text-lg mb-1 text-green-900">Payment Processed</p>
                       <p className="text-green-800/80 font-medium leading-relaxed text-sm">Thank you for your purchase! We've received your payment and your order is now being processed. A detailed receipt has been sent to your email.</p>
                     </div>
                   </div>
                 )}
               </div>
            </CardContent>
          </Card>
        )}

      </div>
    </div>
  );
};
