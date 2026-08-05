
import { useSelector, useDispatch } from 'react-redux';
import type { RootState } from '@/store';
import { updateQuantity, removeFromCart, clearCart } from '@/store/slices/cartSlice';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Trash2, Minus, Plus, ShoppingBag } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { CartItemImage } from '@/components/ui/CartItemImage';

const CartItemCard = ({ item }: { item: any }) => {
  const dispatch = useDispatch();

  return (
    <Card className="flex flex-col sm:flex-row items-center p-4 gap-4 premium-shadow">
      <CartItemImage 
        item={item} 
        className="w-24 h-24 object-cover rounded-md bg-muted"
      />
      <div className="flex-1 text-center sm:text-left">
        <Link to={`/products/${item.productId}`}>
          <h3 className="font-semibold hover:underline">{item.name}</h3>
        </Link>
        <p className="text-sm text-muted-foreground mb-4 sm:mb-0">${item.price.toFixed(2)}</p>
      </div>
      
      <div className="flex items-center gap-4">
        <div className="flex items-center border rounded-md">
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 rounded-r-none"
            onClick={() => dispatch(updateQuantity({ productId: item.productId, quantity: item.quantity - 1 }))}
          >
            <Minus className="h-3 w-3" />
          </Button>
          <span className="w-8 text-center text-sm">{item.quantity}</span>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 rounded-l-none"
            onClick={() => dispatch(updateQuantity({ productId: item.productId, quantity: item.quantity + 1 }))}
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>
        <div className="w-20 text-right font-semibold">
          ${(item.price * item.quantity).toFixed(2)}
        </div>
        <Button 
          variant="ghost" 
          size="icon" 
          className="text-destructive hover:bg-destructive/10"
          onClick={() => dispatch(removeFromCart(item.productId))}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  );
};

export const Cart = () => {
  const { items, totalAmount } = useSelector((state: RootState) => state.cart);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  if (items.length === 0) {
    return (
      <div className="container mx-auto py-20 flex flex-col items-center justify-center text-center">
        <div className="bg-muted p-6 rounded-full mb-6">
          <ShoppingBag className="h-12 w-12 text-muted-foreground" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight mb-2">Your cart is empty</h2>
        <p className="text-muted-foreground mb-8">Looks like you haven't added anything to your cart yet.</p>
        <Link to="/products">
          <Button size="lg">Start Shopping</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold tracking-tight mb-8">Shopping Cart</h1>
      
      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
          {items.map(item => (
            <CartItemCard key={item.productId} item={item} />
          ))}
          <div className="flex justify-end pt-4">
            <Button variant="outline" onClick={() => dispatch(clearCart())}>Clear Cart</Button>
          </div>
        </div>
        
        <div>
          <Card className="premium-shadow sticky top-24">
            <CardHeader>
              <CardTitle>Order Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>${totalAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Shipping</span>
                <span>Calculated at checkout</span>
              </div>
              <div className="border-t pt-4 flex justify-between font-bold text-lg">
                <span>Total</span>
                <span>${totalAmount.toFixed(2)}</span>
              </div>
            </CardContent>
            <CardFooter>
              <Button className="w-full" size="lg" onClick={() => navigate('/checkout')}>
                Proceed to Checkout
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
};
