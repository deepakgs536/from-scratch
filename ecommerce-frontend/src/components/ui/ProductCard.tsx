import { Link } from 'react-router-dom';
import { Card, CardContent, CardFooter } from './card';
import { Button } from './button';
import { Badge } from './badge';
import { ShoppingCart, Heart } from 'lucide-react';
import { motion } from 'framer-motion';
import { useDispatch, useSelector } from 'react-redux';
import { toggleWishlistItem } from '@/store/slices/wishlistSlice';
import type { RootState } from '@/store';

interface Product {
  productId: string;
  name: string;
  price: number;
  image_url: string;
  category: string;
  stock_status: string;
}

export const ProductCard = ({ product, onAddToCart, index = 0 }: { product: Product, onAddToCart: (product: Product) => void, index?: number }) => {
  const dispatch = useDispatch();
  const wishlistItems = useSelector((state: RootState) => state.wishlist.items);
  const isWishlisted = wishlistItems.includes(product.productId);

  const handleWishlistToggle = (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent navigating to product details
    dispatch(toggleWishlistItem(product.productId));
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05, ease: "easeOut" }}
    >
      <Card className="overflow-hidden group hover:border-primary/20 bg-white rounded-[2rem] shadow-sm hover:shadow-xl hover:shadow-primary/5 transition-all duration-500 border border-slate-100 flex flex-col h-full relative">
        <Link to={`/products/${product.productId}`} className="block relative aspect-[4/5] overflow-hidden bg-slate-50">
          <img 
            src={product.image_url || 'https://images.unsplash.com/photo-1560393464-5c69a73c5770?w=500&q=80'} 
            alt={product.name}
            className="object-cover w-full h-full transition-transform duration-700 group-hover:scale-105"
          />
          <div className="absolute top-4 left-4 z-10">
            <Badge className="bg-white/90 backdrop-blur-md text-slate-800 hover:bg-white shadow-sm font-semibold tracking-wide border-none px-3 py-1">
              {product.category || 'General'}
            </Badge>
          </div>
          {product.stock_status !== 'IN_STOCK' && (
            <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] flex items-center justify-center transition-all z-10">
              <Badge variant="destructive" className="px-4 py-1.5 text-sm font-bold shadow-lg">Out of Stock</Badge>
            </div>
          )}
        </Link>

        {/* Wishlist Button */}
        <button 
          onClick={handleWishlistToggle}
          className="absolute top-4 right-4 z-20 h-10 w-10 rounded-full bg-white/90 backdrop-blur-md shadow-sm border border-slate-100 flex items-center justify-center text-slate-400 hover:text-red-500 hover:scale-110 transition-all duration-300"
        >
          <Heart className={`h-5 w-5 ${isWishlisted ? 'fill-red-500 text-red-500' : ''}`} />
        </button>
        <CardContent className="p-6 flex-grow flex flex-col justify-between">
          <div>
            <Link to={`/products/${product.productId}`}>
              <h3 className="font-bold text-lg leading-tight line-clamp-1 hover:text-primary transition-colors text-slate-900 mb-2">{product.name}</h3>
            </Link>
            <div className="flex items-baseline gap-2 mt-auto">
              <p className="font-extrabold text-xl text-primary">${Number(product.price).toFixed(2)}</p>
              <span className="text-sm font-semibold text-slate-400 line-through decoration-slate-300">${(Number(product.price) * 1.2).toFixed(2)}</span>
            </div>
          </div>
        </CardContent>
        <CardFooter className="p-6 pt-0">
          <Button 
            className="w-full rounded-xl h-12 font-bold shadow-lg shadow-primary/10 group-hover:shadow-primary/25 transition-all duration-300" 
            disabled={product.stock_status !== 'IN_STOCK'}
            onClick={() => onAddToCart(product)}
          >
            <ShoppingCart className="mr-2 h-4 w-4" />
            Add to Cart
          </Button>
        </CardFooter>
      </Card>
    </motion.div>
  );
};
