import { createBrowserRouter, RouterProvider, Outlet, Navigate } from 'react-router-dom';
import React, { Suspense } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '@/store';
import { lazy } from 'react';

const Login = lazy(() => import('@/pages/Login').then(module => ({ default: module.Login })));
const ProductListing = lazy(() => import('@/pages/ProductListing').then(module => ({ default: module.ProductListing })));
const ProductDetails = lazy(() => import('@/pages/ProductDetails').then(module => ({ default: module.ProductDetails })));
const Cart = lazy(() => import('@/pages/Cart').then(module => ({ default: module.Cart })));
const Checkout = lazy(() => import('@/pages/Checkout').then(module => ({ default: module.Checkout })));
const Orders = lazy(() => import('@/pages/Orders').then(module => ({ default: module.Orders })));
const OrderDetails = lazy(() => import('@/pages/OrderDetails').then(module => ({ default: module.OrderDetails })));
const PaymentStatus = lazy(() => import('@/pages/PaymentStatus').then(module => ({ default: module.PaymentStatus })));
// const AdminDashboard = lazy(() => import('@/pages/admin/Dashboard').then(module => ({ default: module.AdminDashboard }))); 
const AdminProducts = lazy(() => import('@/pages/admin/Products').then(module => ({ default: module.AdminProducts })));
const AdminCreateProduct = lazy(() => import('@/pages/admin/CreateProduct').then(module => ({ default: module.CreateProduct })));
// const AdminMedia = lazy(() => import('@/pages/admin/MediaUpload').then(module => ({ default: module.MediaUpload }))); 
const AdminOrders = lazy(() => import('@/pages/admin/Orders').then(module => ({ default: module.AdminOrders })));
const AdminInventory = lazy(() => import('@/pages/admin/Inventory').then(module => ({ default: module.AdminInventory })));
const AdminPayments = lazy(() => import('@/pages/admin/Payments').then(module => ({ default: module.AdminPayments })));
const Home = lazy(() => import('@/pages/Home').then(module => ({ default: module.Home })));

import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { Sidebar } from '@/components/layout/Sidebar';

// Layouts
const RootLayout = () => (
  <div className="min-h-screen flex flex-col bg-background text-foreground">
    <Navbar />
    <main className="flex-1">
      <Suspense fallback={<div>Loading...</div>}>
        <Outlet />
      </Suspense>
    </main>
    <Footer />
  </div>
);

const AdminLayout = () => (
  <div className="min-h-screen flex bg-background text-foreground">
    <Sidebar />
    <main className="flex-1 p-6 overflow-auto">
      <Suspense fallback={<div>Loading...</div>}>
        <Outlet />
      </Suspense>
    </main>
  </div>
);

// Guards
const ProtectedRoute = ({ children, role }: { children: React.ReactNode, role?: 'admin' | 'customer' }) => {
  const { isAuthenticated, user } = useSelector((state: RootState) => state.auth);

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (role && user?.role !== role) return <Navigate to="/" replace />;

  return <>{children}</>;
};

// Redirect admins away from customer/public pages to the admin dashboard
const AdminRedirectGuard = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, user } = useSelector((state: RootState) => state.auth);

  if (isAuthenticated && user?.role === 'admin') {
    return <Navigate to="/admin/products" replace />;
  }

  return <>{children}</>;
};

// Redirect logged in customers from the landing page to the products page
const CustomerHomeRedirect = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, user } = useSelector((state: RootState) => state.auth);

  if (isAuthenticated && user?.role === 'customer') {
    return <Navigate to="/products" replace />;
  }

  return <>{children}</>;
};

// Pages (Placeholders for remaining)
const NotFound = lazy(() => import('@/pages/NotFound').then(module => ({ default: module.NotFound })));
const Profile = lazy(() => import('@/pages/Profile').then(module => ({ default: module.Profile })));
const Wishlist = lazy(() => import('@/pages/Wishlist').then(module => ({ default: module.Wishlist })));

// Admin Pages Placeholders for remaining
// Admin Pages Placeholders for remaining
const AdminAnalytics = lazy(() => import('@/pages/admin/Analytics').then(module => ({ default: module.AdminAnalytics })));
const AdminSettings = lazy(() => import('@/pages/admin/Settings').then(module => ({ default: module.AdminSettings })));


const router = createBrowserRouter([
  {
    path: '/',
    element: (
      <AdminRedirectGuard>
        <RootLayout />
      </AdminRedirectGuard>
    ),
    errorElement: <NotFound />,
    children: [
      { index: true, element: <CustomerHomeRedirect><Home /></CustomerHomeRedirect> },
      { path: 'products', element: <ProductListing /> },
      { path: 'products/:id', element: <ProductDetails /> },
      { path: 'cart', element: <Cart /> },
      { path: 'wishlist', element: <Wishlist /> },
      { path: 'login', element: <Login /> },
      
      // General Protected Routes (Any logged in user)
      {
        element: <ProtectedRoute><Outlet /></ProtectedRoute>,
        children: [
          { path: 'checkout', element: <Checkout /> },
          { path: 'profile', element: <Profile /> },
        ]
      },

      // Customer Protected Routes
      {
        element: <ProtectedRoute role="customer"><Outlet /></ProtectedRoute>,
        children: [
          { path: 'orders', element: <Orders /> },
          { path: 'orders/:id', element: <OrderDetails /> },
          { path: 'payments/:status', element: <PaymentStatus /> },
        ]
      }
    ]
  },
  {
    path: '/admin',
    element: <ProtectedRoute role="admin"><AdminLayout /></ProtectedRoute>,
    errorElement: <NotFound />,
    children: [
      { index: true, element: <Navigate to="/admin/products" replace /> },
      {
        path: 'products',
        element: <AdminProducts />,
      },
      {
        path: 'products/create',
        element: <AdminCreateProduct />,
      },
      { path: 'inventory', element: <AdminInventory /> },
      { path: 'orders', element: <AdminOrders /> },
      { path: 'payments', element: <AdminPayments /> },
      { path: 'analytics', element: <AdminAnalytics /> },
      { path: 'settings', element: <AdminSettings /> },
    ]
  }
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
