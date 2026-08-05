import { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import { HeartCrack, ShoppingCart, ArrowLeft, Trash2 } from 'lucide-react';
import { ProductAPI, MediaAPI } from '@/api/services';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { toggleWishlistItem } from '@/store/slices/wishlistSlice';
import { addToCart } from '@/store/slices/cartSlice';
import type { RootState } from '@/store';
import { toast } from 'sonner';

export const Wishlist = () => {
  const wishlistItems = useSelector((state: RootState) => state.wishlist.items);
  const { isAuthenticated } = useSelector((state: RootState) => state.auth);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchWishlistProducts = async () => {
      setLoading(true);
      try {
        if (wishlistItems.length === 0) {
          setProducts([]);
          setLoading(false);
          return;
        }

        const responses = await Promise.all(
          wishlistItems.map(id => ProductAPI.getById(id).catch(() => null))
        );

        let validProducts = responses
          .filter(res => res && res.data && res.data.data)
          .map(res => res!.data.data);

        // Fetch signed URLs
        validProducts = await Promise.all(
          validProducts.map(async (product: any) => {
            if (product.image_url && !product.image_url.startsWith('http')) {
              try {
                const mediaRes = await MediaAPI.getDownloadUrl(product.image_url);
                return { ...product, image_url: mediaRes.data.url };
              } catch (e) {
                return product;
              }
            }
            return product;
          })
        );

        setProducts(validProducts);
      } catch (error) {
        toast.error("Failed to load wishlist items");
      } finally {
        setLoading(false);
      }
    };

    fetchWishlistProducts();
  }, [wishlistItems.length]); // only re-fetch if length changes significantly or on mount

  // Sync products list when item removed
  useEffect(() => {
    setProducts(prev => prev.filter(p => wishlistItems.includes(p.productId)));
  }, [wishlistItems]);

  const handleRemove = (id: string) => {
    dispatch(toggleWishlistItem(id));
    toast.success("Removed from wishlist");
  };

  const handleAddToCart = (product: any) => {
    if (!isAuthenticated) {
      toast.error('Login as Customer');
      navigate('/login');
      return;
    }

    dispatch(addToCart({ ...product, quantity: 1 }));
    toast.success(`${product.name} added to cart`);
  };

  if (loading) {
    return (
      <div className="container mx-auto py-12 px-6 max-w-4xl">
        <Skeleton className="h-10 w-48 mb-8" />
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-32 w-full rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (wishlistItems.length === 0 || products.length === 0) {
    return (
      <div className="container mx-auto py-32 px-6 text-center max-w-md">
        <div className="bg-white p-10 rounded-[2rem] shadow-sm border border-slate-100 flex flex-col items-center">
          <div className="h-24 w-24 bg-red-50 rounded-full flex items-center justify-center mb-6">
            <HeartCrack className="h-10 w-10 text-red-300" />
          </div>
          <h2 className="text-3xl font-black mb-3 tracking-tight">Wishlist is empty</h2>
          <p className="text-slate-500 mb-8 font-medium">You haven't added any items to your wishlist yet.</p>
          <Link to="/products" className="w-full">
            <Button className="w-full rounded-full h-12 font-semibold shadow-md shadow-primary/20">
              <ArrowLeft className="mr-2 h-4 w-4" /> Start Browsing
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-12 px-6 max-w-4xl">
      <h1 className="text-4xl font-black tracking-tight text-slate-900 mb-8 flex items-center">
        My Wishlist <span className="ml-4 text-xl font-bold text-slate-400 px-3 py-1 bg-slate-100 rounded-full">{products.length}</span>
      </h1>

      <div className="space-y-4">
        {products.map(product => (
          <div key={product.productId} className="flex flex-col sm:flex-row items-center gap-6 bg-white p-4 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-md transition-shadow group">
            {/* Image */}
            <Link to={`/products/${product.productId}`} className="w-full sm:w-32 h-32 shrink-0 rounded-2xl overflow-hidden bg-slate-50">
              <img 
                src={product.image_url || 'https://images.unsplash.com/photo-1560393464-5c69a73c5770?w=200&q=80'} 
                alt={product.name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
            </Link>

            {/* Info */}
            <div className="flex-1 text-center sm:text-left">
              <Link to={`/products/${product.productId}`}>
                <h3 className="text-xl font-bold text-slate-900 hover:text-primary transition-colors line-clamp-1">{product.name}</h3>
              </Link>
              <p className="text-sm font-semibold text-slate-500 mt-1">{product.category}</p>
              <div className="mt-3 flex items-center justify-center sm:justify-start gap-3">
                <span className="text-2xl font-extrabold text-primary">${Number(product.price).toFixed(2)}</span>
                {product.stock_status !== 'IN_STOCK' && (
                  <span className="text-xs font-bold text-red-500 bg-red-50 px-2 py-1 rounded-md">Out of Stock</span>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex sm:flex-col gap-3 w-full sm:w-auto mt-4 sm:mt-0 pt-4 sm:pt-0 border-t sm:border-none border-slate-100">
              <Button 
                onClick={() => handleAddToCart(product)} 
                disabled={product.stock_status !== 'IN_STOCK'}
                className="flex-1 sm:flex-none rounded-xl font-semibold shadow-sm"
              >
                <ShoppingCart className="w-4 h-4 mr-2" /> Add to Cart
              </Button>
              <Button 
                variant="outline"
                onClick={() => handleRemove(product.productId)}
                className="flex-none rounded-xl text-slate-500 hover:text-red-500 hover:bg-red-50 border-slate-200 hover:border-red-100 transition-colors"
                title="Remove from wishlist"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
