import { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState } from '@/store';
import { clearCart } from '@/store/slices/cartSlice';
import { CartAPI, OrderAPI } from '@/api/services';
import { useNavigate, Navigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ShoppingBag, Receipt, Truck, CreditCard, ShieldCheck } from 'lucide-react';
import { CartItemImage } from '@/components/ui/CartItemImage';

export const Checkout = () => {
  const { items, totalAmount } = useSelector((state: RootState) => state.cart);
  const { user } = useSelector((state: RootState) => state.auth);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const [currentStep, setCurrentStep] = useState(1);
  const [shipping, setShipping] = useState({
    street: '',
    city: '',
    state: '',
    zip: ''
  });
  const [paymentMethod, setPaymentMethod] = useState('card');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderCompleted, setOrderCompleted] = useState(false);

  if (items.length === 0 && !orderCompleted) {
    return <Navigate to="/cart" replace />;
  }

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (currentStep < 3) return;
    
    setIsSubmitting(true);
    try {
      // Per instructions, trigger POST /cart/:userId/checkout
      const response = await CartAPI.checkout(user?.id || '');
      
      const orderId = response?.data?.data?.orderId || `ord_${Date.now()}`;

      await OrderAPI.updateOrder(orderId, {
        shipping_address: shipping,
        contact_number: "",
        delivery_instructions: "",
      });

      setOrderCompleted(true);
      dispatch(clearCart());
      toast.success('Order placed successfully!');
      navigate(`/orders/${orderId}`);
    } catch (error: any) {
      console.error('Checkout failed:', error?.response?.data || error);
      toast.error(error?.response?.data?.error || 'Failed to place order');
    } finally {
      setIsSubmitting(false);
    }
  };

  const nextStep = () => setCurrentStep(prev => Math.min(prev + 1, 3));
  const prevStep = () => setCurrentStep(prev => Math.max(prev - 1, 1));

  const steps = [
    { id: 1, title: 'Review Products', icon: <ShoppingBag className="w-5 h-5" /> },
    { id: 2, title: 'Price Details', icon: <Receipt className="w-5 h-5" /> },
    { id: 3, title: 'Shipping & Payment', icon: <CreditCard className="w-5 h-5" /> }
  ];

  const estimatedTax = totalAmount * 0.08; // 8% mock tax
  const shippingCost = totalAmount > 100 ? 0 : 15;
  const finalTotal = totalAmount + estimatedTax + shippingCost;

  return (
    <div className="min-h-[calc(100vh-64px)] bg-[#FAFAFA] py-12 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto">
        
        {/* Progress Bar */}
        <div className="mb-12">
          <div className="flex items-center justify-between relative">
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-slate-200 rounded-full z-0">
              <motion.div 
                className="h-full bg-slate-900 rounded-full"
                initial={{ width: '0%' }}
                animate={{ width: `${((currentStep - 1) / 2) * 100}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
            
            {steps.map((step) => {
              const isActive = currentStep === step.id;
              const isCompleted = currentStep > step.id;
              return (
                <div key={step.id} className="relative z-10 flex flex-col items-center">
                  <motion.div 
                    initial={false}
                    animate={{
                      backgroundColor: isCompleted || isActive ? '#0f172a' : '#f8fafc',
                      borderColor: isCompleted || isActive ? '#0f172a' : '#e2e8f0',
                      color: isCompleted || isActive ? '#ffffff' : '#94a3b8'
                    }}
                    className="w-12 h-12 rounded-full border-2 flex items-center justify-center font-bold text-lg shadow-sm"
                  >
                    {isCompleted ? <Check className="w-6 h-6" /> : step.icon}
                  </motion.div>
                  <span className={`absolute -bottom-8 w-32 text-center text-sm font-semibold ${isActive ? 'text-slate-900' : 'text-slate-500'}`}>
                    {step.title}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Wizard Content */}
        <div className="mt-20">
          <AnimatePresence mode="wait">
            
            {currentStep === 1 && (
              <motion.div 
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <Card className="border-none shadow-xl shadow-slate-200/50 overflow-hidden rounded-[2rem]">
                  <CardHeader className="bg-white border-b border-slate-100 px-8 py-6">
                    <CardTitle className="text-2xl font-black">Review Products</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="divide-y divide-slate-100">
                      {items.map(item => (
                        <div key={item.productId} className="flex items-center gap-6 p-8 bg-white">
                          <div className="w-24 h-24 rounded-2xl overflow-hidden bg-slate-100 shrink-0">
                            <CartItemImage item={item} className="w-full h-full object-cover" />
                          </div>
                          <div className="flex-1">
                            <h3 className="text-lg font-bold text-slate-900">{item.name}</h3>
                            <p className="text-slate-500 font-medium">Quantity: {item.quantity}</p>
                          </div>
                          <div className="text-xl font-black text-slate-900">
                            ${(item.price * item.quantity).toFixed(2)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                  <CardFooter className="bg-slate-50 p-8 flex justify-end">
                    <Button size="lg" onClick={nextStep} className="h-14 px-8 rounded-xl text-base font-bold shadow-lg shadow-slate-200 hover:-translate-y-0.5 transition-transform group">
                      Continue to Price Details
                      <ArrowRightIcon className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </CardFooter>
                </Card>
              </motion.div>
            )}

            {currentStep === 2 && (
              <motion.div 
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <Card className="border-none shadow-xl shadow-slate-200/50 overflow-hidden rounded-[2rem]">
                  <CardHeader className="bg-white border-b border-slate-100 px-8 py-6">
                    <CardTitle className="text-2xl font-black">Price Details</CardTitle>
                  </CardHeader>
                  <CardContent className="p-8 bg-white space-y-6">
                    <div className="space-y-4">
                      <div className="flex justify-between items-center text-lg font-medium text-slate-600">
                        <span>Subtotal ({items.length} items)</span>
                        <span className="text-slate-900 font-bold">${totalAmount.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center text-lg font-medium text-slate-600">
                        <span>Estimated Tax (8%)</span>
                        <span className="text-slate-900 font-bold">${estimatedTax.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center text-lg font-medium text-slate-600">
                        <span>Shipping</span>
                        {shippingCost === 0 ? (
                          <span className="text-emerald-500 font-bold">Free</span>
                        ) : (
                          <span className="text-slate-900 font-bold">${shippingCost.toFixed(2)}</span>
                        )}
                      </div>
                    </div>
                    
                    <div className="pt-6 border-t border-slate-100 flex justify-between items-end">
                      <div>
                        <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">Total to Pay</p>
                        <h2 className="text-4xl font-black text-slate-900">${finalTotal.toFixed(2)}</h2>
                      </div>
                      <ShieldCheck className="w-12 h-12 text-slate-200" />
                    </div>
                  </CardContent>
                  <CardFooter className="bg-slate-50 p-8 flex justify-between">
                    <Button variant="outline" size="lg" onClick={prevStep} className="h-14 px-8 rounded-xl text-base font-bold bg-white">
                      Back
                    </Button>
                    <Button size="lg" onClick={nextStep} className="h-14 px-8 rounded-xl text-base font-bold shadow-lg shadow-slate-200 hover:-translate-y-0.5 transition-transform group">
                      Continue to Payment
                      <ArrowRightIcon className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </CardFooter>
                </Card>
              </motion.div>
            )}

            {currentStep === 3 && (
              <motion.div 
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <form onSubmit={handleCheckout}>
                  <Card className="border-none shadow-xl shadow-slate-200/50 overflow-hidden rounded-[2rem]">
                    <CardHeader className="bg-white border-b border-slate-100 px-8 py-6">
                      <CardTitle className="text-2xl font-black">Shipping & Payment</CardTitle>
                    </CardHeader>
                    <CardContent className="p-8 bg-white grid lg:grid-cols-2 gap-12">
                      
                      {/* Shipping Form */}
                      <div className="space-y-6">
                        <h3 className="text-lg font-bold flex items-center"><Truck className="mr-2 w-5 h-5 text-slate-400" /> Shipping Address</h3>
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-700">Street Address</label>
                            <Input 
                              required 
                              value={shipping.street} 
                              onChange={e => setShipping({ ...shipping, street: e.target.value })} 
                              className="h-12 rounded-xl bg-slate-50 border-slate-200 focus-visible:ring-slate-300"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <label className="text-sm font-bold text-slate-700">City</label>
                              <Input 
                                required 
                                value={shipping.city} 
                                onChange={e => setShipping({ ...shipping, city: e.target.value })} 
                                className="h-12 rounded-xl bg-slate-50 border-slate-200 focus-visible:ring-slate-300"
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-sm font-bold text-slate-700">State</label>
                              <Input 
                                required 
                                value={shipping.state} 
                                onChange={e => setShipping({ ...shipping, state: e.target.value })} 
                                className="h-12 rounded-xl bg-slate-50 border-slate-200 focus-visible:ring-slate-300"
                              />
                            </div>
                          </div>
                          <div className="space-y-2 w-1/2">
                            <label className="text-sm font-bold text-slate-700">ZIP Code</label>
                            <Input 
                              required 
                              value={shipping.zip} 
                              onChange={e => setShipping({ ...shipping, zip: e.target.value })} 
                              className="h-12 rounded-xl bg-slate-50 border-slate-200 focus-visible:ring-slate-300"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Payment Method */}
                      <div className="space-y-6">
                        <h3 className="text-lg font-bold flex items-center"><CreditCard className="mr-2 w-5 h-5 text-slate-400" /> Payment Method</h3>
                        <div className="space-y-3">
                          <label className={`block border-2 rounded-xl p-4 cursor-pointer transition-all ${paymentMethod === 'card' ? 'border-slate-900 bg-slate-50' : 'border-slate-200 hover:border-slate-300'}`}>
                            <div className="flex items-center">
                              <input type="radio" name="payment" value="card" checked={paymentMethod === 'card'} onChange={() => setPaymentMethod('card')} className="w-5 h-5 text-slate-900 focus:ring-slate-900 border-slate-300" />
                              <span className="ml-3 font-bold text-slate-900">Credit / Debit Card</span>
                            </div>
                          </label>
                          <label className={`block border-2 rounded-xl p-4 cursor-pointer transition-all ${paymentMethod === 'paypal' ? 'border-slate-900 bg-slate-50' : 'border-slate-200 hover:border-slate-300'}`}>
                            <div className="flex items-center">
                              <input type="radio" name="payment" value="paypal" checked={paymentMethod === 'paypal'} onChange={() => setPaymentMethod('paypal')} className="w-5 h-5 text-slate-900 focus:ring-slate-900 border-slate-300" />
                              <span className="ml-3 font-bold text-slate-900">PayPal</span>
                            </div>
                          </label>
                        </div>
                        
                        <div className="mt-8 bg-slate-50 rounded-xl p-6 border border-slate-100">
                          <div className="flex justify-between items-center font-black text-xl mb-1">
                            <span>Total</span>
                            <span>${finalTotal.toFixed(2)}</span>
                          </div>
                          <p className="text-sm text-slate-500 font-medium">By placing this order, you agree to our Terms.</p>
                        </div>
                      </div>

                    </CardContent>
                    <CardFooter className="bg-slate-50 p-8 flex justify-between">
                      <Button type="button" variant="outline" size="lg" onClick={prevStep} className="h-14 px-8 rounded-xl text-base font-bold bg-white">
                        Back
                      </Button>
                      <Button type="submit" size="lg" disabled={isSubmitting} className="h-14 px-8 rounded-xl text-base font-bold shadow-lg shadow-slate-200 hover:-translate-y-0.5 transition-transform group">
                        {isSubmitting ? 'Processing...' : 'Place Order'}
                        <Check className="ml-2 w-5 h-5 group-hover:scale-110 transition-transform" />
                      </Button>
                    </CardFooter>
                  </Card>
                </form>
              </motion.div>
            )}
            
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

// Quick lucide icon helper for ArrowRight
const ArrowRightIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
);
