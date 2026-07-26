/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  orderBy, 
  limit, 
  onSnapshot,
  doc,
  getDoc,
  where,
  getDocs
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import { Post } from './types';
import { getClientIp, getDeviceImei } from './utils/ip';
import Header from './components/Header';
import VenomCard from './components/VenomCard';
import NewVenomModal from './components/NewVenomModal';
import AdminPanel from './components/AdminPanel';
import InfoModals from './components/InfoModals';
import GuidelinesPage from './components/GuidelinesPage';
import PoliciesPage from './components/PoliciesPage';
import ReportPage from './components/ReportPage';
import AdminReports from './components/admin/AdminReports';
import CommunitiesPage from './components/CommunitiesPage';
import AdminCommunities from './components/admin/AdminCommunities';
import AdminCommunityReports from './components/admin/AdminCommunityReports';
import { 
  Cpu, 
  Search,
  CheckCircle,
  Flame,
  ArrowUp,
  ArrowDown,
  Heart,
  X,
  SlidersHorizontal,
  Check,
  ArrowLeft,
  ShieldAlert,
  RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getOperativeID } from './utils/crypto';
import { checkIpBlockStatus, BlockStatus } from './utils/blockChecker';
import QuarantineNoticeModal from './components/QuarantineNoticeModal';
import { InstallPwaModal } from './components/InstallPwaModal';
import { MobileBottomBar } from './components/MobileBottomBar';

