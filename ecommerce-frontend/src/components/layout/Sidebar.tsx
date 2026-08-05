import { Link, useLocation } from 'react-router-dom';
import { 
  Package, ShoppingBag, Settings, ChevronLeft, ChevronRight, Menu, X, CreditCard, BarChart
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '../ui/button';
import { useState } from 'react';

const navItems = [
  { name: 'Products', path: '/admin/products', icon: Package },
  { name: 'Inventory', path: '/admin/inventory', icon: Package },
  { name: 'Orders', path: '/admin/orders', icon: ShoppingBag },
  { name: 'Payments', path: '/admin/payments', icon: CreditCard },
  { name: 'Analytics', path: '/admin/analytics', icon: BarChart },
  { name: 'Settings', path: '/admin/settings', icon: Settings },
];
 
export const Sidebar = () => {
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isOpenMobile, setIsOpenMobile] = useState(false);

  return (
    <>
      {/* Mobile Toggle Button (Floating) */}
      <div className="md:hidden fixed bottom-6 right-6 z-50">
        <Button 
          size="icon" 
          className="h-14 w-14 rounded-full shadow-xl shadow-primary/30 hover:scale-105 transition-transform" 
          onClick={() => setIsOpenMobile(!isOpenMobile)}
        >
          {isOpenMobile ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </Button>
      </div>

      {/* Mobile Overlay */}
      {isOpenMobile && (
        <div 
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setIsOpenMobile(false)}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={cn(
          "fixed md:sticky top-0 left-0 z-40 flex flex-col h-screen border-r bg-background transition-all duration-300 ease-in-out shadow-2xl md:shadow-none shrink-0 relative",
          isCollapsed ? "w-20" : "w-64",
          isOpenMobile ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        {/* Toggle Button on the right divider */}
        <Button 
          variant="outline" 
          size="icon" 
          className="absolute -right-4 top-6 hidden md:flex h-8 w-8 rounded-full shadow-sm z-50 bg-background border-border hover:bg-accent hover:text-accent-foreground"
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>

        <div className={cn("flex h-16 items-center border-b transition-all duration-300", isCollapsed ? "justify-center px-0" : "justify-start px-6 gap-3")}>
          <div className="flex items-center justify-center bg-primary text-primary-foreground rounded-xl p-1.5 shrink-0 shadow-md">
            <Package className="h-5 w-5" />
          </div>
          <span className={cn("font-extrabold text-lg whitespace-nowrap transition-all duration-300 tracking-tight", isCollapsed ? "opacity-0 w-0 overflow-hidden" : "opacity-100 w-auto")}>
            Essential.
          </span>
        </div>
        
        <div className="flex-1 overflow-y-auto overflow-x-hidden py-4 no-scrollbar">
          <nav className="grid items-start px-3 text-sm font-medium gap-2">
            {navItems.map((item) => (
              <Link key={item.path} to={item.path} onClick={() => setIsOpenMobile(false)}>
                <Button
                  variant={location.pathname === item.path ? 'secondary' : 'ghost'}
                  className={cn(
                    "w-full transition-all duration-200 overflow-hidden", 
                    isCollapsed ? "justify-center px-0" : "justify-start px-4",
                    location.pathname === item.path && "bg-secondary shadow-sm"
                  )}
                  title={isCollapsed ? item.name : undefined}
                >
                  <item.icon className={cn("h-5 w-5 shrink-0 text-muted-foreground", location.pathname === item.path && "text-foreground", !isCollapsed && "mr-3")} />
                  {!isCollapsed && <span className="truncate">{item.name}</span>}
                </Button>
              </Link>
            ))}
          </nav>
        </div>
      </aside>
    </>
  );
};
