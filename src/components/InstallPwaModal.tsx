/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Download, 
  Monitor, 
  Smartphone, 
  Apple, 
  Chrome, 
  Info, 
  Compass, 
  ChevronRight, 
  ArrowUpFromLine, 
  PlusSquare, 
  CheckCircle2,
  ShieldCheck,
  Zap
} from 'lucide-react';

interface InstallPwaModalProps {
  isOpen: boolean;
  onClose: () => void;
  appType?: 'main' | 'admin';
}

type TabType = 'ios' | 'android' | 'desktop';

export const InstallPwaModal: React.FC<InstallPwaModalProps> = ({ 
  isOpen, 
  onClose, 
  appType = 'main' 
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('android');
  const [isPromptAvailable, setIsPromptAvailable] = useState(false);

  // Disable body scroll when modal is active to prevent background scrolling
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Determine current user platform to set default tab
  useEffect(() => {
    if (!isOpen) return;
    
    const userAgent = window.navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(userAgent)) {
      setActiveTab('ios');
    } else if (/android/.test(userAgent)) {
      setActiveTab('android');
    } else {
      setActiveTab('desktop');
    }

    // Check if native installation prompt is available
    const checkPrompt = () => {
      setIsPromptAvailable(!!(window as any).pwaInstallPrompt);
    };
    checkPrompt();
    
    // Add interval to check in case prompt gets registered later
    const interval = setInterval(checkPrompt, 1000);
    return () => clearInterval(interval);
  }, [isOpen]);

  const handleTriggerNativeInstall = () => {
    const promptEvent = (window as any).pwaInstallPrompt;
    if (promptEvent) {
      promptEvent.prompt();
      promptEvent.userChoice.then((choiceResult: any) => {
        if (choiceResult.outcome === 'accepted') {
          console.log('User accepted the PWA install prompt');
          onClose();
        }
      });
    }
  };

  const isAdmin = appType === 'admin';
  const appName = isAdmin ? 'Venom Admin Console' : 'Venom Feed';
  const appSubtitle = isAdmin ? 'MODERATOR COMMAND CENTER' : 'OFFICIAL SOCIAL HUB';
  const appDescription = isAdmin 
    ? 'Access threat response, user reporting logs, device quarantine controls, and real-time community usage statistics.' 
    : 'Read anonymous feeds, react, comment, cast polls, and stay connected with full desktop and mobile standby notifications.';
  
  const appIcon = isAdmin 
    ? 'https://img.icons8.com/nolan/96/shield.png'
    : 'https://i.ibb.co/RpqhT7QZ/14893-removebg-preview.png';

  const manifestUrl = isAdmin ? '/admin-manifest.json' : '/manifest.json';

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[9999] overflow-y-auto p-4 flex justify-center items-start md:items-center">
          {/* Backdrop Blur */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/80 backdrop-blur-md"
            id="pwa-modal-backdrop"
          />

          {/* Modal Content */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className="w-full max-w-lg bg-zinc-950 border border-zinc-900 rounded-xl overflow-hidden shadow-2xl relative z-10 font-mono text-zinc-300 my-auto"
            id="pwa-modal-container"
          >
            {/* Top Cyan Accent Line */}
            <div className={`h-1.5 w-full bg-gradient-to-r ${isAdmin ? 'from-rose-500 via-purple-500 to-rose-500' : 'from-emerald-500 via-teal-500 to-emerald-500'}`} />

            {/* Header section with closing button */}
            <div className="p-5 border-b border-zinc-900 flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-xl bg-zinc-900 border ${isAdmin ? 'border-rose-500/20' : 'border-emerald-500/20'} flex items-center justify-center shrink-0 p-1 relative overflow-hidden`}>
                  <img 
                    src={appIcon} 
                    alt={appName} 
                    className="w-full h-full object-contain select-none"
                    referrerPolicy="no-referrer"
                  />
                  <div className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-tl bg-zinc-950 border-t border-l ${isAdmin ? 'border-rose-500' : 'border-emerald-500'} flex items-center justify-center`}>
                    <Zap className={`w-2 h-2 ${isAdmin ? 'text-rose-400' : 'text-emerald-400'}`} />
                  </div>
                </div>
                <div>
                  <span className={`text-[8px] uppercase font-black px-1.5 py-0.5 rounded ${isAdmin ? 'bg-rose-950/20 text-rose-400 border border-rose-500/10' : 'bg-emerald-950/20 text-emerald-400 border border-emerald-500/10'}`}>
                    {appSubtitle}
                  </span>
                  <h3 className="text-sm font-black text-zinc-100 uppercase tracking-wider mt-1 flex items-center gap-1.5">
                    {appName}
                  </h3>
                  <p className="text-[10px] text-zinc-500 mt-0.5 leading-tight font-sans">
                    Progressive Web Application (PWA)
                  </p>
                </div>
              </div>

              <button 
                onClick={onClose}
                className="p-1 rounded bg-zinc-900/60 border border-zinc-850 text-zinc-500 hover:text-zinc-200 hover:border-zinc-700 transition-colors cursor-pointer"
                id="close-pwa-modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Main Information */}
            <div className="p-5 space-y-4">
              <p className="text-xs text-zinc-400 leading-relaxed font-sans">
                {appDescription} PWAs install directly onto your device screen as lightweight native apps — launching instantly without URL bars or browser frames.
              </p>

              {/* Native Prompt Available Action */}
              {isPromptAvailable ? (
                <div className={`p-4 rounded-lg bg-zinc-900/40 border ${isAdmin ? 'border-rose-500/20 bg-rose-950/5' : 'border-emerald-500/20 bg-emerald-950/5'} flex flex-col sm:flex-row items-center justify-between gap-4`}>
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className={`w-5 h-5 shrink-0 mt-0.5 ${isAdmin ? 'text-rose-400' : 'text-emerald-400'}`} />
                    <div>
                      <h4 className="text-xs font-bold text-zinc-200 uppercase tracking-wide">Device Ready for Direct Download</h4>
                      <p className="text-[10px] text-zinc-500 font-sans mt-0.5">Your browser supports direct automated installation.</p>
                    </div>
                  </div>
                  <button
                    onClick={handleTriggerNativeInstall}
                    className={`w-full sm:w-auto px-4 py-2 rounded text-[10px] font-black uppercase tracking-wider cursor-pointer flex items-center justify-center gap-1.5 transition-all shrink-0 ${
                      isAdmin 
                        ? 'bg-rose-500 hover:bg-rose-400 text-zinc-950 shadow-lg shadow-rose-950/20' 
                        : 'bg-emerald-500 hover:bg-emerald-400 text-zinc-950 shadow-lg shadow-emerald-950/20'
                    }`}
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download {isAdmin ? 'Admin' : 'App'} Now</span>
                  </button>
                </div>
              ) : (
                <div className="p-3 bg-amber-950/10 border border-amber-500/10 rounded-lg flex items-start gap-2.5 text-amber-500">
                  <Info className="w-4 h-4 shrink-0 mt-0.5" />
                  <p className="text-[10px] leading-normal font-sans">
                    Note: Native installation dialog is restricted in standard iframes. Please follow the quick manual installation instructions below to add {appName} directly to your device.
                  </p>
                </div>
              )}

              {/* Platforms Navigation Tabs */}
              <div className="space-y-3">
                <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest block">
                  Select installation guide platform
                </span>
                
                <div className="grid grid-cols-3 gap-1 bg-zinc-950 p-1 border border-zinc-900 rounded-lg">
                  <button
                    onClick={() => setActiveTab('android')}
                    className={`py-2 px-1.5 text-[9px] font-bold rounded uppercase tracking-wider cursor-pointer transition-all flex items-center justify-center gap-1.5 ${
                      activeTab === 'android' 
                        ? (isAdmin ? 'bg-rose-950/20 border border-rose-500/30 text-rose-400' : 'bg-emerald-950/20 border border-emerald-500/30 text-emerald-400')
                        : 'hover:bg-zinc-900/40 text-zinc-500 hover:text-zinc-300 border border-transparent'
                    }`}
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    <span>Android</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('ios')}
                    className={`py-2 px-1.5 text-[9px] font-bold rounded uppercase tracking-wider cursor-pointer transition-all flex items-center justify-center gap-1.5 ${
                      activeTab === 'ios' 
                        ? (isAdmin ? 'bg-rose-950/20 border border-rose-500/30 text-rose-400' : 'bg-emerald-950/20 border border-emerald-500/30 text-emerald-400')
                        : 'hover:bg-zinc-900/40 text-zinc-500 hover:text-zinc-300 border border-transparent'
                    }`}
                  >
                    <Apple className="w-3.5 h-3.5" />
                    <span>iOS (Apple)</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('desktop')}
                    className={`py-2 px-1.5 text-[9px] font-bold rounded uppercase tracking-wider cursor-pointer transition-all flex items-center justify-center gap-1.5 ${
                      activeTab === 'desktop' 
                        ? (isAdmin ? 'bg-rose-950/20 border border-rose-500/30 text-rose-400' : 'bg-emerald-950/20 border border-emerald-500/30 text-emerald-400')
                        : 'hover:bg-zinc-900/40 text-zinc-500 hover:text-zinc-300 border border-transparent'
                    }`}
                  >
                    <Monitor className="w-3.5 h-3.5" />
                    <span>Desktop</span>
                  </button>
                </div>
              </div>

              {/* Instructions Detail Panel */}
              <div className="bg-zinc-950 border border-zinc-900 rounded-lg p-4 min-h-[140px] flex flex-col justify-center">
                <AnimatePresence mode="wait">
                  {activeTab === 'android' && (
                    <motion.div
                      key="android-instructions"
                      initial={{ opacity: 0, x: -5 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 5 }}
                      className="space-y-3.5"
                    >
                      <div className="flex items-center gap-2 text-[10px] text-zinc-400">
                        <Chrome className="w-4 h-4 text-emerald-500/60" />
                        <span className="font-bold uppercase tracking-wider">Chrome / Android Instructions</span>
                      </div>
                      
                      <ol className="text-[11px] text-zinc-400 space-y-2.5 list-none pl-0 font-sans">
                        <li className="flex gap-2.5 items-start">
                          <span className={`w-4 h-4 rounded-full text-[9px] font-mono font-bold shrink-0 flex items-center justify-center border ${isAdmin ? 'bg-rose-950/20 border-rose-500/20 text-rose-400' : 'bg-emerald-950/20 border-emerald-500/20 text-emerald-400'}`}>1</span>
                          <span>Tap the <strong className="text-zinc-200">Three Dots Menu (⋮)</strong> at the top-right of your Chrome browser address bar.</span>
                        </li>
                        <li className="flex gap-2.5 items-start">
                          <span className={`w-4 h-4 rounded-full text-[9px] font-mono font-bold shrink-0 flex items-center justify-center border ${isAdmin ? 'bg-rose-950/20 border-rose-500/20 text-rose-400' : 'bg-emerald-950/20 border-emerald-500/20 text-emerald-400'}`}>2</span>
                          <span>Select <strong className="text-zinc-200">"Install app"</strong> or <strong className="text-zinc-200">"Add to Home screen"</strong> from the menu options.</span>
                        </li>
                        <li className="flex gap-2.5 items-start">
                          <span className={`w-4 h-4 rounded-full text-[9px] font-mono font-bold shrink-0 flex items-center justify-center border ${isAdmin ? 'bg-rose-950/20 border-rose-500/20 text-rose-400' : 'bg-emerald-950/20 border-emerald-500/20 text-emerald-400'}`}>3</span>
                          <span>Confirm installation. <strong className="text-zinc-200">{appName}</strong> will launch in fullscreen standalone mode on your desktop!</span>
                        </li>
                      </ol>
                    </motion.div>
                  )}

                  {activeTab === 'ios' && (
                    <motion.div
                      key="ios-instructions"
                      initial={{ opacity: 0, x: -5 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 5 }}
                      className="space-y-3.5"
                    >
                      <div className="flex items-center gap-2 text-[10px] text-zinc-400">
                        <Compass className="w-4 h-4 text-emerald-500/60" />
                        <span className="font-bold uppercase tracking-wider">Safari / iOS Apple Instructions</span>
                      </div>

                      <ol className="text-[11px] text-zinc-400 space-y-2.5 list-none pl-0 font-sans">
                        <li className="flex gap-2.5 items-start">
                          <span className={`w-4 h-4 rounded-full text-[9px] font-mono font-bold shrink-0 flex items-center justify-center border ${isAdmin ? 'bg-rose-950/20 border-rose-500/20 text-rose-400' : 'bg-emerald-950/20 border-emerald-500/20 text-emerald-400'}`}>1</span>
                          <span className="flex items-center gap-1.5 flex-wrap">
                            Tap the <strong className="text-zinc-200 flex items-center gap-1 bg-zinc-900 border border-zinc-800 px-1 py-0.5 rounded text-[10px]"><ArrowUpFromLine className="w-3.5 h-3.5" /> Share</strong> icon at the bottom center of Safari.
                          </span>
                        </li>
                        <li className="flex gap-2.5 items-start">
                          <span className={`w-4 h-4 rounded-full text-[9px] font-mono font-bold shrink-0 flex items-center justify-center border ${isAdmin ? 'bg-rose-950/20 border-rose-500/20 text-rose-400' : 'bg-emerald-950/20 border-emerald-500/20 text-emerald-400'}`}>2</span>
                          <span className="flex items-center gap-1.5 flex-wrap">
                            Scroll down the sheet and select <strong className="text-zinc-200 flex items-center gap-1 bg-zinc-900 border border-zinc-800 px-1 py-0.5 rounded text-[10px]"><PlusSquare className="w-3.5 h-3.5" /> Add to Home Screen</strong>.
                          </span>
                        </li>
                        <li className="flex gap-2.5 items-start">
                          <span className={`w-4 h-4 rounded-full text-[9px] font-mono font-bold shrink-0 flex items-center justify-center border ${isAdmin ? 'bg-rose-950/20 border-rose-500/20 text-rose-400' : 'bg-emerald-950/20 border-emerald-500/20 text-emerald-400'}`}>3</span>
                          <span>Tap <strong className="text-zinc-200">Add</strong> in the top-right corner to complete. Enjoy zero-latency loading!</span>
                        </li>
                      </ol>
                    </motion.div>
                  )}

                  {activeTab === 'desktop' && (
                    <motion.div
                      key="desktop-instructions"
                      initial={{ opacity: 0, x: -5 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 5 }}
                      className="space-y-3.5"
                    >
                      <div className="flex items-center gap-2 text-[10px] text-zinc-400">
                        <Monitor className="w-4 h-4 text-emerald-500/60" />
                        <span className="font-bold uppercase tracking-wider">Desktop PC / Mac Instructions</span>
                      </div>

                      <ol className="text-[11px] text-zinc-400 space-y-2.5 list-none pl-0 font-sans">
                        <li className="flex gap-2.5 items-start">
                          <span className={`w-4 h-4 rounded-full text-[9px] font-mono font-bold shrink-0 flex items-center justify-center border ${isAdmin ? 'bg-rose-950/20 border-rose-500/20 text-rose-400' : 'bg-emerald-950/20 border-emerald-500/20 text-emerald-400'}`}>1</span>
                          <span>Look at the right-side of your browser's top address bar. Tap the <strong className="text-zinc-200">"Install / Download"</strong> icon (looks like a screen with an arrow, or overlapping boxes).</span>
                        </li>
                        <li className="flex gap-2.5 items-start">
                          <span className={`w-4 h-4 rounded-full text-[9px] font-mono font-bold shrink-0 flex items-center justify-center border ${isAdmin ? 'bg-rose-950/20 border-rose-500/20 text-rose-400' : 'bg-emerald-950/20 border-emerald-500/20 text-emerald-400'}`}>2</span>
                          <span>Alternatively, click the browser menu (⋮ or ☰) and choose <strong className="text-zinc-200">"Save and share" &rarr; "Install Venom"</strong> or similar.</span>
                        </li>
                        <li className="flex gap-2.5 items-start">
                          <span className={`w-4 h-4 rounded-full text-[9px] font-mono font-bold shrink-0 flex items-center justify-center border ${isAdmin ? 'bg-rose-950/20 border-rose-500/20 text-rose-400' : 'bg-emerald-950/20 border-emerald-500/20 text-emerald-400'}`}>3</span>
                          <span>Confirm. The app launches inside an isolated desktop app window with local security permissions!</span>
                        </li>
                      </ol>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Bottom Panel Actions */}
            <div className="p-4 bg-zinc-950 border-t border-zinc-900 flex flex-col sm:flex-row gap-2.5 sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 font-mono text-[9px] text-zinc-600">
                <ShieldCheck className="w-3.5 h-3.5 text-zinc-600" />
                <span>Verified Local Sandboxing operational</span>
              </div>
              <button
                onClick={onClose}
                className={`w-full sm:w-auto px-4 py-2 border rounded text-[10px] font-black uppercase tracking-wider cursor-pointer text-center transition-colors ${
                  isAdmin 
                    ? 'border-rose-500/20 text-rose-400 hover:bg-rose-950/15 hover:border-rose-500/40' 
                    : 'border-emerald-500/20 text-emerald-400 hover:bg-emerald-950/15 hover:border-emerald-500/40'
                }`}
                id="pwa-dismiss-button"
              >
                Close Console
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
