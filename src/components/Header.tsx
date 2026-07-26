/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { 
  Shield, 
  RefreshCw, 
  Menu, 
  HelpCircle, 
  ShieldAlert, 
  BookOpen, 
  Download,
  Home,
  AlertTriangle,
  X,
  MessageSquare
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface HeaderProps {
  onNewPostClick: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  onShowGuidelines: () => void;
  onShowPolicies: () => void;
  onNavigate: (path: string) => void;
}

export default function Header({
  onNewPostClick,
  onRefresh,
  isRefreshing,
  onShowGuidelines,
  onShowPolicies,
  onNavigate,
}: HeaderProps) {
  const [showMenuDropdown, setShowMenuDropdown] = useState(false);

  return (
    <header className="border-b border-zinc-900 bg-zinc-950/90 backdrop-blur-md sticky top-0 z-40 px-4 py-3 sm:px-6">
      <div className="max-w-2xl mx-auto flex items-center justify-between gap-4">
        
        {/* Brand Logo & Title */}
        <div className="flex items-center gap-3">
          <img 
            src="https://i.ibb.co/RpqhT7QZ/14893-removebg-preview.png" 
            alt="Venom Logo" 
            className="w-11 h-11 object-contain select-none drop-shadow-[0_0_10px_rgba(16,185,129,0.4)] transition-transform duration-500 hover:scale-110 active:scale-95 cursor-pointer"
            referrerPolicy="no-referrer"
            onClick={() => onNavigate('/')}
          />
          <div className="cursor-pointer" onClick={() => onNavigate('/')}>
            <h1 className="text-lg font-black tracking-widest font-display text-emerald-400 select-none">
              VENOM
            </h1>
            <p className="text-[10px] text-zinc-500 font-mono tracking-wider uppercase select-none">
              By Obsidian
            </p>
          </div>
        </div>

        {/* Action Controls - Menu beside Refresh, beside Create Post */}
        <div className="flex items-center gap-2">
          
          {/* Refresh Button */}
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="p-2 border border-zinc-850 hover:border-emerald-500/30 rounded bg-zinc-900/40 hover:bg-zinc-950 text-zinc-400 hover:text-emerald-400 disabled:opacity-50 transition-colors cursor-pointer"
            title="Reload Feed"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>

          {/* Create Post Button (Desktop only) */}
          <button
            onClick={onNewPostClick}
            className="hidden md:block px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-sans font-bold tracking-wide rounded transition-all active:scale-95 cursor-pointer whitespace-nowrap"
          >
            + Create Post
          </button>

          {/* Unified Navigation Hub Menu Dropdown */}
          <div className="relative hidden md:block">
            <button
              onClick={() => setShowMenuDropdown(!showMenuDropdown)}
              className="p-2 border border-zinc-850 hover:border-emerald-500/30 rounded bg-zinc-900/40 hover:bg-zinc-950 text-zinc-400 hover:text-emerald-400 transition-colors cursor-pointer flex items-center gap-1.5"
              title="Navigation Hub"
              id="menu-nav-button"
            >
              {showMenuDropdown ? <X className="w-4 h-4 text-rose-400" /> : <Menu className="w-4 h-4" />}
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider">Menu</span>
            </button>
            
            <AnimatePresence>
              {showMenuDropdown && (
                <>
                  {/* Click-outside backdrop */}
                  <div className="fixed inset-0 z-40" onClick={() => setShowMenuDropdown(false)} />
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 5 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 5 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 mt-2 w-64 rounded-xl bg-zinc-950 border border-zinc-900 shadow-2xl p-2 z-50 overflow-hidden"
                  >
                    <div className="px-3 py-2 border-b border-zinc-900/80 mb-1">
                      <span className="text-[9px] font-mono font-bold text-zinc-500 uppercase tracking-widest block">Navigation Hub</span>
                    </div>

                    {[
                      {
                        label: 'Communities',
                        desc: 'De-centralized Group Chatrooms',
                        icon: MessageSquare,
                        color: 'text-emerald-400 bg-emerald-500/5 border border-emerald-500/10',
                        onClick: () => {
                          onNavigate('/communities');
                          setShowMenuDropdown(false);
                        }
                      },
                      {
                        label: 'Guidelines',
                        desc: 'Community Rules & Conduct',
                        icon: BookOpen,
                        color: 'text-emerald-400 bg-emerald-500/5 border border-emerald-500/10',
                        onClick: () => {
                          onNavigate('/guidelines');
                          setShowMenuDropdown(false);
                        }
                      },
                      {
                        label: 'Policies',
                        desc: 'Privacy & Terms of Service',
                        icon: HelpCircle,
                        color: 'text-emerald-400 bg-emerald-500/5 border border-emerald-500/10',
                        onClick: () => {
                          onNavigate('/policies');
                          setShowMenuDropdown(false);
                        }
                      },
                      {
                        label: 'File Report',
                        desc: 'Report Guidelines Violation',
                        icon: AlertTriangle,
                        color: 'text-rose-400 bg-rose-500/5 border border-rose-500/10',
                        onClick: () => {
                          onNavigate('/report');
                          setShowMenuDropdown(false);
                        }
                      },
                      {
                        label: 'Install App',
                        desc: 'Download PWA Desktop/Mobile',
                        icon: Download,
                        color: 'text-sky-400 bg-sky-500/5 border border-sky-500/10',
                        onClick: () => {
                          if ((window as any).triggerPwaInstall) {
                            (window as any).triggerPwaInstall('main');
                          }
                          setShowMenuDropdown(false);
                        }
                      }
                    ].map((item, idx) => (
                      <button
                        key={idx}
                        onClick={item.onClick}
                        className="w-full text-left flex items-start gap-3 p-2.5 rounded-lg hover:bg-zinc-900/50 transition-colors cursor-pointer group"
                      >
                        <div className={`p-1.5 rounded-md ${item.color} group-hover:scale-105 transition-transform shrink-0`}>
                          <item.icon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-bold text-zinc-200 group-hover:text-emerald-400 transition-colors truncate">
                            {item.label}
                          </div>
                          <div className="text-[9px] text-zinc-500 font-mono truncate leading-tight mt-0.5">
                            {item.desc}
                          </div>
                        </div>
                      </button>
                    ))}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>

        </div>
      </div>
    </header>
  );
}
