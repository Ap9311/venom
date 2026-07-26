/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  doc, 
  deleteDoc, 
  getDocs,
  writeBatch,
  updateDoc,
  where
} from 'firebase/firestore';
import { 
  Trash2, 
  Lock, 
  Globe, 
  Users, 
  Search, 
  Eye, 
  ShieldAlert, 
  ShieldCheck, 
  ArrowLeft, 
  Key,
  Database,
  Activity,
  Cpu,
  RefreshCw,
  ExternalLink,
  Edit,
  Save,
  Plus,
  Minus,
  Settings,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface AdminCommunitiesProps {
  onNavigateHome: () => void;
}

export const AdminCommunities: React.FC<AdminCommunitiesProps> = ({ onNavigateHome }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);

  // Firestore community documents
  const [communities, setCommunities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedComm, setSelectedComm] = useState<any | null>(null);
  
  // Community active chats state
  const [activeChats, setActiveChats] = useState<any[]>([]);
  const [loadingChats, setLoadingChats] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');

  // Community parameter editing states
  const [isEditingComm, setIsEditingComm] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editImageUrl, setEditImageUrl] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editArea, setEditArea] = useState('');
  const [editAllowUserPost, setEditAllowUserPost] = useState(true);
  const [editTotalReviews, setEditTotalReviews] = useState<number>(0);
  const [blockType, setBlockType] = useState<'none' | 'temporary' | 'permanent'>('none');
  const [blockDays, setBlockDays] = useState<number>(1);
  const [editUserLimit, setEditUserLimit] = useState('');
  const [editCreatedByIp, setEditCreatedByIp] = useState('');
  const [editCreatedByImei, setEditCreatedByImei] = useState('');
  const [editCreatedBySerial, setEditCreatedBySerial] = useState('');
  const [editCreatedByDeviceType, setEditCreatedByDeviceType] = useState('DESKTOP');
  const [editReportsCount, setEditReportsCount] = useState<number>(0);

  // Reports states for selected community
  const [commReports, setCommReports] = useState<any[]>([]);
  const [loadingReports, setLoadingReports] = useState(false);

  // Chat parameter editing states
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editChatContent, setEditChatContent] = useState('');
  const [editChatLikes, setEditChatLikes] = useState<number>(0);
  const [editChatComments, setEditChatComments] = useState<number>(0);
  const [editChatReports, setEditChatReports] = useState<number>(0);
  const [editChatImageUrl, setEditChatImageUrl] = useState('');
  const [editChatIp, setEditChatIp] = useState('');
  const [editChatImei, setEditChatImei] = useState('');
  const [editChatSerial, setEditChatSerial] = useState('');
  const [editChatDeviceType, setEditChatDeviceType] = useState('DESKTOP');
  const [editChatMsgType, setEditChatMsgType] = useState('text');

  // Check existing session auth
  useEffect(() => {
    const authSession = sessionStorage.getItem('venom_admin_auth');
    if (authSession === 'true') {
      setIsAuthenticated(true);
    }
  }, []);

  // Listen to all communities (including blocked ones)
  useEffect(() => {
    if (!db) return;
    setLoading(true);

    const q = query(collection(db, 'communities'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      }));
      setCommunities(list);
      setLoading(false);
    }, (error) => {
      console.error('Error fetching communities for admin:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Listen to chats of selected community
  useEffect(() => {
    if (!db || !selectedComm) {
      setActiveChats([]);
      return;
    }

    setLoadingChats(true);
    const chatsRef = collection(db, 'communities', selectedComm.id, 'chats');
    const q = query(chatsRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      }));
      setActiveChats(list);
      setLoadingChats(false);
    }, (error) => {
      console.error('Error fetching chats for admin:', error);
      setLoadingChats(false);
    });

    return () => unsubscribe();
  }, [selectedComm]);

  // Synchronize editing state whenever selection changes
  useEffect(() => {
    if (selectedComm) {
      setEditName(selectedComm.name || '');
      setEditDesc(selectedComm.description || '');
      setEditImageUrl(selectedComm.imageUrl || '');
      setEditPassword(selectedComm.password || '');
      setEditArea(selectedComm.religion || '');
      setEditAllowUserPost(selectedComm.allowUserPost !== false);
      setEditTotalReviews(selectedComm.viewsCount || 0);
      setEditUserLimit(selectedComm.userLimit ? selectedComm.userLimit.toString() : '');
      setEditCreatedByIp(selectedComm.createdByIp || '');
      setEditCreatedByImei(selectedComm.createdByImei || '');
      setEditCreatedBySerial(selectedComm.createdBySerial || '');
      setEditCreatedByDeviceType(selectedComm.createdByDeviceType || 'DESKTOP');
      setEditReportsCount(selectedComm.reportsCount || 0);
      
      if (selectedComm.isBlocked) {
        if (selectedComm.blockedUntil) {
          setBlockType('temporary');
          const until = typeof selectedComm.blockedUntil.toMillis === 'function' ? selectedComm.blockedUntil.toMillis() : Number(selectedComm.blockedUntil);
          const diffMs = until - Date.now();
          const diffDays = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
          setBlockDays(diffDays);
        } else {
          setBlockType('permanent');
        }
      } else {
        setBlockType('none');
      }
      setIsEditingComm(false);
      setEditingChatId(null);
    }
  }, [selectedComm]);

  // Listen/Fetch reports for selected community
  useEffect(() => {
    if (!db || !selectedComm) {
      setCommReports([]);
      return;
    }

    setLoadingReports(true);
    const reportsRef = collection(db, 'reports');
    const q = query(reportsRef, where('communityId', '==', selectedComm.id));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      }));
      setCommReports(list);
      setLoadingReports(false);
    }, (error) => {
      console.error('Error fetching reports for selected community:', error);
      setLoadingReports(false);
    });

    return () => unsubscribe();
  }, [selectedComm]);

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);

    // Matches main admin credentials
    if (username === 'theakshatpopat' && password === 'Aprt9311') {
      setIsAuthenticated(true);
      sessionStorage.setItem('venom_admin_auth', 'true');
      setUsername('');
      setPassword('');
    } else {
      setLoginError('Invalid Administrator credentials. Security breach log generated.');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    sessionStorage.removeItem('venom_admin_auth');
  };

  // Permanently delete a community and all of its chats/subcollections
  const handleDeleteCommunity = async (commId: string, commName: string) => {
    const confirmDelete = window.confirm(`[CRITICAL DESTRUCTION PROTOCOL]: Are you absolutely certain you want to permanently delete community "${commName}" and all associated nested chats? This operation is irreversible.`);
    if (!confirmDelete) return;

    try {
      // 1. Fetch and batch delete all chats and nested subcollections
      const chatsRef = collection(db, 'communities', commId, 'chats');
      const chatsSnap = await getDocs(chatsRef);

      const batch = writeBatch(db);

      // Delete chats
      for (const chatDoc of chatsSnap.docs) {
        // Fetch comments of each chat first and delete them
        const commentsRef = collection(db, 'communities', commId, 'chats', chatDoc.id, 'comments');
        const commentsSnap = await getDocs(commentsRef);
        commentsSnap.forEach(commentDoc => {
          batch.delete(doc(db, 'communities', commId, 'chats', chatDoc.id, 'comments', commentDoc.id));
        });

        batch.delete(doc(db, 'communities', commId, 'chats', chatDoc.id));
      }

      // Delete visits tracker subcollection
      const visitsRef = collection(db, 'communities', commId, 'visits');
      const visitsSnap = await getDocs(visitsRef);
      visitsSnap.forEach(visitDoc => {
        batch.delete(doc(db, 'communities', commId, 'visits', visitDoc.id));
      });

      // 2. Delete parent community document
      batch.delete(doc(db, 'communities', commId));

      await batch.commit();

      alert(`Community "${commName}" successfully purged from database core.`);
      if (selectedComm?.id === commId) {
        setSelectedComm(null);
      }
    } catch (err: any) {
      console.error('purging failed:', err);
      alert(`Purging failed: ${err.message || err}`);
    }
  };

  // Permanently delete an individual chat message in a community
  const handleDeleteChat = async (chatId: string) => {
    if (!selectedComm) return;

    const confirmDelete = window.confirm('[ACTION REQUIRED]: Are you sure you want to permanently delete this individual chat dispatch?');
    if (!confirmDelete) return;

    try {
      const batch = writeBatch(db);

      // Fetch comments to delete them in batch
      const commentsRef = collection(db, 'communities', selectedComm.id, 'chats', chatId, 'comments');
      const commentsSnap = await getDocs(commentsRef);
      commentsSnap.forEach(commentDoc => {
        batch.delete(doc(db, 'communities', selectedComm.id, 'chats', chatId, 'comments', commentDoc.id));
      });

      // Delete the chat itself
      batch.delete(doc(db, 'communities', selectedComm.id, 'chats', chatId));

      await batch.commit();
      alert('Message dispatch successfully deleted.');
    } catch (err: any) {
      console.error('Delete failed:', err);
      alert(`Delete failed: ${err.message || err}`);
    }
  };

  // Save modified community data
  const handleSaveCommunity = async () => {
    if (!selectedComm) return;
    try {
      const commRef = doc(db, 'communities', selectedComm.id);
      
      const updateData: any = {
        name: editName.trim(),
        description: editDesc.trim(),
        imageUrl: editImageUrl.trim(),
        password: editPassword.trim(),
        religion: editArea.trim(),
        allowUserPost: editAllowUserPost,
        viewsCount: Number(editTotalReviews),
        userLimit: editUserLimit ? parseInt(editUserLimit) : null,
        createdByIp: editCreatedByIp.trim(),
        createdByImei: editCreatedByImei.trim(),
        createdBySerial: editCreatedBySerial.trim(),
        createdByDeviceType: editCreatedByDeviceType,
        reportsCount: Number(editReportsCount)
      };

      if (blockType === 'permanent') {
        updateData.isBlocked = true;
        updateData.blockedUntil = null;
      } else if (blockType === 'temporary') {
        updateData.isBlocked = true;
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + Number(blockDays));
        updateData.blockedUntil = futureDate;
      } else {
        updateData.isBlocked = false;
        updateData.blockedUntil = null;
      }

      await updateDoc(commRef, updateData);
      
      // Update local selection
      setSelectedComm({
        ...selectedComm,
        ...updateData
      });

      setIsEditingComm(false);
      alert('Community parameters saved successfully!');
    } catch (err: any) {
      console.error('Failed to update community:', err);
      alert('Update failed: ' + err.message);
    }
  };

  // Save modified chat message data
  const handleSaveChat = async (chatId: string) => {
    if (!selectedComm) return;
    try {
      const chatRef = doc(db, 'communities', selectedComm.id, 'chats', chatId);
      await updateDoc(chatRef, {
        content: editChatContent.trim(),
        likesCount: Number(editChatLikes),
        commentsCount: Number(editChatComments),
        reportsCount: Number(editChatReports),
        imageUrl: editChatImageUrl.trim(),
        createdByIp: editChatIp.trim(),
        createdByImei: editChatImei.trim(),
        createdBySerial: editChatSerial.trim(),
        createdByDeviceType: editChatDeviceType,
        type: editChatMsgType
      });
      setEditingChatId(null);
      alert('Chat payload updated successfully!');
    } catch (err: any) {
      console.error('Failed to update chat:', err);
      alert('Update failed: ' + err.message);
    }
  };

  // Dismiss report on Admin Community panel
  const handleDismissReport = async (reportId: string, chatId?: string) => {
    if (!selectedComm) return;
    try {
      // 1. Delete the report document
      await deleteDoc(doc(db, 'reports', reportId));

      // 2. Decrement reportsCount on parent community
      const commRef = doc(db, 'communities', selectedComm.id);
      const newReportsCount = Math.max(0, (selectedComm.reportsCount || 0) - 1);
      await updateDoc(commRef, {
        reportsCount: newReportsCount
      });
      setSelectedComm({
        ...selectedComm,
        reportsCount: newReportsCount
      });

      // 3. Decrement reportsCount on the chat if applicable
      if (chatId) {
        const chatRef = doc(db, 'communities', selectedComm.id, 'chats', chatId);
        try {
          const chatDoc = activeChats.find(c => c.id === chatId);
          if (chatDoc) {
            await updateDoc(chatRef, {
              reportsCount: Math.max(0, (chatDoc.reportsCount || 0) - 1)
            });
          }
        } catch (chatErr) {
          console.error("Failed to decrement chat reportsCount:", chatErr);
        }
      }

      alert('Report successfully dismissed.');
    } catch (err: any) {
      console.error('Failed to dismiss report:', err);
      alert('Failed to dismiss report: ' + err.message);
    }
  };

  const filteredComms = communities.filter(c => {
    if (searchTerm.trim() !== '') {
      const query = searchTerm.toLowerCase();
      return (
        c.name?.toLowerCase().includes(query) ||
        c.description?.toLowerCase().includes(query) ||
        c.religion?.toLowerCase().includes(query) ||
        c.createdByIp?.toLowerCase().includes(query) ||
        c.createdByImei?.toLowerCase().includes(query)
      );
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-[#030303] text-zinc-300 font-mono flex flex-col selection:bg-emerald-500/30 selection:text-emerald-100">
      
      {/* HEADER BAR */}
      <header className="border-b border-zinc-900 bg-black/60 backdrop-blur-md sticky top-0 z-40 px-4 py-3">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div 
            className="flex items-center gap-3 cursor-pointer select-none"
            onClick={onNavigateHome}
          >
            <img 
              src="https://i.ibb.co/RpqhT7QZ/14893-removebg-preview.png" 
              alt="Venom Logo" 
              className="w-11 h-11 object-contain drop-shadow-[0_0_10px_rgba(16,185,129,0.4)]"
              referrerPolicy="no-referrer"
            />
            <div>
              <h1 className="text-sm font-black tracking-widest text-emerald-400 leading-tight">
                VENOM SECURITY TERMINAL
              </h1>
              <p className="text-[9px] text-zinc-500 font-mono tracking-wider uppercase leading-none mt-0.5">
                COMMUNITIES SECTOR [admin/communities]
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                window.history.pushState({}, '', '/admin');
                window.dispatchEvent(new PopStateEvent('popstate'));
              }}
              className="px-3 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold rounded transition-colors uppercase tracking-wider cursor-pointer flex items-center gap-1"
            >
              <span>Admin Portal</span>
            </button>
            <button
              onClick={onNavigateHome}
              className="px-3 py-1 bg-zinc-950 hover:bg-zinc-900 border border-zinc-900 text-zinc-400 hover:text-zinc-200 text-[10px] font-bold rounded transition-colors uppercase tracking-wider cursor-pointer"
            >
              Feed Home
            </button>
            {isAuthenticated && (
              <button
                onClick={handleLogout}
                className="px-3 py-1 bg-rose-950/15 hover:bg-rose-950/30 border border-rose-500/20 text-rose-400 text-[10px] font-bold rounded transition-colors uppercase tracking-wider cursor-pointer"
              >
                LOGOUT
              </button>
            )}
          </div>
        </div>
      </header>

      {/* VIEWPORT CONTROLLER */}
      <AnimatePresence mode="wait">
        {!isAuthenticated ? (
          /* LOGIN */
          <motion.div 
            key="login"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="flex-1 flex items-center justify-center p-4 min-h-[70vh]"
          >
            <div className="w-full max-w-sm bg-zinc-950 border border-zinc-900 rounded-xl p-6 shadow-2xl relative overflow-hidden">
              <div className="flex flex-col items-center justify-center text-center mb-6">
                <div className="w-10 h-10 rounded-full bg-zinc-900 border border-zinc-850 flex items-center justify-center mb-2">
                  <Lock className="w-4 h-4 text-emerald-400" />
                </div>
                <h2 className="text-xs font-black tracking-widest text-zinc-100 uppercase">ACCESS DECRYPTION</h2>
                <p className="text-[9px] text-zinc-500 mt-1 uppercase">Enter credentials for admin/communities</p>
              </div>

              <form onSubmit={handleLoginSubmit} className="space-y-4">
                {loginError && (
                  <div className="bg-rose-950/20 border border-rose-500/20 text-rose-400 text-[9px] p-2.5 rounded border-l-2 border-l-rose-500 font-mono">
                    {loginError}
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-[8px] uppercase text-zinc-500 block font-bold">ADMIN IDENTITY</label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    placeholder="Enter system ID..."
                    className="w-full bg-zinc-900 border border-zinc-850 rounded px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-emerald-500/30 transition-colors"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[8px] uppercase text-zinc-500 block font-bold">CRYPTOGRAPHIC KEY</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="Enter passphrase..."
                    className="w-full bg-zinc-900 border border-zinc-850 rounded px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-emerald-500/30 transition-colors"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-black text-[10px] rounded transition-all uppercase mt-6 tracking-widest flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Key className="w-3.5 h-3.5" />
                  <span>INITIALIZE CONSOLE</span>
                </button>
              </form>
            </div>
          </motion.div>
        ) : (
          /* WORKSPACE */
          <motion.main 
            key="workspace"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex-1 max-w-7xl w-full mx-auto px-4 py-6 space-y-6"
          >
            
            {/* SEARCH AND CONTROL ROW */}
            <div className="bg-zinc-950 border border-zinc-900 p-4 rounded-xl flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-emerald-950/20 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                  <Database className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-xs font-black tracking-wider uppercase text-zinc-100">COMMUNITIES DISPATCH CORES</h2>
                  <p className="text-[9px] text-zinc-500 uppercase mt-0.5">Purge, inspect, and quarantine decentralized group channels.</p>
                </div>
              </div>

              <div className="relative w-full md:w-80">
                <input
                  type="text"
                  placeholder="Filter by Name, IP, IMEI, Region..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-850 focus:border-emerald-500/30 rounded px-3 py-1.5 pl-8 text-xs text-zinc-300 focus:outline-none placeholder-zinc-700 transition-colors"
                />
                <Search className="w-3.5 h-3.5 text-zinc-600 absolute left-2.5 top-2.5" />
              </div>
            </div>

            {/* DASHBOARD GRID */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* LEFT COLUMN: LIST OF ALL COMMUNITIES (5/12) */}
              <div className={`lg:col-span-5 bg-zinc-950 border border-zinc-900 rounded-xl flex flex-col h-[75vh] lg:max-h-[70vh] overflow-hidden ${
                selectedComm ? 'hidden lg:flex' : 'flex'
              }`}>
                <div className="p-4 border-b border-zinc-900 bg-zinc-950 shrink-0 flex justify-between items-center">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">SECTOR INDEX</span>
                  <span className="text-[10px] font-mono bg-zinc-900 text-zinc-500 px-2 py-0.5 rounded">
                    Total: {communities.length}
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
                  {loading ? (
                    <div className="text-center py-8 text-zinc-600 text-[10px]">SYNCING CORES...</div>
                  ) : filteredComms.length === 0 ? (
                    <div className="text-center py-8 text-zinc-600 text-[10px] uppercase">No matching sectors</div>
                  ) : (
                    filteredComms.map((c) => {
                      const isSelected = selectedComm?.id === c.id;
                      const hasFlags = (c.reportsCount || 0) > 0;
                      return (
                        <div
                          key={c.id}
                          onClick={() => setSelectedComm(c)}
                          className={`p-3 rounded-lg border cursor-pointer transition-all flex items-start gap-3 relative group ${
                            isSelected
                              ? 'bg-emerald-500/[0.02] border-emerald-500/40'
                              : 'bg-zinc-900/30 border-zinc-900 hover:border-zinc-800'
                          }`}
                        >
                          <img
                            src={c.imageUrl}
                            alt={c.name}
                            className="w-10 h-10 rounded object-cover bg-zinc-900 border border-zinc-800 shrink-0"
                            referrerPolicy="no-referrer"
                          />

                          <div className="min-w-0 flex-1">
                            <h3 className="text-xs font-bold text-zinc-200 group-hover:text-emerald-400 transition-colors truncate">
                              {c.name}
                            </h3>
                            <p className="text-[9px] text-zinc-600 truncate mt-0.5 uppercase">
                              Region: {c.religion} | password: {c.password ? `"${c.password}"` : 'none'}
                            </p>
                            
                            <div className="flex gap-2 items-center mt-2 flex-wrap">
                              {c.isBlocked && (
                                <span className="text-[8px] bg-rose-950/20 text-rose-400 border border-rose-500/20 px-1.5 py-0.5 rounded flex items-center gap-0.5 font-bold uppercase shrink-0">
                                  <ShieldAlert className="w-2.5 h-2.5" />
                                  <span>BLOCKED</span>
                                </span>
                              )}
                              {hasFlags && (
                                <span className="text-[8px] bg-amber-950/20 text-amber-400 border border-amber-500/20 px-1.5 py-0.5 rounded font-bold shrink-0">
                                  FLAGS: {c.reportsCount || 0}/100
                                </span>
                              )}
                              <span className="text-[8px] bg-zinc-900 text-zinc-500 px-1.5 py-0.5 rounded font-bold shrink-0">
                                REVIEWS: {c.viewsCount || 0}
                              </span>
                            </div>
                          </div>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteCommunity(c.id, c.name);
                            }}
                            className="p-1.5 text-zinc-600 hover:text-rose-400 transition-colors shrink-0 rounded hover:bg-rose-950/10 cursor-pointer"
                            title="PERMANENTLY DELETE COMMUNITY"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* RIGHT COLUMN: DETAILED DISPATCH INSPECT PANEL (7/12) */}
              <div className={`lg:col-span-7 bg-zinc-950 border border-zinc-900 rounded-xl flex flex-col h-[75vh] lg:max-h-[70vh] overflow-hidden ${
                selectedComm ? 'flex' : 'hidden lg:flex'
              }`}>
                {selectedComm ? (
                  <>
                    {/* Selected Community Metadata Inspector Header */}
                    <div className="p-4 border-b border-zinc-900 bg-zinc-950 shrink-0">
                      <div className="flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setSelectedComm(null)}
                            className="lg:hidden p-1.5 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 rounded text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
                          >
                            <ArrowLeft className="w-3.5 h-3.5" />
                          </button>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">SECTOR TELEMETRY INSPECTOR</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setIsEditingComm(!isEditingComm)}
                            className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider bg-zinc-900 border border-zinc-800 hover:border-emerald-500/20 px-2.5 py-1 rounded cursor-pointer transition-colors text-zinc-400 hover:text-emerald-400"
                          >
                            {isEditingComm ? (
                              <>
                                <X className="w-3 h-3" />
                                <span>Cancel</span>
                              </>
                            ) : (
                              <>
                                <Edit className="w-3 h-3" />
                                <span>Edit Parameters</span>
                              </>
                            )}
                          </button>
                          <span className="text-[9px] font-mono text-zinc-500 uppercase">ID: {selectedComm.id}</span>
                        </div>
                      </div>

                      {isEditingComm ? (
                        /* COMMUNITY PARAMETERS FORM */
                        <div className="mt-4 p-4 bg-black/40 border border-zinc-900 rounded-lg space-y-4 text-xs overflow-y-auto flex-1 scrollbar-thin max-h-[45vh] lg:max-h-none">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[8px] uppercase text-zinc-600 font-bold mb-1">Community Name</label>
                              <input
                                type="text"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                className="w-full bg-zinc-950 border border-zinc-900 rounded px-2.5 py-1.5 text-zinc-300 focus:outline-none focus:border-emerald-500/30 font-sans"
                              />
                            </div>
                            <div>
                              <label className="block text-[8px] uppercase text-zinc-600 font-bold mb-1">Area / Religion / Region</label>
                              <input
                                type="text"
                                value={editArea}
                                onChange={(e) => setEditArea(e.target.value)}
                                className="w-full bg-zinc-950 border border-zinc-900 rounded px-2.5 py-1.5 text-zinc-300 focus:outline-none focus:border-emerald-500/30 font-sans"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-[8px] uppercase text-zinc-600 font-bold mb-1">Description</label>
                            <textarea
                              value={editDesc}
                              onChange={(e) => setEditDesc(e.target.value)}
                              rows={2}
                              className="w-full bg-zinc-950 border border-zinc-900 rounded px-2.5 py-1.5 text-zinc-300 focus:outline-none focus:border-emerald-500/30 font-sans"
                            />
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[8px] uppercase text-zinc-600 font-bold mb-1">Logo image url</label>
                              <input
                                type="text"
                                value={editImageUrl}
                                onChange={(e) => setEditImageUrl(e.target.value)}
                                className="w-full bg-zinc-950 border border-zinc-900 rounded px-2.5 py-1.5 text-zinc-300 focus:outline-none focus:border-emerald-500/30 text-[10px]"
                              />
                            </div>
                            <div>
                              <label className="block text-[8px] uppercase text-zinc-600 font-bold mb-1">Access password (empty = public)</label>
                              <input
                                type="text"
                                value={editPassword}
                                onChange={(e) => setEditPassword(e.target.value)}
                                className="w-full bg-zinc-950 border border-zinc-900 rounded px-2.5 py-1.5 text-zinc-300 focus:outline-none focus:border-emerald-500/30 text-[10px]"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                            <div>
                              <label className="block text-[8px] uppercase text-zinc-600 font-bold mb-1">Member Posting Policy</label>
                              <button
                                onClick={() => setEditAllowUserPost(!editAllowUserPost)}
                                className={`w-full text-center py-1.5 rounded border text-[9px] uppercase font-bold tracking-wider transition-all ${
                                  editAllowUserPost
                                    ? 'bg-emerald-950/15 border-emerald-500/20 text-emerald-400'
                                    : 'bg-zinc-950 border-zinc-900 text-zinc-500'
                                }`}
                              >
                                {editAllowUserPost ? 'MEMBERS CAN POST' : 'OWNER ONLY POSTS'}
                              </button>
                            </div>
                            <div>
                              <label className="block text-[8px] uppercase text-zinc-600 font-bold mb-1">Total Reviews</label>
                              <div className="flex items-center bg-zinc-950 border border-zinc-900 rounded overflow-hidden">
                                <button
                                  type="button"
                                  onClick={() => setEditTotalReviews(prev => Math.max(0, prev - 1))}
                                  className="px-3 py-1.5 bg-zinc-900 text-zinc-400 hover:text-rose-400 border-r border-zinc-900 active:bg-zinc-850 cursor-pointer"
                                >
                                  <Minus className="w-3.5 h-3.5" />
                                </button>
                                <input
                                  type="number"
                                  value={editTotalReviews}
                                  onChange={(e) => setEditTotalReviews(Math.max(0, Number(e.target.value)))}
                                  className="w-full text-center bg-transparent focus:outline-none font-bold text-zinc-300 text-xs"
                                />
                                <button
                                  type="button"
                                  onClick={() => setEditTotalReviews(prev => prev + 1)}
                                  className="px-3 py-1.5 bg-zinc-900 text-zinc-400 hover:text-emerald-400 border-l border-zinc-900 active:bg-zinc-850 cursor-pointer"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* ADVANCED METADATA ROW */}
                          <div className="pt-2 border-t border-zinc-900/60">
                            <label className="block text-[8px] uppercase text-zinc-600 font-bold mb-1.5">Advanced Community Metadata</label>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                              <div>
                                <label className="block text-[8px] uppercase text-zinc-600 font-bold mb-1">User Limit (0 = unlimited)</label>
                                <input
                                  type="number"
                                  placeholder="Unlimited"
                                  value={editUserLimit}
                                  onChange={(e) => setEditUserLimit(e.target.value)}
                                  className="w-full bg-zinc-950 border border-zinc-900 rounded px-2.5 py-1.5 text-zinc-300 focus:outline-none focus:border-emerald-500/30 text-[10px]"
                                />
                              </div>
                              <div>
                                <label className="block text-[8px] uppercase text-zinc-600 font-bold mb-1">Reports Count</label>
                                <input
                                  type="number"
                                  value={editReportsCount}
                                  onChange={(e) => setEditReportsCount(Math.max(0, Number(e.target.value)))}
                                  className="w-full bg-zinc-950 border border-zinc-900 rounded px-2.5 py-1.5 text-zinc-300 focus:outline-none focus:border-emerald-500/30 text-[10px]"
                                />
                              </div>
                              <div>
                                <label className="block text-[8px] uppercase text-zinc-600 font-bold mb-1">Creator Device Type</label>
                                <select
                                  value={editCreatedByDeviceType}
                                  onChange={(e) => setEditCreatedByDeviceType(e.target.value)}
                                  className="w-full bg-zinc-950 border border-zinc-900 rounded px-2.5 py-1.5 text-zinc-300 focus:outline-none focus:border-emerald-500/30 text-[10px]"
                                >
                                  <option value="DESKTOP">DESKTOP / LAPTOP</option>
                                  <option value="MOBILE">MOBILE DEVICE</option>
                                </select>
                              </div>
                              <div>
                                <label className="block text-[8px] uppercase text-zinc-600 font-bold mb-1">Creator IP Address</label>
                                <input
                                  type="text"
                                  value={editCreatedByIp}
                                  onChange={(e) => setEditCreatedByIp(e.target.value)}
                                  className="w-full bg-zinc-950 border border-zinc-900 rounded px-2.5 py-1.5 text-zinc-300 focus:outline-none focus:border-emerald-500/30 text-[10px]"
                                />
                              </div>
                              <div>
                                <label className="block text-[8px] uppercase text-zinc-600 font-bold mb-1">Creator IMEI</label>
                                <input
                                  type="text"
                                  value={editCreatedByImei}
                                  onChange={(e) => setEditCreatedByImei(e.target.value)}
                                  className="w-full bg-zinc-950 border border-zinc-900 rounded px-2.5 py-1.5 text-zinc-300 focus:outline-none focus:border-emerald-500/30 text-[10px]"
                                />
                              </div>
                              <div>
                                <label className="block text-[8px] uppercase text-zinc-600 font-bold mb-1">Creator Serial Number</label>
                                <input
                                  type="text"
                                  value={editCreatedBySerial}
                                  onChange={(e) => setEditCreatedBySerial(e.target.value)}
                                  className="w-full bg-zinc-950 border border-zinc-900 rounded px-2.5 py-1.5 text-zinc-300 focus:outline-none focus:border-emerald-500/30 text-[10px]"
                                />
                              </div>
                            </div>
                          </div>

                          {/* BLOCKING MANAGER */}
                          <div className="pt-2 border-t border-zinc-900/60">
                            <label className="block text-[8px] uppercase text-zinc-600 font-bold mb-1.5">Sector Enforcement Status</label>
                            <div className="grid grid-cols-3 gap-2">
                              <button
                                onClick={() => setBlockType('none')}
                                className={`py-1.5 rounded border text-[8px] font-bold uppercase tracking-wider transition-all ${
                                  blockType === 'none'
                                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                                    : 'bg-zinc-950 border-zinc-900 text-zinc-500 hover:border-zinc-850'
                                }`}
                              >
                                Active (No Block)
                              </button>
                              <button
                                onClick={() => setBlockType('temporary')}
                                className={`py-1.5 rounded border text-[8px] font-bold uppercase tracking-wider transition-all ${
                                  blockType === 'temporary'
                                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                                    : 'bg-zinc-950 border-zinc-900 text-zinc-500 hover:border-zinc-850'
                                }`}
                              >
                                Temp Block
                              </button>
                              <button
                                onClick={() => setBlockType('permanent')}
                                className={`py-1.5 rounded border text-[8px] font-bold uppercase tracking-wider transition-all ${
                                  blockType === 'permanent'
                                    ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                                    : 'bg-zinc-950 border-zinc-900 text-zinc-500 hover:border-zinc-850'
                                }`}
                              >
                                Permanent Block
                              </button>
                            </div>

                            {blockType === 'temporary' && (
                              <div className="mt-2.5 p-2 bg-amber-950/5 border border-amber-500/10 rounded flex items-center justify-between gap-3 animate-fadeIn">
                                <span className="text-[8px] uppercase text-amber-500 font-bold font-mono">Temporary ban duration:</span>
                                <div className="flex items-center bg-zinc-950 border border-zinc-900 rounded overflow-hidden h-7">
                                  <button
                                    onClick={() => setBlockDays(prev => Math.max(1, prev - 1))}
                                    className="px-2 py-0.5 bg-zinc-900 text-zinc-400 hover:text-amber-400 border-r border-zinc-900 h-full cursor-pointer"
                                  >
                                    <Minus className="w-3 h-3" />
                                  </button>
                                  <span className="px-3 text-xs font-bold font-mono text-zinc-300 min-w-[50px] text-center">{blockDays} days</span>
                                  <button
                                    onClick={() => setBlockDays(prev => prev + 1)}
                                    className="px-2 py-0.5 bg-zinc-900 text-zinc-400 hover:text-amber-400 border-l border-zinc-900 h-full cursor-pointer"
                                  >
                                    <Plus className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>

                          <div className="flex gap-2 pt-2">
                            <button
                              onClick={handleSaveCommunity}
                              className="flex-1 py-2 bg-emerald-500 text-zinc-950 text-[10px] font-bold tracking-widest uppercase rounded cursor-pointer hover:bg-emerald-400 transition-all active:scale-[0.98] flex items-center justify-center gap-1.5"
                            >
                              <Save className="w-3.5 h-3.5" />
                              <span>Commit Settings</span>
                            </button>
                            <button
                              onClick={() => setIsEditingComm(false)}
                              className="px-4 py-2 bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200 text-[10px] uppercase font-bold rounded cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* VISUAL METADATA BANNER */
                        <div className="mt-3 flex items-start gap-3 p-3 bg-zinc-900/10 border border-zinc-900/40 rounded-lg">
                          <img
                            src={selectedComm.imageUrl}
                            alt={selectedComm.name}
                            className="w-12 h-12 rounded-lg object-cover border border-zinc-850 shrink-0"
                            referrerPolicy="no-referrer"
                          />
                          <div className="min-w-0 flex-1">
                            <h2 className="text-xs font-bold text-zinc-200 tracking-wide font-sans">{selectedComm.name}</h2>
                            <p className="text-[10px] text-zinc-500 mt-1 font-sans leading-relaxed line-clamp-2">{selectedComm.description || 'No description provided.'}</p>
                            
                            <div className="flex flex-wrap gap-2 items-center mt-2">
                              <span className="text-[8px] bg-emerald-500/5 text-emerald-400 border border-emerald-500/10 px-2 py-0.5 rounded uppercase font-bold tracking-wider font-mono">
                                Area: {selectedComm.religion || 'General'}
                              </span>
                              <span className="text-[8px] bg-zinc-950 text-zinc-500 px-2 py-0.5 rounded font-bold uppercase font-mono">
                                Reviews: {selectedComm.viewsCount || 0}
                              </span>
                              {selectedComm.isBlocked && (
                                <span className="text-[8px] bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2 py-0.5 rounded font-bold uppercase font-mono flex items-center gap-0.5">
                                  <ShieldAlert className="w-2.5 h-2.5" />
                                  <span>
                                    {selectedComm.blockedUntil ? `TEMP BLOCK (${blockDays} DAYS LEFT)` : 'PERM BLOCKED'}
                                  </span>
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Info grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 p-3 bg-[#050505] border border-zinc-900 rounded-lg">
                        <div>
                          <span className="text-[8px] text-zinc-600 block uppercase">CREATOR IP</span>
                          <span className="text-[10px] font-bold text-zinc-400">{selectedComm.createdByIp || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="text-[8px] text-zinc-600 block uppercase">CREATOR DEVICE DETECTED</span>
                          <span className="text-[10px] font-bold text-zinc-400 truncate block max-w-xs">
                            {selectedComm.createdByDeviceType === 'MOBILE' ? (
                              `IMEI: ${selectedComm.createdByImei || 'N/A'}`
                            ) : (
                              `S/N: ${selectedComm.createdBySerial || (() => {
                                const creatorImei = selectedComm.createdByImei || '359182371283718';
                                let hash = 0;
                                for (let i = 0; i < creatorImei.length; i++) {
                                  hash = creatorImei.charCodeAt(i) + ((hash << 5) - hash);
                                }
                                const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
                                let creatorSerial = 'VSN';
                                for (let i = 0; i < 10; i++) {
                                  creatorSerial += chars.charAt(Math.abs((hash + i * 23) % chars.length));
                                }
                                return creatorSerial;
                              })()}`
                            )}
                          </span>
                        </div>
                        <div>
                          <span className="text-[8px] text-zinc-600 block uppercase">GATE LOCK</span>
                          <span className="text-[10px] font-bold text-zinc-400">{selectedComm.password ? `"${selectedComm.password}"` : 'NONE'}</span>
                        </div>
                        <div>
                          <span className="text-[8px] text-zinc-600 block uppercase">PERMISSIONS</span>
                          <span className="text-[10px] font-bold text-zinc-400">{selectedComm.allowUserPost ? 'MEMBERS CAN POST' : 'OWNER ONLY'}</span>
                        </div>
                      </div>

                      {/* Incident Reports Panel */}
                      {commReports.length > 0 && (
                        <div className="mt-3 p-3 bg-rose-950/10 border border-rose-950/20 rounded-lg space-y-2 text-xs">
                          <div className="flex justify-between items-center pb-1 border-b border-rose-950/20">
                            <span className="text-[9px] font-bold uppercase tracking-wider text-rose-400 flex items-center gap-1">
                              <ShieldAlert className="w-3.5 h-3.5" />
                              <span>ACTIVE COHORT INCIDENT REPORTS ({commReports.length})</span>
                            </span>
                          </div>
                          <div className="space-y-2 max-h-40 overflow-y-auto pr-1 font-mono">
                            {commReports.map((rep) => (
                              <div key={rep.id} className="p-2.5 bg-black/40 border border-rose-950/20 rounded text-[10px] space-y-1">
                                <div className="flex justify-between items-center text-[8px] text-zinc-500">
                                  <span>ID: {rep.id} | TYPE: {rep.chatId ? 'MESSAGE VIOLATION' : 'COMMUNITY VIOLATION'}</span>
                                  <span>{rep.createdAt ? new Date(rep.createdAt).toLocaleString() : 'N/A'}</span>
                                </div>
                                <p className="text-zinc-300 font-bold"><span className="text-rose-400">REASON:</span> {rep.reason}</p>
                                {rep.opinion && <p className="text-zinc-400 font-sans"><span className="text-zinc-600 font-mono">OPINION:</span> {rep.opinion}</p>}
                                {rep.chatContent && (
                                  <p className="text-zinc-500 italic bg-zinc-950/60 p-1.5 rounded mt-1 font-sans">
                                    " {rep.chatContent} "
                                  </p>
                                )}
                                <div className="flex justify-between text-[8px] text-zinc-600 pt-1 border-t border-zinc-900/60 font-mono">
                                  <span>FILER IP: {rep.ip || 'N/A'}</span>
                                  <span>FILER IMEI/SIG: {rep.imei || 'N/A'}</span>
                                </div>
                                <div className="flex flex-wrap gap-1.5 pt-1.5 border-t border-zinc-900/40">
                                  <button
                                    onClick={() => {
                                      const newReason = window.prompt("Change Report Reason:", rep.reason);
                                      if (newReason !== null) {
                                        updateDoc(doc(db, 'reports', rep.id), { reason: newReason.trim() });
                                      }
                                    }}
                                    className="px-2 py-0.5 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-[8px] text-zinc-400 hover:text-emerald-400 cursor-pointer font-bold rounded uppercase transition-colors"
                                  >
                                    Edit Reason
                                  </button>
                                  <button
                                    onClick={() => {
                                      const newOpinion = window.prompt("Change Detailed Opinion:", rep.opinion || '');
                                      if (newOpinion !== null) {
                                        updateDoc(doc(db, 'reports', rep.id), { opinion: newOpinion.trim() });
                                      }
                                    }}
                                    className="px-2 py-0.5 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-[8px] text-zinc-400 hover:text-emerald-400 cursor-pointer font-bold rounded uppercase transition-colors"
                                  >
                                    Edit Opinion
                                  </button>
                                  <button
                                    onClick={() => handleDismissReport(rep.id, rep.chatId)}
                                    className="ml-auto px-2.5 py-0.5 bg-rose-950/20 hover:bg-rose-950/40 border border-rose-500/20 hover:border-rose-400 text-[8px] text-rose-400 hover:text-rose-300 cursor-pointer font-bold rounded uppercase transition-colors"
                                  >
                                    Dismiss Report
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Chats scroll lists */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#020202]">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-500 block">DISPATCH CHATS IN COHORT</span>
                      
                      {loadingChats ? (
                        <div className="text-center py-12 text-zinc-600 text-[10px]">SYNCING MESSAGE CHATS...</div>
                      ) : activeChats.length === 0 ? (
                        <div className="text-center py-12 text-zinc-600 text-[10px] uppercase">COHORT DISPATCH SHELL IS EMPTY</div>
                      ) : (
                        activeChats.map((chat) => {
                          const isMobile = chat.createdByDeviceType === 'MOBILE' || (!chat.createdByDeviceType && chat.createdByImei && !chat.createdBySerial);
                          const dispatcherImei = chat.createdByImei || 'N/A';
                          const dispatcherSerial = chat.createdBySerial || (() => {
                            const imeiVal = chat.createdByImei || '359182371283718';
                            let dispHash = 0;
                            for (let i = 0; i < imeiVal.length; i++) {
                              dispHash = imeiVal.charCodeAt(i) + ((dispHash << 5) - dispHash);
                            }
                            const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
                            let serial = 'VSN';
                            for (let i = 0; i < 10; i++) {
                              serial += chars.charAt(Math.abs((dispHash + i * 23) % chars.length));
                            }
                            return serial;
                          })();

                          const isEditingThisChat = editingChatId === chat.id;

                          return (
                            <div
                              key={chat.id}
                              className="p-3 bg-zinc-950 border border-zinc-900 hover:border-zinc-850 rounded-lg transition-all flex items-start gap-4 relative"
                            >
                              {isEditingThisChat ? (
                                <div className="min-w-0 flex-1 space-y-3 font-sans text-xs">
                                  <span className="text-[8px] font-bold font-mono text-emerald-400 uppercase tracking-widest block">EDIT DISPATCH MESSAGE</span>
                                  
                                  <div>
                                    <label className="block text-[8px] font-mono uppercase text-zinc-600 mb-1">Message Content</label>
                                    <textarea
                                      value={editChatContent}
                                      onChange={(e) => setEditChatContent(e.target.value)}
                                      rows={3}
                                      className="w-full bg-black border border-zinc-900 rounded p-2 text-zinc-200 focus:outline-none focus:border-emerald-500/30 font-sans"
                                    />
                                  </div>

                                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                    <div>
                                      <label className="block text-[8px] font-mono uppercase text-zinc-600 mb-1">Likes Count</label>
                                      <input
                                        type="number"
                                        value={editChatLikes}
                                        onChange={(e) => setEditChatLikes(Math.max(0, Number(e.target.value)))}
                                        className="w-full bg-black border border-zinc-900 rounded p-1.5 text-center text-zinc-200 focus:outline-none"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-[8px] font-mono uppercase text-zinc-600 mb-1">Comments</label>
                                      <input
                                        type="number"
                                        value={editChatComments}
                                        onChange={(e) => setEditChatComments(Math.max(0, Number(e.target.value)))}
                                        className="w-full bg-black border border-zinc-900 rounded p-1.5 text-center text-zinc-200 focus:outline-none"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-[8px] font-mono uppercase text-zinc-600 mb-1">Reports Count</label>
                                      <input
                                        type="number"
                                        value={editChatReports}
                                        onChange={(e) => setEditChatReports(Math.max(0, Number(e.target.value)))}
                                        className="w-full bg-black border border-zinc-900 rounded p-1.5 text-center text-zinc-200 focus:outline-none"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-[8px] font-mono uppercase text-zinc-600 mb-1">Image URL</label>
                                      <input
                                        type="text"
                                        value={editChatImageUrl}
                                        onChange={(e) => setEditChatImageUrl(e.target.value)}
                                        className="w-full bg-black border border-zinc-900 rounded p-1.5 text-zinc-200 focus:outline-none truncate text-[10px]"
                                        placeholder="No image attached"
                                      />
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                    <div>
                                      <label className="block text-[8px] font-mono uppercase text-zinc-600 mb-1">Sender IP Address</label>
                                      <input
                                        type="text"
                                        value={editChatIp}
                                        onChange={(e) => setEditChatIp(e.target.value)}
                                        className="w-full bg-black border border-zinc-900 rounded p-1.5 text-zinc-200 focus:outline-none text-[10px]"
                                        placeholder="Sender IP"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-[8px] font-mono uppercase text-zinc-600 mb-1">Sender IMEI</label>
                                      <input
                                        type="text"
                                        value={editChatImei}
                                        onChange={(e) => setEditChatImei(e.target.value)}
                                        className="w-full bg-black border border-zinc-900 rounded p-1.5 text-zinc-200 focus:outline-none text-[10px]"
                                        placeholder="Sender IMEI"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-[8px] font-mono uppercase text-zinc-600 mb-1">Sender Serial Number</label>
                                      <input
                                        type="text"
                                        value={editChatSerial}
                                        onChange={(e) => setEditChatSerial(e.target.value)}
                                        className="w-full bg-black border border-zinc-900 rounded p-1.5 text-zinc-200 focus:outline-none text-[10px]"
                                        placeholder="Sender Serial"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-[8px] font-mono uppercase text-zinc-600 mb-1">Device Type</label>
                                      <select
                                        value={editChatDeviceType}
                                        onChange={(e) => setEditChatDeviceType(e.target.value)}
                                        className="w-full bg-black border border-zinc-900 rounded p-1.5 text-zinc-200 focus:outline-none text-[10px]"
                                      >
                                        <option value="DESKTOP">DESKTOP</option>
                                        <option value="MOBILE">MOBILE</option>
                                      </select>
                                    </div>
                                    <div>
                                      <label className="block text-[8px] font-mono uppercase text-zinc-600 mb-1">Message Type</label>
                                      <select
                                        value={editChatMsgType}
                                        onChange={(e) => setEditChatMsgType(e.target.value)}
                                        className="w-full bg-black border border-zinc-900 rounded p-1.5 text-zinc-200 focus:outline-none text-[10px]"
                                      >
                                        <option value="text">TEXT</option>
                                        <option value="image">IMAGE</option>
                                        <option value="poll">POLL</option>
                                        <option value="qa">Q&A</option>
                                      </select>
                                    </div>
                                  </div>

                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => handleSaveChat(chat.id)}
                                      className="flex-1 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-black tracking-widest text-[9px] uppercase rounded cursor-pointer transition-all"
                                    >
                                      Save Dispatch
                                    </button>
                                    <button
                                      onClick={() => setEditingChatId(null)}
                                      className="px-3 py-1.5 bg-zinc-900 border border-zinc-850 text-zinc-400 text-[9px] uppercase font-bold rounded cursor-pointer"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <div className="min-w-0 flex-1 space-y-1.5">
                                    <div className="flex justify-between items-center text-[8px] font-mono text-zinc-600">
                                      <span className="flex items-center gap-1">
                                        ROLE: 
                                        {chat.createdByImei === selectedComm.createdByImei ? (
                                          <span className="text-emerald-400 font-bold bg-emerald-950/20 px-1 py-0.5 rounded border border-emerald-500/20 text-[7px]">OWNER</span>
                                        ) : (
                                          <span className="text-zinc-400 font-bold bg-zinc-900 px-1 py-0.5 rounded border border-zinc-800 text-[7px]">MEMBER</span>
                                        )}
                                      </span>
                                      <span>
                                        SENDER DEVICE: {chat.createdByDeviceType || 'DESKTOP'}
                                      </span>
                                    </div>

                                    <p className="text-[11px] text-zinc-300 whitespace-pre-wrap font-sans">
                                      {chat.content}
                                    </p>

                                    {chat.imageUrl && (
                                      <img
                                        src={chat.imageUrl}
                                        alt="Payload graphic"
                                        className="w-24 h-24 rounded object-cover border border-zinc-900 bg-zinc-900 mt-2"
                                        referrerPolicy="no-referrer"
                                      />
                                    )}

                                    <div className="flex gap-3 text-[9px] text-zinc-600 font-mono">
                                      <span>Type: {chat.type?.toUpperCase()}</span>
                                      <span>Likes: {chat.likesCount || 0}</span>
                                      <span>Comments: {chat.commentsCount || 0}</span>
                                      <span className={(chat.reportsCount || 0) > 0 ? "text-amber-500 font-bold" : ""}>Reports: {chat.reportsCount || 0}</span>
                                    </div>
                                  </div>

                                  <div className="flex flex-col gap-1 shrink-0">
                                    <button
                                      onClick={() => {
                                        setEditingChatId(chat.id);
                                        setEditChatContent(chat.content || '');
                                        setEditChatLikes(chat.likesCount || 0);
                                        setEditChatComments(chat.commentsCount || 0);
                                        setEditChatReports(chat.reportsCount || 0);
                                        setEditChatImageUrl(chat.imageUrl || '');
                                        setEditChatIp(chat.createdByIp || '');
                                        setEditChatImei(chat.createdByImei || '');
                                        setEditChatSerial(chat.createdBySerial || '');
                                        setEditChatDeviceType(chat.createdByDeviceType || 'DESKTOP');
                                        setEditChatMsgType(chat.type || 'text');
                                      }}
                                      className="p-1.5 text-zinc-700 hover:text-emerald-400 rounded hover:bg-emerald-950/15 cursor-pointer transition-colors"
                                      title="EDIT CHAT MESSAGE DETAILS"
                                    >
                                      <Edit className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteChat(chat.id)}
                                      className="p-1.5 text-zinc-700 hover:text-rose-400 rounded hover:bg-rose-950/15 cursor-pointer shrink-0 transition-colors"
                                      title="PURGE DISPATCH MESSAGE"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </>
                ) : (
                  <div className="m-auto text-center space-y-2 p-6">
                    <Eye className="w-8 h-8 text-zinc-800 mx-auto" />
                    <span className="text-[10px] text-zinc-600 uppercase block">SELECT A COHORT CORE TO INSPECT</span>
                  </div>
                )}
              </div>

            </div>

          </motion.main>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminCommunities;
