import { useEffect, useState } from 'react';
import { PaymentAPI, UserAPI } from '@/api/services';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { RefreshCcw, CreditCard, DollarSign, Activity, X } from 'lucide-react';
import { format } from 'date-fns';

export const AdminPayments = () => {
  const [payments, setPayments] = useState<any[]>([]);
  const [userNames, setUserNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [selectedPayment, setSelectedPayment] = useState<any>(null);

  useEffect(() => {
    fetchPayments();
  }, []);

  const fetchPayments = async () => {
    setLoading(true);
    try {
      const response = await PaymentAPI.getAll();
      const sortedPayments = response.data.data.sort((a: any, b: any) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      setPayments(sortedPayments);
      
      const allUserIds = [...new Set(sortedPayments.map((p: any) => p.userId).filter(Boolean))];
      const usersMap: Record<string, string> = {};
      await Promise.all(allUserIds.map(async (uId) => {
        try {
          const uRes = await UserAPI.getProfile(uId as string, true);
          if (uRes.data?.data?.name) {
            usersMap[uId as string] = uRes.data.data.name;
          }
        } catch (e) {}
      }));
      setUserNames(usersMap);
      
    } catch (error) {
      toast.error('Failed to load payments data');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING': return <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">Pending</Badge>;
      case 'COMPLETED': return <Badge className="bg-green-500 hover:bg-green-600">Completed</Badge>;
      case 'FAILED': return <Badge variant="destructive">Failed</Badge>;
      case 'REFUNDED': return <Badge variant="outline" className="border-blue-500 text-blue-500">Refunded</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const totalVolume = payments.filter(p => p.status === 'COMPLETED').reduce((acc, curr) => acc + curr.amount, 0);
  const pendingVolume = payments.filter(p => p.status === 'PENDING').reduce((acc, curr) => acc + curr.amount, 0);

  return (
    <div className="min-h-[calc(100vh-64px)] bg-[#F8FAFC] py-8 px-4 sm:px-8">
      <div className="flex flex-col md:flex-row justify-between md:items-end gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
            Payments Ledger
          </h1>
          <p className="text-slate-500 mt-1 text-sm font-medium">Track transactions, settlements, and payment health.</p>
        </div>
        <Button 
          variant="outline" 
          onClick={fetchPayments} 
          disabled={loading}
          className="shadow-sm hover:shadow transition-all bg-background/50 backdrop-blur-sm"
        >
          <RefreshCcw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Sync Ledger
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="border-none shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] rounded-[1.5rem] bg-white overflow-hidden relative">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <DollarSign className="w-16 h-16 text-emerald-600" />
          </div>
          <CardHeader className="pb-2 relative z-10">
            <CardTitle className="text-xs font-semibold tracking-wider text-emerald-600 uppercase">
              Settled Volume
            </CardTitle>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="text-3xl font-black text-slate-900">
              {loading ? '-' : `$${totalVolume.toFixed(2)}`}
            </div>
            <p className="text-sm text-slate-500 mt-1 font-medium">Completed transactions</p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] rounded-[1.5rem] bg-white overflow-hidden relative">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Activity className="w-16 h-16 text-amber-600" />
          </div>
          <CardHeader className="pb-2 relative z-10">
            <CardTitle className="text-xs font-semibold tracking-wider text-amber-600 uppercase">
              Pending Authorization
            </CardTitle>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="text-3xl font-black text-slate-900">
              {loading ? '-' : `$${pendingVolume.toFixed(2)}`}
            </div>
            <p className="text-sm text-slate-500 mt-1 font-medium">Awaiting settlement</p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] rounded-[1.5rem] bg-white overflow-hidden relative">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <CreditCard className="w-16 h-16 text-blue-600" />
          </div>
          <CardHeader className="pb-2 relative z-10">
            <CardTitle className="text-xs font-semibold tracking-wider text-blue-600 uppercase">
              Total Transactions
            </CardTitle>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="text-3xl font-black text-slate-900">
              {loading ? '-' : payments.length}
            </div>
            <p className="text-sm text-slate-500 mt-1 font-medium">All payment attempts</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-none shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] rounded-[2rem] bg-white overflow-hidden">
        <CardHeader className="border-b border-slate-50 px-6 pt-6 pb-3">
          <CardTitle className="text-lg font-bold text-slate-900">Transaction History</CardTitle>
          <CardDescription className="text-slate-500 text-xs font-medium mt-1">Comprehensive log of all payment gateways and customer transactions.</CardDescription>
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
                    <TableHead className="py-4 px-6 font-semibold text-slate-500">Payment ID / Txn</TableHead>
                    <TableHead className="font-semibold text-slate-500">Customer</TableHead>
                    <TableHead className="font-semibold text-slate-500">Order ID</TableHead>
                    <TableHead className="font-semibold text-slate-500">Method</TableHead>
                    <TableHead className="text-right font-semibold text-slate-500">Amount</TableHead>
                    <TableHead className="text-center font-semibold text-slate-500">Status</TableHead>
                    <TableHead className="text-right pr-6 font-semibold text-slate-500">Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map(payment => (
                    <TableRow 
                      key={payment.paymentId} 
                      className="hover:bg-slate-50/50 cursor-pointer transition-colors border-slate-50"
                      onClick={() => setSelectedPayment(payment)}
                    >
                      <TableCell className="py-3 px-6">
                        <p className="font-mono text-xs font-bold text-slate-900">{payment.paymentId}</p>
                        <p className="font-mono text-[10px] text-slate-400 mt-0.5">{payment.transaction_id || 'N/A'}</p>
                      </TableCell>
                      <TableCell className="text-sm font-bold text-slate-900">
                        {userNames[payment.userId] || 'Unknown User'}
                        <p className="font-mono text-[10px] text-slate-400 mt-0.5 font-medium">{payment.userId}</p>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-slate-500">{payment.orderId.substring(0, 8)}...</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-slate-50 border-slate-200 text-slate-600 font-bold">
                          {payment.payment_method}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-black text-sm text-slate-900">
                        {payment.currency === 'USD' ? '$' : ''}{payment.amount.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="scale-90">{getStatusBadge(payment.status)}</div>
                      </TableCell>
                      <TableCell className="text-right pr-6 text-xs text-slate-500 font-medium">
                        {payment.created_at ? format(new Date(payment.created_at), 'MMM dd, HH:mm') : 'N/A'}
                      </TableCell>
                    </TableRow>
                  ))}
                  {payments.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                        No transactions found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment Details Modal */}
      {selectedPayment && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <Card className="w-full max-w-lg shadow-2xl border-0 ring-1 ring-border/50">
            <CardHeader className="bg-muted/30 pb-4 border-b flex flex-row items-center justify-between">
              <div>
                <CardTitle>Payment Receipt</CardTitle>
                <CardDescription>Transaction Details</CardDescription>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setSelectedPayment(null)} className="h-8 w-8 rounded-full">
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              <div className="flex justify-between items-center p-4 bg-muted/30 rounded-lg border">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Amount</p>
                  <p className="text-3xl font-black">{selectedPayment.currency === 'USD' ? '$' : ''}{selectedPayment.amount.toFixed(2)} {selectedPayment.currency}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-muted-foreground mb-1">Status</p>
                  {getStatusBadge(selectedPayment.status)}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-y-4 gap-x-6 text-sm">
                <div>
                  <p className="text-muted-foreground mb-1">Payment ID</p>
                  <p className="font-mono text-xs break-all font-semibold">{selectedPayment.paymentId}</p>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1">Gateway Txn ID</p>
                  <p className="font-mono text-xs break-all">{selectedPayment.transaction_id || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1">Customer</p>
                  <p className="font-medium">{userNames[selectedPayment.userId] || 'Unknown User'}</p>
                  <p className="font-mono text-xs text-muted-foreground mt-0.5">ID: {selectedPayment.userId}</p>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1">Related Order ID</p>
                  <p className="font-mono text-xs break-all">{selectedPayment.orderId}</p>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1">Payment Method</p>
                  <p className="font-medium">{selectedPayment.payment_method}</p>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1">Processed At</p>
                  <p className="font-medium">{selectedPayment.created_at ? format(new Date(selectedPayment.created_at), 'PPP pp') : 'N/A'}</p>
                </div>
              </div>
            </CardContent>
            <div className="flex justify-end p-4 bg-muted/10 border-t mt-2 rounded-b-xl">
              <Button variant="outline" onClick={() => setSelectedPayment(null)}>Close</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
