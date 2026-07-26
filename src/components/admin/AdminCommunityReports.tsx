import React, { useState, useEffect } from 'react';
import { collection, doc, deleteDoc, updateDoc, setDoc, getDoc, onSnapshot, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { ShieldAlert, Lock, Unlock, Trash2, Check, Clock, RefreshCw, Search, Users, ArrowLeft, AlertTriangle, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function AdminCommunityReports() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);

  // Active view tab: 'reports' | 'blocked'
  const [activeTab, setActiveTab] = useState<'reports' | 'blocked'>('reports');

  // Real-time Firestore data
  const [communities, setCommunities] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actioningId, setActioningId] = useState<string | null>(null);

  // Ban adjustment form
  const [banDays, setBanDays] = useState<number>(15);
  const [banType, setBanType] = useState<'temporary' | 'permanent'>('temporary');

  // Check login session on load
  useEffect(() => {
    const authSession = sessionStorage.getItem('venom_admin_auth');
    if (authSession === 'true') {
      setIsAuthenticated(true);
    }
  }, []);

  // Real-time Communities listener
  useEffect(() => {
    if (!isAuthenticated) return;
    setIsLoading(true);

    const commsRef = collection(db, 'communities');
    const unsubscribe = onSnapshot(commsRef, (snap) => {
      const fetched = snap.docs.map(d => ({
        id: d.id,
        ...d.data()
      }));
      setCommunities(fetched);
      setIsLoading(false);
    }, (err) => {
      console.error("Failed to read communities:", err);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [isAuthenticated]);

  // Real-time Reports listener for Community Reports
  useEffect(() => {
    if (!isAuthenticated) return;

    const reportsRef = collection(db, 'reports');
    const unsubscribe = onSnapshot(reportsRef, (snap) => {
      const fetched = snap.docs.map(d => ({
        id: d.id,
        ...d.data()
      })) as any[];
      // Filter for reports targetting communities (has communityId)
      const communityReports = fetched.filter(r => r.communityId);
      setReports(communityReports);
    }, (err) => {
      console.error("Failed to read community reports:", err);
    });

    return () => unsubscribe();
  }, [isAuthenticated]);

  // Handle administrator credentials authentication
  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);

    if (username === 'theakshatpopat' && password === 'Aprt9311') {
      setIsAuthenticated(true);
      sessionStorage.setItem('venom_admin_auth', 'true');
      setUsername('');
      setPassword('');
    } else {
      setLoginError('Invalid administrator credentials. Authentication denied.');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    sessionStorage.removeItem('venom_admin_auth');
  };

  // DISMISS ALL COMPLAINTS against a community
  const handleDismissCommunityReports = async (communityId: string) => {
    if (!confirm('Are you sure you want to dismiss all complaints against this community? This resets reportsCount.')) {
      return;
    }
    setActioningId(communityId);
    try {
      // 1. Reset reportsCount
      const commRef = doc(db, 'communities', communityId);
      await updateDoc(commRef, {
        reportsCount: 0
      });

      // 2. Clear related reports in db
      const q = query(collection(db, 'reports'), where('communityId', '==', communityId));
      const snap = await getDocs(q);
      const batchDeletes = snap.docs.map(d => deleteDoc(doc(db, 'reports', d.id)));
      await Promise.all(batchDeletes);

      alert("All active complaints for this community have been dismissed.");
    } catch (err) {
      console.error("Dismiss community failed:", err);
      alert("Failed to dismiss complaints.");
    } finally {
      setActioningId(null);
    }
  };

  // BLOCK COMMUNITY (TEMPORARY OR PERMANENT)
  const handleBlockCommunity = async (communityId: string, type: 'temporary' | 'permanent', days: number) => {
    setActioningId(communityId);
    try {
      const commRef = doc(db, 'communities', communityId);
      let blockedUntil: string | null = null;
      if (type === 'temporary') {
        const exp = new Date();
        exp.setDate(exp.getDate() + days);
        blockedUntil = exp.toISOString();
      }

      await updateDoc(commRef, {
        isBlocked: true,
        blockedUntil: blockedUntil,
        reportsCount: 100 // keep it blocked
      });

      alert(`Community blocked successfully (${type === 'permanent' ? 'Permanently' : `for ${days} days`}).`);
    } catch (err) {
      console.error("Failed to block community:", err);
      alert("Failed to apply community block.");
    } finally {
      setActioningId(null);
    }
  };

  // LIFT BLOCK ON COMMUNITY
  const handleUnblockCommunity = async (communityId: string) => {
    setActioningId(communityId);
    try {
      const commRef = doc(db, 'communities', communityId);
      await updateDoc(commRef, {
        isBlocked: false,
        blockedUntil: null,
        reportsCount: 0
      });

      // Also dismiss old reports
      const q = query(collection(db, 'reports'), where('communityId', '==', communityId));
      const snap = await getDocs(q);
      const batchDeletes = snap.docs.map(d => deleteDoc(doc(db, 'reports', d.id)));
      await Promise.all(batchDeletes);

      alert("Community unblocked successfully. Active reports have been cleared.");
    } catch (err) {
      console.error("Failed to unblock community:", err);
      alert("Failed to unblock community.");
    } finally {
      setActioningId(null);
    }
  };

  // Formulate deterministic Serial or IMEI if missing
  const getDeterministicSerial = (idString: string, prefix: string = 'VSN') => {
    if (!idString) return 'UNKNOWN';
    let hash = 0;
    for (let i = 0; i < idString.length; i++) {
      hash = idString.charCodeAt(i) + ((hash << 5) - hash);
    }
    const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let serial = prefix;
    for (let i = 0; i < 10; i++) {
      serial += chars.charAt(Math.abs((hash + i * 23) % chars.length));
    }
    return serial;
  };

  const getDeterministicImei = (idString: string) => {
    if (!idString) return 'UNKNOWN';
    let hash = 0;
    for (let i = 0; i < idString.length; i++) {
      hash = idString.charCodeAt(i) + ((hash << 5) - hash);
    }
    let digits = '35';
    for (let i = 0; i < 13; i++) {
      digits += Math.abs((hash + i * 19) % 10).toString();
    }
    return digits;
  };

  // Format time remaining for temporary bans
  const formatTimeLeft = (blockedUntilStr?: string) => {
    if (!blockedUntilStr) return 'Permanent';
    const expires = new Date(blockedUntilStr);
    const now = new Date();
    if (now >= expires) return 'Expired (Ban active until manual lift)';

    const diffMs = expires.getTime() - now.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    let label = '';
    if (diffDays > 0) label += `${diffDays}d `;
    if (diffHours > 0 || diffDays > 0) label += `${diffHours}h `;
    label += `${diffMins}m left`;
    return label;
  };

  // Filter lists
  const reportedCommunitiesList = communities.filter(c => (c.reportsCount || 0) > 0 && !c.isBlocked);
  const blockedCommunitiesList = communities.filter(c => c.isBlocked);

  // Helper to trigger navigation
  const navigateTo = (path: string) => {
    window.history.pushState({}, '', path);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  return (
    <div className="min-h-screen bg-[#030303] text-zinc-300 font-mono flex flex-col selection:bg-emerald-500/30 selection:text-emerald-100 relative">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-5xl h-[1px] bg-gradient-to-r from-transparent via-emerald-500/20 to-transparent z-10" />

      {/* HEADER BAR */}
      <header className="border-b border-zinc-900 bg-black/60 backdrop-blur-md sticky top-0 z-40 px-4 py-3">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div 
            className="flex items-center gap-3 cursor-pointer select-none transition-transform active:scale-95"
            onClick={() => navigateTo('/')}
          >
            <img 
              src="https://i.ibb.co/RpqhT7QZ/14893-removebg-preview.png" 
              alt="Venom Logo" 
              className="w-11 h-11 object-contain select-none drop-shadow-[0_0_10px_rgba(16,185,129,0.4)] hover:scale-110 transition-transform cursor-pointer"
              referrerPolicy="no-referrer"
            />
            <div>
              <h1 className="text-lg font-black tracking-widest text-emerald-400 select-none leading-tight">
                VENOM
              </h1>
              <p className="text-[10px] text-zinc-500 font-mono tracking-wider uppercase select-none leading-none mt-0.5">
                COMMUNITY SHIELD LOGS
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap justify-center">
            <button
              onClick={() => navigateTo('/admin')}
              className="px-3 py-1.5 bg-zinc-950 hover:bg-zinc-900 border border-zinc-900 text-zinc-400 hover:text-zinc-200 text-[10px] font-bold rounded transition-colors uppercase tracking-wider cursor-pointer"
            >
              Go to admin panel
            </button>
            <button
              onClick={() => navigateTo('/admin/communities')}
              className="px-3 py-1.5 bg-emerald-950/20 hover:bg-emerald-950/40 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold rounded transition-colors uppercase tracking-wider cursor-pointer"
            >
              Go to admin Community page
            </button>
            {isAuthenticated && (
              <button
                onClick={handleLogout}
                className="px-3 py-1.5 bg-rose-950/15 hover:bg-rose-950/35 border border-rose-500/20 text-rose-400 text-[10px] font-bold rounded transition-colors uppercase tracking-wider cursor-pointer"
              >
                Logout
              </button>
            )}
          </div>
        </div>
      </header>

      {/* BODY GATE / VIEWPORT */}
      <div className="flex-1 max-w-5xl w-full mx-auto p-4 space-y-6">
        {!isAuthenticated ? (
          /* LOGIN PANEL GATEWAY */
          <div className="flex items-center justify-center py-20">
            <div className="w-full max-w-sm bg-zinc-950 border border-zinc-900 rounded-xl p-6 shadow-2xl relative overflow-hidden">
              <div className="absolute -top-16 -right-16 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />
              
              <div className="flex flex-col items-center justify-center text-center mb-6">
                <div className="w-10 h-10 rounded-full bg-zinc-900 border border-zinc-850 flex items-center justify-center mb-2">
                  <Lock className="w-4 h-4 text-emerald-400" />
                </div>
                <h2 className="text-xs font-black tracking-widest text-zinc-100 uppercase">DECRYPTION AUTH SHIELD</h2>
                <p className="text-[9px] text-zinc-500 mt-1 uppercase">Enter credentials to moderate communities</p>
              </div>

              <form onSubmit={handleLoginSubmit} className="space-y-4">
                {loginError && (
                  <div className="bg-rose-950/20 border border-rose-500/20 text-rose-400 text-[9px] p-2.5 rounded border-l-2 border-l-rose-500">
                    {loginError}
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-[8px] uppercase text-zinc-500 block font-bold tracking-wider">ADMIN IDENTITY</label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    placeholder="Enter admin ID..."
                    className="w-full bg-zinc-900 border border-zinc-850 focus:border-emerald-500/30 rounded px-3 py-2 text-xs text-zinc-300 focus:outline-none placeholder-zinc-700 transition-colors"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[8px] uppercase text-zinc-500 block font-bold tracking-wider">SECURITY PASSPHRASE</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="Enter secret passphrase..."
                    className="w-full bg-zinc-900 border border-zinc-850 focus:border-emerald-500/30 rounded px-3 py-2 text-xs text-zinc-300 focus:outline-none placeholder-zinc-700 transition-colors"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-black text-[10px] rounded transition-all uppercase mt-6 cursor-pointer tracking-widest flex items-center justify-center gap-1.5 shadow-lg"
                >
                  <span>AUTHORIZE CLEARANCE</span>
                </button>
              </form>
            </div>
          </div>
        ) : (
          /* MAIN MONITORING DASHBOARD */
          <div className="space-y-6">
            
            {/* TAB BUTTONS */}
            <div className="flex border-b border-zinc-900 pb-px gap-2">
              <button
                onClick={() => setActiveTab('reports')}
                className={`px-4 py-2 text-xs font-bold uppercase tracking-wider cursor-pointer border-b-2 transition-all ${
                  activeTab === 'reports'
                    ? 'border-emerald-500 text-emerald-400 bg-emerald-500/5'
                    : 'border-transparent text-zinc-500 hover:text-zinc-300'
                }`}
              >
                Reported Communities ({reportedCommunitiesList.length})
              </button>
              <button
                onClick={() => setActiveTab('blocked')}
                className={`px-4 py-2 text-xs font-bold uppercase tracking-wider cursor-pointer border-b-2 transition-all ${
                  activeTab === 'blocked'
                    ? 'border-rose-500 text-rose-400 bg-rose-500/5'
                    : 'border-transparent text-zinc-500 hover:text-zinc-300'
                }`}
              >
                Blocked Communities ({blockedCommunitiesList.length})
              </button>
            </div>

            {/* TAB CONTENT: REPORTED LIST */}
            {activeTab === 'reports' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-zinc-900/60 pb-2">
                  <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-black flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-emerald-400 animate-pulse" />
                    Pending Community Violation Complaints
                  </span>
                </div>

                {isLoading ? (
                  <div className="text-center py-12 text-xs text-zinc-500 flex items-center justify-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin text-emerald-500" />
                    <span>Analyzing active community logs...</span>
                  </div>
                ) : reportedCommunitiesList.length === 0 ? (
                  <div className="border border-zinc-900 bg-zinc-950/20 text-center py-16 rounded-xl text-xs text-zinc-500 italic">
                    All clear. No reported communities detected in the active feed list.
                  </div>
                ) : (
                  <div className="space-y-6">
                    {reportedCommunitiesList.map((comm) => {
                      const commReports = reports.filter(r => r.communityId === comm.id);
                      const creatorIp = comm.createdByIp || '127.0.0.1';
                      const creatorImei = comm.createdByImei || getDeterministicImei(comm.id);
                      const creatorSerial = comm.createdBySerial || getDeterministicSerial(comm.id, 'COMM-CREATOR');

                      return (
                        <div 
                          key={comm.id}
                          className="border border-zinc-900 bg-zinc-950 rounded-xl p-5 space-y-4 hover:border-zinc-850 transition-all shadow-md relative"
                        >
                          {/* Banner background glow for high urgency */}
                          {(comm.reportsCount || 0) >= 10 && (
                            <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/[0.02] rounded-full blur-2xl pointer-events-none" />
                          )}

                          {/* Community details header */}
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-zinc-900 pb-3">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-emerald-400 font-black text-xs uppercase tracking-wide">
                                  {comm.name}
                                </span>
                                <span className="text-[9px] bg-rose-950/30 text-rose-400 border border-rose-500/10 px-2 py-0.5 rounded font-black tracking-widest uppercase">
                                  {comm.reportsCount || 0} TOTAL COMPLAINTS
                                </span>
                              </div>
                              <p className="text-[11px] text-zinc-400 leading-relaxed font-sans max-w-2xl">
                                {comm.description || 'No description provided.'}
                              </p>
                            </div>

                            {/* Creator details */}
                            <div className="bg-[#0c0c0c] border border-zinc-900 p-2.5 rounded-lg text-[9px] text-zinc-500 space-y-1 font-mono shrink-0">
                              <span className="text-[8px] text-zinc-400 font-bold uppercase tracking-wider block">CREATOR FOOTPRINT:</span>
                              <div>IP: <strong className="text-zinc-300 font-sans">{creatorIp}</strong></div>
                              <div>IMEI: <strong className="text-rose-400">{creatorImei}</strong></div>
                              <div>S/N: <strong className="text-amber-400">{creatorSerial}</strong></div>
                            </div>
                          </div>

                          {/* Individual complaints stack */}
                          {commReports.length > 0 && (
                            <div className="space-y-2">
                              <span className="text-[9px] text-rose-400 font-black tracking-wider uppercase block">
                                RECEIVED FRAUD & THREAT LOGS:
                              </span>
                              <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
                                {commReports.map((rep) => {
                                  const repIp = rep.ip || '127.0.0.1';
                                  const repImei = rep.imei || getDeterministicImei(rep.id);
                                  const repSerial = getDeterministicSerial(rep.id, 'REPORTER');

                                  return (
                                    <div 
                                      key={rep.id}
                                      className="bg-zinc-950/40 border border-zinc-900 rounded p-3 text-[10.5px] space-y-1.5"
                                    >
                                      <div className="flex items-center justify-between text-[8px] text-zinc-600 flex-wrap gap-2 border-b border-zinc-900/40 pb-1">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                          <span className="text-rose-400 font-bold">REASON: {rep.reason || 'Safety Infraction'}</span>
                                          <span>•</span>
                                          <span>REPORTER IP: <strong className="text-zinc-400">{repIp}</strong></span>
                                          <span>•</span>
                                          <span>REPORTER IMEI: <strong className="text-rose-500">{repImei}</strong></span>
                                          <span>•</span>
                                          <span>REPORTER S/N: <strong className="text-amber-500">{repSerial}</strong></span>
                                        </div>
                                        <span>{rep.createdAt ? new Date(rep.createdAt).toLocaleString() : 'N/A'}</span>
                                      </div>
                                      <p className="text-zinc-300 italic font-sans pl-1.5 border-l border-rose-500/10">
                                        "{rep.opinion || 'No additional commentary.'}"
                                      </p>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Block Actions Row */}
                          <div className="pt-2 flex flex-wrap items-center justify-between gap-4 border-t border-zinc-900/80 bg-zinc-950/20 p-3 rounded-lg">
                            {/* Ban duration controls */}
                            <div className="flex items-center gap-2 flex-wrap">
                              <div className="flex items-center gap-1 border border-zinc-900 bg-black p-1.5 rounded text-[10px]">
                                <span className="text-zinc-500 font-bold uppercase text-[8px] tracking-wider px-1">DURATION:</span>
                                <select
                                  value={banType}
                                  onChange={(e) => setBanType(e.target.value as 'temporary' | 'permanent')}
                                  className="bg-zinc-900 text-zinc-300 border-none rounded text-[10px] px-1.5 py-0.5 focus:outline-none"
                                >
                                  <option value="temporary">Temporary</option>
                                  <option value="permanent">Permanent</option>
                                </select>

                                {banType === 'temporary' && (
                                  <input
                                    type="number"
                                    value={banDays}
                                    onChange={(e) => setBanDays(Math.max(1, parseInt(e.target.value) || 15))}
                                    className="w-12 bg-zinc-900 text-zinc-300 border-none rounded text-[10px] px-1 py-0.5 text-center focus:outline-none font-bold"
                                    min={1}
                                  />
                                )}
                                {banType === 'temporary' && <span className="text-zinc-500 text-[9px] pr-1">Days</span>}
                              </div>

                              <button
                                onClick={() => handleBlockCommunity(comm.id, banType, banDays)}
                                disabled={actioningId === comm.id}
                                className="px-3 py-2 bg-rose-950/20 hover:bg-rose-950/40 border border-rose-500/20 hover:border-rose-500 text-rose-400 text-[10px] font-bold rounded uppercase tracking-wider flex items-center gap-1 transition-colors cursor-pointer"
                              >
                                <Lock className="w-3.5 h-3.5" />
                                <span>Apply Quarantine Block</span>
                              </button>
                            </div>

                            {/* Dismiss Reports */}
                            <div className="ml-auto">
                              <button
                                onClick={() => handleDismissCommunityReports(comm.id)}
                                disabled={actioningId === comm.id}
                                className="px-3.5 py-2 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-300 text-[10px] font-bold rounded uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer"
                              >
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                                <span>Dismiss All Complaints</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* TAB CONTENT: BLOCKED LIST */}
            {activeTab === 'blocked' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-zinc-900/60 pb-2">
                  <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-black flex items-center gap-2">
                    <Lock className="w-4 h-4 text-rose-400" />
                    Quarantined / Suspended Communities
                  </span>
                </div>

                {isLoading ? (
                  <div className="text-center py-12 text-xs text-zinc-500 flex items-center justify-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin text-rose-500" />
                    <span>Analyzing database blocks...</span>
                  </div>
                ) : blockedCommunitiesList.length === 0 ? (
                  <div className="border border-zinc-900 bg-zinc-950/20 text-center py-16 rounded-xl text-xs text-zinc-500 italic">
                    No communities are currently quarantined under security policies.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3">
                    {blockedCommunitiesList.map((comm) => {
                      const creatorIp = comm.createdByIp || '127.0.0.1';
                      const creatorImei = comm.createdByImei || getDeterministicImei(comm.id);
                      const creatorSerial = comm.createdBySerial || getDeterministicSerial(comm.id, 'COMM-CREATOR');

                      return (
                        <div 
                          key={comm.id}
                          className="bg-zinc-950 border border-rose-500/10 hover:border-rose-500/25 p-4 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all"
                        >
                          <div className="space-y-1.5 flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-zinc-200 text-xs">
                                {comm.name}
                              </span>
                              <span className="px-1.5 py-0.5 rounded bg-rose-950/30 border border-rose-500/20 text-rose-400 font-bold uppercase text-[7.5px] tracking-widest flex items-center gap-1 font-mono">
                                <ShieldAlert className="w-2.5 h-2.5" />
                                <span>SUSPENDED</span>
                              </span>
                            </div>

                            <p className="text-[10.5px] text-zinc-500 font-sans leading-relaxed">
                              {comm.description || 'No description.'}
                            </p>

                            <div className="text-[10px] text-emerald-400 flex flex-wrap items-center gap-2 pt-0.5 font-mono">
                              <Clock className="w-3.5 h-3.5 text-emerald-500" />
                              <span>
                                <strong>TIME REMAINING:</strong>{' '}
                                <span className="font-bold underline text-white">
                                  {comm.blockedUntil ? formatTimeLeft(comm.blockedUntil) : 'Permanent Block'}
                                </span>
                              </span>
                              <span className="text-zinc-800">|</span>
                              <span className="text-[9px] text-zinc-500 uppercase">
                                CREATOR IMEI: <strong className="text-zinc-400">{creatorImei}</strong>
                              </span>
                            </div>
                          </div>

                          <div className="shrink-0 flex items-center gap-2 self-end md:self-auto font-mono">
                            <button
                              onClick={() => handleUnblockCommunity(comm.id)}
                              disabled={actioningId === comm.id}
                              className="px-3 py-1.5 bg-emerald-950/20 border border-emerald-500/25 hover:border-emerald-500 hover:bg-emerald-950/40 text-emerald-400 text-[10px] font-bold rounded transition-colors uppercase tracking-wider cursor-pointer flex items-center gap-1"
                              title="Lift community ban"
                            >
                              <Unlock className="w-3.5 h-3.5" />
                              <span>Lift Block</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
