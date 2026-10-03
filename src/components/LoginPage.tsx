/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { checkIsAdminDevice, getAdminConfig, registerAdminDevice, getAdminDeviceId } from '../utils/adminAuth';
import { getDeviceImei } from '../utils/ip';
import { NxDomainError } from './NxDomainError';
import { Shield, Lock, Key, AlertCircle, ArrowRight, ShieldCheck, Cpu } from 'lucide-react';

interface LoginPageProps {
  onNavigateAdmin: () => void;
  onBackToHome: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onNavigateAdmin, onBackToHome }) => {
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [isAlreadyAdmin, setIsAlreadyAdmin] = useState(false);
  const [isGateLocked, setIsGateLocked] = useState(false);
  const [slotsRemaining, setSlotsRemaining] = useState(0);
  const [maxSlots, setMaxSlots] = useState(3);
  const [adminCount, setAdminCount] = useState(0);

  // Hardware identities preview
  const [userImei, setUserImei] = useState('');
  const [adminDeviceId, setAdminDeviceId] = useState('');

  // Form inputs
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function evaluateLoginGate() {
      try {
        // 1. Fetch hardware identities
        const [imei, adminId] = await Promise.all([
          getDeviceImei(),
          getAdminDeviceId()
        ]);
        if (isMounted) {
          setUserImei(imei);
          setAdminDeviceId(adminId);
        }

        // 2. Check if this device is already an authorized admin device
        const isAdmin = await checkIsAdminDevice();
        if (isAdmin) {
          if (isMounted) {
            setIsAlreadyAdmin(true);
            setCheckingAccess(false);
          }
          // Redirect directly to /admin
          onNavigateAdmin();
          return;
        }

        // 3. Fetch admin slot limits
        const config = await getAdminConfig();
        if (isMounted) {
          setMaxSlots(config.maxAdmins);
          setAdminCount(config.registeredCount);
          setSlotsRemaining(Math.max(0, config.maxAdmins - config.registeredCount));

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
          // In case of failure to confirm access, lock by default
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
        // Successfully authenticated and generated persistent admin identity
        onNavigateAdmin();
      } else {
        setErrorMsg(res.error || 'Invalid credentials. Access Denied.');
        setIsSubmitting(false);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Authentication error.');
      setIsSubmitting(false);
    }
  };

  // 1. While determining device authorization, show minimal black screen
  if (checkingAccess) {
    return (
      <div className="min-h-screen bg-[#202124] flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    );
  }

  // 2. If the maximum admin IDs (e.g. 3) have already been generated, or user is unauthorized:
  // Render the authentic, indistinguishable NXDOMAIN browser error page!
  if (isGateLocked) {
    return <NxDomainError />;
  }

  // 3. Admin slots are still available (< maxAdmins): Render the Administrative Clearance Login form
  return (
    <div className="min-h-screen bg-[#030303] text-zinc-300 font-mono flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden selection:bg-emerald-500/30 selection:text-emerald-200">
      
      {/* Background glow and aesthetic grid */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.02] bg-[radial-gradient(#10b981_1px,transparent_1px)] [background-size:24px_24px] z-0" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-emerald-500/[0.03] rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-md w-full relative z-10 space-y-6">
        
        {/* Top Header Card */}
        <div className="text-center space-y-3">
          <div className="inline-flex p-3 rounded-2xl bg-zinc-900/80 border border-zinc-800/80 shadow-2xl shadow-emerald-950/20">
            <Shield className="w-8 h-8 text-emerald-400 animate-pulse" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-widest text-zinc-100 uppercase">
              Administrative Clearance
            </h1>
            <p className="text-xs text-zinc-500 tracking-wider uppercase mt-1">
              Cryptographic Device Authorization Gate
            </p>
          </div>
        </div>

        {/* Dual Identity Status Badge */}
        <div className="bg-zinc-950/90 border border-zinc-900 rounded-xl p-4 shadow-xl space-y-3 text-xs">
          <div className="flex items-center justify-between border-b border-zinc-900 pb-2">
            <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Gate Allocation</span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Slot {adminCount + 1} of {maxSlots} Available
            </span>
          </div>

          <div className="space-y-2 text-[11px]">
            <div className="flex items-center justify-between">
              <span className="text-zinc-500 flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-zinc-600" />
                1. User Device Identity:
              </span>
              <span className="text-zinc-300 font-bold tracking-wider">{userImei || '35...'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-500 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                2. Target Admin Signature:
              </span>
              <span className="text-emerald-400 font-bold tracking-wider">{adminDeviceId || 'ADM-...'}</span>
            </div>
          </div>

          <div className="text-[10px] text-zinc-500 leading-relaxed border-t border-zinc-900/80 pt-2">
            Hardware-locked biometric signature. Successful authentication registers this device as 1 of {maxSlots} permanent administrators.
          </div>
        </div>

        {/* Authentication Form */}
        <form onSubmit={handleSubmit} className="bg-zinc-950 border border-zinc-900 rounded-xl p-6 shadow-2xl space-y-5">
          
          {errorMsg && (
            <div className="bg-rose-500/10 border border-rose-500/20 rounded-lg p-3 text-xs text-rose-400 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="space-y-4">
            {/* Username Input */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                <Lock className="w-3 h-3 text-emerald-400" />
                Administrator Username
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
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                <Key className="w-3 h-3 text-emerald-400" />
                Security Password
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
            className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-black text-xs uppercase tracking-wider rounded-lg transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/40"
          >
            {isSubmitting ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-zinc-950/20 border-t-zinc-950 rounded-full animate-spin" />
                <span>Generating Admin Identity...</span>
              </>
            ) : (
              <>
                <span>Authenticate & Register Device</span>
                <ArrowRight className="w-4 h-4" />
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
            ← Return to Network Feed
          </button>
        </div>

      </div>
    </div>
  );
};

export default LoginPage;
