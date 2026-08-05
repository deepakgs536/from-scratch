import { Link, useLocation } from 'react-router-dom';
import { ShoppingCart, User, Package, LogIn, Heart } from 'lucide-react';
import { Button } from '../ui/button';
import { useSelector } from 'react-redux';
import type { RootState } from '@/store';

export const Navbar = () => {
  const location = useLocation();
  const isLandingPage = location.pathname === '/';
  const { isAuthenticated } = useSelector((state: RootState) => state.auth);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center space-x-2 group">
          <div className="h-8 w-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center group-hover:scale-105 transition-transform">
            <Package className="h-5 w-5" />
          </div>
          <span className="font-bold text-lg hidden sm:inline-block tracking-tight">Essential.</span>
        </Link>
        
        {!isLandingPage ? (
          <>
            <nav className="flex items-center space-x-8 text-sm font-semibold h-full relative">
              <Link to="/products" className="transition-colors hover:text-primary text-muted-foreground">All Products</Link>
              <Link to="/orders" className="transition-colors hover:text-primary text-muted-foreground">Orders</Link>
              

            </nav>
            <div className="flex items-center space-x-2 sm:space-x-4">
              <Link to="/wishlist">
                <Button variant="ghost" size="icon" className="relative hover:bg-primary/5 rounded-full text-slate-600 hover:text-red-500 transition-colors">
                  <Heart className="h-5 w-5" />
                  {/* Badge could show count if needed */}
                </Button>
              </Link>
              <Link to="/cart">
                <Button variant="ghost" size="icon" className="relative hover:bg-primary/5 rounded-full">
                  <ShoppingCart className="h-5 w-5" />
                  <span className="absolute top-1 right-1 h-2.5 w-2.5 rounded-full bg-primary border-2 border-background" />
                </Button>
              </Link>
              {isAuthenticated ? (
                <Link to="/profile">
                  <Button variant="outline" className="rounded-full px-5 font-semibold hover:bg-primary/5">
                    <User className="mr-2 h-4 w-4" />
                    Profile
                  </Button>
                </Link>
              ) : (
                <Link to="/login">
                  <Button variant="outline" className="rounded-full px-5 font-semibold hover:bg-primary/5">
                    <LogIn className="mr-2 h-4 w-4" />
                    Login
                  </Button>
                </Link>
              )}
            </div>
          </>
        ) : (
          <div className="flex items-center space-x-4">
            <Link to="/products" className="text-sm font-semibold text-muted-foreground hover:text-primary transition-colors hidden sm:block mr-2">
              Browse Store
            </Link>
            <Link to="/login">
              <Button className="rounded-full px-6 font-semibold shadow-lg shadow-primary/20 hover:-translate-y-0.5 transition-transform">
                Login
                <LogIn className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        )}
      </div>
    </header>
  );
};
