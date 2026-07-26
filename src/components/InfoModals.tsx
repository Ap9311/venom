/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion } from 'motion/react';
import { X, ShieldAlert, Lock, BookOpen, AlertCircle, FileText, CheckCircle } from 'lucide-react';

interface InfoModalsProps {
  type: 'guidelines' | 'policies' | 'tips' | null;
  onClose: () => void;
}

export default function InfoModals({ type, onClose }: InfoModalsProps) {
  // Disable body scroll when modal is active to prevent background scrolling
  React.useEffect(() => {
    if (type) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [type]);

  if (!type) return null;

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 overflow-y-auto p-4 flex justify-center items-start md:items-center">
      {/* Click outside backdrop overlay */}
      <div className="fixed inset-0" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ duration: 0.2 }}
        className="bg-zinc-950 border border-zinc-900 rounded-xl max-w-lg w-full text-zinc-300 shadow-2xl p-6 font-sans relative z-10 my-auto"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-zinc-500 hover:text-zinc-200 rounded transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* GUIDELINES VIEW */}
        {type === 'guidelines' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2.5 text-emerald-400 border-b border-zinc-900 pb-3">
              <ShieldAlert className="w-5 h-5 text-emerald-400" />
              <h2 className="text-sm font-bold uppercase tracking-widest font-mono">VENOM COMMUNITY GUIDELINES</h2>
            </div>
            <div className="space-y-3.5 text-xs text-zinc-400 leading-relaxed font-sans">
              <p>
                Venom operates as a professional, clean social environment where transparency is matched with absolute cryptographic confidence. Adhering to guidelines ensures the flow remains constructive:
              </p>
              <div className="space-y-3 font-mono text-[11px] text-zinc-300 bg-zinc-900/40 p-3 rounded border border-zinc-900">
                <div className="flex gap-2">
                  <span className="text-emerald-400 font-bold">1. RESPECT DEBATE:</span>
                  <span>Keep disagreements intellectual and evidence-focused. Disrespect or bad behavior is prohibited.</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-emerald-400 font-bold">2. AUTHENTIC CONTENT:</span>
                  <span>Do not upload malicious, spammy, or duplicate items. Post unique, valuable polls and Q&As.</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-emerald-400 font-bold">3. NO LEAKS OR HARASSMENT:</span>
                  <span>Do not share confidential personal details (doxxing). Target ideas, not people.</span>
                </div>
              </div>
              <p className="text-[10px] text-zinc-500 italic">
                Violators of these rules are subject to immediate and permanent IP suspensions at the discretion of the moderator.
              </p>
            </div>
          </div>
        )}

        {/* POLICIES VIEW */}
        {type === 'policies' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2.5 text-emerald-400 border-b border-zinc-900 pb-3">
              <Lock className="w-5 h-5 text-emerald-400" />
              <h2 className="text-sm font-bold uppercase tracking-widest font-mono">SYSTEM PRIVACY & COOKIE POLICIES</h2>
            </div>
            <div className="space-y-3.5 text-xs text-zinc-400 leading-relaxed font-sans">
              <p>
                Our server architecture is built for clean anonymity. Read our privacy and storage policy specifications below:
              </p>
              <div className="space-y-3 font-mono text-[11px] text-zinc-300 bg-zinc-900/40 p-3 rounded border border-zinc-900">
                <div className="flex gap-2">
                  <span className="text-emerald-400 font-bold">ZERO PASSWORD STORAGE:</span>
                  <span>Your browser generates an independent key-pair signature on boot. We do not store keys or personal identifiers.</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-emerald-400 font-bold">LOCAL PREFERENCES:</span>
                  <span>Your likes, upvotes/downvotes, and poll choices are safely compartmentalized in your local state.</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-emerald-400 font-bold">CLOUD INTEGRITY:</span>
                  <span>Media objects are optimized via compression, and payloads are stored securely under Firestore protocols.</span>
                </div>
              </div>
              <p className="text-[10px] text-zinc-500 italic">
                By using Venom, your public IP address may be verified securely by local firewalls to protect database integrity against bot abuse.
              </p>
            </div>
          </div>
        )}

        {/* PRO TIPS VIEW */}
        {type === 'tips' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2.5 text-emerald-400 border-b border-zinc-900 pb-3">
              <BookOpen className="w-5 h-5 text-emerald-400" />
              <h2 className="text-sm font-bold uppercase tracking-widest font-mono">PRO TIPS FOR EXTREME USABILITY</h2>
            </div>
            <div className="space-y-3.5 text-xs text-zinc-400 leading-relaxed font-sans">
              <p>
                Master the Venom feed like an expert operative. Here are our top handpicked power-tips:
              </p>
              <div className="space-y-3 font-mono text-[11px] text-zinc-300 bg-zinc-900/40 p-3 rounded border border-zinc-900">
                <div className="flex gap-2">
                  <span className="text-emerald-400 font-bold">POLLS WITH IMAGES:</span>
                  <span>You are not limited to just text polls! You can easily attach an image to Q&As and Polls to let users vote on visual concepts.</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-emerald-400 font-bold">COPY PERMALINK:</span>
                  <span>Clicking the share button copy-pastes a direct cryptographic post anchor link (e.g., #post-ID) right to your clipboard.</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-emerald-400 font-bold">ZERO-LOAD INTERACTION:</span>
                  <span>All upvotes, downvotes, and likes update instantly in the local state for flawless responsiveness.</span>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end pt-3 mt-4 border-t border-zinc-900">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs rounded transition-all cursor-pointer font-sans"
          >
            Acknowledge & Close
          </button>
        </div>
      </motion.div>
    </div>
  );
}
