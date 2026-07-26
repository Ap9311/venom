/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Post } from '../types';
import { 
  ArrowBigUp, 
  ArrowBigDown, 
  Heart, 
  MessageSquare, 
  Share2, 
  Shield, 
  Eye, 
  Check, 
  X, 
  BarChart2, 
  HelpCircle, 
  Hash,
  Copy,
  Link,
  MessageCircle,
  Twitter,
  Facebook,
  ExternalLink,
  Send,
  Smile,
  Flag,
  Instagram
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  isPostLiked, 
  togglePostLikeStore, 
  getPostVote, 
  setPostVoteStore, 
  getPollVotedOption, 
  setPollVotedOptionStore,
  getPostReaction,
  setPostReactionStore,
  getInteractionState,
  saveInteractionState
} from '../utils/storage';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { doc, updateDoc, increment, setDoc, deleteDoc, getDoc, runTransaction } from 'firebase/firestore';
import { getClientIp, getDeviceImei } from '../utils/ip';
import { copyToClipboard } from '../utils/clipboard';
import { formatTimeAgo, formatShortCount } from '../utils/time';
import CommentsPane from './CommentsPane';

interface VenomCardProps {
  key?: string | number;
  post: Post;
  highlighted?: boolean;
  onPostUpdate?: (updatedPost: Partial<Post>) => void;
  isBlocked?: boolean;
  onBlockedActionTriggered?: () => void;
  compact?: boolean;
}

const REACTIONS = [
  { key: 'love', emoji: '❤️', label: 'Love' },
  { key: 'fire', emoji: '🔥', label: 'Fire' },
  { key: 'laugh', emoji: '😂', label: 'Laugh' },
  { key: 'wow', emoji: '😮', label: 'Wow' },
  { key: 'like', emoji: '👍', label: 'Like' },
  { key: 'angry', emoji: '😡', label: 'Angry' },
];

interface FloatingEmoji {
  id: number;
  emoji: string;
  x: number;
  delay: number;
}

const getDeterministicColors = (str: string) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const gradients = [
    'from-emerald-500/20 to-teal-500/20 border-emerald-500/30 text-emerald-400',
    'from-cyan-500/20 to-blue-500/20 border-cyan-500/30 text-cyan-400',
    'from-indigo-500/20 to-purple-500/20 border-indigo-500/30 text-indigo-400',
    'from-pink-500/20 to-rose-500/20 border-pink-500/30 text-pink-400',
    'from-amber-500/20 to-orange-500/20 border-amber-500/30 text-amber-400',
    'from-violet-500/20 to-fuchsia-500/20 border-violet-500/30 text-violet-400',
  ];
  return gradients[Math.abs(hash) % gradients.length];
};

