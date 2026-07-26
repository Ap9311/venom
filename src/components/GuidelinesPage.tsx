import React from 'react';
import { ShieldAlert, BookOpen, ChevronLeft, HelpCircle, CheckCircle, Info, Radio, Download } from 'lucide-react';
import { motion } from 'motion/react';
import { MobileBottomBar } from './MobileBottomBar';

interface GuidelinesPageProps {
  onBackToHome: () => void;
}

export default function GuidelinesPage({ onBackToHome }: GuidelinesPageProps) {
  return (
    <div className="min-h-screen bg-[#030303] text-zinc-300 font-mono flex flex-col selection:bg-emerald-500/30 selection:text-emerald-100 relative overflow-hidden">
      {/* Background radial glow overlay */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.02] bg-[radial-gradient(#10b981_1px,transparent_1px)] [background-size:24px_24px] z-0" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-6xl h-[1px] bg-gradient-to-r from-transparent via-emerald-500/20 to-transparent z-10" />

      {/* HEADER */}
      <header className="border-b border-zinc-900 bg-black/60 backdrop-blur-md sticky top-0 z-40 px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div 
            className="flex items-center gap-3 cursor-pointer select-none transition-transform active:scale-95"
            onClick={() => {
              if (onBackToHome) {
                onBackToHome();
              } else {
                window.history.pushState({}, '', '/');
                window.dispatchEvent(new PopStateEvent('popstate'));
              }
            }}
          >
            <img 
              src="https://i.ibb.co/RpqhT7QZ/14893-removebg-preview.png" 
              alt="Venom Logo" 
              className="w-11 h-11 object-contain select-none drop-shadow-[0_0_10px_rgba(16,185,129,0.4)] transition-transform duration-500 hover:scale-110 active:scale-95 cursor-pointer"
              referrerPolicy="no-referrer"
            />
            <div>
              <h1 className="text-lg font-black tracking-widest text-emerald-400 select-none leading-tight">
                VENOM
              </h1>
              <p className="text-[10px] text-zinc-500 font-mono tracking-wider uppercase select-none leading-none mt-0.5">
                By Obsidian
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (onBackToHome) {
                  onBackToHome();
                } else {
                  window.history.pushState({}, '', '/');
                  window.dispatchEvent(new PopStateEvent('popstate'));
                }
              }}
              className="px-3 py-1 bg-zinc-950 hover:bg-zinc-900 border border-zinc-900 text-zinc-400 hover:text-zinc-200 text-[10px] font-bold rounded transition-colors uppercase tracking-wider flex items-center gap-1 cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Feed Home</span>
            </button>
          </div>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8 pb-24 relative z-10 space-y-8">
        
        {/* HERO TITLE */}
        <div className="space-y-2 border-b border-zinc-900 pb-6">
          <div className="flex items-center gap-2 text-emerald-400">
            <Radio className="w-4 h-4 animate-pulse text-emerald-400" />
            <span className="text-[10px] font-bold tracking-widest text-emerald-400 uppercase">OFFICIAL VENOM PROTOCOL</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight uppercase leading-none">
            COMMUNITY GUIDELINES & USING RIGHTS
          </h1>
          <p className="text-xs text-zinc-500 font-sans leading-relaxed max-w-2xl">
            Venom is a zero-friction, cryptographic decentralized social space for sharing unfiltered polls, Q&A sessions, and texts. 
            Anonymity is a powerful tool—and with great power comes the responsibility of preserving a healthy community.
          </p>
        </div>

        {/* GUIDELINES GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* SEC 1: THE CORE DIRECTIVES */}
          <div className="bg-zinc-950 border border-zinc-900 rounded-lg p-5 space-y-4 shadow-xl">
            <h3 className="text-xs font-bold text-emerald-400 border-b border-zinc-900 pb-2 mb-2 uppercase tracking-widest flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-emerald-500/70" />
              <span>1. The Core Directives</span>
            </h3>
            <p className="text-[11px] text-zinc-400 leading-relaxed font-sans">
              To keep the stream productive and secure, all participants must operate under the three universal codes of conduct:
            </p>
            <div className="space-y-4.5 pt-2">
              <div className="space-y-1 bg-zinc-900/20 p-2.5 rounded border border-zinc-900/60">
                <span className="text-[10px] font-bold text-emerald-400 block">I. INTELLECTUAL ENGAGEMENT</span>
                <p className="text-[10px] text-zinc-400 leading-relaxed font-sans">
                  Arguments should target ideas, principles, and statements. Personal attacks, targeted harassment, or toxic behavior will result in severe penalties.
                </p>
              </div>
              <div className="space-y-1 bg-zinc-900/20 p-2.5 rounded border border-zinc-900/60">
                <span className="text-[10px] font-bold text-emerald-400 block">II. AUTHENTIC DISCOURSE</span>
                <p className="text-[10px] text-zinc-400 leading-relaxed font-sans">
                  Do not flood the network with automated requests, malicious code snippets, affiliate spam, or identical copy-paste payloads. Share original and interesting content.
                </p>
              </div>
              <div className="space-y-1 bg-zinc-900/20 p-2.5 rounded border border-zinc-900/60">
                <span className="text-[10px] font-bold text-emerald-400 block">III. ZERO PERSONAL EXPOSURE</span>
                <p className="text-[10px] text-zinc-400 leading-relaxed font-sans">
                  Sharing another person's confidential, private data (doxxing), IP logs, phone numbers, or residential addresses is strictly forbidden and results in immediate automated bans.
                </p>
              </div>
            </div>
          </div>

          {/* SEC 2: USING RIGHTS & FEATURES */}
          <div className="bg-zinc-950 border border-zinc-900 rounded-lg p-5 space-y-4 shadow-xl flex flex-col justify-between">
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-emerald-400 border-b border-zinc-900 pb-2 mb-2 uppercase tracking-widest flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-emerald-500/70" />
                <span>2. Using Rights & Rules</span>
              </h3>
              <p className="text-[11px] text-zinc-400 leading-relaxed font-sans">
                As a user of the Venom network, you hold complete autonomy over your cryptographic presence:
              </p>
              <div className="space-y-3 font-mono text-[10px] text-zinc-400">
                <div className="flex items-start gap-2 bg-zinc-900/10 p-2 border border-zinc-900 rounded">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                  <span><strong>Cryptographic ID Signature:</strong> Every user holds a local browser key pair signature on startup. No passwords, no registers.</span>
                </div>
                <div className="flex items-start gap-2 bg-zinc-900/10 p-2 border border-zinc-900 rounded">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                  <span><strong>Interactive Participation:</strong> Vote on interactive Q&As and Polls, and react with custom emojis to discuss ideas.</span>
                </div>
                <div className="flex items-start gap-2 bg-zinc-900/10 p-2 border border-zinc-900 rounded">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                  <span><strong>Thread Amplification:</strong> Ask questions, add responses, and like or react to content to bubble key conversations up.</span>
                </div>
                <div className="flex items-start gap-2 bg-zinc-900/10 p-2 border border-zinc-900 rounded">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                  <span><strong>Secure Share Links:</strong> Click Share to grab a dynamic, encrypted anchor URL to highlight any post for others.</span>
                </div>
              </div>
            </div>

            <div className="p-3 bg-emerald-950/10 border border-emerald-500/10 rounded text-[10px] text-emerald-400 leading-relaxed">
              <strong>System Enforcement Notice:</strong> Reports are handled peer-to-peer. When a post accumulates 10 reports from unique nodes, the system immediately deletes it permanently.
            </div>
          </div>

        </div>

        {/* DETAILED FAQ / PROTOCOL EXPLANATION */}
        <div className="bg-zinc-950 border border-zinc-900 rounded-lg p-6 space-y-4 shadow-xl">
          <h3 className="text-xs font-bold text-emerald-400 border-b border-zinc-900 pb-3 uppercase tracking-widest flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-emerald-500/70" />
            <span>Interactive Protocol FAQ</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-[11px] leading-relaxed">
            <div className="space-y-1.5">
              <span className="font-bold text-zinc-100 uppercase tracking-tight block">Q: Can administrators see my private identity?</span>
              <p className="text-zinc-400 font-sans">
                No. Venom utilizes client-side hashing signatures. The network logs client metadata (IP address and user-agent string) solely for firewall and DDoS/bot containment rules.
              </p>
            </div>
            
            <div className="space-y-1.5">
              <span className="font-bold text-zinc-100 uppercase tracking-tight block">Q: How can I post an image instead of text?</span>
              <p className="text-zinc-400 font-sans">
                When you click "Create Post" inside the main channel, toggle the post type parameter from "Text" to "Image" or "Poll". You can upload images directly to make interactive card modules!
              </p>
            </div>

            <div className="space-y-1.5">
              <span className="font-bold text-zinc-100 uppercase tracking-tight block">Q: What happens if I abuse the report function?</span>
              <p className="text-zinc-400 font-sans">
                Reports are cryptographically mapped to your local nodes. Spamming fraudulent reports or target-brigading other nodes' posts can trigger auto-suspension systems against your own IP.
              </p>
            </div>

            <div className="space-y-1.5">
              <span className="font-bold text-zinc-100 uppercase tracking-tight block">Q: How do the IP suspension thresholds work?</span>
              <p className="text-zinc-400 font-sans">
                If the posts created by your device gather a combined sum of 50 reports, your IP enters quarantine. Offense level 1 triggers a 15-day ban, offense level 2 triggers 30 days, and offense level 3 is a permanent ban.
              </p>
            </div>
          </div>
        </div>

        {/* BOTTOM ACTION BAR */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-zinc-950 border border-zinc-900 rounded-lg">
          <div className="flex items-center gap-2.5">
            <Info className="w-4 h-4 text-emerald-500 shrink-0" />
            <span className="text-[10px] text-zinc-500 uppercase tracking-wider leading-relaxed">
              BY LAUNCHING THE MAIN INTERFACE, YOU AGREE TO RESPECT AND ENGAGE WITHIN PROTOCOL LAWS.
            </span>
          </div>
          
          <button
            onClick={() => {
              if (onBackToHome) {
                onBackToHome();
              } else {
                window.history.pushState({}, '', '/');
                window.dispatchEvent(new PopStateEvent('popstate'));
              }
            }}
            className="w-full sm:w-auto px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs rounded transition-all cursor-pointer font-sans text-center shrink-0 uppercase tracking-wider"
          >
            Go to Main Feed
          </button>
        </div>

      </main>

      {/* FOOTER */}
      <footer className="border-t border-zinc-900 bg-black/40 py-6 px-4 pb-24 text-center text-[9px] text-zinc-600 font-mono">
        <p className="uppercase tracking-widest">VENOM NETWORKS © 2026 • ANONYMOUS DECENTRALIZED DISCOURSE CORE</p>
      </footer>

      <MobileBottomBar currentPath="/guidelines" />
    </div>
  );
}
