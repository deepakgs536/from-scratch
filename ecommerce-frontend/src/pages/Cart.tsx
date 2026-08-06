import { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState } from '@/store';
import { updateQuantity, removeFromCart, clearCart, setCart } from '@/store/slices/cartSlice';
import { CartAPI, ProductAPI, MediaAPI } from '@/api/services';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Trash2, Minus, Plus, ShoppingBag } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

const CartItemCard = ({ item }: { item: any }) => {
  const dispatch = useDispatch();
  const { user } = useSelector((state: RootState) => state.auth);

  const handleUpdateQuantity = async (newQuantity: number) => {
    if (newQuantity < 1) return;
    
    // Optimistic UI update
    dispatch(updateQuantity({ productId: item.productId, quantity: newQuantity }));
    
    if (user?.id) {
      try {
        const res = await CartAPI.updateItem(user.id, item.productId, { quantity: newQuantity });
        if (!res.data?.success) {
          // Revert on failure
          dispatch(updateQuantity({ productId: item.productId, quantity: item.quantity }));
          toast.error('Failed to update quantity');
        }
      } catch (err: any) {
        dispatch(updateQuantity({ productId: item.productId, quantity: item.quantity }));
        toast.error('Network error updating cart');
      }
    }
  };

  const handleRemove = async () => {
    dispatch(removeFromCart(item.productId));
    if (user?.id) {
      try {
        await CartAPI.removeItem(user.id, item.productId);
      } catch (err) {
        console.error('Failed to remove from cart backend', err);
      }
    }
  };

  return (
    <Card className="flex flex-col sm:flex-row items-center p-4 gap-4 premium-shadow">
      {/* Product image — signed URL resolved on cart load */}
      <div className="w-24 h-24 shrink-0 rounded-md overflow-hidden bg-muted">
        {item.image_url ? (
          <img
            src={item.image_url}
            alt={item.name}
            className="w-full h-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs text-center px-1">
            No Image
          </div>
        )}
      </div>

      <div className="flex-1 text-center sm:text-left">
        <Link to={`/products/${item.productId}`}>
          <h3 className="font-semibold hover:underline line-clamp-2">
            {item.name && item.name !== item.productId
              ? item.name
              : <span className="text-muted-foreground italic text-sm">Loading…</span>}
          </h3>
        </Link>
        <p className="text-sm text-muted-foreground mb-4 sm:mb-0">${(Number(item.price) || 0).toFixed(2)}</p>
      </div>
      
      <div className="flex items-center gap-4">
        <div className="flex items-center border rounded-md">
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 rounded-r-none"
            onClick={() => handleUpdateQuantity(item.quantity - 1)}
          >
            <Minus className="h-3 w-3" />
          </Button>
          <span className="w-8 text-center text-sm">{item.quantity}</span>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 rounded-l-none"
            onClick={() => handleUpdateQuantity(item.quantity + 1)}
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>
        <div className="w-20 text-right font-semibold">
          ${((Number(item.price) || 0) * (Number(item.quantity) || 1)).toFixed(2)}
        </div>
        <Button 
          variant="ghost" 
          size="icon" 
          className="text-destructive hover:bg-destructive/10"
          onClick={handleRemove}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  );
};

export const Cart = () => {
  const { items, totalAmount } = useSelector((state: RootState) => state.cart);
  const { user } = useSelector((state: RootState) => state.auth);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  // Fetch cart from backend, then enrich each item with product name + signed image URL
  // (same pattern as ProductListing.tsx)
  useEffect(() => {
    if (!user?.id) return;

    CartAPI.get(user.id)
      .then(async (res) => {
        if (!res.data?.success || !Array.isArray(res.data.data?.items)) return;

        const backendItems: any[] = res.data.data.items;

        const enriched = await Promise.all(
          backendItems.map(async (item: any) => {
            try {
              const productRes = await ProductAPI.getById(item.productId, true);
              const product = productRes?.data?.data;
              if (!product) return item;

              // Resolve signed image URL exactly like ProductListing does
              let image_url = product.image_url || '';
              if (image_url && !image_url.startsWith('http')) {
                try {
                  const mediaRes = await MediaAPI.getDownloadUrl(image_url);
                  image_url = mediaRes.data.url;
                } catch {
                  image_url = '';
                }
              }

              return {
                ...item,
                name: product.name || item.productId,
                image_url,
              };
            } catch {
              return item; // keep as-is on individual product fetch error
            }
          })
        );

        dispatch(setCart(enriched));
      })
      .catch((err) => console.error('Failed to fetch backend cart', err));
  }, [user?.id, dispatch]);

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
            <Button variant="outline" onClick={async () => {
              dispatch(clearCart());
              if (user?.id) await CartAPI.clear(user.id);
            }}>Clear Cart</Button>
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
