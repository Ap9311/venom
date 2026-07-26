/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  BookOpen, 
  HelpCircle, 
  Plus, 
  Flag, 
  AlertTriangle,
  Home,
  MessageSquare
} from 'lucide-react';
import { motion } from 'motion/react';

interface MobileBottomBarProps {
  currentPath?: string;
}

export const MobileBottomBar: React.FC<MobileBottomBarProps> = ({ 
  currentPath: propPath 
}) => {
  const [currentPath, setCurrentPath] = useState(propPath || window.location.pathname);

  // Synchronize path changes
  useEffect(() => {
    if (propPath) {
      setCurrentPath(propPath);
      return;
    }

    const handleLocationChange = () => {
      setCurrentPath(window.location.pathname);
    };

    window.addEventListener('popstate', handleLocationChange);
    // Poll occasionally to catch internal navigation events
    const interval = setInterval(handleLocationChange, 200);

    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      clearInterval(interval);
    };
  }, [propPath]);

  const handleNavigate = (path: string) => {
    if (window.location.pathname === path) return;
    window.history.pushState({}, '', path);
    window.dispatchEvent(new Event('popstate'));
  };

  const handleCreateClick = () => {
    if (window.location.pathname !== '/') {
      window.history.pushState({}, '', '/');
      window.dispatchEvent(new Event('popstate'));
      // Wait a short moment for home screen to mount, then open new post modal
      setTimeout(() => {
        if ((window as any).triggerNewPost) {
          (window as any).triggerNewPost();
        }
      }, 150);
    } else {
      if ((window as any).triggerNewPost) {
        (window as any).triggerNewPost();
      }
    }
  };

  const handleInstallClick = () => {
    if ((window as any).triggerPwaInstall) {
      (window as any).triggerPwaInstall('main');
    }
  };

  // Helper to check active state
  const isTabActive = (path: string) => currentPath === path;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-zinc-950/90 backdrop-blur-md border-t border-zinc-900/80 px-4 h-16 flex items-center justify-between safe-bottom shadow-[0_-8px_24px_rgba(0,0,0,0.6)]">
      
      {/* 1. Policies Tab (Replaced Rules with Policy) */}
      <button
        onClick={() => handleNavigate('/policies')}
        className="flex flex-col items-center justify-center flex-1 h-full relative cursor-pointer group"
        id="nav-policies"
      >
        <div className="flex flex-col items-center justify-center transition-transform duration-200 active:scale-90">
          <HelpCircle 
            className={`w-5 h-5 transition-colors duration-250 ${
              isTabActive('/policies') 
                ? 'text-emerald-400' 
                : 'text-zinc-500 group-hover:text-zinc-300'
            }`} 
          />
          <span className={`text-[8px] font-mono font-black mt-1 uppercase tracking-wider transition-colors duration-250 ${
            isTabActive('/policies') 
              ? 'text-emerald-400' 
              : 'text-zinc-600 group-hover:text-zinc-400'
          }`}>
            Policy
          </span>
        </div>
      </button>

      {/* 2. Community Chat Tab (Replaced Policy with Community Chat) */}
      <button
        onClick={() => handleNavigate('/communities')}
        className="flex flex-col items-center justify-center flex-1 h-full relative cursor-pointer group"
        id="nav-communities"
      >
        <div className="flex flex-col items-center justify-center transition-transform duration-200 active:scale-90">
          <MessageSquare 
            className={`w-5 h-5 transition-colors duration-250 ${
              isTabActive('/communities') 
                ? 'text-emerald-400' 
                : 'text-zinc-500 group-hover:text-zinc-300'
            }`} 
          />
          <span className={`text-[8px] font-mono font-black mt-1 uppercase tracking-wider transition-colors duration-250 ${
            isTabActive('/communities') 
              ? 'text-emerald-400' 
              : 'text-zinc-600 group-hover:text-zinc-400'
          }`}>
            Community
          </span>
        </div>
      </button>

      {/* 3. Center Create Post Button (Elevated Instagram-Style) */}
      <div className="flex-1 flex justify-center items-center h-full relative">
        <button
          onClick={handleCreateClick}
          className="w-11 h-11 rounded-full bg-emerald-500 hover:bg-emerald-400 text-zinc-950 flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.4)] hover:shadow-[0_0_20px_rgba(16,185,129,0.6)] active:scale-95 transition-all duration-200 cursor-pointer border-2 border-zinc-950 -translate-y-2 relative z-10"
          id="nav-create-post"
          title="Create Cryptographic Dispatch"
        >
          <Plus className="w-6 h-6 stroke-[3px]" />
        </button>
        {/* Subtle center ring aura */}
        <div className="absolute w-12 h-12 rounded-full border border-emerald-500/10 pointer-events-none -translate-y-2 animate-pulse" />
      </div>

      {/* 4. Home Tab */}
      <button
        onClick={() => handleNavigate('/')}
        className="flex flex-col items-center justify-center flex-1 h-full relative cursor-pointer group"
        id="nav-home"
      >
        <div className="flex flex-col items-center justify-center transition-transform duration-200 active:scale-90">
          <Home 
            className={`w-5 h-5 transition-colors duration-250 ${
              isTabActive('/') 
                ? 'text-emerald-400' 
                : 'text-zinc-500 group-hover:text-zinc-300'
            }`} 
          />
          <span className={`text-[8px] font-mono font-black mt-1 uppercase tracking-wider transition-colors duration-250 ${
            isTabActive('/') 
              ? 'text-emerald-400' 
              : 'text-zinc-600 group-hover:text-zinc-400'
          }`}>
            Home
          </span>
        </div>
      </button>

      {/* 5. Report Tab */}
      <button
        onClick={() => handleNavigate('/report')}
        className="flex flex-col items-center justify-center flex-1 h-full relative cursor-pointer group"
        id="nav-report"
      >
        <div className="flex flex-col items-center justify-center transition-transform duration-200 active:scale-90">
          <AlertTriangle 
            className={`w-5 h-5 transition-colors duration-250 ${
              isTabActive('/report') 
                ? 'text-rose-400' 
                : 'text-zinc-500 group-hover:text-zinc-300'
            }`} 
          />
          <span className={`text-[8px] font-mono font-black mt-1 uppercase tracking-wider transition-colors duration-250 ${
            isTabActive('/report') 
              ? 'text-rose-400' 
              : 'text-zinc-600 group-hover:text-zinc-400'
          }`}>
            Report
          </span>
        </div>
      </button>

    </div>
  );
};
