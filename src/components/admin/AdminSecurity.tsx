/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, doc, setDoc, deleteDoc, onSnapshot, getDoc, query } from 'firebase/firestore';
import { ShieldAlert, Unlock, RefreshCw, Clock, Ban } from 'lucide-react';
import { getClientIp } from '../../utils/ip';

export const AdminSecurity: React.FC = () => {
  const [blockedIps, setBlockedIps] = useState<any[]>([]);
  const [newIpToBlock, setNewIpToBlock] = useState('');
  const [banType, setBanType] = useState<'temporary' | 'permanent'>('permanent');
  const [banDays, setBanDays] = useState('7');
  const [triggerPostId, setTriggerPostId] = useState('');
  const [banReason, setBanReason] = useState('Community Guidelines Violation (Admin Enforced)');
  const [isFirewallLoading, setIsFirewallLoading] = useState(false);
  const [errorFeedback, setErrorFeedback] = useState<string | null>(null);
  const [successFeedback, setSuccessFeedback] = useState<string | null>(null);
  const [adminIp, setAdminIp] = useState<string>('');

  // Resolve current administrator's IP address on load
  useEffect(() => {
    const resolveIp = async () => {
      const resolved = await getClientIp();
      setAdminIp(resolved);
    };
    resolveIp();
  }, []);

  // Clear feedback messages automatically
  useEffect(() => {
    if (errorFeedback) {
      const timer = setTimeout(() => setErrorFeedback(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [errorFeedback]);

  useEffect(() => {
    if (successFeedback) {
      const timer = setTimeout(() => setSuccessFeedback(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [successFeedback]);

  // Fetch Blocked IPs list in real-time
  useEffect(() => {
    setIsFirewallLoading(true);
    const blockedRef = collection(db, 'blockedIps');
    
    const unsubscribe = onSnapshot(
      blockedRef,
      (snapshot) => {
        const ips = snapshot.docs.map(d => ({
          id: d.id,
          ...d.data()
        }));
        setBlockedIps(ips);
        setIsFirewallLoading(false);
      },
      (error) => {
        setIsFirewallLoading(false);
        console.error('Failed to fetch blocked IPs:', error);
        setErrorFeedback('Failed to synchronize firewall. Check Firestore access rules.');
      }
    );

    return () => unsubscribe();
  }, []);

  // Block a new IP address
  const handleBlockIpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanIp = newIpToBlock.trim();
    if (!cleanIp) return;

    // Basic IP validation check (supports both IPv4 and simple IPv6 format)
    if (!/^[a-fA-F0-9.:]+$/.test(cleanIp)) {
      setErrorFeedback('Invalid IP format. Access denied.');
      return;
    }

    if (cleanIp === '150.129.200.97') {
      setErrorFeedback('Security system error: IP address 150.129.200.97 is white-listed and cannot be blocked under any circumstances.');
      return;
    }

    try {
      let expiresAt: string | null = null;
      if (banType === 'temporary') {
        const days = parseInt(banDays, 10);
        if (isNaN(days) || days <= 0) {
          setErrorFeedback('Please specify a valid positive number of days.');
          return;
        }
        const expDate = new Date();
        expDate.setDate(expDate.getDate() + days);
        expiresAt = expDate.toISOString();
      }

      let triggerPostTitle = '';
      let triggerPostContent = '';
      let triggerPostImageUrl = '';

      if (triggerPostId.trim()) {
        try {
          const postRef = doc(db, 'posts', triggerPostId.trim());
          const postSnap = await getDoc(postRef);
          if (postSnap.exists()) {
            const pData = postSnap.data();
            triggerPostTitle = pData.title || '';
            triggerPostContent = pData.content || '';
            triggerPostImageUrl = pData.imageUrl || '';
          } else {
            // Check if input is maybe an encrypted hash
            const postsColl = collection(db, 'posts');
            const q = query(collection(db, 'posts')); // simple snapshot query
            // We can fetch later or just fallback
          }
        } catch (postErr) {
          console.error('Failed to pre-resolve post details:', postErr);
        }
      }

      const blockRef = doc(db, 'blockedIps', cleanIp);
      await setDoc(blockRef, {
        ip: cleanIp,
        isBlocked: true,
        blockCount: 1,
        totalReports: 0,
        blockedAt: new Date().toISOString(),
        expiresAt,
        blockType: banType === 'temporary' ? `${banDays}days` : 'permanent',
        reason: banReason.trim() || 'Community Guidelines Violation (Admin Enforced)',
        triggerPostId: triggerPostId.trim() || null,
        triggerPostTitle: triggerPostTitle || null,
        triggerPostContent: triggerPostContent || null,
        triggerPostImageUrl: triggerPostImageUrl || null
      });

      setNewIpToBlock('');
      setTriggerPostId('');
      setBanReason('Community Guidelines Violation (Admin Enforced)');
      setSuccessFeedback(`IP Address ${cleanIp} blacklisted successfully (${banType === 'temporary' ? `Temporary: ${banDays} days` : 'Permanent'}).`);
    } catch (err) {
      console.error('Failed to block IP:', err);
      setErrorFeedback('Firewall error. Deploy Firestore rules or verify client permissions.');
    }
  };

  // Unblock an IP address
  const handleUnblockIp = async (ip: string) => {
    try {
      const blockRef = doc(db, 'blockedIps', ip);
      await setDoc(blockRef, {
        isBlocked: false,
        expiresAt: null,
        blockedAt: null,
        totalReports: 0
      }, { merge: true });
      setSuccessFeedback(`IP Address ${ip} has been successfully unblocked.`);
    } catch (err) {
      console.error('Failed to unblock IP:', err);
      setErrorFeedback(`Failed to lift IP block on: ${ip}`);
    }
  };

  return (
    <div className="bg-zinc-950 border border-zinc-900 rounded-lg p-5 shadow-xl">
      <h3 className="text-xs font-bold text-emerald-400 border-b border-zinc-900 pb-2.5 mb-4 uppercase tracking-widest flex items-center gap-2 font-mono">
        <ShieldAlert className="w-4 h-4 text-emerald-500/70" />
        <span>IP Firewall Rule Set</span>
      </h3>

      {/* Admin Current IP Address Diagnostic */}
      {adminIp && (
        <div className="mb-4 p-2.5 bg-zinc-900/30 border border-zinc-900 rounded flex items-center justify-between text-[10px] font-mono">
          <span className="text-zinc-500 uppercase tracking-wide">Your IP Signature:</span>
          <div className="flex items-center gap-1.5">
            <span className="text-zinc-300 font-bold">{adminIp}</span>
            {blockedIps.some(b => b.id === adminIp) ? (
              <span className="px-1.5 py-0.5 rounded bg-rose-950/40 border border-rose-500/25 text-rose-400 font-bold uppercase text-[7px] tracking-widest animate-pulse">
                Blocked
              </span>
            ) : (
              <span className="px-1.5 py-0.5 rounded bg-emerald-950/40 border border-emerald-500/25 text-emerald-400 font-bold uppercase text-[7px] tracking-widest">
                Active
              </span>
            )}
          </div>
        </div>
      )}

      {/* Feedback Messages */}
      {errorFeedback && (
        <div className="bg-rose-950/25 border border-rose-500/30 text-rose-400 text-[10px] p-2.5 rounded font-mono mb-3 leading-relaxed">
          [ERROR] {errorFeedback}
        </div>
      )}

      {successFeedback && (
        <div className="bg-emerald-950/20 border border-emerald-500/20 text-emerald-400 text-[10px] p-2.5 rounded font-mono mb-3 leading-relaxed">
          [SUCCESS] {successFeedback}
        </div>
      )}

      {/* Block IP Form */}
      <form onSubmit={handleBlockIpSubmit} className="space-y-3 mb-6 bg-zinc-900/10 p-3.5 border border-zinc-900 rounded-lg">
        <span className="text-[9px] uppercase text-zinc-500 block font-bold tracking-wider font-mono">
          MANUALLY DEPLOY IP BLOCK
        </span>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[9px] text-zinc-500 uppercase tracking-wider block">Target IP Address</label>
            <input
              type="text"
              value={newIpToBlock}
              onChange={(e) => setNewIpToBlock(e.target.value)}
              placeholder="e.g. 192.168.1.1"
              required
              className="w-full bg-zinc-900 border border-zinc-850 focus:border-emerald-500/30 rounded px-2.5 py-1.5 text-xs text-zinc-300 focus:outline-none placeholder-zinc-700 transition-colors font-mono"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[9px] text-zinc-500 uppercase tracking-wider block">Ban Duration Type</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setBanType('permanent')}
                className={`flex-1 py-1.5 px-3 rounded text-[10px] font-bold uppercase font-mono border tracking-wider transition-all cursor-pointer ${
                  banType === 'permanent'
                    ? 'bg-rose-950/30 border-rose-500/50 text-rose-400'
                    : 'bg-zinc-900/50 border-zinc-850 text-zinc-500 hover:text-zinc-400'
                }`}
              >
                Permanent
              </button>
              <button
                type="button"
                onClick={() => setBanType('temporary')}
                className={`flex-1 py-1.5 px-3 rounded text-[10px] font-bold uppercase font-mono border tracking-wider transition-all cursor-pointer ${
                  banType === 'temporary'
                    ? 'bg-amber-950/20 border-amber-500/40 text-amber-400'
                    : 'bg-zinc-900/50 border-zinc-850 text-zinc-500 hover:text-zinc-400'
                }`}
              >
                Temporary
              </button>
            </div>
          </div>
        </div>

        {banType === 'temporary' && (
          <div className="space-y-1">
            <label className="text-[9px] text-zinc-500 uppercase tracking-wider block">Custom Duration (Days)</label>
            <input
              type="number"
              min="1"
              value={banDays}
              onChange={(e) => setBanDays(e.target.value)}
              placeholder="Number of days (e.g. 3, 7, 30)"
              required={banType === 'temporary'}
              className="w-full bg-zinc-900 border border-zinc-850 focus:border-emerald-500/30 rounded px-2.5 py-1.5 text-xs text-zinc-300 focus:outline-none placeholder-zinc-700 transition-colors font-mono"
            />
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[9px] text-zinc-500 uppercase tracking-wider block">Triggering Post ID (Optional)</label>
            <input
              type="text"
              value={triggerPostId}
              onChange={(e) => setTriggerPostId(e.target.value)}
              placeholder="e.g. j7xSdhHwk3v"
              className="w-full bg-zinc-900 border border-zinc-850 focus:border-emerald-500/30 rounded px-2.5 py-1.5 text-xs text-zinc-300 focus:outline-none placeholder-zinc-700 transition-colors font-mono"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[9px] text-zinc-500 uppercase tracking-wider block">Reason For Suspension</label>
            <input
              type="text"
              value={banReason}
              onChange={(e) => setBanReason(e.target.value)}
              placeholder="Violation description"
              required
              className="w-full bg-zinc-900 border border-zinc-850 focus:border-emerald-500/30 rounded px-2.5 py-1.5 text-xs text-zinc-300 focus:outline-none placeholder-zinc-700 transition-colors font-sans"
            />
          </div>
        </div>

        <button
          type="submit"
          className="w-full py-2 bg-rose-950/20 border border-rose-500/30 hover:border-rose-500 hover:bg-rose-950/40 text-rose-400 text-[10px] font-bold rounded transition-colors uppercase font-mono tracking-widest cursor-pointer"
        >
          Execute IP Suspension
        </button>
      </form>

      {/* Firewall List */}
      <div className="space-y-2 max-h-[350px] overflow-y-auto scrollbar-thin">
        <span className="text-[9px] uppercase text-zinc-500 block font-bold mb-2 tracking-wider font-mono">
          BLACKLISTED IP ADDRESSES ({blockedIps.length})
        </span>
        
        {isFirewallLoading ? (
          <div className="text-[10px] text-zinc-600 flex items-center gap-1.5 py-4 font-mono">
            <RefreshCw className="w-3 h-3 animate-spin text-emerald-500" />
            <span>Querying firewall configuration...</span>
          </div>
        ) : blockedIps.length === 0 ? (
          <div className="text-[10px] text-zinc-600 italic bg-zinc-900/20 p-4 border border-zinc-900 rounded text-center font-mono">
            Firewall is clean. No device bans issued.
          </div>
        ) : (
          blockedIps.map((block) => {
            let detailsLabel = 'Permanent Ban';
            if (block.expiresAt) {
              const expires = new Date(block.expiresAt);
              const now = new Date();
              if (now >= expires) {
                detailsLabel = 'Expired';
              } else {
                const diffMs = expires.getTime() - now.getTime();
                const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                detailsLabel = `Expires in ${diffDays}d ${diffHours}h`;
              }
            }

            const isCurrentlyBlocked = block.isBlocked !== false;

            return (
              <div 
                key={block.id} 
                className={`flex items-start justify-between p-3 border rounded font-mono text-[11px] gap-2 transition-all ${
                  isCurrentlyBlocked 
                    ? 'bg-zinc-900/40 border-zinc-900' 
                    : 'bg-zinc-900/10 border-zinc-950 opacity-60'
                }`}
              >
                <div className="flex flex-col space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`font-bold break-all ${isCurrentlyBlocked ? 'text-zinc-200' : 'text-zinc-500 line-through'}`}>
                      {block.id}
                    </span>
                    {!isCurrentlyBlocked ? (
                      <span className="px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-500 text-[8px] font-black uppercase tracking-wider flex items-center gap-1">
                        LIFTED / CLEAN
                      </span>
                    ) : block.expiresAt ? (
                      <span className="px-1.5 py-0.5 rounded bg-amber-950/30 border border-amber-500/20 text-amber-400 text-[8px] font-black uppercase tracking-wider flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5" />
                        {detailsLabel}
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded bg-rose-950/30 border border-rose-500/20 text-rose-400 text-[8px] font-black uppercase tracking-wider flex items-center gap-1">
                        <Ban className="w-2.5 h-2.5" />
                        Permanent
                      </span>
                    )}
                  </div>
                  
                  <div className="space-y-0.5 font-sans text-[10px] text-zinc-400 leading-normal">
                    <div>
                      <span className="text-zinc-500 font-mono text-[8px] uppercase font-bold mr-1">Reason:</span>
                      <span className="italic">"{block.reason || 'Guidelines Violation'}"</span>
                    </div>
                    {block.triggerPostId && (
                      <div className="text-[9.5px]">
                        <span className="text-zinc-500 font-mono text-[8px] uppercase font-bold mr-1">Trigger Post ID:</span>
                        <code className="text-rose-400 font-mono text-[9px] bg-rose-950/10 px-1 py-0.2 rounded">{block.triggerPostId}</code>
                      </div>
                    )}
                  </div>
                </div>
                
                {isCurrentlyBlocked ? (
                  <button
                    onClick={() => handleUnblockIp(block.id)}
                    className="p-1.5 bg-zinc-900/50 hover:bg-zinc-850 border border-zinc-850 hover:border-emerald-500/30 text-zinc-500 hover:text-emerald-400 rounded transition-colors cursor-pointer shrink-0"
                    title="Lift IP Suspension"
                  >
                    <Unlock className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setNewIpToBlock(block.id);
                      setBanType('permanent');
                    }}
                    className="p-1.5 bg-zinc-900/50 hover:bg-zinc-850 border border-zinc-850 hover:border-rose-500/30 text-zinc-600 hover:text-rose-450 rounded transition-colors cursor-pointer shrink-0"
                    title="Reload into Suspension Console"
                  >
                    <Ban className="w-4 h-4" />
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>

      <div className="mt-4 p-3 bg-zinc-900/10 border border-zinc-900 rounded text-[9px] text-zinc-500 leading-relaxed font-sans">
        <strong className="text-zinc-400 block font-mono mb-0.5 uppercase text-[8px] tracking-wide">
          Automatic Enforcement:
        </strong>
        Blocked devices will be blocked in the middleware layer. They will not be able to create new posts or interact with any active venom feeds.
      </div>
    </div>
  );
};
