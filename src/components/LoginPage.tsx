/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { checkIsAdminDevice, getAdminConfig, registerAdminDevice } from '../utils/adminAuth';
import { NxDomainError } from './NxDomainError';
import { Lock, Key, ArrowRight, AlertCircle } from 'lucide-react';

interface LoginPageProps {
  onNavigateAdmin: () => void;
  onBackToHome: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onNavigateAdmin, onBackToHome }) => {
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [isGateLocked, setIsGateLocked] = useState(false);

  // Form inputs
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function evaluateLoginGate() {
      try {
        // 1. Check if this device is already an authorized admin device
        const isAdmin = await checkIsAdminDevice();
        if (isAdmin) {
          if (isMounted) {
            setCheckingAccess(false);
          }
          // Redirect directly to /admin
          onNavigateAdmin();
          return;
        }

        // 2. Fetch admin slot limits
        const config = await getAdminConfig();
        if (isMounted) {
          // If all admin slots are generated and filled, gate is completely locked
          if (config.isFull) {
            setIsGateLocked(true);
          } else {
            setIsGateLocked(false);
          }
          setCheckingAccess(false);
        }
      } catch (err) {
        console.error('Error evaluating login gate:', err);
        if (isMounted) {
          setIsGateLocked(true);
          setCheckingAccess(false);
        }
      }
    }

    evaluateLoginGate();

    return () => {
      isMounted = false;
    };
  }, [onNavigateAdmin]);

  // Handle administrator credentials submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setErrorMsg(null);
    setIsSubmitting(true);

    try {
      const res = await registerAdminDevice(username, password);

      if (res.success) {
        // Successfully authenticated - proceed directly to real /admin
        onNavigateAdmin();
      } else {
        setErrorMsg(res.error || 'Access Denied: Invalid credentials.');
        setIsSubmitting(false);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Authentication rejected.');
      setIsSubmitting(false);
    }
  };

  // 1. While determining device authorization, show clean minimal dark screen
  if (checkingAccess) {
    return (
      <div className="min-h-screen bg-[#202124] flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    );
  }

  // 2. If the maximum admin slots are already filled and visitor is not an admin:
  // Render the authentic browser error page (indistinguishable from a non-existent route)
  if (isGateLocked) {
    return <NxDomainError />;
  }

  // 3. Clean, high-security login form (strictly NO leaked hardware tokens, IMEIs, or admin signatures)
  return (
    <div className="min-h-screen bg-[#030303] text-zinc-300 font-mono flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden selection:bg-emerald-500/30 selection:text-emerald-200">
      
      {/* Background glow and subtle matrix grid */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.02] bg-[radial-gradient(#10b981_1px,transparent_1px)] [background-size:24px_24px] z-0" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[450px] h-[450px] bg-emerald-500/[0.03] rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-sm w-full relative z-10 space-y-6">
        
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 rounded-2xl bg-zinc-900/90 border border-zinc-800 shadow-2xl">
            <Lock className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-lg font-black tracking-widest text-zinc-100 uppercase">
              Administrative Login
            </h1>
            <p className="text-[11px] text-zinc-500 tracking-wider uppercase mt-0.5">
              Secure System Authentication
            </p>
          </div>
        </div>

        {/* Authentication Form */}
        <form onSubmit={handleSubmit} className="bg-zinc-950 border border-zinc-900 rounded-xl p-6 shadow-2xl space-y-4">
          
          {errorMsg && (
            <div className="bg-rose-500/10 border border-rose-500/20 rounded-lg p-3 text-xs text-rose-400 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="space-y-3.5">
            {/* Username Input */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                <Lock className="w-3 h-3 text-emerald-400" />
                Username
              </label>
              <input
                type="text"
                required
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username..."
                className="w-full bg-zinc-900/80 border border-zinc-800 rounded-lg px-3.5 py-2.5 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50 transition-colors"
              />
            </div>

            {/* Password Input */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                <Key className="w-3 h-3 text-emerald-400" />
                Password
              </label>
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password..."
                className="w-full bg-zinc-900/80 border border-zinc-800 rounded-lg px-3.5 py-2.5 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50 transition-colors"
              />
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting || !username.trim() || !password.trim()}
            className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-black text-xs uppercase tracking-wider rounded-lg transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/40 mt-2"
          >
            {isSubmitting ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-zinc-950/20 border-t-zinc-950 rounded-full animate-spin" />
                <span>Authenticating...</span>
              </>
            ) : (
              <>
                <span>Sign In</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </form>

        {/* Back to Home Link */}
        <div className="text-center">
          <button
            type="button"
            onClick={onBackToHome}
            className="text-[11px] text-zinc-500 hover:text-zinc-400 uppercase tracking-wider transition-colors cursor-pointer"
          >
            ← Return to Feed
          </button>
        </div>

      </div>
    </div>
  );
};

export default LoginPage;
