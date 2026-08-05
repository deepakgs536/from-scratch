import { useEffect, useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { PaymentAPI } from '@/api/services';

export const PaymentStatus = () => {
  const { status } = useParams<{ status: string }>();
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get('orderId');

  const [paymentState, setPaymentState] = useState<'processing' | 'success' | 'failed'>(
    status === 'success' ? 'success' : status === 'failed' ? 'failed' : 'processing'
  );

  useEffect(() => {
    if (paymentState === 'processing' && orderId) {
      // Simulate payment processing
      const processPayment = async () => {
        try {
          await new Promise(resolve => setTimeout(resolve, 2000));
          await PaymentAPI.process({ orderId, amount: 0, method: 'mock' }); // amount doesn't matter for mock
          setPaymentState('success');
        } catch (error) {
          setPaymentState('failed');
        }
      };
      processPayment();
    }
  }, [paymentState, orderId]);

  return (
    <div className="container mx-auto py-20 px-4 flex justify-center items-center">
      <Card className="w-full max-w-md text-center premium-shadow">
        <CardHeader>
          <CardTitle className="text-2xl">Payment Status</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-8 space-y-4">
          {paymentState === 'processing' && (
            <>
              <Loader2 className="h-16 w-16 animate-spin text-primary" />
              <h2 className="text-xl font-semibold">Processing Payment...</h2>
              <p className="text-muted-foreground">Please do not close this window.</p>
            </>
          )}

          {paymentState === 'success' && (
            <>
              <CheckCircle2 className="h-16 w-16 text-green-500" />
              <h2 className="text-xl font-semibold">Payment Successful!</h2>
              <p className="text-muted-foreground">Your order {orderId && `#${orderId}`} has been confirmed.</p>
            </>
          )}

          {paymentState === 'failed' && (
            <>
              <XCircle className="h-16 w-16 text-destructive" />
              <h2 className="text-xl font-semibold">Payment Failed</h2>
              <p className="text-muted-foreground">There was an issue processing your payment.</p>
            </>
          )}
        </CardContent>
        <CardFooter className="justify-center">
          {paymentState === 'success' ? (
            <Link to="/orders">
              <Button size="lg">View Orders</Button>
            </Link>
          ) : paymentState === 'failed' ? (
            <Link to="/checkout">
              <Button size="lg" variant="outline">Try Again</Button>
            </Link>
          ) : null}
        </CardFooter>
      </Card>
    </div>
  );
};
