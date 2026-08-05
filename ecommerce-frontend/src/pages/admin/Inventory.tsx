import { useEffect, useState } from 'react';
import { ProductAPI, InventoryAPI, MediaAPI } from '@/api/services';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { RefreshCcw, AlertCircle, Edit, TrendingDown, Package, ShieldCheck, ChevronDown, ChevronUp, PlusCircle } from 'lucide-react';
import { format } from 'date-fns';

export const AdminInventory = () => {
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [editForm, setEditForm] = useState({ available_quantity: 0, reserved_quantity: 0 });
  const [actionLoading, setActionLoading] = useState(false);
  const [showLowStock, setShowLowStock] = useState(false);

  useEffect(() => {
    fetchInventory();
  }, []);

  const fetchInventory = async () => {
  setLoading(true);

  try {
    const [productsRes, inventoryRes] = await Promise.all([
      ProductAPI.getAll(),
      InventoryAPI.getAll()
    ]);

    const products = await Promise.all(
      productsRes.data.data.map(async (product: any) => {
        if (!product.image_url) {
          return product;
        }

        try {
          const mediaResponse = await MediaAPI.getDownloadUrl(
            product.image_url
          );

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

    const inventory = inventoryRes.data.data;

    const merged = products.map((product: any) => {
      const inv =
        inventory.find(
          (item: any) => item.productId === product.productId
        ) || {
          available_quantity: 0,
          reserved_quantity: 0,
          updated_at: new Date().toISOString()
        };

      return {
        ...product,
        ...inv
      };
    });

    setInventoryItems(merged);
  } catch (error) {
    console.error(error);
    toast.error("Failed to load inventory data");
  } finally {
    setLoading(false);
  }
};

  const handleEditClick = (item: any) => {
    setEditingItem(item);
    setEditForm({
      available_quantity: item.available_quantity,
      reserved_quantity: item.reserved_quantity
    });
  };

  const handleEditConfirm = async () => {
    if (!editingItem) return;
    setActionLoading(true);
    try {
      await InventoryAPI.update(editingItem.productId, editForm);
      setInventoryItems(inventoryItems.map(item => 
        item.productId === editingItem.productId 
          ? { ...item, ...editForm, updated_at: new Date().toISOString() } 
          : item
      ));
      toast.success('Inventory updated successfully');
      setEditingItem(null);
    } catch (error) {
      toast.error('Failed to update inventory');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRestock = async (item: any) => {
    setActionLoading(true);
    try {
      const restockData = { available_quantity: 50, reserved_quantity: item.reserved_quantity };
      await InventoryAPI.update(item.productId, restockData);
      setInventoryItems(inventoryItems.map(i => 
        i.productId === item.productId 
          ? { ...i, ...restockData, updated_at: new Date().toISOString() } 
          : i
      ));
      toast.success(`${item.name} restocked to 50 successfully!`);
    } catch (error) {
      toast.error(`Failed to restock ${item.name}`);
    } finally {
      setActionLoading(false);
    }
  };

  const outOfStockCount = inventoryItems.filter(p => p.available_quantity === 0).length;
  const totalAvailable = inventoryItems.reduce((acc, curr) => acc + (curr.available_quantity || 0), 0);
  const totalReserved = inventoryItems.reduce((acc, curr) => acc + (curr.reserved_quantity || 0), 0);

  return (
    <div className="min-h-[calc(100vh-64px)] bg-[#F8FAFC] py-8 px-4 sm:px-8">
      <div className="flex flex-col md:flex-row justify-between md:items-end gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
            Inventory Central
          </h1>
          <p className="text-slate-500 mt-1 text-sm font-medium">Real-time stock levels and warehouse distribution.</p>
        </div>
        <Button 
          variant="outline" 
          onClick={fetchInventory} 
          disabled={loading}
          className="shadow-sm hover:shadow transition-all bg-background/50 backdrop-blur-sm"
        >
          <RefreshCcw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Sync Data
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="border-none shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] rounded-[1.5rem] bg-white overflow-hidden relative">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Package className="w-16 h-16 text-blue-600" />
          </div>
          <CardHeader className="pb-2 relative z-10">
            <CardTitle className="text-xs font-semibold tracking-wider text-blue-600 uppercase">
              Total Available
            </CardTitle>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="text-3xl font-black text-slate-900">{loading ? '-' : totalAvailable}</div>
            <p className="text-sm text-slate-500 mt-1 font-medium">Ready to ship units</p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] rounded-[1.5rem] bg-white overflow-hidden relative">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <ShieldCheck className="w-16 h-16 text-amber-600" />
          </div>
          <CardHeader className="pb-2 relative z-10">
            <CardTitle className="text-xs font-semibold tracking-wider text-amber-600 uppercase">
              Reserved Stock
            </CardTitle>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="text-3xl font-black text-slate-900">{loading ? '-' : totalReserved}</div>
            <p className="text-sm text-slate-500 mt-1 font-medium">Allocated for pending orders</p>
          </CardContent>
        </Card>

        <Card className={`border-none shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] rounded-[1.5rem] bg-white overflow-hidden relative`}>
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <TrendingDown className={`w-16 h-16 ${outOfStockCount > 0 ? 'text-destructive' : 'text-slate-400'}`} />
          </div>
          <CardHeader className="pb-2 relative z-10">
            <CardTitle className={`text-xs font-semibold tracking-wider uppercase flex items-center gap-2 ${outOfStockCount > 0 ? 'text-destructive' : 'text-slate-500'}`}>
              {outOfStockCount > 0 && <AlertCircle className="h-4 w-4" />}
              Stock Depleted
            </CardTitle>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className={`text-4xl font-black ${outOfStockCount > 0 ? 'text-destructive' : ''}`}>
              {loading ? '-' : outOfStockCount}
            </div>
            <p className={`text-sm mt-1 font-medium ${outOfStockCount > 0 ? 'text-destructive/80' : 'text-muted-foreground'}`}>
              Products requiring restock
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Low Stock & Depleted Collapsible List */}
      <div className="mb-8 bg-amber-50 border border-amber-100 rounded-[1.5rem] overflow-hidden shadow-sm">
        <button
          onClick={() => setShowLowStock(!showLowStock)}
          className="w-full flex items-center justify-between p-5 bg-amber-100/50 hover:bg-amber-100 transition-colors focus:outline-none"
        >
          <div className="flex items-center gap-3">
            <AlertCircle className="text-amber-600 w-5 h-5" />
            <span className="font-bold text-amber-800">
              Low Stock & Depleted Items ({inventoryItems.filter(i => i.available_quantity <= 10).length})
            </span>
          </div>
          {showLowStock ? (
            <ChevronUp className="text-amber-600 w-5 h-5" />
          ) : (
            <ChevronDown className="text-amber-600 w-5 h-5" />
          )}
        </button>
        {showLowStock && (
          <div className="p-5 border-t border-amber-100 space-y-3 bg-amber-50/50 animate-in slide-in-from-top-2 duration-300">
            {inventoryItems.filter(i => i.available_quantity <= 10).length === 0 ? (
              <p className="text-sm text-amber-700/70 text-center py-4 font-medium">All items have sufficient stock (11+).</p>
            ) : (
              inventoryItems.filter(i => i.available_quantity <= 10).map(item => (
                <div key={item.productId} className="flex items-center justify-between bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                  <div className="flex items-center gap-4">
                    <img src={item.image_url || 'https://images.unsplash.com/photo-1560393464-5c69a73c5770?w=100&q=80'} alt={item.name} className="w-12 h-12 rounded-lg object-cover shadow-sm ring-1 ring-border/50" />
                    <div>
                      <p className="font-bold text-sm text-slate-900">{item.name}</p>
                      <p className="text-xs text-slate-500 font-mono mt-0.5">{item.sku || 'N/A'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 sm:gap-6">
                    <div className="text-right">
                      <p className="text-xs text-slate-400 mb-1 uppercase tracking-wider font-bold">Qty</p>
                      <Badge variant={item.available_quantity === 0 ? 'destructive' : 'secondary'} className={`text-sm px-2.5 py-0.5 ${item.available_quantity > 0 ? 'bg-amber-100 text-amber-800' : ''}`}>
                        {item.available_quantity}
                      </Badge>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => handleRestock(item)} disabled={actionLoading} className="hidden sm:flex border-emerald-200 text-emerald-700 hover:bg-emerald-50 shadow-sm">
                      <PlusCircle className="h-4 w-4 mr-2" /> Restock
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <Card className="border-none shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] rounded-[2rem] bg-white overflow-hidden">
        <CardHeader className="border-b border-slate-50 px-6 pt-6 pb-3">
          <CardTitle className="text-lg font-bold text-slate-900">Stock Overview</CardTitle>
          <CardDescription className="text-slate-500 text-xs font-medium mt-1">Manage individual product quantities and allocations.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-4 p-6">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-transparent hover:bg-transparent">
                  <TableRow className="border-slate-50">
                    <TableHead className="py-4 px-6 font-semibold text-slate-500">Product</TableHead>
                    <TableHead className="font-semibold text-slate-500">SKU</TableHead>
                    <TableHead className="text-right font-semibold text-slate-500">Available</TableHead>
                    <TableHead className="text-right font-semibold text-slate-500">Reserved</TableHead>
                    <TableHead className="text-center font-semibold text-slate-500">Status</TableHead>
                    <TableHead className="font-semibold text-slate-500">Last Updated</TableHead>
                    <TableHead className="text-right pr-6 font-semibold text-slate-500">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inventoryItems.map(item => {
                    const total = item.available_quantity + item.reserved_quantity;
                    const stockPercentage = total > 0 ? Math.min(100, Math.round((item.available_quantity / total) * 100)) : 0;
                    const isLowStock = item.available_quantity > 0 && item.available_quantity <= 10;
                    const isOutOfStock = item.available_quantity === 0;
                    
                    return (
                      <TableRow key={item.productId} className={`hover:bg-slate-50/50 border-slate-50 transition-colors ${isOutOfStock ? 'bg-red-50/50' : ''}`}>
                        <TableCell className="font-medium py-3 px-6">
                          <div className="flex items-center gap-4">
                            <div className="relative">
                              <img src={item.image_url || 'https://images.unsplash.com/photo-1560393464-5c69a73c5770?w=500&q=80'} alt={item.name} className="w-10 h-10 rounded-lg object-cover shadow-sm" />
                              {isOutOfStock && <div className="absolute inset-0 bg-white/50 rounded-lg backdrop-blur-[1px]"></div>}
                            </div>
                            <div>
                              <p className="font-bold text-slate-900 text-sm">{item.name}</p>
                              <p className="text-xs text-slate-500">{item.category}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-slate-400">{item.sku || 'N/A'}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-col items-end gap-1.5">
                            <span className={`font-black text-sm ${isOutOfStock ? 'text-destructive' : isLowStock ? 'text-amber-500' : 'text-slate-900'}`}>
                              {item.available_quantity}
                            </span>
                            {/* Visual Stock Indicator */}
                            <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div 
                                className={`h-full rounded-full ${isOutOfStock ? 'bg-destructive' : isLowStock ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                style={{ width: `${Math.max(5, stockPercentage)}%` }}
                              ></div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant="outline" className="bg-slate-50 border-slate-200 text-slate-600 font-bold">{item.reserved_quantity}</Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge 
                            variant={isOutOfStock ? 'destructive' : isLowStock ? 'secondary' : 'default'}
                            className={`text-[10px] uppercase tracking-wider font-bold
                              ${isLowStock ? 'bg-amber-100 text-amber-800 hover:bg-amber-100' : ''}
                            `}
                          >
                            {isOutOfStock ? 'Out of Stock' : isLowStock ? 'Low Stock' : 'In Stock'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-slate-500 font-medium">
                          {item.updated_at ? format(new Date(item.updated_at), 'MMM dd, HH:mm') : 'N/A'}
                        </TableCell>
                        <TableCell className="text-right pr-6">
                          <Button variant="ghost" size="icon" onClick={() => handleEditClick(item)} className="text-slate-400 hover:text-indigo-600 hover:bg-indigo-50">
                            <Edit className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Inventory Modal */}
      {editingItem && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <Card className="w-full max-w-sm shadow-2xl border-0 ring-1 ring-border/50">
            <CardHeader className="bg-muted/30 pb-4 border-b">
              <CardTitle>Update Inventory</CardTitle>
              <CardDescription className="line-clamp-1">{editingItem.name}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5 pt-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground flex justify-between">
                  <span>Available Quantity</span>
                  <span className="text-muted-foreground font-normal">Ready to ship</span>
                </label>
                <input 
                  type="number"
                  min="0"
                  className="flex h-11 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-transparent transition-all"
                  value={editForm.available_quantity}
                  onChange={e => setEditForm({...editForm, available_quantity: parseInt(e.target.value) || 0})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground flex justify-between">
                  <span>Reserved Quantity</span>
                  <span className="text-muted-foreground font-normal">Pending orders</span>
                </label>
                <input 
                  type="number"
                  min="0"
                  className="flex h-11 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-transparent transition-all"
                  value={editForm.reserved_quantity}
                  onChange={e => setEditForm({...editForm, reserved_quantity: parseInt(e.target.value) || 0})}
                />
              </div>
            </CardContent>
            <div className="flex justify-end gap-3 p-6 pt-2 bg-muted/10 border-t mt-2 rounded-b-xl">
              <Button variant="ghost" onClick={() => setEditingItem(null)} disabled={actionLoading}>Cancel</Button>
              <Button onClick={handleEditConfirm} disabled={actionLoading} className="shadow-md">
                {actionLoading ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