export default function VenomCard({ 
  post, 
  highlighted = false, 
  onPostUpdate,
  isBlocked = false,
  onBlockedActionTriggered,
  compact = false
}: VenomCardProps) {
  const [showComments, setShowComments] = useState(false);
  const [isExpandingImage, setIsExpandingImage] = useState(false);
  const [isCopingHash, setIsCopingHash] = useState(false);
  const [commentsCount, setCommentsCount] = useState(post.commentsCount);
  const [showShareModal, setShowShareModal] = useState(false);
  const [isCopiedLink, setIsCopiedLink] = useState(false);
  
  const [activeReaction, setActiveReaction] = useState<string | null>(null);
  const [showMobileReactions, setShowMobileReactions] = useState(false);
  const [floatingEmojis, setFloatingEmojis] = useState<FloatingEmoji[]>([]);

  // Local locks to prevent concurrent rapid double clicks
  const [isLiking, setIsLiking] = useState(false);
  const [isVoting, setIsVoting] = useState(false);
  const [isVotingPoll, setIsVotingPoll] = useState(false);
  const [isReactingState, setIsReactingState] = useState(false);
  const [dummyTrigger, setDummyTrigger] = useState(0);

  React.useEffect(() => {
    setCommentsCount(post.commentsCount);
  }, [post.commentsCount]);

  React.useEffect(() => {
    setActiveReaction(getPostReaction(post.id));
  }, [post.id]);

  // Lock body scroll when overlay screens (Share Modal or Expanded Image lightbox) are active
  React.useEffect(() => {
    if (showShareModal || isExpandingImage) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [showShareModal, isExpandingImage]);

  React.useEffect(() => {
    let active = true;
    const syncInteractions = async () => {
      try {
        const deviceImei = getDeviceImei();
        if (!deviceImei) return;

        // Fetch like interaction
        const likeRef = doc(db, 'interactions', `${post.id}_${deviceImei}_like`);
        const likeSnap = await getDoc(likeRef);
        if (!active) return;
        
        const state = getInteractionState();
        let changed = false;

        const isCurrentlyLikedInStore = state.likedPosts.includes(post.id);
        if (likeSnap.exists()) {
          if (!isCurrentlyLikedInStore) {
            state.likedPosts.push(post.id);
            changed = true;
          }
        } else {
          if (isCurrentlyLikedInStore) {
            const index = state.likedPosts.indexOf(post.id);
            state.likedPosts.splice(index, 1);
            changed = true;
          }
        }

        // Fetch vote interaction
        const voteRef = doc(db, 'interactions', `${post.id}_${deviceImei}_vote`);
        const voteSnap = await getDoc(voteRef);
        if (!active) return;
        
        const currentVoteInStore = state.votedPosts[post.id];
        if (voteSnap.exists()) {
          const voteData = voteSnap.data();
          if (currentVoteInStore !== voteData.direction) {
            state.votedPosts[post.id] = voteData.direction;
            changed = true;
          }
        } else {
          if (currentVoteInStore) {
            delete state.votedPosts[post.id];
            changed = true;
          }
        }

        // Fetch poll interaction
        const pollRef = doc(db, 'interactions', `${post.id}_${deviceImei}_poll`);
        const pollSnap = await getDoc(pollRef);
        if (!active) return;
        
        const currentPollInStore = state.votedPolls[post.id];
        if (pollSnap.exists()) {
          const pollData = pollSnap.data();
          if (currentPollInStore !== pollData.optionIndex) {
            state.votedPolls[post.id] = pollData.optionIndex;
            changed = true;
          }
        }

        // Fetch reaction interaction
        const reactionRef = doc(db, 'interactions', `${post.id}_${deviceImei}_reaction`);
        const reactionSnap = await getDoc(reactionRef);
        if (!active) return;
        
        const currentReactionInStore = state.reactedPosts ? state.reactedPosts[post.id] : null;
        if (reactionSnap.exists()) {
          const reactionData = reactionSnap.data();
          if (currentReactionInStore !== reactionData.reactionKey) {
            if (!state.reactedPosts) state.reactedPosts = {};
            state.reactedPosts[post.id] = reactionData.reactionKey;
            setActiveReaction(reactionData.reactionKey);
            changed = true;
          }
        } else {
          if (currentReactionInStore) {
            if (state.reactedPosts) {
              delete state.reactedPosts[post.id];
            }
            setActiveReaction(null);
            changed = true;
          }
        }

        if (changed) {
          saveInteractionState(state);
          // Trigger local state update to re-render component
          setDummyTrigger(prev => prev + 1);
        }
      } catch (err) {
        console.error('Failed to sync interactions from Firestore:', err);
      }
    };

    syncInteractions();
    return () => {
      active = false;
    };
  }, [post.id]);

  // Read interaction states from LocalStorage via storage helpers
  const liked = isPostLiked(post.id);
  const userVote = getPostVote(post.id); // 'up', 'down', or null
  const votedPollOption = getPollVotedOption(post.id); // number index or null

  // Calculate dynamic properties
  const isVotedPoll = votedPollOption !== null;
  const pollVotes = post.pollVotes || {};
  const totalPollVotes = Object.values(pollVotes).reduce((a, b) => a + b, 0);
  const totalReactions = (Object.values(post.reactions || {}) as number[]).reduce((a, b) => a + b, 0);

  const handleLikeToggle = async () => {
    if (isBlocked) {
      if (onBlockedActionTriggered) onBlockedActionTriggered();
      return;
    }
    if (isLiking) return;
    setIsLiking(true);

    try {
      const userIp = await getClientIp();
      const deviceImei = getDeviceImei();
      const interactionRef = doc(db, 'interactions', `${post.id}_${deviceImei}_like`);
      const postRef = doc(db, 'posts', post.id);

      await runTransaction(db, async (transaction) => {
        const likeSnap = await transaction.get(interactionRef);
        const postSnap = await transaction.get(postRef);

        if (!postSnap.exists()) return;
        const currentPostData = postSnap.data();
        const existingLikes = currentPostData.likesCount || 0;

        if (likeSnap.exists()) {
          // Unlike
          transaction.delete(interactionRef);
          const newLikes = Math.max(0, existingLikes - 1);
          transaction.update(postRef, { likesCount: newLikes });
          
          // Reconcile local storage
          const state = getInteractionState();
          const idx = state.likedPosts.indexOf(post.id);
          if (idx !== -1) {
            state.likedPosts.splice(idx, 1);
            saveInteractionState(state);
          }

          if (onPostUpdate) {
            onPostUpdate({ likesCount: newLikes });
          }
        } else {
          // Like
          transaction.set(interactionRef, {
            ip: userIp,
            imei: deviceImei,
            postId: post.id,
            type: 'like',
            createdAt: new Date().toISOString()
          });
          const newLikes = existingLikes + 1;
          transaction.update(postRef, { likesCount: newLikes });

          // Reconcile local storage
          const state = getInteractionState();
          if (!state.likedPosts.includes(post.id)) {
            state.likedPosts.push(post.id);
            saveInteractionState(state);
          }

          if (onPostUpdate) {
            onPostUpdate({ likesCount: newLikes });
          }
        }
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `posts/${post.id}`);
    } finally {
      setIsLiking(false);
    }
  };

  const handleVote = async (direction: 'up' | 'down') => {
    if (isBlocked) {
      if (onBlockedActionTriggered) onBlockedActionTriggered();
      return;
    }
    if (isVoting) return;
    setIsVoting(true);

    try {
      const userIp = await getClientIp();
      const deviceImei = getDeviceImei();
      const interactionRef = doc(db, 'interactions', `${post.id}_${deviceImei}_vote`);
      const postRef = doc(db, 'posts', post.id);

      await runTransaction(db, async (transaction) => {
        const voteSnap = await transaction.get(interactionRef);
        const postSnap = await transaction.get(postRef);

        if (!postSnap.exists()) return;
        const currentPostData = postSnap.data();
        let currentUp = currentPostData.upvotesCount || 0;
        let currentDown = currentPostData.downvotesCount || 0;

        if (voteSnap.exists()) {
          const oldVoteDirection = voteSnap.data().direction;
          
          if (oldVoteDirection === direction) {
            // Cancel existing vote
            transaction.delete(interactionRef);
            if (direction === 'up') {
              currentUp = Math.max(0, currentUp - 1);
            } else {
              currentDown = Math.max(0, currentDown - 1);
            }
            
            // Reconcile local storage
            const state = getInteractionState();
            delete state.votedPosts[post.id];
            saveInteractionState(state);
          } else {
            // Switch vote direction
            transaction.set(interactionRef, {
              ip: userIp,
              imei: deviceImei,
              postId: post.id,
              type: 'vote',
              direction,
              createdAt: new Date().toISOString()
            });
            
            if (direction === 'up') {
              currentUp += 1;
              currentDown = Math.max(0, currentDown - 1);
            } else {
              currentDown += 1;
              currentUp = Math.max(0, currentUp - 1);
            }

            // Reconcile local storage
            const state = getInteractionState();
            state.votedPosts[post.id] = direction;
            saveInteractionState(state);
          }
        } else {
          // Brand new vote
          transaction.set(interactionRef, {
            ip: userIp,
            imei: deviceImei,
            postId: post.id,
            type: 'vote',
            direction,
            createdAt: new Date().toISOString()
          });
          
          if (direction === 'up') {
            currentUp += 1;
          } else {
            currentDown += 1;
          }

          // Reconcile local storage
          const state = getInteractionState();
          state.votedPosts[post.id] = direction;
          saveInteractionState(state);
        }

        transaction.update(postRef, {
          upvotesCount: currentUp,
          downvotesCount: currentDown
        });

        if (onPostUpdate) {
          onPostUpdate({
            upvotesCount: currentUp,
            downvotesCount: currentDown
          });
        }
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `posts/${post.id}`);
    } finally {
      setIsVoting(false);
    }
  };

  const handlePollVote = async (optionIndex: number) => {
    if (isBlocked) {
      if (onBlockedActionTriggered) onBlockedActionTriggered();
      return;
    }
    if (isVotedPoll || isVotingPoll) return; // Prevent double voting
    setIsVotingPoll(true);

    setPollVotedOptionStore(post.id, optionIndex);

    try {
      const userIp = await getClientIp();
      const deviceImei = getDeviceImei();
      const interactionRef = doc(db, 'interactions', `${post.id}_${deviceImei}_poll`);
      const postRef = doc(db, 'posts', post.id);

      await runTransaction(db, async (transaction) => {
        const pollSnap = await transaction.get(interactionRef);
        const postSnap = await transaction.get(postRef);

        if (!postSnap.exists()) return;
        const currentPostData = postSnap.data();
        const currentVotes = { ...(currentPostData.pollVotes || {}) };

        if (!pollSnap.exists()) {
          transaction.set(interactionRef, {
            ip: userIp,
            imei: deviceImei,
            postId: post.id,
            type: 'poll',
            optionIndex,
            createdAt: new Date().toISOString()
          });
          currentVotes[optionIndex] = (currentVotes[optionIndex] || 0) + 1;
          transaction.update(postRef, {
            pollVotes: currentVotes
          });
          if (onPostUpdate) {
            onPostUpdate({ pollVotes: currentVotes });
          }
        }
      });
    } catch (error) {
      // Revert on error
      const state = getInteractionState();
      delete state.votedPolls[post.id];
      saveInteractionState(state);

      const revertedState = { ...pollVotes };
      if (onPostUpdate) {
        onPostUpdate({ pollVotes: revertedState });
      }
      handleFirestoreError(error, OperationType.UPDATE, `posts/${post.id}`);
    } finally {
      setIsVotingPoll(false);
    }
  };

  const handleCopyHash = () => {
    navigator.clipboard.writeText(post.encryptedHash);
    setIsCopingHash(true);
    setTimeout(() => setIsCopingHash(false), 2000);
  };

  const shareUrl = `${window.location.origin}/?id=${post.encryptedHash}`;
  const shareTitle = post.title;

  const imageUrl = post.imageUrl 
    ? `${window.location.origin}/api/post-image/${post.encryptedHash}`
    : 'https://i.ibb.co/jkzWK6V6/14895-removebg-preview.png';

  // Format a simple, humble and elegant dispatch message matching the user request
  const dispatchText = `Venom

Review Post:
"${post.title}"
"${post.content || ''}"

Link: ${shareUrl}

Post Venom Now: https://myvenom.vercel.app`;

  const twitterDispatchText = `Venom

Review Post:
"${post.title}"

Link: ${shareUrl}

Post Venom Now: https://myvenom.vercel.app`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setIsCopiedLink(true);
    setTimeout(() => setIsCopiedLink(false), 2000);
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Venom — ${shareTitle}`,
          text: dispatchText,
          url: shareUrl,
        });
      } catch (err) {
        console.log('Error sharing:', err);
      }
    } else {
      handleCopyLink();
    }
  };

  const sharePlatforms = [
    {
      name: 'WhatsApp',
      icon: MessageCircle,
      color: 'hover:text-green-400 hover:border-green-500/30 text-emerald-500/70 hover:bg-green-950/15',
      url: `https://api.whatsapp.com/send?text=${encodeURIComponent(dispatchText)}`
    },
    {
      name: 'X / Twitter',
      icon: Twitter,
      color: 'hover:text-sky-400 hover:border-sky-500/30 text-emerald-500/70 hover:bg-sky-950/15',
      url: `https://twitter.com/intent/tweet?text=${encodeURIComponent(twitterDispatchText)}&url=${encodeURIComponent(shareUrl)}`
    },
    {
      name: 'Instagram',
      icon: Instagram,
      color: 'hover:text-pink-400 hover:border-pink-500/30 text-emerald-500/70 hover:bg-pink-950/15',
      url: `https://www.instagram.com/`
    },
    {
      name: 'Telegram',
      icon: Send,
      color: 'hover:text-blue-400 hover:border-blue-500/30 text-emerald-500/70 hover:bg-blue-950/15',
      url: `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(dispatchText)}`
    },
    {
      name: 'Reddit',
      icon: ExternalLink,
      color: 'hover:text-orange-400 hover:border-orange-500/30 text-emerald-500/70 hover:bg-orange-950/15',
      url: `https://www.reddit.com/submit?url=${encodeURIComponent(shareUrl)}&title=${encodeURIComponent(`[VENOM SECURE INTEL] ${shareTitle}`)}`
    },
    {
      name: 'Facebook',
      icon: Facebook,
      color: 'hover:text-indigo-400 hover:border-indigo-500/30 text-emerald-500/70 hover:bg-indigo-950/15',
      url: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`
    }
  ];

  const handleShare = () => {
    setShowShareModal(true);
  };

  const spawnFloatingEmojis = (emoji: string) => {
    const newParticles = Array.from({ length: 12 }).map((_, i) => ({
      id: Date.now() + i + Math.random(),
      emoji,
      x: (Math.random() - 0.5) * 140, // Nice horizontal dispersal
      delay: Math.random() * 0.3, // Beautiful staggered release
    }));
    setFloatingEmojis((prev) => [...prev, ...newParticles]);
    setTimeout(() => {
      setFloatingEmojis((prev) => prev.filter((p) => !newParticles.find((np) => np.id === p.id)));
    }, 2500);
  };

  const handleReact = async (reactionKey: string) => {
    setShowMobileReactions(false);
    if (isBlocked) {
      if (onBlockedActionTriggered) onBlockedActionTriggered();
      return;
    }
    if (isReactingState) return;
    setIsReactingState(true);

    try {
      const userIp = await getClientIp();
      const deviceImei = getDeviceImei();
      const interactionRef = doc(db, 'interactions', `${post.id}_${deviceImei}_reaction`);
      const postRef = doc(db, 'posts', post.id);

      await runTransaction(db, async (transaction) => {
        const reactionSnap = await transaction.get(interactionRef);
        const postSnap = await transaction.get(postRef);

        if (!postSnap.exists()) return;
        const currentPostData = postSnap.data();
        const currentReactions = { ...(currentPostData.reactions || {}) };

        if (reactionSnap.exists()) {
          const oldReactionKey = reactionSnap.data().reactionKey;

          if (oldReactionKey === reactionKey) {
            // Cancel reaction
            transaction.delete(interactionRef);
            currentReactions[reactionKey] = Math.max(0, (currentReactions[reactionKey] || 0) - 1);

            // Reconcile local storage & state
            setActiveReaction(null);
            setPostReactionStore(post.id, null);
          } else {
            // Switch reaction
            transaction.set(interactionRef, {
              ip: userIp,
              imei: deviceImei,
              postId: post.id,
              type: 'reaction',
              reactionKey,
              createdAt: new Date().toISOString()
            });

            currentReactions[oldReactionKey] = Math.max(0, (currentReactions[oldReactionKey] || 0) - 1);
            currentReactions[reactionKey] = (currentReactions[reactionKey] || 0) + 1;

            // Trigger floating emojis optimistically
            const emoji = REACTIONS.find(r => r.key === reactionKey)?.emoji || '❤️';
            spawnFloatingEmojis(emoji);

            // Reconcile local storage & state
            setActiveReaction(reactionKey);
            setPostReactionStore(post.id, reactionKey);
          }
        } else {
          // Brand new reaction
          transaction.set(interactionRef, {
            ip: userIp,
            imei: deviceImei,
            postId: post.id,
            type: 'reaction',
            reactionKey,
            createdAt: new Date().toISOString()
          });

          currentReactions[reactionKey] = (currentReactions[reactionKey] || 0) + 1;

          // Trigger floating emojis optimistically
          const emoji = REACTIONS.find(r => r.key === reactionKey)?.emoji || '❤️';
          spawnFloatingEmojis(emoji);

          // Reconcile local storage & state
          setActiveReaction(reactionKey);
          setPostReactionStore(post.id, reactionKey);
        }

        transaction.update(postRef, {
          reactions: currentReactions
        });

        if (onPostUpdate) {
          onPostUpdate({ reactions: currentReactions });
        }
      });
    } catch (error) {
      console.error('Failed to update reaction:', error);
      handleFirestoreError(error, OperationType.UPDATE, `posts/${post.id}`);
    } finally {
      setIsReactingState(false);
    }
  };

  const handleCommentsCountChange = (newCount: number) => {
    setCommentsCount(newCount);
    if (onPostUpdate) {
      onPostUpdate({ commentsCount: newCount });
    }
  };

  const formatTimestamp = (ts: any) => {
    if (!ts) return 'just now';
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getCategoryLabel = (cat: string) => {
    const map: { [key: string]: string } = {
      general: 'Discussion',
      tech: 'Tech & Dev',
      design: 'Design & Creative',
      gaming: 'Gaming',
      lifestyle: 'Lifestyle',
    };
    return map[cat] || cat;
  };

  return (
    <article 
      id={`post-${post.id}`} 
      className={`relative border rounded-xl overflow-hidden flex flex-col hover:shadow-2xl transition-all duration-300 font-sans text-zinc-300 ${
        highlighted 
          ? 'border-emerald-500/50 bg-emerald-950/10 shadow-[0_0_20px_rgba(16,185,129,0.15)] ring-1 ring-emerald-500/30' 
          : 'border-zinc-900 bg-zinc-950/70 hover:border-emerald-500/10'
      }`}
    >
      
      {/* Top Meta Info Header */}
      <div className={`px-4 py-3 flex items-center justify-between border-b border-zinc-900/40 text-[10px] text-zinc-500 font-mono gap-3 flex-wrap ${compact ? 'px-2.5 py-2 text-[9px]' : ''}`}>
        
        {/* Left Side: Category, Type and Report Button */}
        <div className="flex items-center gap-2 min-w-0">
          {/* 1. Post Type Badge (replacing the old category badge) */}
          <span className={`text-emerald-400 font-bold bg-emerald-950/30 border border-emerald-500/20 px-2 py-0.5 rounded uppercase text-[9px] tracking-wider flex items-center gap-1 shrink-0 ${compact ? 'px-1.5 py-0 text-[8px]' : ''}`}>
            {post.type === 'text' && <Hash className="w-2.5 h-2.5 text-emerald-400" />}
            {post.type === 'image' && <Eye className="w-2.5 h-2.5 text-emerald-400" />}
            {post.type === 'poll' && <BarChart2 className="w-2.5 h-2.5 text-emerald-400" />}
            {post.type === 'qa' && <HelpCircle className="w-2.5 h-2.5 text-emerald-400" />}
            <span>{post.type === 'qa' ? 'Q&A' : post.type.toUpperCase()}</span>
          </span>

          {highlighted && (
            <>
              <span className="text-zinc-800">•</span>
              <span className="bg-emerald-500 text-zinc-950 px-1.5 py-0.5 rounded uppercase text-[8px] font-black tracking-wider animate-pulse flex items-center gap-1">
                Target
              </span>
            </>
          )}

          <span className="text-zinc-800">•</span>

          {/* 2. Report Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              copyToClipboard(post.id || post.encryptedHash).then(() => {
                window.history.pushState({}, '', `/report?id=${post.id || post.encryptedHash}`);
                window.dispatchEvent(new PopStateEvent('popstate'));
              });
            }}
            className={`flex items-center gap-1 text-rose-500 hover:text-rose-400 font-bold bg-rose-950/10 hover:bg-rose-950/25 border border-rose-500/20 hover:border-rose-500/40 px-2.5 py-0.5 rounded uppercase text-[8px] tracking-wider transition-all cursor-pointer shrink-0 ${compact ? 'px-1.5 py-0 text-[7.5px]' : ''}`}
            title="Copy ID & Report this Venom"
          >
            <Flag className="w-2.5 h-2.5 text-rose-500" />
            <span>Report</span>
          </button>
        </div>

        {/* Right Side: Post ID and Share Button */}
        <div className="flex items-center gap-2 shrink-0 ml-auto md:ml-0">
          {/* 3. Post ID cryptographic tag */}
          <button 
            onClick={handleCopyHash}
            className="hover:text-emerald-400 cursor-pointer text-zinc-600 transition-colors flex items-center gap-1 group font-mono text-[9px] shrink-0"
            title="Click to copy post verification tag"
          >
            <Shield className="w-3 h-3 text-emerald-500/15 group-hover:text-emerald-400/50" />
            <span>{isCopingHash ? 'COPIED' : 'ID: ' + post.encryptedHash.substring(0, 8).toUpperCase()}</span>
          </button>

          <span className="text-zinc-800">•</span>

          {/* 4. Share Button */}
          <button
            onClick={handleShare}
            className="p-1 hover:bg-zinc-900/60 text-zinc-500 hover:text-emerald-400 rounded transition-all cursor-pointer relative shrink-0"
            title="Share Venom"
          >
            <Share2 className="w-3.5 h-3.5" />
          </button>
        </div>

      </div>

      {/* Main content pane */}
      <div className={`p-4 flex-1 flex flex-col ${compact ? 'p-3' : ''}`}>
        {/* Title */}
        <h2 className={`text-sm sm:text-base font-semibold text-zinc-100 tracking-tight leading-snug mb-2 font-sans hover:text-emerald-300 transition-colors ${compact ? 'text-xs mb-1' : ''}`}>
          {post.title}
        </h2>

        {/* Core content text */}
        {post.content && (
          <p className={`text-xs sm:text-sm text-zinc-400 leading-relaxed mb-4 whitespace-pre-wrap pl-0.5 break-words font-sans ${compact ? 'text-[11px] mb-2' : ''}`}>
            {post.content}
          </p>
        )}

        {/* --- Image Attachment (Optional for all post types) --- */}
        {post.imageUrl && (
          <div className="relative rounded overflow-hidden bg-zinc-900/30 border border-zinc-900 mb-4 max-h-80 flex items-center justify-center">
            <img 
              src={post.imageUrl} 
              alt={post.title} 
              referrerPolicy="no-referrer"
              className="max-h-80 object-contain w-full cursor-zoom-in hover:brightness-105 transition-all"
              onClick={() => setIsExpandingImage(true)}
            />
          </div>
        )}

        {/* --- Poll Post Renderer --- */}
        {post.type === 'poll' && post.pollOptions && (
          <div className="space-y-2 mb-4 pl-0.5">
            {post.pollOptions.map((option, idx) => {
              const optionVotes = pollVotes[idx] || 0;
              const percent = totalPollVotes > 0 ? Math.round((optionVotes / totalPollVotes) * 100) : 0;
              const isSelected = votedPollOption === idx;

              return (
                <div key={idx} className="relative">
                  {isVotedPoll ? (
                    /* Post-vote styled result */
                    <div className="border border-zinc-900 bg-zinc-950/20 p-2.5 rounded text-xs overflow-hidden flex items-center justify-between">
                      {/* Animated Progress slide-in fill */}
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${percent}%` }}
                        transition={{ duration: 0.6 }}
                        className="absolute inset-y-0 left-0 bg-emerald-500/5 border-r border-emerald-500/10 pointer-events-none"
                      />
                      
                      <div className="relative z-10 flex items-center gap-2 text-zinc-300 max-w-[75%] font-sans">
                        {isSelected && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                        <span className={isSelected ? 'text-emerald-300 font-semibold' : ''}>{option}</span>
                      </div>
                      <div className="relative z-10 text-right text-[10px] font-mono text-zinc-400">
                        <span className="font-bold text-zinc-300">{percent}%</span>
                        <span className="text-zinc-600 ml-1.5">({optionVotes})</span>
                      </div>
                    </div>
                  ) : (
                    /* Interactive pre-vote choice button */
                    <button
                      onClick={() => handlePollVote(idx)}
                      className="w-full text-left bg-zinc-900/40 hover:bg-zinc-900/80 border border-zinc-800 hover:border-emerald-500/20 p-2.5 rounded text-xs text-zinc-300 hover:text-emerald-400 cursor-pointer transition-all duration-200 font-sans"
                    >
                      {option}
                    </button>
                  )}
                </div>
              );
            })}
            
            {/* Poll summary stats metadata */}
            {isVotedPoll && (
              <div className="text-[9px] text-zinc-600 font-mono pt-1 text-right">
                TOTAL VOTES: {totalPollVotes}
              </div>
            )}
          </div>
        )}

        {/* --- Q&A Post Renderer --- */}
        {post.type === 'qa' && post.pollOptions && (
          <div className="space-y-2 mb-4 pl-0.5">
            {post.pollOptions.map((option, idx) => {
              const optionVotes = pollVotes[idx] || 0;
              const percent = totalPollVotes > 0 ? Math.round((optionVotes / totalPollVotes) * 100) : 0;
              const isSelected = votedPollOption === idx;
              const isCorrect = post.correctOptionIndex === idx;

              return (
                <div key={idx} className="relative">
                  {isVotedPoll ? (
                    /* Q&A Decrypted Stat result styling */
                    <div className={`border p-2.5 rounded text-xs flex items-center justify-between transition-all ${
                      isCorrect 
                        ? 'border-emerald-500/20 bg-emerald-950/5' 
                        : isSelected 
                          ? 'border-rose-500/20 bg-rose-950/5' 
                          : 'border-zinc-900 bg-zinc-950/20'
                    }`}>
                      {/* Animated Progress slide-in fill */}
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${percent}%` }}
                        transition={{ duration: 0.6 }}
                        className={`absolute inset-y-0 left-0 border-r pointer-events-none ${
                          isCorrect 
                            ? 'bg-emerald-500/5 border-emerald-500/10' 
                            : isSelected 
                              ? 'bg-rose-500/5 border-rose-500/10' 
                              : 'bg-zinc-500/5 border-zinc-500/10'
                        }`}
                      />

                      <div className="relative z-10 flex items-center gap-2 max-w-[75%] font-sans">
                        {isCorrect && (
                          <span className="text-[8px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1 py-0.2 rounded font-mono font-bold shrink-0">
                            CORRECT
                          </span>
                        )}
                        {isSelected && !isCorrect && (
                          <span className="text-[8px] bg-rose-500/20 text-rose-400 border border-rose-500/30 px-1 py-0.2 rounded font-mono font-bold shrink-0">
                            YOUR CHOICE
                          </span>
                        )}
                        <span className={`text-zinc-300 ${isCorrect ? 'text-emerald-400 font-semibold' : isSelected ? 'text-rose-400 font-semibold' : ''}`}>
                          {option}
                        </span>
                      </div>
                      <div className="relative z-10 text-right text-[10px] font-mono text-zinc-400">
                        <span className={`font-bold ${isCorrect ? 'text-emerald-400' : isSelected ? 'text-rose-400' : 'text-zinc-300'}`}>{percent}%</span>
                        <span className="text-zinc-600 ml-1.5">({optionVotes})</span>
                      </div>
                    </div>
                  ) : (
                    /* Interactive pre-choice selection button */
                    <button
                      onClick={() => handlePollVote(idx)}
                      className="w-full text-left bg-zinc-900/40 hover:bg-zinc-900/80 border border-zinc-800 hover:border-emerald-500/20 p-2.5 rounded text-xs text-zinc-300 hover:text-emerald-400 cursor-pointer transition-all duration-200 font-sans"
                    >
                      {option}
                    </button>
                  )}
                </div>
              );
            })}

            {isVotedPoll && (
              <div className="flex justify-between items-center text-[9px] text-zinc-600 font-mono pt-1">
                <div>
                  {post.correctOptionIndex !== undefined && votedPollOption === post.correctOptionIndex ? (
                    <span className="text-emerald-400 font-bold">✔ CORRECT CHOICE SELECTED</span>
                  ) : post.correctOptionIndex !== undefined ? (
                    <span className="text-rose-400 font-bold">✘ INCORRECT CHOICE SELECTED</span>
                  ) : (
                    <span>POLL SUBMISSION REGISTERED</span>
                  )}
                </div>
                <div>VOTES: {totalPollVotes}</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Scrollable Mobile Reaction Bar (opens with smooth height and fade animation on mobile) */}
      <AnimatePresence>
        {showMobileReactions && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden flex justify-center w-full sm:hidden bg-zinc-950/20 border-t border-zinc-900/40"
          >
            <div className="py-2 px-3 flex justify-center w-full">
              <div className="bg-zinc-900 border border-zinc-800 rounded-full py-1 px-2.5 flex items-center justify-between gap-1 shadow-xl w-full max-w-[280px]">
                {REACTIONS.map((r) => {
                  const count = post.reactions?.[r.key] || 0;
                  const isUserReacted = activeReaction === r.key;
                  return (
                    <button
                      key={r.key}
                      onClick={() => handleReact(r.key)}
                      className={`flex items-center gap-0.5 px-2 py-1 rounded-full transition-all duration-200 text-xs cursor-pointer active:scale-90 shrink-0 ${
                        isUserReacted
                          ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-bold'
                          : 'bg-transparent border border-transparent text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      <span className="text-sm shrink-0">{r.emoji}</span>
                      {count > 0 && <span className="font-mono text-[9px] font-medium opacity-80">{formatShortCount(count)}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer Interactive Actions */}
      <div className="px-3 py-2 border-t border-zinc-900/60 bg-zinc-950 flex justify-between items-center text-zinc-500 font-mono gap-1 sm:gap-2">
        
        {/* Left Side: Likes, Comments & Mobile React Button */}
        <div className="flex items-center gap-1 sm:gap-1.5 justify-start">
          {/* Likes Button */}
          <button
            onClick={handleLikeToggle}
            className={`flex items-center gap-1 sm:gap-1.5 px-2 py-1 hover:bg-zinc-900/60 rounded text-[10px] sm:text-xs transition-colors cursor-pointer ${
              liked ? 'text-rose-500 font-semibold font-bold' : 'hover:text-rose-400 text-zinc-500'
            }`}
          >
            <Heart className={`w-3.5 h-3.5 ${liked ? 'fill-rose-500 text-rose-500' : ''}`} />
            <span className="text-[10px]">{formatShortCount(post.likesCount)}</span>
          </button>

          {/* Comments Expand Button */}
          <button
            onClick={() => {
              const nextVal = !showComments;
              setShowComments(nextVal);
              if (nextVal) {
                setTimeout(() => {
                  const element = document.getElementById(`post-${post.id}`);
                  if (element) {
                    element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }
                }, 150);
              }
            }}
            className={`flex items-center gap-1 sm:gap-1.5 px-2 py-1 hover:bg-emerald-950/10 rounded text-[10px] sm:text-xs transition-colors cursor-pointer ${
              showComments ? 'text-emerald-400 font-semibold' : 'hover:text-emerald-400 text-zinc-500'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span className="text-[10px]">{formatShortCount(commentsCount)}</span>
          </button>

          {/* Mobile Screen: Minimalist React button beside Comment button */}
          <button
            onClick={() => {
              const nextVal = !showMobileReactions;
              setShowMobileReactions(nextVal);
              if (nextVal) {
                setTimeout(() => {
                  const element = document.getElementById(`post-${post.id}`);
                  if (element) {
                    element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                  }
                }, 150);
              }
            }}
            className={`flex sm:hidden items-center gap-1 px-2 py-1 hover:bg-zinc-900/60 rounded text-[10px] transition-colors cursor-pointer ${
              activeReaction ? 'text-emerald-400 font-semibold' : 'hover:text-emerald-400'
            }`}
            title="React to post"
          >
            {activeReaction ? (
              <span className="text-sm shrink-0">
                {REACTIONS.find((r) => r.key === activeReaction)?.emoji}
              </span>
            ) : (
              <Smile className="w-3.5 h-3.5 text-zinc-500 hover:text-emerald-400" />
            )}
            {Object.values(post.reactions || {}).reduce((a, b) => a + b, 0) > 0 && (
              <span className="text-[9px] text-zinc-400 ml-0.5">
                {formatShortCount(Object.values(post.reactions || {}).reduce((a, b) => a + b, 0))}
              </span>
            )}
          </button>
        </div>

        {/* Center Side: Static Reaction Bar (All 6 emojis on desktop, hidden on mobile) */}
        <div className="hidden sm:flex justify-center items-center flex-1">
          <div className="flex items-center gap-0.5 sm:gap-1 bg-zinc-900/40 border border-zinc-850/60 rounded-full p-0.5 px-1 sm:px-1.5 shadow-inner">
            {REACTIONS.map((r) => {
              const count = post.reactions?.[r.key] || 0;
              const isUserReacted = activeReaction === r.key;
              return (
                <button
                  key={r.key}
                  onClick={() => handleReact(r.key)}
                  className={`flex items-center gap-0.5 px-1 sm:px-1.5 py-0.5 rounded-full transition-all duration-200 text-[9px] sm:text-[11px] cursor-pointer group hover:scale-105 active:scale-95 ${
                    isUserReacted
                      ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-bold'
                      : 'bg-transparent border border-transparent text-zinc-500 hover:text-zinc-300'
                  }`}
                  title={r.label}
                >
                  <span className={`text-[11px] sm:text-xs transition-transform duration-200 ${isUserReacted ? 'scale-110' : 'group-hover:scale-120'}`}>
                    {r.emoji}
                  </span>
                  {count > 0 && <span className="font-mono text-[8px] sm:text-[9px] font-medium">{formatShortCount(count)}</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Side: Post Timeline */}
        <div className="flex items-center justify-end shrink-0">
          <span className={`text-[8px] sm:text-[10px] text-zinc-400 font-bold bg-zinc-900 border border-zinc-850 px-2 sm:px-3.5 py-1 rounded tracking-wider uppercase font-mono shadow-sm min-w-[70px] sm:min-w-[90px] text-center whitespace-nowrap hover:text-emerald-400 transition-colors`}>
            {formatTimeAgo(post.createdAt)}
          </span>
        </div>
      </div>

      {/* Expandable Comments Section */}
      <AnimatePresence>
        {showComments && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden bg-zinc-950/30"
          >
            <CommentsPane 
              postId={post.id} 
              onCommentsCountChange={handleCommentsCountChange}
              isBlocked={isBlocked}
              onBlockedActionTriggered={onBlockedActionTriggered}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Image expanded modal */}
      {isExpandingImage && post.imageUrl && (
        <div 
          className="fixed inset-0 bg-black/95 backdrop-blur-md z-50 flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setIsExpandingImage(false)}
        >
          <button 
            className="absolute top-4 right-4 p-2 bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-emerald-400 rounded"
            onClick={() => setIsExpandingImage(false)}
          >
            <X className="w-5 h-5" />
          </button>
          <img 
            src={post.imageUrl} 
            alt={post.title} 
            referrerPolicy="no-referrer"
            className="max-h-full max-w-full object-contain rounded border border-zinc-800 shadow-2xl animate-fade-in"
          />
        </div>
      )}

      {/* Premium Social Sharing Modal */}
      <AnimatePresence>
        {showShareModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4"
            onClick={() => setShowShareModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 15, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, y: 15, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="bg-zinc-950 border border-zinc-850 rounded-xl w-full max-w-sm overflow-hidden shadow-2xl relative"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="p-4 border-b border-zinc-900 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Share2 className="w-4 h-4 text-emerald-400" />
                  <span className="font-mono font-bold text-xs tracking-wider uppercase text-zinc-200">
                    Share Venom
                  </span>
                </div>
                <button
                  onClick={() => setShowShareModal(false)}
                  className="p-1.5 hover:bg-zinc-900 rounded-md text-zinc-500 hover:text-rose-400 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Body Content */}
              <div className="p-4 space-y-4">
                {/* Title Preview */}
                <div className="bg-zinc-900/40 border border-zinc-900 rounded-lg p-3 text-left">
                  <div className="text-[10px] text-zinc-600 font-mono font-bold tracking-wider uppercase mb-1">
                    Venom Post Preview
                  </div>
                  <h4 className="text-xs font-semibold text-zinc-300 font-sans line-clamp-1">
                    {post.title}
                  </h4>
                  {post.content && (
                    <p className="text-[11px] text-zinc-500 font-sans line-clamp-2 mt-1">
                      {post.content}
                    </p>
                  )}
                </div>

                {/* Primary Button: Device Native Share (Web Share API) */}
                {typeof navigator !== 'undefined' && navigator.share && (
                  <button
                    onClick={() => {
                      handleNativeShare();
                      setShowShareModal(false);
                    }}
                    className="w-full bg-emerald-500 hover:bg-emerald-400 text-zinc-950 py-2.5 px-4 rounded-lg font-bold text-xs tracking-wider flex items-center justify-center gap-2 transition-all duration-200 cursor-pointer shadow-lg shadow-emerald-950/20 active:scale-[0.98]"
                  >
                    <Share2 className="w-4 h-4 shrink-0" />
                    SHARE VIA DEVICE APPS
                  </button>
                )}

                {/* Grid of Social Platform Shortcuts */}
                <div className="space-y-2">
                  <div className="text-[9px] text-zinc-600 font-mono font-bold tracking-wider uppercase text-left">
                    Social Quick Links
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {sharePlatforms.map((platform) => {
                      const PlatformIcon = platform.icon;
                      return (
                        <a
                          key={platform.name}
                          href={platform.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => {
                            if (platform.name === 'Instagram') {
                              navigator.clipboard.writeText(dispatchText);
                              setIsCopiedLink(true);
                              setTimeout(() => setIsCopiedLink(false), 2000);
                            }
                            setTimeout(() => setShowShareModal(false), 500);
                          }}
                          className={`flex items-center gap-2.5 p-2 rounded-lg border border-zinc-900 bg-zinc-900/10 text-zinc-400 text-xs transition-all duration-200 ${platform.color} cursor-pointer hover:bg-zinc-900/40 font-sans`}
                        >
                          <PlatformIcon className="w-4 h-4 shrink-0" />
                          <span>{platform.name}</span>
                        </a>
                      );
                    })}
                  </div>
                </div>

                {/* Copy Link input box */}
                <div className="space-y-1.5 pt-1">
                  <div className="text-[9px] text-zinc-600 font-mono font-bold tracking-wider uppercase text-left">
                    Direct Secure Link
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={shareUrl}
                      onClick={(e) => (e.target as HTMLInputElement).select()}
                      className="bg-zinc-900 border border-zinc-850 rounded-lg px-3 py-1.5 text-[11px] text-zinc-400 select-all font-mono flex-1 focus:outline-none focus:border-zinc-700"
                    />
                    <button
                      onClick={handleCopyLink}
                      className="bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 px-3 py-1.5 rounded-lg text-xs font-bold tracking-wider flex items-center gap-1.5 transition-all cursor-pointer relative shrink-0"
                    >
                      {isCopiedLink ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                          <span className="text-emerald-400 text-[10px]">COPIED</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-zinc-500" />
                          <span className="text-[10px]">COPY LINK</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Footer status */}
              <div className="px-4 py-3 bg-zinc-900/40 border-t border-zinc-900 text-center text-[9px] text-zinc-500 font-mono">
                DECENTRALIZED ANONYMOUS LINK SECURED
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Emoji Particles Container (Instagram-like animations) */}
      <div className="absolute inset-x-0 bottom-0 pointer-events-none overflow-hidden h-96 z-50 flex items-end justify-center">
        <AnimatePresence>
          {floatingEmojis.map((particle) => (
            <motion.div
              key={particle.id}
              initial={{ opacity: 0, y: 20, x: 0, scale: 0.3 }}
              animate={{ 
                opacity: [0, 1, 1, 0], 
                y: -180 - Math.random() * 80, 
                x: particle.x,
                scale: [0.3, 1.4, 1.1, 0.7],
                rotate: (Math.random() - 0.5) * 60 
              }}
              transition={{ duration: 1.8, ease: 'easeOut', delay: particle.delay }}
              className="absolute pointer-events-none text-3xl select-none"
              style={{ bottom: '24px' }}
            >
              {particle.emoji}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

    </article>
  );
}
