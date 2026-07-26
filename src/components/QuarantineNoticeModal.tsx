/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { X, AlertTriangle, Clock, Ban } from 'lucide-react';
import { motion } from 'motion/react';
import { BlockStatus } from '../utils/blockChecker';

interface QuarantineNoticeModalProps {
  blockStatus: BlockStatus;
  userIp: string;
  onClose: () => void;
}

export default function QuarantineNoticeModal({ blockStatus, userIp, onClose }: QuarantineNoticeModalProps) {
  // Disable body scroll when modal is active to prevent background scrolling
  React.useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto p-3 flex justify-center items-start md:items-center">
      {/* Backdrop */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/90 backdrop-blur-sm"
      />

      {/* Modal Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="relative w-full max-w-sm bg-zinc-950 border border-rose-500/40 rounded-xl shadow-2xl z-10 p-4 space-y-3.5 text-zinc-300 font-mono my-auto scrollbar-thin scrollbar-thumb-zinc-800"
      >
        <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-rose-500 via-amber-500 to-rose-500" />
        
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-rose-950/20 border border-rose-500/35 flex items-center justify-center text-rose-400 shrink-0">
              <Ban className="w-3.5 h-3.5 animate-pulse" />
            </div>
            <div>
              <h2 className="text-[10px] font-black tracking-widest text-zinc-100 uppercase leading-none">
                QUARANTINE NOTICE
              </h2>
              <p className="text-[7.5px] text-zinc-500 uppercase tracking-wider mt-0.5 font-sans">
                Write clearance suspended
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1 hover:bg-zinc-900 border border-transparent hover:border-zinc-800 rounded text-zinc-500 hover:text-zinc-300 transition-all cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Concise Warning Banner */}
        <div className="bg-rose-950/10 border border-rose-500/10 p-2.5 rounded-lg space-y-0.5 text-xs">
          <span className="font-bold text-rose-400 flex items-center gap-1 uppercase tracking-wide text-[9px]">
            <AlertTriangle className="w-3 h-3 text-rose-400" />
            READ-ONLY PRIVILEGES ONLY
          </span>
          <p className="font-sans text-zinc-400 text-[10px] leading-relaxed">
            Your IP signature has been isolated from network writes due to content complaints. Posting, commenting, and reporting features are deactivated.
          </p>
        </div>

        {/* Threat metadata list */}
        <div className="bg-zinc-900/30 border border-zinc-900 rounded-lg p-2.5 space-y-1 text-[9px] leading-relaxed">
          <div className="flex justify-between border-b border-zinc-900/40 pb-0.5">
            <span className="text-zinc-500 uppercase">Suspended IP:</span>
            <span className="text-zinc-300 font-bold font-mono">{userIp || '127.0.0.1'}</span>
          </div>
          <div className="flex justify-between border-b border-zinc-900/40 pb-0.5">
            <span className="text-zinc-500 uppercase">Violation Tier:</span>
            <span className="text-rose-400 font-bold">Level {blockStatus.blockCount || 1}</span>
          </div>
          <div className="flex justify-between border-b border-zinc-900/40 pb-0.5">
            <span className="text-zinc-500 uppercase">Expiry Status:</span>
            <span className="text-amber-400 font-bold tracking-wider">{blockStatus.timeLeftLabel || 'Permanent Ban'}</span>
          </div>
          <div className="pt-0.5 text-[9px]">
            <span className="text-zinc-500 uppercase font-bold block">REASON SPECIFIED:</span>
            <span className="text-zinc-400 italic font-sans block mt-0.5 text-[9.5px]">
              "{blockStatus.reason || 'Multiple user complaints flagged on posted content.'}"
            </span>
          </div>
        </div>

        {/* Triggering Post Preview */}
        {blockStatus.triggerPostId && (
          <div className="space-y-1 border border-rose-500/15 bg-rose-950/5 rounded-lg p-2.5 text-[9px]">
            <span className="text-[7.5px] uppercase text-rose-400 font-bold tracking-wider block">
              TRIGGERING INCIDENT PREVIEW
            </span>
            <div className="space-y-0.5 font-sans">
              {blockStatus.triggerPostTitle && (
                <div className="text-zinc-200 font-bold uppercase tracking-tight text-[9.5px] font-mono">
                  {blockStatus.triggerPostTitle}
                </div>
              )}
              {blockStatus.triggerPostContent && (
                <p className="text-zinc-400 italic leading-relaxed text-[9.5px]">
                  "{blockStatus.triggerPostContent}"
                </p>
              )}
              {blockStatus.triggerPostImageUrl && (
                <div className="relative aspect-video w-full max-h-16 overflow-hidden rounded border border-zinc-900 bg-zinc-950 flex items-center justify-center my-1">
                  <img 
                    src={blockStatus.triggerPostImageUrl} 
                    alt="Triggering Content Payload" 
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
            </div>
            {blockStatus.reportReason && (
              <div className="pt-1 border-t border-zinc-900/40 text-[8px] font-mono text-zinc-500 flex flex-wrap items-center gap-1">
                <span>COMPLAINT: <strong className="text-rose-400 uppercase">{blockStatus.reportReason}</strong></span>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <button
          onClick={onClose}
          className="w-full py-1.5 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 hover:border-zinc-750 text-zinc-300 font-black text-[8.5px] rounded transition-all uppercase tracking-widest cursor-pointer text-center"
        >
          ACKNOWLEDGE SUSPENSION
        </button>
      </motion.div>
    </div>
  );
}
