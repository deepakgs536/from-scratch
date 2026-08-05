import { useEffect, useState } from 'react';
import { ProductAPI, MediaAPI, CartAPI } from '@/api/services';
import { ProductCard } from '@/components/ui/ProductCard';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { useDispatch, useSelector } from 'react-redux';
import { addToCart } from '@/store/slices/cartSlice';
import { Search, ChevronDown, Check } from 'lucide-react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import type { RootState } from '@/store';

const CATEGORIES = ['All Categories', 'Electronics', 'Apparel', 'Home & Living', 'Accessories'];

export const ProductListing = () => {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  const [searchParams, setSearchParams] = useSearchParams();
  const initialCategory = searchParams.get('category') 
    ? searchParams.get('category')!.charAt(0).toUpperCase() + searchParams.get('category')!.slice(1) 
    : 'All Categories';
    
  const [selectedCategory, setSelectedCategory] = useState(
    CATEGORIES.find(c => c.toLowerCase() === initialCategory.toLowerCase()) || 'All Categories'
  );

  useEffect(() => {
    const categoryParam = searchParams.get('category');
    if (categoryParam) {
      const match = CATEGORIES.find(c => c.toLowerCase() === categoryParam.toLowerCase());
      if (match && match !== selectedCategory) {
        setSelectedCategory(match);
      }
    } else if (selectedCategory !== 'All Categories') {
      setSelectedCategory('All Categories');
    }
  }, [searchParams]);

  const [sortBy, setSortBy] = useState('price_asc');
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const dispatch = useDispatch();

  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      try {
        const response = await ProductAPI.getAll(selectedCategory);
        const productsWithSignedUrls = await Promise.all(
          response.data.data.map(async (product: any) => {
            if (!product.image_url) {
              return product;
            }
            try {
              const mediaResponse = await MediaAPI.getDownloadUrl(product.image_url);
              return {
                ...product,
                image_url: mediaResponse.data.url
              };
            } catch (err) {
              return { ...product, image_url: "" };
            }
          })
        );
        setProducts(productsWithSignedUrls);
      } catch (error) {
        toast.error('Failed to load products');
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, [selectedCategory]);

  const { isAuthenticated, user } = useSelector((state: RootState) => state.auth);
  const navigate = useNavigate();

  const filteredProducts = [...products]
    .filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) || (p.category && p.category.toLowerCase().includes(search.toLowerCase()));
      return matchesSearch;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'price_asc': return (Number(a.price) || 0) - (Number(b.price) || 0);
        case 'price_desc': return (Number(b.price) || 0) - (Number(a.price) || 0);
        case 'category_asc': return (a.category || '').localeCompare(b.category || '');
        case 'category_desc': return (b.category || '').localeCompare(a.category || '');
        default: return 0;
      }
    });

  const handleAddToCart = async (product: any) => {
    if (!isAuthenticated) {
      toast.error('Login as Customer');
      navigate('/login');
      return;
    }

    dispatch(addToCart(product));
    
    // Sync with backend if logged in
    if (user?.id) {
      try {
        await CartAPI.addItem(user.id, {
          productId: product.productId,
          name: product.name,
          price: Number(product.price),
          quantity: 1,
          image_url: product.image_url
        });
      } catch (error: any) {
        console.error('Failed to sync cart with backend:', error?.response?.data || error);
      }
    }
    
    toast.success(`${product.name} added to cart`);
  };

  const handleCategorySelect = (category: string) => {
    setSelectedCategory(category);
    if (category === 'All Categories') {
      searchParams.delete('category');
    } else {
      searchParams.set('category', category.toLowerCase());
    }
    setSearchParams(searchParams);
  };

  return (
    <div className="container mx-auto py-12 px-6">
      <div className="flex flex-col md:flex-row justify-between items-center mb-12 gap-6 bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
        
        <div className="flex items-center gap-4 w-full md:w-auto">
          <h1 className="text-3xl font-black tracking-tight">{selectedCategory}</h1>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
          
          {/* Category Dropdown */}
          <div 
            className="w-full sm:w-auto relative z-50" 
            onClick={() => setIsCategoryOpen(!isCategoryOpen)} 
            onBlur={() => setTimeout(() => setIsCategoryOpen(false), 200)} 
            tabIndex={0}
          >
            <div className={`h-12 px-5 flex items-center justify-between gap-3 rounded-full border ${isCategoryOpen ? 'border-primary ring-2 ring-primary/20 bg-white' : 'border-slate-200 bg-slate-50 hover:bg-slate-100'} transition-all cursor-pointer text-sm font-semibold text-slate-700 w-full sm:w-56 outline-none`}>
              <span className="truncate">{selectedCategory}</span>
              <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform duration-300 ${isCategoryOpen ? 'rotate-180' : ''}`} />
            </div>
            
            {isCategoryOpen && (
              <div className="absolute top-14 left-0 w-full sm:min-w-[224px] bg-white/95 backdrop-blur-xl rounded-[1.5rem] shadow-xl border border-slate-100 p-2 z-50 animate-in fade-in zoom-in-95 duration-200 origin-top">
                {CATEGORIES.map(option => (
                  <div 
                    key={option}
                    className={`flex items-center justify-between px-4 py-2.5 rounded-xl text-sm font-semibold cursor-pointer transition-colors ${selectedCategory === option ? 'bg-primary/10 text-primary' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCategorySelect(option);
                      setIsCategoryOpen(false);
                    }}
                  >
                    {option}
                    {selectedCategory === option && <Check className="h-4 w-4" />}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Custom Sort Dropdown */}
          <div 
            className="w-full sm:w-auto relative" 
            onClick={() => setIsSortOpen(!isSortOpen)} 
            onBlur={() => setTimeout(() => setIsSortOpen(false), 200)} 
            tabIndex={0}
          >
            <div className={`h-12 px-5 flex items-center justify-between gap-3 rounded-full border ${isSortOpen ? 'border-primary ring-2 ring-primary/20 bg-white' : 'border-slate-200 bg-slate-50 hover:bg-slate-100'} transition-all cursor-pointer text-sm font-semibold text-slate-700 w-full sm:w-56 outline-none`}>
              <span className="truncate">
                {sortBy === 'price_asc' && 'Price: Low to High'}
                {sortBy === 'price_desc' && 'Price: High to Low'}
                {sortBy === 'category_asc' && 'Category: A to Z'}
                {sortBy === 'category_desc' && 'Category: Z to A'}
              </span>
              <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform duration-300 ${isSortOpen ? 'rotate-180' : ''}`} />
            </div>
            
            {isSortOpen && (
              <div className="absolute top-14 left-0 w-full sm:min-w-[224px] bg-white/95 backdrop-blur-xl rounded-[1.5rem] shadow-xl border border-slate-100 p-2 z-50 animate-in fade-in zoom-in-95 duration-200 origin-top">
                {[
                  { value: 'price_asc', label: 'Price: Low to High' },
                  { value: 'price_desc', label: 'Price: High to Low' },
                  { value: 'category_asc', label: 'Category: A to Z' },
                  { value: 'category_desc', label: 'Category: Z to A' },
                ].map(option => (
                  <div 
                    key={option.value}
                    className={`flex items-center justify-between px-4 py-2.5 rounded-xl text-sm font-semibold cursor-pointer transition-colors ${sortBy === option.value ? 'bg-primary/10 text-primary' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSortBy(option.value);
                      setIsSortOpen(false);
                    }}
                  >
                    {option.label}
                    {sortBy === option.value && <Check className="h-4 w-4" />}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="w-full sm:w-64 md:w-80 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
            <Input 
              placeholder="Search for essentials..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-12 pl-12 rounded-full border-slate-200 bg-slate-50 focus-visible:ring-slate-200 focus-visible:bg-white transition-colors"
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="space-y-4">
              <Skeleton className="h-[400px] w-full rounded-[2rem]" />
              <Skeleton className="h-6 w-3/4 rounded-md" />
              <Skeleton className="h-6 w-1/2 rounded-md" />
            </div>
          ))}
        </div>
      ) : filteredProducts.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {filteredProducts.map((product, index) => (
            <ProductCard 
              key={product.productId} 
              product={product} 
              onAddToCart={handleAddToCart}
              index={index}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-32 bg-white rounded-[2rem] border border-slate-100 shadow-sm mt-8">
          <div className="h-24 w-24 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-300">
            <Search className="h-10 w-10" />
          </div>
          <h3 className="text-2xl font-black tracking-tight mb-3">No products found</h3>
          <p className="text-slate-500 font-medium text-lg">We couldn't find anything matching your current filters.</p>
          <Button 
            variant="outline" 
            className="mt-8 rounded-full px-8 h-12 font-semibold"
            onClick={() => { setSearch(''); handleCategorySelect('All Categories'); }}
          >
            Clear Filters
          </Button>
        </div>
      )}
    </div>
  );
};
