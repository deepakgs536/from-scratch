import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Sparkles, ArrowRight, Truck, CheckCircle2, MessageSquare, Play, Star } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ProductAPI, MediaAPI } from '@/api/services';
import { ProductCard } from '@/components/ui/ProductCard';
import { useDispatch, useSelector } from 'react-redux';
import { addToCart } from '@/store/slices/cartSlice';
import type { RootState } from '@/store';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { motion, useScroll, useTransform } from 'framer-motion';
import type { Variants } from 'framer-motion';

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: "easeOut" } }
};

const stagger = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.12 }
  }
};

export const Home = () => {
  const [featuredProducts, setFeaturedProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { isAuthenticated } = useSelector((state: RootState) => state.auth);
  const { scrollYProgress } = useScroll();
  const yParallax = useTransform(scrollYProgress, [0, 1], [0, 150]);
  const opacityFade = useTransform(scrollYProgress, [0, 0.5], [1, 0]);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const response = await ProductAPI.getAll();
        const productsWithUrls = await Promise.all(
          response.data.data.map(async (p: any) => {
            if (!p.image_url) return p;
            try {
              const res = await MediaAPI.getDownloadUrl(p.image_url);
              return { ...p, image_url: res.data.url };
            } catch (e) {
              return { ...p, image_url: "" };
            }
          })
        );
        setFeaturedProducts(productsWithUrls.slice(0, 4));
      } catch (error) {
        console.error('Failed to load products', error);
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, []);

  const handleAddToCart = (product: any) => {
    if (!isAuthenticated) {
      toast.error('Login as Customer');
      navigate('/login');
      return;
    }
    dispatch(addToCart(product));
    toast.success(`${product.name} added to cart`);
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#FAFAFA] text-slate-900 selection:bg-slate-200">
      
      {/* 1. SCROLLYTELLING HERO (Light & Airy) */}
      <section className="relative overflow-hidden min-h-[90vh] flex items-center pt-20 pb-32">
        <div className="absolute inset-0 pointer-events-none z-0">
          <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-slate-100 rounded-full blur-[100px] opacity-60 translate-x-1/3 -translate-y-1/4" />
          <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-blue-50 rounded-full blur-[80px] opacity-60 -translate-x-1/3 translate-y-1/3" />
        </div>

        <div className="container relative z-10 px-6">
          <div className="grid lg:grid-cols-12 gap-12 items-center">
            
            <motion.div 
              initial="hidden" animate="visible" variants={stagger}
              className="lg:col-span-6 flex flex-col space-y-8"
            >
              <motion.div variants={fadeUp}>
                <div className="inline-flex items-center rounded-full border border-slate-200 bg-white px-4 py-1.5 text-sm font-medium text-slate-600 shadow-sm">
                  <Sparkles className="mr-2 h-4 w-4 text-amber-500" />
                  Spring 2026 Collection
                </div>
              </motion.div>
              
              <motion.div variants={fadeUp} className="space-y-6">
                <h1 className="text-6xl md:text-8xl font-black tracking-tighter leading-[1.05] text-slate-900">
                  Elevate <br/>
                  <span className="text-slate-400 font-light italic">the Everyday.</span>
                </h1>
                <p className="max-w-md text-lg md:text-xl text-slate-600 font-medium leading-relaxed">
                  Mindfully crafted essentials designed to bring clarity, comfort, and quiet luxury to your modern life.
                </p>
              </motion.div>

              <motion.div variants={fadeUp} className="flex flex-wrap gap-4 pt-4">
                <Link to="/products">
                  <Button size="lg" className="h-14 px-8 rounded-full text-base font-semibold shadow-lg shadow-slate-200 hover:-translate-y-0.5 transition-transform">
                    Shop Collection
                  </Button>
                </Link>
                <Link to="/about">
                  <Button size="lg" variant="outline" className="h-14 px-8 rounded-full text-base font-semibold bg-white border-slate-200 hover:bg-slate-50 hover:-translate-y-0.5 transition-transform">
                    <Play className="mr-2 h-4 w-4" /> Watch Film
                  </Button>
                </Link>
              </motion.div>

              <motion.div variants={fadeUp} className="pt-8 flex items-center gap-4 text-sm font-medium text-slate-500">
                <div className="flex -space-x-2">
                  {[1,2,3,4].map(i => (
                     <div key={i} className="w-8 h-8 rounded-full border-2 border-white bg-slate-200 overflow-hidden">
                       <img src={`https://i.pravatar.cc/100?img=${i+10}`} alt="Customer" />
                     </div>
                  ))}
                </div>
                <p>Loved by 10,000+ minimalists.</p>
              </motion.div>
            </motion.div>

            <motion.div 
              style={{ y: yParallax, opacity: opacityFade }}
              className="lg:col-span-6 relative hidden lg:block h-[700px] w-full"
            >
              <div className="absolute inset-0 rounded-[2.5rem] overflow-hidden shadow-2xl bg-slate-100">
                <img 
                  src="/hero-product.jpg" 
                  alt="Minimalist Modern Lifestyle Product" 
                  className="object-cover w-full h-full object-center"
                />
              </div>
              
              {/* Floating Data Card */}
              <motion.div 
                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.8, duration: 0.8 }}
                className="absolute top-1/4 -left-12 bg-white/80 backdrop-blur-xl p-4 rounded-2xl shadow-xl border border-white/40 flex items-center gap-4"
              >
                <div className="h-12 w-12 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold">
                  $129
                </div>
                <div>
                  <p className="font-bold text-slate-900 leading-tight">Aura Sound</p>
                  <p className="text-sm text-slate-500 font-medium">360° Spatial Audio</p>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* 2. THE BENTO GRID (Categories & Trust) */}
      <section className="py-24 bg-white relative">
        <div className="container px-6">
          <motion.div 
            initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={fadeUp}
            className="mb-16"
          >
            <h2 className="text-4xl font-black tracking-tight mb-4">Discover the Ecosystem</h2>
            <p className="text-slate-500 text-xl font-medium">Everything you need, nothing you don't.</p>
          </motion.div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 auto-rows-[250px]">
            {/* Big Category Box */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }}
              className="md:col-span-2 md:row-span-2 rounded-[2rem] overflow-hidden relative group bg-slate-100"
            >
              <img src="https://images.unsplash.com/photo-1498049794561-7780e7231661?q=80&w=1200&auto=format&fit=crop" alt="Electronics" className="absolute inset-0 w-full h-full object-cover mix-blend-multiply opacity-90 group-hover:scale-105 transition-transform duration-1000 ease-out" />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 to-transparent" />
              <div className="absolute bottom-0 left-0 p-10 text-white">
                <h3 className="text-3xl font-bold mb-2">Workspace Essentials</h3>
                <Link to="/products?category=electronics" className="inline-flex items-center font-semibold hover:gap-2 transition-all">
                  Shop Now <ArrowRight className="ml-1 h-5 w-5" />
                </Link>
              </div>
            </motion.div>

            {/* Small Category Box */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6, delay: 0.1 }}
              className="rounded-[2rem] overflow-hidden relative group bg-slate-100"
            >
              <img src="https://images.unsplash.com/photo-1445205170230-053b83016050?q=80&w=600&auto=format&fit=crop" alt="Apparel" className="absolute inset-0 w-full h-full object-cover opacity-90 group-hover:scale-105 transition-transform duration-1000 ease-out" />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 to-transparent" />
              <div className="absolute bottom-0 left-0 p-8 text-white">
                <h3 className="text-2xl font-bold mb-1">Apparel</h3>
                <Link to="/products?category=apparel" className="text-sm font-semibold hover:underline">Explore</Link>
              </div>
            </motion.div>

            {/* Trust Box (Data Backed) */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6, delay: 0.2 }}
              className="rounded-[2rem] bg-slate-50 p-8 flex flex-col justify-center border border-slate-100"
            >
              <Truck className="h-8 w-8 text-slate-900 mb-4" />
              <h3 className="text-3xl font-black text-slate-900 mb-1">3x Faster</h3>
              <p className="text-slate-500 font-medium">Average delivery time compared to industry standards. Free over $150.</p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* 3. PRODUCT-AS-DEMO (Featured) */}
      <section className="py-32 bg-[#FAFAFA]">
        <div className="container px-6">
          <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-6">
            <div>
              <h2 className="text-4xl font-black tracking-tight mb-4">Curated For You</h2>
              <p className="text-slate-500 text-xl font-medium">A selection of our finest pieces.</p>
            </div>
            <Link to="/products">
              <Button variant="outline" className="rounded-full px-8 h-12 font-semibold bg-white border-slate-200">
                View All <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
              {[1,2,3,4].map((i) => (
                <div key={i} className="space-y-4">
                  <Skeleton className="h-[400px] w-full rounded-[2rem]" />
                  <Skeleton className="h-6 w-3/4 rounded-md" />
                </div>
              ))}
            </div>
          ) : (
            <motion.div 
              initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8"
            >
              {featuredProducts.map(product => (
                <motion.div key={product.productId} variants={fadeUp}>
                  <ProductCard product={product} onAddToCart={handleAddToCart} />
                </motion.div>
              ))}
            </motion.div>
          )}
        </div>
      </section>

      {/* 4. CONVERSATIONAL AI HOOK */}
      <section className="py-24 bg-white border-y border-slate-100">
        <div className="container px-6">
          <div className="bg-slate-50 rounded-[3rem] p-10 md:p-20 text-center max-w-5xl mx-auto border border-slate-100 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 text-slate-200 opacity-50">
              <MessageSquare className="h-64 w-64 -rotate-12" />
            </div>
            <div className="relative z-10 max-w-2xl mx-auto flex flex-col items-center">
              <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center mb-8">
                <Sparkles className="h-8 w-8 text-slate-900" />
              </div>
              <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-6 text-slate-900">
                Not sure where to start?
              </h2>
              <p className="text-xl text-slate-500 font-medium mb-10 leading-relaxed">
                Chat with our AI Stylist. Tell us about your lifestyle, and we'll curate a personalized collection just for you.
              </p>
              <Button size="lg" className="h-14 px-10 rounded-full text-base font-semibold shadow-lg shadow-slate-200">
                Start Conversation
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* 5. DATA-BACKED TESTIMONIALS */}
      <section className="py-32 bg-[#FAFAFA]">
        <div className="container px-6">
          <div className="text-center mb-20">
            <h2 className="text-4xl font-black tracking-tight mb-4">Don't take our word for it.</h2>
            <p className="text-slate-500 text-xl font-medium max-w-2xl mx-auto">
              Real metrics from real customers who upgraded their lifestyle.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { stat: "98%", metric: "Satisfaction Rate", name: "Sarah J.", text: "The build quality completely exceeded my expectations. Worth every penny." },
              { stat: "2.5x", metric: "Longer Lifespan", name: "Michael C.", text: "Compared to my previous gear, these products are built to last a lifetime." },
              { stat: "0", metric: "Returns Needed", name: "Emma R.", text: "Everything fit perfectly out of the box. The sizing guide is flawlessly accurate." }
            ].map((review, i) => (
              <motion.div 
                key={i} 
                initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.15, duration: 0.6 }}
                className="bg-white p-10 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-end gap-3 mb-6">
                  <span className="text-5xl font-black text-slate-900 tracking-tighter">{review.stat}</span>
                  <span className="text-sm font-bold text-slate-400 uppercase tracking-widest pb-1">{review.metric}</span>
                </div>
                <div className="flex gap-1 mb-6">
                  {[1,2,3,4,5].map(star => <Star key={star} className="h-4 w-4 fill-amber-400 text-amber-400" />)}
                </div>
                <p className="text-lg text-slate-600 font-medium leading-relaxed mb-8">"{review.text}"</p>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  <span className="font-bold text-slate-900">{review.name}</span>
                  <span className="text-slate-400 text-sm ml-2">Verified Buyer</span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

    </div>
  );
};