export default function App() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(true);
  const [activeCategory, setActiveCategory] = useState('all');
  const [sortBy, setSortBy] = useState<'latest' | 'oldest' | 'likes'>('latest');
  const [searchTerm, setSearchTerm] = useState('');
  const [showNewPostModal, setShowNewPostModal] = useState(false);
  const [opId, setOpId] = useState('');
  const [dbConnected, setDbConnected] = useState<boolean | null>(null);
  const [currentPath, setCurrentPath] = useState(
    window.location.pathname + window.location.search
  );
  const [activeInfoModal, setActiveInfoModal] = useState<'guidelines' | 'policies' | 'tips' | null>(null);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [highlightedPostId, setHighlightedPostId] = useState<string | null>(null);
  const [blockStatus, setBlockStatus] = useState<BlockStatus | null>(null);
  const [userIp, setUserIp] = useState<string>('');
  const [showQuarantineModal, setShowQuarantineModal] = useState(false);
  const [showInstallPwaModal, setShowInstallPwaModal] = useState(false);
  const [installPwaAppType, setInstallPwaAppType] = useState<'main' | 'admin'>('main');

  useEffect(() => {
    (window as any).openPwaInstallModal = (type: 'main' | 'admin' = 'main') => {
      setInstallPwaAppType(type);
      setShowInstallPwaModal(true);
    };
    (window as any).triggerNewPost = () => {
      handleNewPostClick();
    };

    // Lock screen orientation to startup orientation if supported
    const lockOrientation = async () => {
      if (typeof window !== 'undefined' && window.screen && window.screen.orientation && (window.screen.orientation as any).lock) {
        try {
          const orientationType = window.innerHeight > window.innerWidth ? 'portrait' : 'landscape';
          await (window.screen.orientation as any).lock(orientationType);
        } catch (err) {
          console.warn('Orientation lock not supported or requires fullscreen:', err);
        }
      }
    };
    lockOrientation();

    return () => {
      delete (window as any).openPwaInstallModal;
      delete (window as any).triggerNewPost;
    };
  }, [blockStatus]);

  // Helper to parse search parameters directly from currentPath to ensure perfect React state reactivity
  const getQueryParamFromPath = (path: string, paramName: string) => {
    try {
      const queryIndex = path.indexOf('?');
      if (queryIndex === -1) return null;
      const params = new URLSearchParams(path.substring(queryIndex));
      return params.get(paramName);
    } catch (e) {
      return null;
    }
  };

  // Parse path for single post sharing
  const postMatch = currentPath.match(/^\/post\/([a-zA-Z0-9_-]+)/) || currentPath.match(/^\/venom\/([a-zA-Z0-9_-]+)/);
  const sharedPostId = postMatch ? postMatch[1] : null;

  const sharedHashId = (currentPath.startsWith('/report') || currentPath.startsWith('/admin'))
    ? null
    : (getQueryParamFromPath(currentPath, 'id') || new URLSearchParams(window.location.search).get('id'));

  const handleNewPostClick = () => {
    if (blockStatus?.isBlocked) {
      setShowQuarantineModal(true);
    } else {
      setShowNewPostModal(true);
    }
  };

  // Direct navigation functions that synchronously sync browser history and React state
  const handleNavigateAdmin = () => {
    window.history.pushState({}, '', '/admin');
    setCurrentPath(
      window.location.pathname +
      window.location.search
    );
  };

  const handleBackToHome = () => {
    window.history.pushState({}, '', '/');
    setCurrentPath('/');
  };

  const handleNavigate = (path: string) => {
    window.history.pushState({}, '', path);
    setCurrentPath(path);
  };

  // Synchronize routing and auto-decryption parameters on direct URL load
  useEffect(() => {
    if (
      (sharedPostId || sharedHashId) &&
      posts.length > 0
    ) {
      const targetId =
        sharedPostId || sharedHashId;

      const foundPost = posts.find(
        (p) =>
          p.id === targetId ||
          p.encryptedHash === targetId
      );
      if (foundPost) {
        // Automatically navigate to the homepage by replacing address bar entry
        window.history.replaceState({}, '', '/');
        setCurrentPath('/');
        
        // Fill the homepage search box with that human-readable ID
        setSearchTerm(foundPost.encryptedHash);
        
        // Save matched highlight pointer
        setHighlightedPostId(foundPost.id);
        
        // Smoothly auto-scroll target element into view once rendered
        setTimeout(() => {
          const element = document.getElementById(`post-${foundPost.id}`);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 800);
      }
    }
  }, [sharedPostId, sharedHashId, posts]);

  // Load operative local metadata & listen to location routes
  useEffect(() => {
    setOpId(getOperativeID());

    const handleLocationChange = () => {
      setCurrentPath(
        window.location.pathname +
        window.location.search
      );
    };
    window.addEventListener('popstate', handleLocationChange);
    return () => window.removeEventListener('popstate', handleLocationChange);
  }, []);

  // Dual PWA routing and session management logic for Admin vs Main PWA isolation
  useEffect(() => {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
    const params = new URLSearchParams(window.location.search);
    const pwaParam = params.get('pwa'); // 'admin' or 'main'
    const idParam = params.get('id');

    let activeApp = localStorage.getItem('venom_pwa_active_app');

    if (pwaParam === 'admin') {
      activeApp = 'admin';
      localStorage.setItem('venom_pwa_active_app', 'admin');
    } else if (pwaParam === 'main') {
      activeApp = 'main';
      localStorage.setItem('venom_pwa_active_app', 'main');
    } else if (idParam) {
      // Shared post link must ALWAYS route to the main user app
      activeApp = 'main';
      localStorage.setItem('venom_pwa_active_app', 'main');
    } else {
      // Determine based on current path if no active PWA type is stored
      if (window.location.pathname.startsWith('/admin')) {
        activeApp = 'admin';
        localStorage.setItem('venom_pwa_active_app', 'admin');
      } else if (!activeApp) {
        activeApp = 'main';
        localStorage.setItem('venom_pwa_active_app', 'main');
      }
    }

    if (isStandalone) {
      const search = window.location.search || '';
      if (activeApp === 'admin') {
        const sessionStarted = sessionStorage.getItem('venom_admin_session_active');
        if (!sessionStarted) {
          sessionStorage.setItem('venom_admin_session_active', 'true');
          sessionStorage.removeItem('venom_main_session_active'); // Keep separate
          // For a fresh session of Admin PWA, force the route to /admin and preserve query parameters
          window.history.replaceState({}, '', `/admin${search}`);
          setCurrentPath(`/admin${search}`);
        }
      } else {
        const sessionStarted = sessionStorage.getItem('venom_main_session_active');
        if (!sessionStarted) {
          sessionStorage.setItem('venom_main_session_active', 'true');
          sessionStorage.removeItem('venom_admin_session_active'); // Keep separate
          // For a fresh session of Main PWA, preserve the actual pathname and query parameters
          const actualPathname = window.location.pathname;
          window.history.replaceState({}, '', `${actualPathname}${search}`);
          setCurrentPath(`${actualPathname}${search}`);
        }
      }
    }
  }, []);

  // Listen to beforeinstallprompt event to support manual PWA installations from admin console
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      (window as any).pwaInstallPrompt = e;
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Also listen to early-loaded prompt custom event from index.html
    const handleCustomPrompt = (e: any) => {
      if (e.detail) {
        (window as any).pwaInstallPrompt = e.detail;
      }
    };
    window.addEventListener('pwa-prompt-available', handleCustomPrompt);

    // Expose a robust global function for automatic PWA installation triggers
    (window as any).triggerPwaInstall = (appType: 'main' | 'admin' = 'main') => {
      const promptEvent = (window as any).pwaInstallPrompt;
      if (promptEvent) {
        promptEvent.prompt();
        promptEvent.userChoice.then((choiceResult: any) => {
          if (choiceResult.outcome === 'accepted') {
            console.log('PWA installation accepted by user');
          }
        });
        return true;
      }
      // If native prompt is not available (e.g., inside iframe or already installed), open the premium modal
      if ((window as any).openPwaInstallModal) {
        (window as any).openPwaInstallModal(appType);
        return true;
      }
      return false;
    };

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('pwa-prompt-available', handleCustomPrompt);
    };
  }, []);

  // Dynamically change title, favicon, and manifest on route change for Admin PWA isolation
  useEffect(() => {
    const favicon32 = document.getElementById('favicon-link-32') as HTMLLinkElement | null;
    const favicon16 = document.getElementById('favicon-link-16') as HTMLLinkElement | null;
    const appleIconLink = document.getElementById('apple-icon-link') as HTMLLinkElement | null;
    const manifestLink = document.getElementById('pwa-manifest-link') as HTMLLinkElement | null;
    
    const isAdminReportRoute = currentPath.startsWith('/admin/report') || currentPath.includes('admin/report') || currentPath.includes('reports');
    const isAdminRoute = currentPath.startsWith('/admin');
    const isReportRoute = currentPath.startsWith('/report');
    const isPoliciesRoute = currentPath.startsWith('/policies');
    const isGuidelinesRoute = currentPath.startsWith('/guidelines');
    
    let pageTitle = "Venom | Decentralized Anonymous Grid";
    if (isAdminReportRoute) {
      pageTitle = "Venom Admin Reports";
    } else if (isAdminRoute) {
      pageTitle = "Venom Admin Console";
    } else if (isReportRoute) {
      pageTitle = "Venom Security Report";
    } else if (isPoliciesRoute) {
      pageTitle = "Venom Policies";
    } else if (isGuidelinesRoute) {
      pageTitle = "Venom Guidelines";
    }

    document.title = pageTitle;

    const iconUrl = (isAdminRoute || isAdminReportRoute) 
      ? "https://i.ibb.co/RpqhT7QZ/14893-removebg-preview.png" 
      : "https://i.ibb.co/jkzWK6V6/14895-removebg-preview.png";

    const manifestUrl = (isAdminRoute || isAdminReportRoute)
      ? "/admin-manifest.json"
      : "/manifest.json";

    if (favicon32) favicon32.href = iconUrl;
    if (favicon16) favicon16.href = iconUrl;
    if (appleIconLink) appleIconLink.href = iconUrl;
    if (manifestLink) manifestLink.href = manifestUrl;
  }, [currentPath]);

  const [blockedIpAddresses, setBlockedIpAddresses] = useState<string[]>([]);

  // Listen to the complete list of blocked IP addresses in real-time to filter posts dynamically
  useEffect(() => {
    if (!db) return;
    const q = query(collection(db, 'blockedIps'), where('isBlocked', '==', true));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const ips = snapshot.docs.map((docSnap) => docSnap.id);
        setBlockedIpAddresses(ips);
      },
      (error) => {
        console.error('Error listening to blocked IPs:', error);
      }
    );
    return () => unsubscribe();
  }, []);

  // Check client IP and listen to its block status in real-time
  useEffect(() => {
    if (!db) return;
    let active = true;
    let unsubIp: (() => void) | null = null;
    let unsubImei: (() => void) | null = null;

    const setupBlockSubscription = async () => {
      try {
        const ip = await getClientIp();
        const imei = getDeviceImei();
        if (!active) return;
        setUserIp(ip);

        // Check initial block status on load
        const initialStatus = await checkIpBlockStatus(ip, imei);
        if (!active) return;
        if (initialStatus.isBlocked) {
          setBlockStatus(initialStatus);
          setShowQuarantineModal(true);
        }

        const ipRef = doc(db, 'blockedIps', ip);
        const imeiRef = doc(db, 'blockedImeis', imei);

        const checkStatusAndUpdate = async () => {
          const status = await checkIpBlockStatus(ip, imei);
          if (!active) return;
          setBlockStatus(status);
          setShowQuarantineModal(status.isBlocked);
        };

        unsubIp = onSnapshot(ipRef, checkStatusAndUpdate, (error) => {
          console.error('Error in IP block status listener:', error);
        });

        unsubImei = onSnapshot(imeiRef, checkStatusAndUpdate, (error) => {
          console.error('Error in IMEI block status listener:', error);
        });
      } catch (err) {
        console.error('Failed to retrieve client IP/IMEI block status:', err);
      }
    };

    setupBlockSubscription();
    
    return () => {
      active = false;
      if (unsubIp) unsubIp();
      if (unsubImei) unsubImei();
    };
  }, []);

  // Fetch posts in real-time from Firestore
  useEffect(() => {
    setIsRefreshing(true);
    if (!db) {
      setDbConnected(false);
      setIsRefreshing(false);
      return;
    }

    const postsRef = collection(db, 'posts');
    const q = query(postsRef, orderBy('createdAt', 'desc'), limit(100));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fetchedPosts = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        })) as Post[];
        
        setPosts(fetchedPosts);
        setDbConnected(true);
        setIsRefreshing(false);
      },
      (error) => {
        setDbConnected(false);
        setIsRefreshing(false);
        handleFirestoreError(error, OperationType.GET, 'posts');
      }
    );

    return () => unsubscribe();
  }, []);

  // Load and synchronize IMEI & IP-based interactions on boot to lock votes and likes securely on device-level
  useEffect(() => {
    const syncInteractions = async () => {
      if (!db) return;
      try {
        const userIp = await getClientIp();
        const deviceImei = getDeviceImei();
        
        // Query by IMEI primarily (100% stable device-level persistent tracking)
        const qImei = query(collection(db, 'interactions'), where('imei', '==', deviceImei));
        // Query by IP as legacy fallback (in case IMEI is not set on older documents)
        const qIp = query(collection(db, 'interactions'), where('ip', '==', userIp));
        
        const [snapImei, snapIp] = await Promise.all([
          getDocs(qImei),
          getDocs(qIp)
        ]);
        
        const likedPosts: string[] = [];
        const votedPosts: { [postId: string]: 'up' | 'down' } = {};
        const votedPolls: { [postId: string]: number } = {};
        const reactedPosts: { [postId: string]: string } = {};
        
        const processDoc = (docSnap: any) => {
          const data = docSnap.data();
          const pId = data.postId;
          if (!pId) return;
          
          if (data.type === 'like') {
            if (!likedPosts.includes(pId)) likedPosts.push(pId);
          } else if (data.type === 'vote') {
            votedPosts[pId] = data.direction;
          } else if (data.type === 'poll') {
            votedPolls[pId] = data.optionIndex;
          } else if (data.type === 'reaction') {
            reactedPosts[pId] = data.reactionKey;
          }
        };

        snapImei.forEach(processDoc);
        snapIp.forEach(processDoc);
        
        const existing = localStorage.getItem('venom_user_interactions');
        let parsed: any = { likedComments: [], likedReplies: [] };
        if (existing) {
          try {
            parsed = JSON.parse(existing);
          } catch (e) {}
        }
        
        localStorage.setItem('venom_user_interactions', JSON.stringify({
          likedPosts,
          votedPosts,
          votedPolls,
          likedComments: parsed.likedComments || [],
          likedReplies: parsed.likedReplies || [],
          reactedPosts,
        }));
        
        // Dispatch storage event to notify components of synchronized state
        window.dispatchEvent(new Event('storage'));
      } catch (err) {
        console.error('Failed to sync device-level interactions:', err);
      }
    };
    
    if (dbConnected) {
      syncInteractions();
    }
  }, [dbConnected]);

  const handlePostUpdate = (postId: string, updatedFields: Partial<Post>) => {
    setPosts((prevPosts) =>
      prevPosts.map((post) =>
        post.id === postId ? { ...post, ...updatedFields } : post
      )
    );
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 600);
  };

  // Perform client-side category filtering, search queries, and ranking
  const filteredPosts = posts
    .filter((post) => {
      // 1. Never show deleted posts
      if (post.isDeleted) return false;
      
      // 2. Never show posts from blocked IPs
      if (post.postedFromIp && blockedIpAddresses.includes(post.postedFromIp)) return false;

      return true;
    })
    .filter((post) => {
      if (sharedPostId || sharedHashId) {
        const targetId = sharedPostId || sharedHashId;
        return post.id === targetId || post.encryptedHash === targetId;
      }
      
      if (activeCategory !== 'all' && post.category !== activeCategory) {
        return false;
      }
      
      if (searchTerm.trim() !== '') {
        const term = searchTerm.toLowerCase();
        const titleMatch = post.title?.toLowerCase().includes(term);
        const contentMatch = post.content?.toLowerCase().includes(term);
        const categoryMatch = post.category?.toLowerCase().includes(term);
        const idMatch = post.id?.toLowerCase().includes(term);
        const hashMatch = post.encryptedHash?.toLowerCase().includes(term);
        return titleMatch || contentMatch || categoryMatch || idMatch || hashMatch;
      }
      
      return true;
    })
    .sort((a, b) => {
          if (sortBy === 'likes') {
            const likesA = a.likesCount || 0;
            const likesB = b.likesCount || 0;
            if (likesA !== likesB) return likesB - likesA;
            return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
          }

          if (sortBy === 'oldest') {
            const timeA = a.createdAt?.seconds || 0;
            const timeB = b.createdAt?.seconds || 0;
            return timeA - timeB;
          }

          const timeA = a.createdAt?.seconds || 0;
          const timeB = b.createdAt?.seconds || 0;
          return timeB - timeA;
        });

  // Admin community reports terminal route check
  if (currentPath.startsWith('/admin/report-communities') || currentPath.startsWith('/admin/community-reports')) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -15 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
        className="min-h-screen bg-[#030303]"
      >
        <AdminCommunityReports />
      </motion.div>
    );
  }

  // Admin reports terminal route check
  if (currentPath.startsWith('/admin/report')) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -15 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
        className="min-h-screen bg-[#030303]"
      >
        <AdminReports />
      </motion.div>
    );
  }

  // Admin communities terminal route check
  if (currentPath.startsWith('/admin/communities')) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -15 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
        className="min-h-screen bg-[#030303]"
      >
        <AdminCommunities onNavigateHome={handleBackToHome} />
      </motion.div>
    );
  }

  // Communities page route check
  if (currentPath.startsWith('/communities') || currentPath.startsWith('/venom/communities')) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -15 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
        className="min-h-screen bg-zinc-950"
      >
        <CommunitiesPage onBackToHome={handleBackToHome} posts={posts} />
      </motion.div>
    );
  }

  // Admin route check
  if (currentPath.startsWith('/admin')) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -15 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
        className="min-h-screen bg-zinc-950"
      >
        <AdminPanel 
          posts={posts} 
          onNavigateHome={handleBackToHome} 
        />
      </motion.div>
    );
  }

  // Guidelines page route check
  if (currentPath.startsWith('/guidelines')) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -15 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
        className="min-h-screen bg-[#030303]"
      >
        <GuidelinesPage onBackToHome={handleBackToHome} />
      </motion.div>
    );
  }

  // Policies page route check
  if (currentPath.startsWith('/policies')) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -15 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
        className="min-h-screen bg-[#030303]"
      >
        <PoliciesPage onBackToHome={handleBackToHome} />
      </motion.div>
    );
  }

  // User report page route check
  if (currentPath.startsWith('/report')) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -15 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
        className="min-h-screen bg-[#030303]"
      >
        <ReportPage onBackToHome={handleBackToHome} />
      </motion.div>
    );
  }

  // Render normal feed view
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      className="min-h-screen bg-zinc-950 font-sans text-zinc-300 antialiased flex flex-col selection:bg-emerald-500 selection:text-zinc-950"
    >
      
      {/* Background aesthetic grid overlay */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.01] bg-[radial-gradient(#10b981_1px,transparent_1px)] [background-size:24px_24px] z-0" />

      {/* Main Header Component */}
      <Header
        onNewPostClick={handleNewPostClick}
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
        onShowGuidelines={() => setActiveInfoModal('guidelines')}
        onShowPolicies={() => setActiveInfoModal('policies')}
        onNavigate={handleNavigate}
      />

      {/* Centered Instagram-style Feed Layout */}
      <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-6 pb-20 md:pb-6 space-y-5 relative z-10">
        
        {/* Persistent IP Quarantine Warning Banner */}
        {blockStatus?.isBlocked && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={() => setShowQuarantineModal(true)}
            className="flex items-center justify-between bg-rose-500/10 border border-rose-500/20 hover:border-rose-500/40 rounded-xl p-4 backdrop-blur-md relative overflow-hidden cursor-pointer select-none group transition-all"
          >
            <div className="absolute -top-12 -right-12 w-24 h-24 bg-rose-500/5 rounded-full blur-xl pointer-events-none" />
            <div className="flex items-center gap-3">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse border border-rose-500/30 shrink-0" />
              <div>
                <span className="text-[10px] font-mono font-bold text-rose-400 uppercase tracking-widest block leading-none">
                  ⚠️ DEVICE IP UNDER QUARANTINE ({blockStatus.timeLeftLabel || 'PERMANENT'})
                </span>
                <span className="text-[8px] text-zinc-400 uppercase tracking-tight mt-1.5 block font-mono leading-relaxed">
                  WRITE CLEARANCE SUSPENDED: {blockStatus.reason || 'Guidelines violation'}. CLICK TO INSPECT EVIDENCE.
                </span>
              </div>
            </div>
            <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-rose-400 group-hover:underline shrink-0 pl-2">
              View Notice
            </span>
          </motion.div>
        )}

        {/* Shared Post Header Banner */}
        {(sharedPostId || sharedHashId) ? (
          <div className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 backdrop-blur-md relative overflow-hidden">
            <div className="absolute -top-12 -right-12 w-24 h-24 bg-emerald-500/5 rounded-full blur-xl pointer-events-none" />
            <div className="flex items-center gap-3">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse border border-emerald-500/30" />
              <div>
                <span className="text-[10px] font-mono font-bold text-emerald-400 uppercase tracking-widest block leading-none">
                  Viewing Shared Venom
                </span>
                <span className="text-[8px] text-zinc-500 uppercase tracking-tight font-mono mt-1 block">
                  Secure cryptographic transmission decrypted
                </span>
              </div>
            </div>
            <button
              onClick={() => {
                setSearchTerm('');
                setHighlightedPostId(null);
                setActiveCategory('all');
                handleBackToHome();
              }}
              className="flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400 hover:text-emerald-400 transition-colors bg-zinc-950 border border-zinc-900 hover:border-emerald-500/20 px-3 py-1.5 rounded cursor-pointer active:scale-95 shadow-md"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-emerald-400" />
              <span>View Full Feed</span>
            </button>
          </div>
        ) : (
          /* Normal Feed Filter Panel & Search */
          <div className="relative z-30 bg-zinc-900/30 border border-zinc-900 p-4 rounded-xl space-y-3.5 backdrop-blur-md">
            
            {/* Sorting Row */}
            <div className="flex items-center justify-between border-b border-zinc-900/50 pb-2">
              <span className="text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-widest">Sort By</span>
              <div className="flex items-center gap-1">
                {[
                  { id: 'latest', label: 'Latest' },
                  { id: 'oldest', label: 'Oldest' },
                  { id: 'likes', label: 'Liked' },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setSortBy(item.id as any)}
                    className={`px-3 py-1 rounded text-[10px] font-bold font-mono uppercase transition-colors cursor-pointer ${
                      sortBy === item.id
                        ? 'bg-emerald-500/10 text-emerald-400 font-semibold'
                        : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Search and Channel Filter Row */}
            <div className="flex gap-2 items-center">
              {/* Search Input Bar */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-zinc-500" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search..."
                  className="w-full bg-zinc-950 border border-zinc-900 focus:border-emerald-500/30 rounded-md pl-9 pr-8 py-2 text-xs text-zinc-300 placeholder-zinc-600 focus:outline-none transition-colors"
                />
                {searchTerm && (
                  <button 
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2.5 top-2.5 hover:text-rose-400 text-zinc-500 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Filter Dropdown Button */}
              <div className="relative">
                <button 
                  onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                  className="px-3 py-2 border border-zinc-900 bg-zinc-900/60 hover:bg-zinc-950 text-zinc-300 rounded-md text-xs font-mono font-bold uppercase transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{activeCategory === 'all' ? 'All Channels' : `#${activeCategory}`}</span>
                </button>
                
                {showFilterDropdown && (
                  <>
                    <div 
                      className="fixed inset-0 z-40" 
                      onClick={() => setShowFilterDropdown(false)} 
                    />
                    <div className="absolute right-0 mt-2 w-44 bg-zinc-950 border border-zinc-900 rounded-md shadow-2xl z-50 py-1 text-xs font-mono">
                      {[
                        { id: 'all', label: 'All Channels' },
                        { id: 'general', label: '#general' },
                        { id: 'tech', label: '#tech' },
                        { id: 'design', label: '#design' },
                        { id: 'gaming', label: '#gaming' },
                        { id: 'lifestyle', label: '#lifestyle' },
                      ].map((cat) => (
                        <button
                          key={cat.id}
                          onClick={() => {
                            setActiveCategory(cat.id);
                            setShowFilterDropdown(false);
                          }}
                          className={`w-full text-left px-3.5 py-2 hover:bg-zinc-900 transition-colors flex items-center justify-between cursor-pointer ${
                            activeCategory === cat.id ? 'text-emerald-400 font-bold' : 'text-zinc-500 hover:text-zinc-300'
                          }`}
                        >
                          <span>{cat.label}</span>
                          {activeCategory === cat.id && <Check className="w-3.5 h-3.5" />}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

          </div>
        )}

        {/* Active filter summary (if active) */}
        {!(sharedPostId || sharedHashId) && (searchTerm || activeCategory !== 'all') && (
          <div className="flex flex-col items-center gap-3">
            <div className="text-[10px] font-mono text-zinc-500 flex items-center gap-2 px-1 justify-center flex-wrap">
              <span>ACTIVE FILTER:</span>
              <span className="text-zinc-400 font-bold uppercase bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-800">
                {activeCategory === 'all' ? 'ALL CHANNELS' : `#${activeCategory}`}
              </span>
              {searchTerm && (
                <>
                  <span className="text-zinc-700 font-bold">/</span>
                  <span className="text-zinc-400 font-bold bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-800">
                    "{searchTerm}"
                  </span>
                </>
              )}
              <span className="text-zinc-700">|</span>
              <span className="text-emerald-500 font-bold">{filteredPosts.length} posts found</span>
            </div>
            
            <button
              onClick={() => {
                setSearchTerm('');
                setActiveCategory('all');
                setHighlightedPostId(null);
                handleBackToHome();
              }}
              className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider font-mono text-emerald-400 hover:text-emerald-300 transition-colors border border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10 px-4 py-1.5 rounded-md shadow-lg shadow-emerald-950/20 cursor-pointer"
            >
              <RefreshCw className="w-3 h-3 animate-pulse text-emerald-400" />
              <span>Go to Homescreen (Latest Venoms)</span>
            </button>
          </div>
        )}

        {/* Target post shared search highlight banner */}
        {!(sharedPostId || sharedHashId) && highlightedPostId && searchTerm && (
          <div className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 backdrop-blur-md relative overflow-hidden">
            <div className="absolute -top-12 -right-12 w-24 h-24 bg-emerald-500/5 rounded-full blur-xl pointer-events-none" />
            <div className="flex items-center gap-3">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse border border-emerald-500/30" />
              <div>
                <span className="text-[10px] font-mono font-bold text-emerald-400 uppercase tracking-widest block leading-none">
                  Decrypted Shared Venom
                </span>
                <span className="text-[8px] text-zinc-500 uppercase tracking-tight font-mono mt-1 block">
                  Encrypted human-readable hash match active
                </span>
              </div>
            </div>
            <button
              onClick={() => {
                setSearchTerm('');
                setHighlightedPostId(null);
                setActiveCategory('all');
                handleBackToHome();
              }}
              className="flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400 hover:text-emerald-400 transition-colors bg-zinc-950 border border-zinc-900 hover:border-emerald-500/20 px-3 py-1.5 rounded cursor-pointer active:scale-95 shadow-md"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-emerald-400" />
              <span>Back to Home</span>
            </button>
          </div>
        )}

        {/* Posts Feed container */}
        <div className="space-y-4">
          {isRefreshing ? (
            /* High-fidelity pulsing multi-card skeleton loaders */
            <div className="space-y-5">
              {[1, 2, 3].map((num) => (
                <div 
                  key={`skeleton-${num}`} 
                  className="border border-zinc-900/60 bg-zinc-950/60 rounded-lg overflow-hidden flex flex-col p-4 space-y-4 animate-pulse"
                >
                  {/* Top Meta Info Header */}
                  <div className="flex items-center justify-between border-b border-zinc-900/40 pb-2.5">
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-16 bg-zinc-900/80 rounded" />
                      <div className="h-4 w-10 bg-zinc-900/80 rounded" />
                    </div>
                    <div className="h-3.5 w-20 bg-zinc-900/80 rounded" />
                  </div>
                  
                  {/* Title & Body content */}
                  <div className="space-y-3 flex-1">
                    <div className="h-4 bg-zinc-900/80 rounded w-2/3" />
                    <div className="space-y-2 pt-1">
                      <div className="h-3 bg-zinc-900/50 rounded w-full" />
                      <div className="h-3 bg-zinc-900/50 rounded w-5/6" />
                      <div className="h-3 bg-zinc-900/50 rounded w-4/5" />
                    </div>
                  </div>
                  
                  {/* Bottom Interaction Footer */}
                  <div className="flex items-center justify-between pt-3 border-t border-zinc-900/40">
                    <div className="flex items-center gap-3">
                      <div className="h-7 w-20 bg-zinc-900/80 rounded-md" />
                      <div className="h-7 w-12 bg-zinc-900/80 rounded-md" />
                      <div className="h-7 w-12 bg-zinc-900/80 rounded-md" />
                    </div>
                    <div className="h-5 w-24 bg-zinc-900/80 rounded-md" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredPosts.length === 0 ? (
            /* Empty slate placeholder */
            <div className="border border-zinc-900 bg-zinc-950/40 rounded-xl p-16 text-center flex flex-col items-center justify-center gap-4">
              <ShieldAlert className="w-8 h-8 text-zinc-700" />
              <div className="max-w-sm space-y-1">
                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest font-mono">
                  {(sharedPostId || sharedHashId) ? 'Shared Venom Not Found' : 'No Posts Detected'}
                </h3>
                <p className="text-xs text-zinc-500 leading-relaxed">
                  {(sharedPostId || sharedHashId)
                    ? 'The shared post link is invalid, expired, or was purged by system security.' 
                    : 'This channel is currently empty.'}
                </p>
              </div>
              {(sharedPostId || sharedHashId) ? (
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setHighlightedPostId(null);
                    setActiveCategory('all');
                    handleBackToHome();
                  }}
                  className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 hover:border-zinc-750 text-xs font-bold rounded transition-all cursor-pointer font-mono uppercase tracking-wider"
                >
                  Go to Main Feed
                </button>
              ) : (
                <button
                  onClick={handleNewPostClick}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-bold rounded transition-all cursor-pointer"
                >
                  + Create the First Post
                </button>
              )}
            </div>
          ) : (
            /* Real post elements rendered with layout morphing and smooth animations */
            <motion.div 
              layout="position"
              className="space-y-5"
            >
              <AnimatePresence mode="popLayout">
                {filteredPosts.map((post) => (
                  <motion.div
                    key={post.id}
                    layout="position"
                    initial={{ opacity: 0, y: 12, scale: 0.99 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98, y: -8 }}
                    transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <VenomCard
                      post={post}
                      highlighted={highlightedPostId === post.id}
                      onPostUpdate={(fields) => handlePostUpdate(post.id, fields)}
                      isBlocked={blockStatus?.isBlocked || false}
                      onBlockedActionTriggered={() => setShowQuarantineModal(true)}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
          )}
        </div>

      </main>

      {/* Dynamic Modal Interfaces */}
      {showNewPostModal && (
        <NewVenomModal 
          onClose={() => setShowNewPostModal(false)} 
          onPostCreated={handleRefresh}
        />
      )}

      {showQuarantineModal && blockStatus && (
        <QuarantineNoticeModal 
          blockStatus={blockStatus}
          userIp={userIp}
          onClose={() => setShowQuarantineModal(false)}
        />
      )}

      <InfoModals 
        type={activeInfoModal} 
        onClose={() => setActiveInfoModal(null)} 
      />

      <InstallPwaModal 
        isOpen={showInstallPwaModal} 
        onClose={() => setShowInstallPwaModal(false)} 
        appType={installPwaAppType}
      />

      <MobileBottomBar currentPath={currentPath} />

    </motion.div>
  );
}
