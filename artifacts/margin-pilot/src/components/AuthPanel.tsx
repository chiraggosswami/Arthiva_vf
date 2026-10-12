import React, { useState } from 'react';
import { useAuth } from '../state/AuthContext';
import { isFirebaseConfigured } from '../lib/firebase';
import { ArthivaLogo } from './ArthivaLogo';
import { X, Lock, Mail, User, Store, ArrowRight, ShieldCheck, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { useLocation } from 'wouter';

interface AuthPanelProps {
  initialTab?: 'signin' | 'register';
  onSuccess?: () => void;
  onClose?: () => void;
  isModal?: boolean;
}

export function AuthPanel({
  initialTab = 'signin',
  onSuccess,
  onClose,
  isModal = true,
}: AuthPanelProps) {
  const { login, loginWithGoogle, loginAsDemo, register, isLoading, requestedRoute, setRequestedRoute } = useAuth();
  const [, setLocation] = useLocation();

  const [tab, setTab] = useState<'signin' | 'register'>(initialTab);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [storeName, setStoreName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setError(null);
    const res = await loginWithGoogle();
    if (!res.success) {
      setError(res.error || 'Google sign-in failed');
      return;
    }

    const destination = requestedRoute || '/dashboard';
    setRequestedRoute(null);
    if (onSuccess) {
      onSuccess();
    }
    setLocation(destination);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email || !email.includes('@')) {
      setError('Please provide a valid email address');
      return;
    }

    if (tab === 'register') {
      if (!name.trim()) {
        setError('Please enter your full name or brand handle');
        return;
      }
      const res = await register(name, email, password, storeName);
      if (!res.success) {
        setError(res.error || 'Registration failed');
        return;
      }
    } else {
      const res = await login(email, password);
      if (!res.success) {
        setError(res.error || 'Sign in failed');
        return;
      }
    }

    // Determine return destination
    const destination = requestedRoute || '/dashboard';
    setRequestedRoute(null);

    if (onSuccess) {
      onSuccess();
    }
    setLocation(destination);
  };

  const content = (
    <div className="bg-white rounded-2xl border border-[#d6e2de] shadow-2xl overflow-hidden max-w-md w-full mx-auto relative flex flex-col max-h-[calc(100dvh-1.5rem)] sm:max-h-[min(92dvh,640px)]">
      {/* Header bar */}
      <div className="shrink-0 bg-gradient-to-br from-[#0a2f36] via-[#0e3b43] to-[#144d57] text-white p-4 sm:p-5 pb-3 sm:pb-4 relative border-b border-white/10">
        {isModal && onClose && (
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3.5 right-3.5 text-white/75 hover:text-white p-1.5 rounded-lg bg-white/5 hover:bg-white/15 backdrop-blur-xs border border-white/10 hover:border-white/25 transition-all duration-150 hover:scale-105 active:scale-95 cursor-pointer shadow-xs"
            aria-label="Close dialog"
          >
            <X size={17} />
          </button>
        )}

        <div className="flex items-center gap-2 mb-1.5">
          <ArthivaLogo size="sm" theme="dark" accentDotColor="#f5a524" />
          <span className="text-[9.5px] font-bold tracking-widest text-[#f5a524] uppercase px-1.5 py-0.5 rounded bg-white/10 border border-white/10">
            SECURE ACCESS
          </span>
        </div>

        <h2 className="text-lg sm:text-xl font-bold font-['Bricolage_Grotesque'] text-white leading-tight">
          {tab === 'signin' ? 'Sign in to Arthiva Operations' : 'Start your Arthiva pilot'}
        </h2>
        <p className="text-[11px] sm:text-xs text-white/80 mt-1 line-clamp-1 sm:line-clamp-none">
          {tab === 'signin'
            ? 'Access your profit-aware dispatch queue and saved workspace.'
            : 'Join leading D2C brands cutting RTO drag and protecting margins.'}
        </p>

        {/* Tab switchers */}
        <div className="flex bg-black/35 backdrop-blur-xs p-1 rounded-xl mt-3 border border-white/10">
          <button
            type="button"
            onClick={() => { setTab('signin'); setError(null); }}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all duration-200 cursor-pointer ${
              tab === 'signin'
                ? 'bg-gradient-to-r from-white via-[#f7faf9] to-[#edf4f1] text-[#0e3b43] shadow-md scale-[1.01]'
                : 'text-white/75 hover:text-white hover:bg-white/10 active:bg-white/15'
            }`}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => { setTab('register'); setError(null); }}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all duration-200 cursor-pointer ${
              tab === 'register'
                ? 'bg-gradient-to-r from-white via-[#f7faf9] to-[#edf4f1] text-[#0e3b43] shadow-md scale-[1.01]'
                : 'text-white/75 hover:text-white hover:bg-white/10 active:bg-white/15'
            }`}
          >
            Register
          </button>
        </div>
      </div>

      {/* Form Body */}
      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3 sm:space-y-3.5 overscroll-contain">
        {error && (
          <div className="p-2.5 sm:p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2 animate-in fade-in">
            <AlertCircle size={15} className="shrink-0 mt-0.5 text-red-600" />
            <span className="break-words leading-tight">{error}</span>
          </div>
        )}

        {/* Google Authentication via Firebase Auth */}
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={isLoading}
          className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-white via-[#fcfdfe] to-[#f4f9f7] hover:from-[#edf7f3] hover:to-[#e4f1eb] text-[#0e3b43] font-bold text-xs sm:text-sm border border-[#cfded8] hover:border-[#1f8a5b] shadow-xs hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50"
        >
          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          <span>Continue with Google</span>
        </button>

        <div className="flex items-center gap-3 my-1">
          <div className="flex-1 h-px bg-[#e1e9e5]" />
          <span className="text-[10px] uppercase font-bold tracking-wider text-[#798e89]">or with email & password</span>
          <div className="flex-1 h-px bg-[#e1e9e5]" />
        </div>

        {tab === 'register' && (
          <>
            <div>
              <label className="block text-[11px] sm:text-xs font-bold text-[#143d41] mb-1">
                Full Name / Brand Lead
              </label>
              <div className="relative">
                <User size={14} className="absolute left-3 top-2.5 text-[#728581]" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Priya Sharma"
                  className="w-full bg-[#f8faf9] border border-[#dce5e1] focus:border-[#0e3b43] focus:bg-white rounded-xl pl-8 sm:pl-9 pr-3 py-1.5 sm:py-2 text-xs text-[#0e3b43] outline-none transition-all placeholder:text-[#9bb0a9]"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] sm:text-xs font-bold text-[#143d41] mb-1">
                Store / Brand Name
              </label>
              <div className="relative">
                <Store size={14} className="absolute left-3 top-2.5 text-[#728581]" />
                <input
                  type="text"
                  value={storeName}
                  onChange={e => setStoreName(e.target.value)}
                  placeholder="e.g. Ojas Botanics"
                  className="w-full bg-[#f8faf9] border border-[#dce5e1] focus:border-[#0e3b43] focus:bg-white rounded-xl pl-8 sm:pl-9 pr-3 py-1.5 sm:py-2 text-xs text-[#0e3b43] outline-none transition-all placeholder:text-[#9bb0a9]"
                />
              </div>
            </div>
          </>
        )}

        <div>
          <label className="block text-[11px] sm:text-xs font-bold text-[#143d41] mb-1">
            Work Email
          </label>
          <div className="relative">
            <Mail size={14} className="absolute left-3 top-2.5 text-[#728581]" />
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="founder@yourbrand.in"
              className="w-full bg-[#f8faf9] border border-[#dce5e1] focus:border-[#0e3b43] focus:bg-white rounded-xl pl-8 sm:pl-9 pr-3 py-1.5 sm:py-2 text-xs text-[#0e3b43] outline-none transition-all placeholder:text-[#9bb0a9]"
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-[11px] sm:text-xs font-bold text-[#143d41]">
              Password
            </label>
            {tab === 'signin' && (
              <span className="text-[10.5px] text-[#718580] cursor-pointer hover:underline">
                Demo access: any password
              </span>
            )}
          </div>
          <div className="relative">
            <Lock size={14} className="absolute left-3 top-2.5 text-[#728581]" />
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full bg-[#f8faf9] border border-[#dce5e1] focus:border-[#0e3b43] focus:bg-white rounded-xl pl-8 sm:pl-9 pr-3 py-1.5 sm:py-2 text-xs text-[#0e3b43] outline-none transition-all placeholder:text-[#9bb0a9]"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-2.5 sm:py-3 px-4 rounded-xl bg-gradient-to-r from-[#0e3b43] via-[#134954] to-[#185e6b] hover:from-[#134954] hover:via-[#195c68] hover:to-[#206f7e] text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none mt-1 group"
        >
          {isLoading ? (
            <>
              <Loader2 size={15} className="animate-spin" />
              <span>Verifying session...</span>
            </>
          ) : (
            <>
              <span>{tab === 'signin' ? 'Sign in to Workspace' : 'Create Pilot Account'}</span>
              <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform" />
            </>
          )}
        </button>

        <div className="pt-2.5 border-t border-[#edf2f0] flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5 text-[10.5px] sm:text-[11px] text-[#697f7a] leading-tight">
            <ShieldCheck size={13} className="text-[#1f8a5b] shrink-0" />
            <span className="truncate">
              {isFirebaseConfigured
                ? 'Firebase Auth session & secure Firestore cloud sync'
                : 'Zero-config local workspace with instant simulation access'}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[10.5px] sm:text-[11px] text-[#697f7a] leading-tight">
            <CheckCircle2 size={13} className="text-[#1f8a5b] shrink-0" />
            <span className="truncate">Automatic workspace sync with multi-seller support</span>
          </div>
        </div>

        {/* Quick demo sign-in helper */}
        <div className="bg-gradient-to-r from-[#f2f7f5] to-[#eaf3ef] p-3 rounded-xl border border-[#d5e5de] text-center space-y-2">
          <div className="flex items-center justify-between text-[11px] font-bold text-[#35524b]">
            <span>Testing or quick access?</span>
            <span className="text-[9.5px] uppercase font-bold px-1.5 py-0.5 rounded bg-[#1f8a5b]/15 text-[#1f8a5b]">Instant</span>
          </div>
          <button
            type="button"
            onClick={() => {
              loginAsDemo('kanishka1work@gmail.com', 'Kanishka Tyagi', 'Arthiva Store');
              const dest = requestedRoute || '/dashboard';
              setRequestedRoute(null);
              if (onSuccess) onSuccess();
              setLocation(dest);
            }}
            className="w-full text-xs font-bold text-white bg-gradient-to-r from-[#0e3b43] to-[#16505c] hover:from-[#134954] hover:to-[#1c6473] py-2 px-3 rounded-lg shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <span>One-Click Sign In as Operator</span>
            <ArrowRight size={13} />
          </button>
          <div className="flex items-center justify-center gap-2 pt-0.5">
            <button
              type="button"
              onClick={() => {
                setEmail('operations@ojasbotanics.in');
                setPassword('demo123');
                if (tab === 'register') {
                  setName('Priya Sharma');
                  setStoreName('Ojas Botanics');
                }
              }}
              className="text-[11px] font-semibold text-[#1f8a5b] hover:underline cursor-pointer"
            >
              Prefill with Ojas Botanics Lead
            </button>
          </div>
        </div>
      </form>
    </div>
  );

  if (isModal) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200 overflow-y-auto">
        <div className="relative w-full max-w-md my-auto max-h-[calc(100dvh-1rem)] sm:max-h-[calc(100dvh-2rem)] flex flex-col animate-in zoom-in-95 duration-200">
          {content}
        </div>
      </div>
    );
  }

  return content;
}
