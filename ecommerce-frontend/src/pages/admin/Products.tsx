import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '@/store';
import { ProductAPI, MediaAPI } from '@/api/services';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Plus, Edit, Trash2, ShieldCheck } from 'lucide-react';

import { useNavigate } from 'react-router-dom';

export const AdminProducts = () => {
  const { user } = useSelector((state: RootState) => state.auth);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [deletingProduct, setDeletingProduct] = useState<any>(null);
  const [editForm, setEditForm] = useState({ name: '', price: 0, category: '', stock_status: '' });
  const [actionLoading, setActionLoading] = useState(false);
  const navigate = useNavigate();

  const handleEditClick = (product: any) => {
    setEditingProduct(product);
    setEditForm({ 
      name: product.name, 
      price: product.price, 
      category: product.category || '', 
      stock_status: product.stock_status 
    });
  };

  const handleDeleteConfirm = async () => {
    if (!deletingProduct) return;
    setActionLoading(true);
    try {
      await ProductAPI.delete(deletingProduct.productId);
      setProducts(products.filter(p => p.productId !== deletingProduct.productId));
      toast.success('Product deleted successfully');
    } catch (error) {
      toast.error('Failed to delete product');
    } finally {
      setActionLoading(false);
      setDeletingProduct(null);
    }
  };

  const handleEditConfirm = async () => {
    if (!editingProduct) return;
    setActionLoading(true);
    try {
      await ProductAPI.update(editingProduct.productId, editForm);
      setProducts(products.map(p => p.productId === editingProduct.productId ? { ...p, ...editForm } : p));
      toast.success('Product updated successfully');
    } catch (error) {
      toast.error('Failed to update product');
    } finally {
      setActionLoading(false);
      setEditingProduct(null);
    }
  };

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const response = await ProductAPI.getAll();

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
              console.error(
                `Failed to generate signed URL for ${product.productId}`,
                err
              );

              return {
                ...product,
                image_url: ""
              };
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
  }, []);

  return (
    <div className="min-h-[calc(100vh-64px)] bg-[#F8FAFC] py-8 px-4 sm:px-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">Products Management</h1>
          <p className="text-slate-500 mt-1 text-sm font-medium">Manage your store inventory and pricing.</p>
        </div>
        <div className="flex items-center gap-4 mt-4 md:mt-0">
          {/* DEMO PURPOSES: Verify Role */}
          <div className="hidden md:flex items-center gap-2 bg-slate-50 border border-slate-200 px-4 py-2 rounded-xl">
            <ShieldCheck className="w-5 h-5 text-indigo-500" />
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Active Role</span>
              <span className="text-sm font-bold text-slate-900 capitalize">{user?.role || 'Unknown'}</span>
            </div>
          </div>
          
          <Button onClick={() => navigate('/admin/products/create')} className="h-12 px-6 rounded-xl shadow-lg shadow-primary/20">
            <Plus className="mr-2 h-4 w-4" /> Add Product
          </Button>
        </div>
      </div>

      <Card className="border-none shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] rounded-[2rem] bg-white overflow-hidden">
        <CardHeader className="px-6 pt-6 pb-3 border-b border-slate-50">
          <CardTitle className="text-lg font-bold text-slate-900">All Products</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-slate-50 hover:bg-transparent">
                  <TableHead className="w-[80px] font-semibold text-slate-500">Image</TableHead>
                  <TableHead className="font-semibold text-slate-500">Name</TableHead>
                  <TableHead className="font-semibold text-slate-500">Category</TableHead>
                  <TableHead className="font-semibold text-slate-500">Price</TableHead>
                  <TableHead className="font-semibold text-slate-500">Status</TableHead>
                  <TableHead className="text-right font-semibold text-slate-500">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map(product => (
                  <TableRow key={product.productId} className="border-slate-50 hover:bg-slate-50/50 transition-colors">
                    <TableCell>
                      <img src={product.image_url || 'https://images.unsplash.com/photo-1560393464-5c69a73c5770?w=500&q=80'} alt={product.name} className="w-12 h-12 rounded-xl object-cover shadow-sm" />
                    </TableCell>
                    <TableCell className="font-bold text-slate-900 text-sm">{product.name}</TableCell>
                    <TableCell className="text-slate-500 font-medium text-sm">{product.category}</TableCell>
                    <TableCell className="font-bold text-slate-900 text-sm">${product.price.toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge variant={product.stock_status === 'IN_STOCK' ? 'default' : 'destructive'} className="text-[10px] uppercase tracking-wider font-bold">
                        {product.stock_status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" className="mr-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50" onClick={() => handleEditClick(product)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-slate-400 hover:text-rose-600 hover:bg-rose-50" onClick={() => setDeletingProduct(product)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Modal */}
      {deletingProduct && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md shadow-lg border">
            <CardHeader>
              <CardTitle>Delete Product</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Are you sure you want to delete <span className="font-semibold text-foreground">{deletingProduct.name}</span>? This action cannot be undone.
              </p>
            </CardContent>
            <div className="flex justify-end gap-3 p-6 pt-0">
              <Button variant="outline" onClick={() => setDeletingProduct(null)} disabled={actionLoading}>Cancel</Button>
              <Button variant="destructive" onClick={handleDeleteConfirm} disabled={actionLoading}>
                {actionLoading ? 'Deleting...' : 'Delete'}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Edit Product Modal */}
      {editingProduct && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md shadow-lg border">
            <CardHeader>
              <CardTitle>Edit Product</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Name</label>
                <input 
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={editForm.name}
                  onChange={e => setEditForm({...editForm, name: e.target.value})}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Price</label>
                  <input 
                    type="number"
                    step="0.01"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    value={editForm.price}
                    onChange={e => setEditForm({...editForm, price: parseFloat(e.target.value)})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Category</label>
                  <input 
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    value={editForm.category}
                    onChange={e => setEditForm({...editForm, category: e.target.value})}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Status</label>
                <select 
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={editForm.stock_status}
                  onChange={e => setEditForm({...editForm, stock_status: e.target.value})}
                >
                  <option value="IN_STOCK">IN_STOCK</option>
                  <option value="OUT_OF_STOCK">OUT_OF_STOCK</option>
                </select>
              </div>
            </CardContent>
            <div className="flex justify-end gap-3 p-6 pt-0">
              <Button variant="outline" onClick={() => setEditingProduct(null)} disabled={actionLoading}>Cancel</Button>
              <Button onClick={handleEditConfirm} disabled={actionLoading}>
                {actionLoading ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
