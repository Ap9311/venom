import React from 'react';
import { Lock, FileText, ChevronLeft, ShieldCheck, AlertTriangle, EyeOff, Scale, Download } from 'lucide-react';
import { MobileBottomBar } from './MobileBottomBar';

interface PoliciesPageProps {
  onBackToHome: () => void;
}

export default function PoliciesPage({ onBackToHome }: PoliciesPageProps) {
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
            <Lock className="w-4 h-4 text-emerald-400" />
            <span className="text-[10px] font-bold tracking-widest text-emerald-400 uppercase">SYSTEM STABILITY DIVISION</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight uppercase leading-none">
            POLICIES, SYSTEM RULES & MODERATION ACTION CODES
          </h1>
          <p className="text-xs text-zinc-500 font-sans leading-relaxed max-w-2xl">
            This document outlines the privacy protocols, system intent, rules of engagement, and the exact escalating disciplinary actions deployed against violations to guarantee database safety.
          </p>
        </div>

        {/* POLICIES BLOCK 1 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* SEC 1: SYSTEM PURPOSE & PRIVACY */}
          <div className="bg-zinc-950 border border-zinc-900 rounded-lg p-5 space-y-4 shadow-xl">
            <h3 className="text-xs font-bold text-emerald-400 border-b border-zinc-900 pb-2 mb-2 uppercase tracking-widest flex items-center gap-2">
              <EyeOff className="w-4 h-4 text-emerald-500/70" />
              <span>1. System Purpose & Privacy</span>
            </h3>
            <p className="text-[11px] text-zinc-400 leading-relaxed font-sans">
              Venom was established to facilitate absolute cryptographic confidence in speech. We believe healthy, robust debates emerge when participants are freed from central registration profiles:
            </p>
            <div className="space-y-3 font-mono text-[10px] text-zinc-400">
              <div className="bg-zinc-900/40 p-2.5 rounded border border-zinc-900">
                <span className="text-zinc-200 font-bold block mb-1">A. NO ACCOUNTS or PASSWORDS</span>
                <p className="font-sans text-[10.5px]">
                  The application does not use accounts or logins. Users are identified solely by a secure cryptographic key pair generated locally in the browser’s storage. No passwords are ever transferred or kept.
                </p>
              </div>
              <div className="bg-zinc-900/40 p-2.5 rounded border border-zinc-900">
                <span className="text-zinc-200 font-bold block mb-1">B. DATA ISOLATION</span>
                <p className="font-sans text-[10.5px]">
                  Casted likes, upvotes, downvotes, and active poll selections are kept safe inside client-side cache stores.
                </p>
              </div>
              <div className="bg-zinc-900/40 p-2.5 rounded border border-zinc-900">
                <span className="text-zinc-200 font-bold block mb-1">C. NETWORK LOGGING</span>
                <p className="font-sans text-[10.5px]">
                  IP signatures and operating agents are recorded upon post creation to safeguard Firestore database write operations from DDoS attacks, malicious bots, or spam-scripts.
                </p>
              </div>
              <div className="bg-zinc-900/40 p-2.5 rounded border border-zinc-900">
                <span className="text-zinc-200 font-bold block mb-1">D. UNILATERAL ACCESS CONTROL</span>
                <p className="font-sans text-[10.5px]">
                  Venom reserves the absolute, unilateral right to suspend, terminate, restrict, or deactivate device access, IP ranges, or cryptographic keys at any time, with or without prior notice, for network preservation, spam prevention, policy enforcement, or at its sole discretion.
                </p>
              </div>
            </div>
          </div>

          {/* SEC 2: SEVERE VIOLATIONS & MODERATION ACTION CODES */}
          <div className="bg-zinc-950 border border-zinc-900 rounded-lg p-5 space-y-4 shadow-xl flex flex-col justify-between">
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-emerald-400 border-b border-zinc-900 pb-2 mb-2 uppercase tracking-widest flex items-center gap-2">
                <Scale className="w-4 h-4 text-emerald-500/70" />
                <span>2. Automated Enforcement Codes</span>
              </h3>
              <p className="text-[11px] text-zinc-400 leading-relaxed font-sans">
                Venom operates a zero-tolerance automatic enforcement grid against dangerous payloads. Here are the exact codes and actions deployed against specific content categories:
              </p>
              
              <div className="space-y-3.5 pt-1 text-[10px] font-mono text-zinc-400">
                <div className="flex gap-2">
                  <span className="text-rose-400 font-bold shrink-0">CODE-ALPHA (TERRORISM):</span>
                  <span>Promoting terrorism, violent extremism, or hate organization activities triggers immediate global post purging and permanent IP-range firewall bans.</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-rose-400 font-bold shrink-0">CODE-BETA (DRUGS):</span>
                  <span>Soliciting or marketing illegal substances, pharmaceuticals, or weapons triggers immediate post-deletion and IP bans.</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-rose-400 font-bold shrink-0">CODE-GAMMA (DOXXING):</span>
                  <span>Exposing real-world private coordinates, phone numbers, or residential data (doxxing) triggers instantaneous deletion and escalates IP bans.</span>
                </div>
              </div>
            </div>

            <div className="p-3 bg-rose-950/15 border border-rose-500/10 rounded text-[10px] text-rose-400 leading-relaxed font-sans">
              <strong>Reporting System Integrity:</strong>
              Any user can submit a report against a Post ID. To maintain decentralization, once a post accumulates 10 reports, it is auto-deleted from public view instantly.
            </div>
          </div>

        </div>

        {/* SEC 3: INTERMEDIARY SAFE HARBOR & DISCLAIMER */}
        <div className="bg-zinc-950 border border-zinc-900 rounded-lg p-6 space-y-4 shadow-xl">
          <h3 className="text-xs font-bold text-emerald-400 border-b border-zinc-900 pb-3 uppercase tracking-widest flex items-center gap-2">
            <Scale className="w-4 h-4 text-emerald-400" />
            <span>3. Legal Safe Harbor & Limitation of Liability</span>
          </h3>
          <div className="space-y-3 text-[11px] text-zinc-400 leading-relaxed font-sans">
            <p>
              <strong>Platform Intermediary Status:</strong> Venom operates strictly as an intermediary platform and technical host under applicable digital services laws. As a decentralized, real-time communication medium without mandatory account creation, the platform does not pre-screen, censor, or actively monitor user-authored transmissions prior to their release.
            </p>
            <p>
              <strong>Absolute Absence of Guarantee:</strong> While Venom employs automated threat intelligence grids, community-driven reporting queues, and administrative firewalls to identify and purge illicit content, we <strong>do not and cannot guarantee</strong> a 100% safe or fully vetted network environment. Users acknowledge that decentralized networks are vulnerable to sporadic, unauthorized transmissions by independent third parties. Just as globally recognized secure messaging protocols (such as Telegram, WhatsApp, or Discord) encounter challenges in regulating decentralized communications, Venom manages these limitations with maximum professional effort but disclaims absolute compliance guarantees.
            </p>
            <p>
              <strong>Indemnification & Safe Use:</strong> By accessing Venom, you agree that all activities, opinions, and files shared are the sole and exclusive responsibility of the originating user signature. Venom, its developers, operators, and affiliates shall be held <strong>completely harmless and indemnified</strong> against any damages, legal actions, or losses arising from illegal or non-compliant actions initiated by third-party actors on this network. Users are strongly urged to exercise sound judgment, act in accordance with local statutes, and actively utilize our built-in Threat Report console to maintain community safety.
            </p>
          </div>
        </div>

        {/* IP QUARANTINE ESCALATION CHART */}
        <div className="bg-zinc-950 border border-zinc-900 rounded-lg p-6 space-y-4 shadow-xl">
          <h3 className="text-xs font-bold text-emerald-400 border-b border-zinc-900 pb-3 uppercase tracking-widest flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-500/70" />
            <span>IP Quarantine Escalation Protocol</span>
          </h3>
          <p className="text-[11px] text-zinc-400 leading-relaxed font-sans">
            To prevent persistent bad actors, report counts are tallied cumulatively across all posts uploaded from a given IP address. 
            If the system counts 50 total security reports accumulated by posts originating from your IP signature, the following escalating bans are automatically triggered:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 font-mono text-[10px]">
            <div className="bg-zinc-900/40 border border-zinc-900 p-3.5 rounded-lg text-center space-y-1">
              <span className="text-emerald-400 font-bold uppercase tracking-wider block">1st Offense</span>
              <span className="text-lg font-black text-zinc-100 block">15 DAYS</span>
              <p className="text-[9px] text-zinc-500 leading-normal font-sans">
                IP signature quarantined. Blocked from creating posts or commenting for 15 days. Reports count refreshes after suspension.
              </p>
            </div>

            <div className="bg-zinc-900/40 border border-zinc-900 p-3.5 rounded-lg text-center space-y-1">
              <span className="text-emerald-400 font-bold uppercase tracking-wider block">2nd Offense</span>
              <span className="text-lg font-black text-zinc-100 block">30 DAYS</span>
              <p className="text-[9px] text-zinc-500 leading-normal font-sans">
                Recidivism detected. IP quarantined for 30 days. All posting functions fully suspended. Refresh on suspension lapse.
              </p>
            </div>

            <div className="bg-rose-950/10 border border-rose-500/20 p-3.5 rounded-lg text-center space-y-1">
              <span className="text-rose-400 font-bold uppercase tracking-wider block">3rd Offense</span>
              <span className="text-lg font-black text-rose-400 block">PERMANENT</span>
              <p className="text-[9px] text-zinc-500 leading-normal font-sans">
                Device IP blacklisted permanently. Access to grid write capabilities terminated. Only administrative review can unlock the signature.
              </p>
            </div>
          </div>
        </div>

        {/* BOTTOM ACTION BAR */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-zinc-950 border border-zinc-900 rounded-lg">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
            <span className="text-[10px] text-zinc-500 uppercase tracking-wider leading-relaxed">
              SECURITY RULES ARE ACTIVATED AND CHECKED AT ALL DATA POINTS AT MODULE RUNTIME.
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
        <p className="uppercase tracking-widest">VENOM NETWORKS © 2026 • PRIVACY PROTOCOL INTENSITY DEPLOYMENT</p>
      </footer>

      <MobileBottomBar currentPath="/policies" />
    </div>
  );
}
