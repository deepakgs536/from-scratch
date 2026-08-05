import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Compass, Home, Search } from 'lucide-react';
import { motion } from 'framer-motion';

export const NotFound = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#FAFAFA] text-slate-900 px-6 relative overflow-hidden">
      {/* Background blobs for depth */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-[100px] pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 text-center max-w-2xl mx-auto"
      >
        <div className="mb-8 relative inline-block">
          <Compass className="w-32 h-32 text-slate-200 mx-auto" />
          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <Compass className="w-32 h-32 text-primary opacity-20 blur-sm" />
          </motion.div>
        </div>

        <h1 className="text-8xl md:text-9xl font-black tracking-tighter text-slate-900 mb-4 drop-shadow-sm">
          404
        </h1>
        <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-6">
          Looks like you've ventured off the map.
        </h2>
        <p className="text-lg text-slate-500 mb-10 max-w-md mx-auto leading-relaxed">
          The page you are looking for doesn't exist, has been moved, or is temporarily unavailable. Let's get you back on track.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <Button asChild size="lg" className="rounded-full px-8 h-14 text-base font-semibold shadow-lg shadow-primary/20 hover:-translate-y-0.5 transition-transform w-full sm:w-auto">
            <Link to="/">
              <Home className="mr-2 h-5 w-5" /> Back to Home
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="rounded-full px-8 h-14 text-base font-semibold border-slate-200 hover:bg-slate-50 hover:-translate-y-0.5 transition-transform w-full sm:w-auto bg-white/50 backdrop-blur-md">
            <Link to="/products">
              <Search className="mr-2 h-5 w-5" /> Browse Products
            </Link>
          </Button>
        </div>
      </motion.div>
    </div>
  );
};
