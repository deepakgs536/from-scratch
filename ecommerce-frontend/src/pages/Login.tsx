import React, { useState, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { loginSuccess, logout } from '@/store/slices/authSlice';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, ArrowRight, MailCheck } from 'lucide-react';
import { signUp, confirmSignUp, signIn, fetchAuthSession, signOut } from 'aws-amplify/auth';

type AuthStep = 'LOGIN' | 'SIGNUP' | 'CONFIRM';

export const Login = () => {
  const [step, setStep] = useState<AuthStep>('LOGIN');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'customer' | 'admin'>('customer');
  const [confirmationCode, setConfirmationCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const dispatch = useDispatch();
  const navigate = useNavigate();

  // Clear any stale local AWS session when mounting the Login page
  useEffect(() => {
    const clearStaleSession = async () => {
      try {
        await signOut();
        dispatch(logout());
      } catch (err) {
        // Safely ignore, the user just didn't have an active session
      }
    };
    clearStaleSession();
  }, [dispatch]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (step === 'SIGNUP') {
        await signUp({
          username: email,
          password,
          options: {
            userAttributes: {
              email,
              name,
              'custom:role': role
            }
          }
        });
        toast.success('Sign up successful! Please check your email for the code.');
        setStep('CONFIRM');
      } else if (step === 'CONFIRM') {
        await confirmSignUp({
          username: email,
          confirmationCode
        });
        // After confirmation call the /users endpoint to create the user in the backend write function in service.ts to handle this
        toast.success('Email confirmed! You can now log in.');
        setStep('LOGIN');
        setConfirmationCode('');
        setPassword('');
      } else if (step === 'LOGIN') {
        await signIn({
          username: email,
          password
        });
        
        const session = await fetchAuthSession();
        const idToken = session.tokens?.idToken?.toString() || '';
        const payload = session.tokens?.idToken?.payload || {};
        
        // Extract role from Cognito Groups (e.g., ['admin'])
        const groups = payload['cognito:groups'] as string[] | undefined;
        const userRole = groups?.includes('admin') ? ('admin' as const) : ('customer' as const);
        const userName = (payload.name as string) || 'User';
        
        const user = {
          id: payload.sub as string,
          name: userName,
          email,
          role: userRole
        };

        console.log('User logged in:', user, 'ID Token:', idToken, 'Role:', userRole);

        dispatch(loginSuccess({ user, token: idToken }));
        toast.success('Welcome back!');
        
        if (userRole === 'admin') {
          navigate('/admin/products');
        } else {
          navigate('/');
        }
      }
    } catch (error: any) {
      toast.error(error.message || 'An error occurred during authentication');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const isLogin = step === 'LOGIN';

  return (
    <div className="flex h-[calc(100vh-64px)] w-full overflow-hidden bg-[#FAFAFA]">
      <div className={`flex w-full h-full flex-col lg:flex-row ${step === 'SIGNUP' || step === 'CONFIRM' ? 'lg:flex-row-reverse' : ''}`}>
        
        {/* Aesthetic Image Panel */}
        <motion.div 
          layout
          transition={{ type: "spring", stiffness: 90, damping: 20 }}
          className="hidden lg:block lg:w-1/2 relative h-full p-4"
        >
          <div className="relative w-full h-full rounded-[2rem] overflow-hidden shadow-2xl bg-slate-900">
            <AnimatePresence initial={false}>
              {isLogin ? (
                <motion.img 
                  key="login-img"
                  src="https://images.unsplash.com/photo-1493666438817-866a91353ca9?q=80&w=1200&auto=format&fit=crop" 
                  alt="Login Aesthetic"
                  initial={{ opacity: 0, scale: 1.05 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.5 }}
                  className="absolute inset-0 w-full h-full object-cover"
                />
              ) : (
                <motion.img 
                  key="signup-img"
                  src="https://images.unsplash.com/photo-1507089947368-19c1da9775ae?q=80&w=1200&auto=format&fit=crop" 
                  alt="Signup Aesthetic"
                  initial={{ opacity: 0, scale: 1.05 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.5 }}
                  className="absolute inset-0 w-full h-full object-cover"
                />
              )}
            </AnimatePresence>
            
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-slate-900/20 to-transparent" />
            
            <motion.div 
              layout 
              className="absolute bottom-12 left-12 right-12 text-white"
            >
              <div className="inline-flex items-center rounded-full bg-white/20 backdrop-blur-md px-4 py-1.5 text-sm font-semibold mb-6 shadow-sm border border-white/10">
                <Sparkles className="mr-2 h-4 w-4 text-amber-300" />
                {isLogin ? "Welcome back" : "Join the ecosystem"}
              </div>
              <h2 className="text-4xl lg:text-5xl font-black tracking-tight mb-4 leading-[1.1]">
                {isLogin ? "Curated essentials for modern living." : "Elevate your everyday experience."}
              </h2>
              <p className="text-slate-200 font-medium text-lg max-w-md">
                {isLogin 
                  ? "Access your exclusive collections, faster checkout, and personalized recommendations."
                  : "Create an account to track orders, save favorites, and unlock member-only benefits."
                }
              </p>
            </motion.div>
          </div>
        </motion.div>

        {/* Form Panel */}
        <motion.div 
          layout
          transition={{ type: "spring", stiffness: 90, damping: 20 }}
          className="w-full lg:w-1/2 h-full flex flex-col justify-center overflow-y-auto px-6 py-12 lg:px-24 scrollbar-hide"
        >
          <div className="w-full max-w-md mx-auto">
            
            <motion.div layout="position" className="text-center lg:text-left mb-5">
              <h1 className="text-4xl font-black tracking-tight text-slate-900 mb-3">
                {step === 'LOGIN' && 'Sign In'}
                {step === 'SIGNUP' && 'Create Account'}
                {step === 'CONFIRM' && 'Verify Email'}
              </h1>
              <p className="text-slate-500 font-medium text-lg">
                {step === 'LOGIN' && 'Enter your details to access your account.'}
                {step === 'SIGNUP' && 'Join us to get started with your journey.'}
                {step === 'CONFIRM' && 'Enter the 6-digit code sent to your email.'}
              </p>
            </motion.div>

            <form onSubmit={handleAuth} className="space-y-5">
              <AnimatePresence mode="popLayout">
                {step === 'SIGNUP' && (
                  <motion.div
                    key="name-field"
                    initial={{ opacity: 0, height: 0, y: -20 }}
                    animate={{ opacity: 1, height: 'auto', y: 0 }}
                    exit={{ opacity: 0, height: 0, y: -20 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-2 overflow-hidden"
                  >
                    <label htmlFor="name" className="text-sm font-bold text-slate-700">Full Name</label>
                    <Input
                      id="name"
                      type="text"
                      placeholder="John Doe"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="h-12 lg:h-14 bg-white border-slate-200 rounded-xl px-4 focus-visible:ring-slate-300"
                      required
                    />
                  </motion.div>
                )}

                {(step === 'LOGIN' || step === 'SIGNUP' || step === 'CONFIRM') && (
                  <motion.div layout="position" key="email-field" className="space-y-2">
                    <label htmlFor="email" className="text-sm font-bold text-slate-700">Email Address</label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="hello@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="h-12 lg:h-14 bg-white border-slate-200 rounded-xl px-4 focus-visible:ring-slate-300"
                      required
                      disabled={step === 'CONFIRM'}
                    />
                  </motion.div>
                )}

                {step === 'SIGNUP' && (
                  <motion.div
                    key="role-field"
                    initial={{ opacity: 0, height: 0, y: -20 }}
                    animate={{ opacity: 1, height: 'auto', y: 0 }}
                    exit={{ opacity: 0, height: 0, y: -20 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-2 overflow-hidden"
                  >
                    <label className="text-sm font-bold text-slate-700">Account Type</label>
                    <div className="flex bg-slate-100 p-1 rounded-xl">
                      <button
                        type="button"
                        onClick={() => setRole('customer')}
                        className={`flex-1 py-3 text-sm font-bold rounded-lg transition-all ${role === 'customer' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                      >
                        Customer
                      </button>
                      <button
                        type="button"
                        onClick={() => setRole('admin')}
                        className={`flex-1 py-3 text-sm font-bold rounded-lg transition-all ${role === 'admin' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                      >
                        Admin
                      </button>
                    </div>
                  </motion.div>
                )}
                
                {(step === 'LOGIN' || step === 'SIGNUP') && (
                  <motion.div layout="position" key="password-field" className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label htmlFor="password" className="text-sm font-bold text-slate-700">Password</label>
                      {step === 'LOGIN' && <a href="#" className="text-sm font-semibold text-slate-500 hover:text-slate-900 transition-colors">Forgot password?</a>}
                    </div>
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="h-12 lg:h-14 bg-white border-slate-200 rounded-xl px-4 focus-visible:ring-slate-300"
                      required
                    />
                  </motion.div>
                )}

                {step === 'CONFIRM' && (
                  <motion.div
                    key="confirm-field"
                    initial={{ opacity: 0, height: 0, y: -20 }}
                    animate={{ opacity: 1, height: 'auto', y: 0 }}
                    exit={{ opacity: 0, height: 0, y: -20 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-2 overflow-hidden"
                  >
                    <label htmlFor="code" className="text-sm font-bold text-slate-700 flex items-center gap-2">
                      <MailCheck className="w-4 h-4 text-slate-400" /> Verification Code
                    </label>
                    <Input
                      id="code"
                      type="text"
                      placeholder="123456"
                      value={confirmationCode}
                      onChange={(e) => setConfirmationCode(e.target.value)}
                      className="h-12 lg:h-14 bg-white border-slate-200 rounded-xl px-4 focus-visible:ring-slate-300 text-center tracking-widest text-lg font-mono"
                      required
                      maxLength={6}
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              <motion.div layout="position" className="pt-2">
                <Button type="submit" disabled={isLoading} className="w-full h-12 lg:h-14 rounded-xl text-base font-bold shadow-lg shadow-slate-200 hover:-translate-y-0.5 transition-transform group">
                  {isLoading ? 'Processing...' : (
                    step === 'LOGIN' ? 'Sign In' : 
                    step === 'SIGNUP' ? 'Create Account' : 
                    'Confirm Email'
                  )}
                  {!isLoading && <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />}
                </Button>
              </motion.div>
            </form>

            <motion.div layout="position">
              <p className="text-center text-slate-500 font-medium mt-8">
                {step === 'LOGIN' ? "Don't have an account? " : step === 'SIGNUP' ? "Already have an account? " : "Need to change email? "}
                <button 
                  type="button"
                  onClick={() => setStep(step === 'LOGIN' ? 'SIGNUP' : 'LOGIN')}
                  className="text-slate-900 font-bold hover:underline transition-all focus:outline-none"
                >
                  {step === 'LOGIN' ? 'Sign up' : 'Log in'}
                </button>
              </p>
            </motion.div>

          </div>
        </motion.div>
      </div>
    </div>
  );
};
