/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { auth, db } from '../../firebase';
import { doc, setDoc } from 'firebase/firestore';
import { AdminDeviceManager } from './AdminDeviceManager';
import { checkIsAdminDevice, ensureFirestoreAdminClaim } from '../../utils/adminAuth';
import { ShieldCheck, Lock, Key, ArrowLeft, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface AdminAuditProps {
  onNavigateHome: () => void;
}

export const AdminAudit: React.FC<AdminAuditProps> = ({ onNavigateHome }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);

  // Check hardware admin identity or session auth on mount
  useEffect(() => {
    let isMounted = true;
    const checkAuth = async () => {
      const isAdminDevice = await checkIsAdminDevice();
      if (!isMounted) return;
      if (isAdminDevice) {
        setIsAuthenticated(true);
        sessionStorage.setItem('venom_admin_auth', 'true');
        ensureFirestoreAdminClaim().catch(console.warn);
      } else {
        setIsAuthenticated(false);
        sessionStorage.removeItem('venom_admin_auth');
        localStorage.removeItem('venom_is_admin_device');
      }
    };
    checkAuth();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);

    try {
      const res = await fetch('/api/admin-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();

      if (data.success && data.token && auth.currentUser) {
        const adminRef = doc(db, 'admins', auth.currentUser.uid);
        await setDoc(adminRef, {
          isAdmin: true,
          secretKey: data.token,
          registeredAt: new Date().toISOString()
        });

        setIsAuthenticated(true);
        sessionStorage.setItem('venom_admin_auth', 'true');
        sessionStorage.setItem('venom_admin_token', data.token);
        localStorage.setItem('venom_is_admin_device', 'true');
        setUsername('');
        setPassword('');
      } else {
        setLoginError(data.error || 'Invalid Administrator credentials.');
      }
    } catch (err) {
      setLoginError('Authentication server error.');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    sessionStorage.removeItem('venom_admin_auth');
  };

  const handleNavigateAdmin = () => {
    window.history.pushState({}, '', '/admin');
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  const handleNavigateCommunities = () => {
    window.history.pushState({}, '', '/admin/communities');
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  return (
    <div className="min-h-screen bg-[#030303] text-zinc-300 font-mono flex flex-col selection:bg-emerald-500/30 selection:text-emerald-100">
      
      {/* GLOWING HEADER BACKGROUND */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-5xl h-[1px] bg-gradient-to-r from-transparent via-emerald-500/20 to-transparent z-10" />

      {/* ADMIN TITLE / CONSOLE STATUS BAR */}
      <header className="border-b border-zinc-900 bg-black/60 backdrop-blur-md sticky top-0 z-40 px-4 py-3">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div 
            className="flex items-center gap-3 cursor-pointer select-none transition-transform active:scale-95"
            onClick={handleNavigateAdmin}
          >
            <img 
              src="https://i.ibb.co/RpqhT7QZ/14893-removebg-preview.png" 
              alt="Venom Logo" 
              className="w-11 h-11 object-contain select-none drop-shadow-[0_0_10px_rgba(16,185,129,0.4)] transition-transform duration-500 hover:scale-110 active:scale-95 cursor-pointer"
              referrerPolicy="no-referrer"
            />
            <div>
              <h1 className="text-lg font-black tracking-widest text-emerald-400 select-none leading-tight flex items-center gap-2">
                VENOM <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">AUDIT</span>
              </h1>
              <p className="text-[10px] text-zinc-500 font-mono tracking-wider uppercase select-none leading-none mt-0.5">
                Admin Identity & Gate Security Terminal
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap justify-center">
            <button
              onClick={handleNavigateAdmin}
              className="px-3 py-1 bg-emerald-950/20 hover:bg-emerald-950/40 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold rounded transition-colors uppercase tracking-wider cursor-pointer flex items-center gap-1.5"
            >
              <ArrowLeft className="w-3 h-3" />
              <span>Admin Console</span>
            </button>
            <button
              onClick={onNavigateHome}
              className="px-3 py-1 bg-zinc-950 hover:bg-zinc-900 border border-zinc-900 text-zinc-400 hover:text-zinc-200 text-[10px] font-bold rounded transition-colors uppercase tracking-wider cursor-pointer"
            >
              Feed Home
            </button>
            {isAuthenticated && (
              <button
                onClick={handleNavigateCommunities}
                className="px-3 py-1 bg-emerald-950/20 hover:bg-emerald-950/40 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold rounded transition-colors uppercase tracking-wider cursor-pointer"
              >
                Admin Communities
              </button>
            )}
            {isAuthenticated && (
              <button
                onClick={handleLogout}
                className="px-3 py-1 bg-rose-950/15 hover:bg-rose-950/30 border border-rose-500/20 text-rose-400 text-[10px] font-bold rounded transition-colors uppercase tracking-wider cursor-pointer"
              >
                Terminate Clearance
              </button>
            )}
          </div>
        </div>
      </header>

      {/* MAIN VIEWPORT SWITCHER */}
      <AnimatePresence mode="wait">
        {!isAuthenticated ? (
          /* LOGIN PANEL GATEWAY */
          <motion.div 
            key="login"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="flex-1 flex items-center justify-center p-4 min-h-[70vh]"
          >
            <div className="w-full max-w-sm bg-zinc-950 border border-zinc-900 rounded-xl p-6 shadow-2xl relative overflow-hidden">
              <div className="absolute -top-16 -right-16 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />
              
              <div className="flex flex-col items-center justify-center text-center mb-6">
                <div className="w-10 h-10 rounded-full bg-zinc-900 border border-zinc-850 flex items-center justify-center mb-2">
                  <Lock className="w-4 h-4 text-emerald-400" />
                </div>
                <h2 className="text-xs font-black tracking-widest text-zinc-100 uppercase">ACCESS DECRYPTION SHELL</h2>
                <p className="text-[9px] text-zinc-500 mt-1 uppercase">Enter cryptographic clearance credentials to connect</p>
              </div>

              <form onSubmit={handleLoginSubmit} className="space-y-4">
                {loginError && (
                  <div className="bg-rose-950/20 border border-rose-500/20 text-rose-400 text-[9px] p-2.5 rounded leading-relaxed border-l-2 border-l-rose-500">
                    [BREACH WARNING]: {loginError}
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-[8px] uppercase text-zinc-500 block font-bold tracking-wider">SYSTEM IDENTITY (ADMIN)</label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    placeholder="Enter security ID..."
                    className="w-full bg-zinc-900 border border-zinc-850 focus:border-emerald-500/30 rounded px-3 py-2 text-xs text-zinc-300 focus:outline-none placeholder-zinc-700 transition-colors"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[8px] uppercase text-zinc-500 block font-bold tracking-wider">CRYPTOGRAPHIC KEY (PASSWORD)</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="Enter passphrase..."
                    className="w-full bg-zinc-900 border border-zinc-850 focus:border-emerald-500/30 rounded px-3 py-2 text-xs text-zinc-300 focus:outline-none placeholder-zinc-700 transition-colors"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-black text-[10px] rounded transition-all uppercase mt-6 cursor-pointer tracking-widest flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-950/20"
                >
                  <Key className="w-3.5 h-3.5" />
                  <span>INITIALIZE CLEARANCE</span>
                </button>
              </form>
            </div>
          </motion.div>
        ) : (
          /* AUTHENTICATED ADMINISTRATOR WORKSPACE - DEDICATED AUDIT & GATE SECURITY */
          <motion.main 
            key="audit-terminal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex-1 max-w-6xl w-full mx-auto px-4 py-6 pb-28 md:pb-12 space-y-6 relative z-10"
          >
            {/* DUAL HARDWARE ADMIN IDENTITY & GATE SECURITY SECTION */}
            <AdminDeviceManager />
          </motion.main>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminAudit;
