import React, { useState, useEffect } from 'react';
import { doc, getDoc, collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { getClientIp } from '../utils/ip';
import { submitPostReport } from '../utils/reports';
import { checkIpBlockStatus, BlockStatus } from '../utils/blockChecker';
import { ShieldAlert, ChevronLeft, Search, Eye, AlertCircle, CheckCircle, RefreshCw, AlertTriangle, ExternalLink, Download, BookOpen } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import VenomCard from './VenomCard';
import { MobileBottomBar } from './MobileBottomBar';

interface ReportPageProps {
  onBackToHome?: () => void;
}

export default function ReportPage({ onBackToHome }: ReportPageProps) {
  const [postId, setPostId] = useState('');
  const [selectedReason, setSelectedReason] = useState('');
  const [opinion, setOpinion] = useState('');
  
  // Post verification state
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifiedPost, setVerifiedPost] = useState<any | null>(null);
  const [verificationError, setVerificationError] = useState<string | null>(null);

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitResult, setSubmitResult] = useState<any | null>(null);

  // Client IP and blocking state
  const [userIp, setUserIp] = useState('');
  const [blockStatus, setBlockStatus] = useState<BlockStatus | null>(null);

  // Pre-fill post ID from query params if specified (e.g. /report?id=abc)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const queryId = params.get('id');
    if (queryId) {
      setPostId(queryId);
      // Automatically trigger verification on load if ID is provided
      handleVerifyPost(queryId);
    }

    // Resolve client IP
    const initIp = async () => {
      try {
        const ip = await getClientIp();
        setUserIp(ip);
        const block = await checkIpBlockStatus(ip);
        setBlockStatus(block);
      } catch (err) {
        console.error('Failed to resolve IP or check block status:', err);
      }
    };
    initIp();
  }, []);

  const handleVerifyPost = async (idToVerify?: string) => {
    const targetId = idToVerify || postId.trim();
    if (!targetId) return;

    setIsVerifying(true);
    setVerificationError(null);
    setVerifiedPost(null);

    try {
      // 1. Try directly matching by Document ID
      const postRef = doc(db, 'posts', targetId);
      const snap = await getDoc(postRef);
      
      let matchedDoc: any = null;
      if (snap.exists()) {
        matchedDoc = { id: snap.id, ...snap.data() };
      } else {
        // 2. Try querying by encryptedHash field
        const q = query(collection(db, 'posts'), where('encryptedHash', '==', targetId), limit(1));
        const querySnap = await getDocs(q);
        if (!querySnap.empty) {
          const docSnap = querySnap.docs[0];
          matchedDoc = { id: docSnap.id, ...docSnap.data() };
        }
      }

      if (matchedDoc) {
        if (matchedDoc.isDeleted) {
          setVerificationError('This post is already deleted or suspended by system moderation.');
        } else {
          setVerifiedPost(matchedDoc);
        }
      } else {
        setVerificationError('Post ID not found. Verify character spelling and try again.');
      }
    } catch (err: any) {
      console.error('Verification failed:', err);
      setVerificationError(`Verification failed: ${err.message || err}`);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifiedPost) {
      setSubmitError('You must verify a valid Post ID before submitting a security report.');
      return;
    }
    if (!selectedReason) {
      setSubmitError('Selectable reason of report is compulsory.');
      return;
    }

    // Double check block status
    if (blockStatus?.isBlocked) {
      setSubmitError(`Submission denied: Your IP signature is currently quarantined (${blockStatus.timeLeftLabel}).`);
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const reporterIp = userIp || (await getClientIp());
      const result = await submitPostReport(verifiedPost.id, selectedReason, opinion, reporterIp);
      setSubmitResult(result);
    } catch (err: any) {
      console.error('Report submission failed:', err);
      setSubmitError(err.message || 'Failed to submit security report.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setPostId('');
    setSelectedReason('');
    setOpinion('');
    setVerifiedPost(null);
    setVerificationError(null);
    setSubmitError(null);
    setSubmitResult(null);
  };

  return (
    <div className="min-h-screen bg-[#030303] text-zinc-300 font-mono flex flex-col selection:bg-emerald-500/30 selection:text-emerald-100 relative overflow-hidden">
      {/* Background grid design */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.02] bg-[radial-gradient(#10b981_1px,transparent_1px)] [background-size:24px_24px] z-0" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-6xl h-[1px] bg-gradient-to-r from-transparent via-emerald-500/20 to-transparent z-10" />

      {/* HEADER */}
      <header className="border-b border-zinc-900 bg-black/60 backdrop-blur-md sticky top-0 z-40 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
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
                window.history.pushState({}, '', '/guidelines');
                window.dispatchEvent(new PopStateEvent('popstate'));
              }}
              className="px-3 py-1 bg-emerald-950/20 hover:bg-emerald-950/40 border border-emerald-500/20 text-emerald-400 hover:text-emerald-300 text-[10px] font-bold rounded transition-colors uppercase tracking-wider flex items-center gap-1 cursor-pointer"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>View Rules</span>
            </button>
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

      {/* MAIN LAYOUT */}
      <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-8 relative z-10 space-y-6">
        
        {/* QUARANTINE WARNING IF BLOCKED */}
        {blockStatus?.isBlocked && (
          <div className="border border-rose-500/40 bg-rose-950/15 p-4 rounded-lg flex gap-3 text-rose-400">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="space-y-1 text-xs">
              <span className="font-bold uppercase tracking-wider block">YOUR DEVICE IP IS CURRENTLY QUARANTINED</span>
              <p className="font-sans leading-relaxed">
                Due to your uploaded posts receiving cumulative user security reports in excess of system thresholds, your node's writing clearance has been temporarily suspended.
              </p>
              <div className="pt-2 font-mono text-[10.5px]">
                <span className="block"><strong>QUARANTINE EXPRIY:</strong> {blockStatus.timeLeftLabel}</span>
                {blockStatus.reason && <span className="block mt-0.5 text-zinc-400"><strong>REASON:</strong> {blockStatus.reason}</span>}
              </div>
            </div>
          </div>
        )}

        <div className="space-y-1.5 border-b border-zinc-900 pb-5">
          <h1 className="text-xl font-black text-white tracking-tight uppercase leading-none">
            SUBMIT CONTENT REPORT
          </h1>
          <p className="text-[11px] text-zinc-500 font-sans leading-normal">
            Spotted a post violating our Community Guidelines? Log the details below. All reports are logged with zero personal identifier disclosure. If a post hits 10 reports, it disappears instantly.
          </p>
        </div>

        <AnimatePresence mode="wait">
          {submitResult ? (
            /* SUCCESS PANEL */
            <motion.div 
              key="success"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="bg-zinc-950 border border-emerald-500/35 p-6 rounded-lg text-center space-y-4 shadow-2xl"
            >
              <div className="w-12 h-12 bg-emerald-950/20 border border-emerald-500/35 rounded-full flex items-center justify-center mx-auto mb-2 text-emerald-400">
                <CheckCircle className="w-6 h-6 animate-pulse" />
              </div>
              
              <div className="space-y-1.5">
                <h3 className="text-xs font-black uppercase tracking-widest text-zinc-100">REPORT LOGGED SUCCESSFULLY</h3>
                <p className="text-[11px] text-zinc-400 leading-normal font-sans max-w-md mx-auto">
                  The security entry for Post ID: <code className="bg-zinc-900 px-1 py-0.5 rounded text-[10px] text-emerald-300 font-mono">{verifiedPost.id}</code> has been committed to the Firestore protocol.
                </p>
              </div>

              <div className="border border-zinc-900 bg-zinc-900/10 p-3.5 rounded text-[10px] space-y-1.5 max-w-sm mx-auto text-left leading-normal font-mono">
                <div className="flex justify-between">
                  <span className="text-zinc-500">POST STATUS:</span>
                  <span className={submitResult.autoDeleted ? 'text-rose-400 font-bold' : 'text-emerald-400'}>
                    {submitResult.autoDeleted ? 'DELETED BY AUTO-MODERATOR' : 'MONITORED ACTIVE FEED'}
                  </span>
                </div>
                {submitResult.autoDeleted && (
                  <p className="text-[9px] text-zinc-400 leading-normal font-sans pt-1 border-t border-zinc-900 mt-1">
                    This post gathered 10 or more security complaints. The system has automatically removed it from the global feed.
                  </p>
                )}
                {submitResult.blockTriggered && (
                  <div className="pt-1.5 border-t border-zinc-900 mt-1.5 text-rose-400">
                    <span className="font-bold block">[AUTO ENFORCEMENT]:</span>
                    <span>The author IP of this post has been placed in quarantine: {submitResult.blockTypeLabel}.</span>
                  </div>
                )}
              </div>

              <div className="pt-4 flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={resetForm}
                  className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 hover:border-zinc-750 text-xs font-bold rounded transition-colors uppercase tracking-wider font-mono cursor-pointer"
                >
                  Report Another Post
                </button>
                <button
                  onClick={() => {
                    if (onBackToHome) {
                      onBackToHome();
                    } else {
                      window.history.pushState({}, '', '/');
                      window.dispatchEvent(new PopStateEvent('popstate'));
                    }
                  }}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-bold rounded transition-all uppercase tracking-wider font-sans cursor-pointer"
                >
                  Back to Homepage
                </button>
              </div>
            </motion.div>
          ) : (
            /* FORM DISPLAY */
            <motion.form 
              key="form"
              onSubmit={handleSubmitReport} 
              className="space-y-5"
            >
              {submitError && (
                <div className="bg-rose-950/20 border border-rose-500/25 text-rose-400 text-[10px] p-3 rounded font-mono border-l-2 border-l-rose-500">
                  [SUBMISSION WARNING]: {submitError}
                </div>
              )}

              {/* POST ID VERIFICATION BOX */}
              <div className="bg-zinc-950 border border-zinc-900 p-4 rounded-lg space-y-3">
                <div className="space-y-1">
                  <label className="text-[9px] uppercase text-zinc-400 block font-bold tracking-wider">
                    TARGET POST IDENTIFIER (COMPULSORY)
                  </label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        value={postId}
                        onChange={(e) => {
                          setPostId(e.target.value);
                          setVerifiedPost(null);
                        }}
                        placeholder="Enter 20-character Post ID... (e.g. mAtE7p8O...)"
                        disabled={isVerifying || isSubmitting}
                        required
                        className="w-full bg-zinc-900 border border-zinc-850 focus:border-emerald-500/30 rounded px-3 py-2 text-xs text-zinc-300 focus:outline-none placeholder-zinc-700 transition-colors font-mono"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleVerifyPost()}
                      disabled={isVerifying || isSubmitting || !postId.trim()}
                      className="px-4 py-1.5 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 hover:border-zinc-700 disabled:opacity-40 text-zinc-300 text-[10px] font-bold rounded transition-colors uppercase tracking-wider flex items-center gap-1 cursor-pointer font-mono shrink-0"
                    >
                      {isVerifying ? <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-400" /> : <Search className="w-3.5 h-3.5" />}
                      <span>Verify</span>
                    </button>
                  </div>
                </div>

                {/* VERIFICATION ERROR FEEDBACK */}
                {verificationError && (
                  <div className="text-[10px] text-rose-400 flex items-center gap-1.5 bg-rose-950/5 border border-rose-900/40 p-2.5 rounded">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{verificationError}</span>
                  </div>
                )}

                {/* VERIFIED POST PREVIEW COMPACT CARD */}
                {verifiedPost && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between border-b border-zinc-900 pb-1.5">
                      <div className="flex items-center gap-1.5 text-[8px] text-emerald-400 font-bold font-mono tracking-widest uppercase">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                        <span>POST SECURELY VERIFIED</span>
                      </div>
                    </div>
                    <VenomCard post={verifiedPost} highlighted={true} />
                  </div>
                )}
              </div>

              {/* COMPULSORY SELECTABLE REASON */}
              <div className="bg-zinc-950 border border-zinc-900 p-4 rounded-lg space-y-3">
                <label className="text-[9px] uppercase text-zinc-400 block font-bold tracking-wider">
                  SELECTABLE REASON OF REPORT (COMPULSORY)
                </label>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {[
                    { val: 'Terrorism', label: 'Terrorism & Extremism' },
                    { val: 'Drugs', label: 'Drugs & Illegal Substances' },
                    { val: 'Doxxing', label: 'Personal Identity Leak (Doxxing)' },
                    { val: 'Harassment', label: 'Severe Harassment & Hate Speech' },
                    { val: 'Sexual', label: 'Severe Sexual Content' },
                    { val: 'Scams', label: 'Scams, Fraud & Abuse' },
                    { val: 'Spam', label: 'Malicious Spam & Viruses' },
                    { val: 'Other', label: 'Other Policy Violation' },
                  ].map((opt) => (
                    <label 
                      key={opt.val}
                      className={`flex items-center gap-2.5 px-3 py-2.5 border rounded cursor-pointer transition-colors font-mono text-[10.5px] ${
                        selectedReason === opt.val 
                          ? 'border-emerald-500/50 bg-emerald-950/10 text-emerald-400 font-bold' 
                          : 'border-zinc-900 bg-zinc-900/20 text-zinc-400 hover:border-zinc-800'
                      }`}
                    >
                      <input
                        type="radio"
                        name="reason"
                        value={opt.val}
                        checked={selectedReason === opt.val}
                        onChange={() => setSelectedReason(opt.val)}
                        disabled={isSubmitting}
                        className="hidden"
                      />
                      <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${
                        selectedReason === opt.val ? 'border-emerald-500 text-emerald-400' : 'border-zinc-600'
                      }`}>
                        {selectedReason === opt.val && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                      </div>
                      <span>{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* OPTIONAL OPINION / DESCRIPTION */}
              <div className="bg-zinc-950 border border-zinc-900 p-4 rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[9px] uppercase text-zinc-400 block font-bold tracking-wider">
                    EXPLAIN WHY THE POST SHOULD BE DELETED (OPTIONAL OPINION)
                  </label>
                  <span className="text-[8px] text-zinc-600 font-mono uppercase">OPTIONAL</span>
                </div>
                <textarea
                  value={opinion}
                  onChange={(e) => setOpinion(e.target.value)}
                  maxLength={500}
                  placeholder="Describe why you believe this post breaks community laws..."
                  disabled={isSubmitting}
                  className="w-full bg-zinc-900 border border-zinc-850 focus:border-emerald-500/30 rounded px-3 py-2 text-xs text-zinc-300 focus:outline-none placeholder-zinc-700 h-24 resize-none transition-colors font-sans"
                />
              </div>

              {/* ACTION BTNS */}
              <button
                type="submit"
                disabled={isSubmitting || !verifiedPost || !selectedReason || blockStatus?.isBlocked}
                className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed text-zinc-950 font-black text-xs rounded transition-all uppercase tracking-widest cursor-pointer flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-950/20"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-zinc-950" />
                    <span>LOGGING REPORT TRANSACTION...</span>
                  </>
                ) : (
                  <>
                    <ShieldAlert className="w-4 h-4 text-zinc-950" />
                    <span>SUBMIT SECURITY REPORT</span>
                  </>
                )}
              </button>
            </motion.form>
          )}
        </AnimatePresence>
      </main>

      {/* FOOTER */}
      <footer className="border-t border-zinc-900 bg-black/40 py-6 px-4 pb-24 text-center text-[9px] text-zinc-600 font-mono">
        <p className="uppercase tracking-widest">VENOM NETWORKS © 2026 • THREAT ASSESSMENT GRID MODULE</p>
      </footer>

      <MobileBottomBar currentPath="/report" />
    </div>
  );
}
