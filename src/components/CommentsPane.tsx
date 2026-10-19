/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  collection, 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc,
  query, 
  orderBy, 
  onSnapshot, 
  increment, 
  serverTimestamp,
  arrayUnion 
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Comment, Reply } from '../types';
import { getDeviceImei } from '../utils/ip';
import { 
  isCommentLiked, 
  toggleCommentLikeStore, 
  isReplyLiked, 
  toggleReplyLikeStore 
} from '../utils/storage';
import { Heart, CornerDownRight, MessageSquare, Send, ShieldAlert, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

function deduplicateById<T extends { id?: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  items.forEach((item, index) => {
    const id = item.id || `item_${index}`;
    if (!seen.has(id)) {
      seen.add(id);
      result.push(item);
    }
  });
  return result;
}

interface CommentsPaneProps {
  postId: string;
  onCommentsCountChange?: (newCount: number) => void;
  isBlocked?: boolean;
  onBlockedActionTriggered?: () => void;
  isDrawerMode?: boolean;
}

export default function CommentsPane({ 
  postId, 
  onCommentsCountChange,
  isBlocked = false,
  onBlockedActionTriggered,
  isDrawerMode = false,
}: CommentsPaneProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newCommentText, setNewCommentText] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

  // Real-time listener for comments
  useEffect(() => {
    const commentsRef = collection(db, 'posts', postId, 'comments');
    const q = query(commentsRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fetchedComments = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        })) as Comment[];
        
        setComments(deduplicateById(fetchedComments));
        if (onCommentsCountChange) {
          onCommentsCountChange(fetchedComments.length);
        }
      },
      (error) => {
        console.warn('Comments query fallback notice:', error);
      }
    );

    return () => unsubscribe();
  }, [postId]);

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isBlocked) {
      if (onBlockedActionTriggered) onBlockedActionTriggered();
      return;
    }
    if (!newCommentText.trim() || isSubmittingComment) return;

    setIsSubmittingComment(true);
    const text = newCommentText.trim();
    setNewCommentText('');

    try {
      const commentsRef = collection(db, 'posts', postId, 'comments');
      const customCommentRef = doc(commentsRef);
      const newCommentId = customCommentRef.id;

      await setDoc(customCommentRef, {
        id: newCommentId,
        content: text,
        likesCount: 0,
        repliesCount: 0,
        repliesList: [],
        createdAt: serverTimestamp(),
      });

      // Increment comments count on the post
      try {
        const postRef = doc(db, 'posts', postId);
        await updateDoc(postRef, {
          commentsCount: increment(1),
        });
      } catch (cntErr) {
        console.warn('Post comment counter increment notice:', cntErr);
      }

    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `posts/${postId}/comments`);
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const formatTimestamp = (ts: any) => {
    if (!ts) return 'just now';
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' ' + date.toLocaleDateString();
  };

  const uniqueComments = deduplicateById<Comment>(comments);

  if (isDrawerMode) {
    return (
      <div className="flex flex-col h-full font-sans bg-zinc-950 overflow-hidden">
        {/* Comments List (Fills remaining height) */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {uniqueComments.length === 0 ? (
            <div className="text-center py-12 text-xs text-zinc-500 flex flex-col items-center justify-center gap-2 font-mono">
              <ShieldAlert className="w-6 h-6 text-zinc-600 animate-pulse" />
              <span className="text-zinc-300 font-sans font-medium text-sm">No comments yet</span>
              <span className="text-[11px] text-zinc-600">Be the first to share your thoughts!</span>
            </div>
          ) : (
            uniqueComments.map((comment, index) => (
              <CommentItem
                key={comment.id ? `${comment.id}_${index}` : `comment_${index}`}
                postId={postId}
                comment={comment}
                index={index}
                isBlocked={isBlocked}
                onBlockedActionTriggered={onBlockedActionTriggered}
                formatTimestamp={formatTimestamp}
              />
            ))
          )}
        </div>

        {/* Sticky Instagram-style Comment Input Bar at the Bottom */}
        <div className="p-3 bg-zinc-950/95 border-t border-zinc-900 shrink-0">
          <form onSubmit={handlePostComment} className="flex items-center gap-2 max-w-2xl mx-auto">
            <input
              type="text"
              value={newCommentText}
              onChange={(e) => setNewCommentText(e.target.value)}
              placeholder="Add an anonymous comment..."
              maxLength={1000}
              className="flex-1 bg-zinc-900/80 border border-zinc-800/90 focus:border-emerald-500/50 rounded-full px-4 py-2.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none transition-all font-sans"
            />
            <button
              type="submit"
              disabled={!newCommentText.trim() || isSubmittingComment}
              className="bg-emerald-500 hover:bg-emerald-400 text-zinc-950 disabled:bg-zinc-800 disabled:text-zinc-600 disabled:opacity-50 px-4 py-2.5 rounded-full text-xs font-bold tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer font-sans shrink-0 active:scale-95 shadow-md"
            >
              <Send className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Post</span>
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="border-t border-zinc-900 bg-zinc-950/40 p-4 sm:p-5 font-sans">
      <div className="flex items-center gap-2 mb-4 text-xs text-zinc-400 font-semibold uppercase tracking-wider font-mono">
        <MessageSquare className="w-4 h-4 text-emerald-500/80" />
        <span>COMMENTS ({uniqueComments.length})</span>
      </div>

      {/* Input Form */}
      <form onSubmit={handlePostComment} className="flex gap-2 mb-6">
        <input
          type="text"
          value={newCommentText}
          onChange={(e) => setNewCommentText(e.target.value)}
          placeholder="Write a comment..."
          maxLength={1000}
          className="flex-1 bg-zinc-900/60 border border-zinc-850/80 focus:border-emerald-500/40 rounded px-3 py-2 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none transition-colors"
        />
        <button
          type="submit"
          disabled={!newCommentText.trim() || isSubmittingComment}
          className="bg-emerald-950/40 text-emerald-400 hover:bg-emerald-900/50 hover:text-emerald-300 border border-emerald-500/30 disabled:opacity-40 disabled:hover:bg-emerald-950/40 px-4 py-2 rounded text-xs font-semibold tracking-wider flex items-center gap-1.5 transition-all cursor-pointer font-sans"
        >
          <Send className="w-3.5 h-3.5" />
          <span>Comment</span>
        </button>
      </form>

      {/* Comments List */}
      <div className="space-y-4 max-h-[220px] overflow-y-auto pr-1">
        {uniqueComments.length === 0 ? (
          <div className="text-center py-6 text-xs text-zinc-600 flex flex-col items-center gap-2 font-mono">
            <ShieldAlert className="w-5 h-5 text-zinc-700 animate-pulse" />
            <span>No comments yet. Share your thoughts above!</span>
          </div>
        ) : (
          uniqueComments.map((comment, index) => (
            <CommentItem
              key={comment.id ? `${comment.id}_${index}` : `comment_${index}`}
              postId={postId}
              comment={comment}
              index={index}
              isBlocked={isBlocked}
              onBlockedActionTriggered={onBlockedActionTriggered}
              formatTimestamp={formatTimestamp}
            />
          ))
        )}
      </div>
    </div>
  );
}

interface CommentItemProps {
  key?: React.Key;
  postId: string;
  comment: Comment;
  index: number;
  isBlocked: boolean;
  onBlockedActionTriggered?: () => void;
  formatTimestamp: (ts: any) => string;
}

function CommentItem({
  postId,
  comment,
  index,
  isBlocked,
  onBlockedActionTriggered,
  formatTimestamp,
}: CommentItemProps) {
  const [replies, setReplies] = useState<Reply[]>(Array.isArray((comment as any).repliesList) ? (comment as any).repliesList : []);
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);
  const [likesCount, setLikesCount] = useState(comment.likesCount);
  const [commentLiked, setCommentLiked] = useState(isCommentLiked(`${postId}_${comment.id}`));

  useEffect(() => {
    setLikesCount(comment.likesCount);
    setCommentLiked(isCommentLiked(`${postId}_${comment.id}`));
  }, [comment.id, comment.likesCount, postId]);

  // Real-time listener for replies on THIS comment with fallback to comment document's repliesList array
  useEffect(() => {
    if (Array.isArray((comment as any).repliesList)) {
      setReplies(deduplicateById((comment as any).repliesList));
    }

    const repliesRef = collection(db, 'posts', postId, 'comments', comment.id, 'replies');
    const q = query(repliesRef, orderBy('createdAt', 'asc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fetchedReplies = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        })) as Reply[];

        const docReplies = Array.isArray((comment as any).repliesList) ? (comment as any).repliesList : [];
        const merged = deduplicateById([...docReplies, ...fetchedReplies]);
        setReplies(merged);
      },
      (error) => {
        if (Array.isArray((comment as any).repliesList)) {
          setReplies(deduplicateById((comment as any).repliesList));
        }
      }
    );

    return () => unsubscribe();
  }, [postId, comment.id, (comment as any).repliesList]);

  const handleCommentLike = async () => {
    if (isBlocked) {
      if (onBlockedActionTriggered) onBlockedActionTriggered();
      return;
    }
    const key = `${postId}_${comment.id}`;
    const liked = toggleCommentLikeStore(key);
    setCommentLiked(liked);
    setLikesCount(prev => prev + (liked ? 1 : -1));
    
    try {
      const commentRef = doc(db, 'posts', postId, 'comments', comment.id);
      await updateDoc(commentRef, {
        likesCount: increment(liked ? 1 : -1),
      });

      // Persist to interactions collection for device fingerprint tracking
      const deviceImei = await getDeviceImei();
      const interactionRef = doc(db, 'interactions', `${key}_${deviceImei}_comment_like`);
      if (liked) {
        setDoc(interactionRef, {
          type: 'like_comment',
          commentKey: key,
          postId,
          commentId: comment.id,
          imei: deviceImei,
          createdAt: new Date().toISOString()
        }).catch(console.error);
      } else {
        deleteDoc(interactionRef).catch(console.error);
      }
    } catch (error) {
      toggleCommentLikeStore(key);
      setCommentLiked(!liked);
      setLikesCount(prev => prev + (!liked ? 1 : -1));
    }
  };

  const handleReplyLike = async (replyId: string) => {
    if (isBlocked) {
      if (onBlockedActionTriggered) onBlockedActionTriggered();
      return;
    }
    const key = `${comment.id}_${replyId}`;
    const liked = toggleReplyLikeStore(key);

    const updated = replies.map(r => r.id === replyId ? { ...r, likesCount: Math.max(0, (r.likesCount || 0) + (liked ? 1 : -1)) } : r);
    setReplies(deduplicateById(updated));

    try {
      const commentRef = doc(db, 'posts', postId, 'comments', comment.id);
      await updateDoc(commentRef, {
        repliesList: updated
      });

      try {
        const replyRef = doc(db, 'posts', postId, 'comments', comment.id, 'replies', replyId);
        await updateDoc(replyRef, {
          likesCount: increment(liked ? 1 : -1),
        });
      } catch (subErr) {}
    } catch (error) {
      toggleReplyLikeStore(key);
      setReplies(prev => prev.map(r => r.id === replyId ? { ...r, likesCount: Math.max(0, (r.likesCount || 0) + (!liked ? 1 : -1)) } : r));
    }
  };

  const handlePostReply = async () => {
    if (isBlocked) {
      if (onBlockedActionTriggered) onBlockedActionTriggered();
      return;
    }
    const text = replyText.trim();
    if (!text || isSubmittingReply) return;

    setIsSubmittingReply(true);
    setReplyText('');

    try {
      const newReplyObj = {
        id: 'reply_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        content: text,
        likesCount: 0,
        createdAt: new Date().toISOString()
      };

      const commentRef = doc(db, 'posts', postId, 'comments', comment.id);
      await updateDoc(commentRef, {
        repliesList: arrayUnion(newReplyObj),
        repliesCount: increment(1)
      });

      setReplies(prev => deduplicateById([...prev, newReplyObj]));

      try {
        const repliesRef = collection(db, 'posts', postId, 'comments', comment.id, 'replies');
        await setDoc(doc(repliesRef, newReplyObj.id), {
          ...newReplyObj,
          createdAt: serverTimestamp()
        });
      } catch (subErr) {}

    } catch (error) {
      console.error('Failed to post reply:', error);
    } finally {
      setIsSubmittingReply(false);
    }
  };

  const signature = `User#${comment.id.substring(0, 4).toUpperCase()}`;
  const uniqueReplies = deduplicateById<Reply>(replies);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: Math.min(index * 0.05, 0.4) }}
      className="border-b border-zinc-900/40 pb-4 last:border-0 last:pb-0"
    >
      {/* Comment Meta / Signature */}
      <div className="flex items-center justify-between mb-1.5 font-mono">
        <div className="flex items-center gap-2">
          <span className="text-[9px] text-zinc-400 font-bold bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-800/60 uppercase">
            {signature}
          </span>
          <span className="text-[8px] text-zinc-600 flex items-center gap-1">
            <Clock className="w-2.5 h-2.5" />
            {formatTimestamp(comment.createdAt)}
          </span>
        </div>
      </div>

      {/* Content */}
      <p className="text-xs text-zinc-300 leading-relaxed pl-1 mb-2.5 break-words font-sans">
        {comment.content}
      </p>

      {/* Comment Actions */}
      <div className="flex items-center gap-4 text-[10px] text-zinc-500 pl-1 font-mono">
        <button
          onClick={handleCommentLike}
          className={`flex items-center gap-1 transition-colors cursor-pointer ${
            commentLiked ? 'text-rose-500 font-bold' : 'hover:text-rose-400'
          }`}
        >
          <Heart className={`w-3.5 h-3.5 ${commentLiked ? 'fill-rose-500' : ''}`} />
          <span>{likesCount}</span>
        </button>

        <button
          onClick={() => setShowReplyInput(prev => !prev)}
          className="flex items-center gap-1 hover:text-emerald-400 transition-colors cursor-pointer"
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>{comment.repliesCount || uniqueReplies.length} { (comment.repliesCount || uniqueReplies.length) === 1 ? 'reply' : 'replies'}</span>
        </button>
      </div>

      {/* Expanded Replies Block */}
      <AnimatePresence>
        {showReplyInput && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.15 }}
            className="mt-3 pl-4 border-l border-zinc-800/80 space-y-3"
          >
            {/* Replies List */}
            {uniqueReplies.length > 0 && (
              <div className="space-y-3 pt-1">
                {uniqueReplies.map((reply, replyIdx) => {
                  const replyLiked = isReplyLiked(`${comment.id}_${reply.id}`);
                  const replySig = `User#${(reply.id || '').substring(0, 4).toUpperCase()}`;
                  const replyKey = reply.id ? `${reply.id}_${replyIdx}` : `reply_${replyIdx}`;

                  return (
                    <div key={replyKey} className="bg-zinc-950/20 p-2 rounded border border-zinc-900/60 font-sans">
                      <div className="flex items-center justify-between mb-1 font-mono">
                        <div className="flex items-center gap-2">
                          <span className="text-[8px] text-zinc-400 font-bold bg-zinc-900 px-1 py-0.2 rounded border border-zinc-800/50 uppercase">
                            {replySig}
                          </span>
                          <span className="text-[8px] text-zinc-600">
                            {formatTimestamp(reply.createdAt)}
                          </span>
                        </div>
                      </div>
                      <p className="text-xs text-zinc-400 pl-1 break-words leading-relaxed mb-1.5 font-sans">
                        {reply.content}
                      </p>
                      <button
                        onClick={() => handleReplyLike(reply.id)}
                        className={`flex items-center gap-1 text-[9px] text-zinc-500 pl-1 transition-colors cursor-pointer font-mono ${
                          replyLiked ? 'text-rose-500 font-bold' : 'hover:text-rose-400'
                        }`}
                      >
                        <Heart className={`w-3 h-3 ${replyLiked ? 'fill-rose-500' : ''}`} />
                        <span>{reply.likesCount}</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Reply Form */}
            <div className="flex gap-2 items-center pt-2">
              <CornerDownRight className="w-4 h-4 text-zinc-600 shrink-0" />
              <input
                type="text"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Write a reply..."
                maxLength={1000}
                className="flex-1 bg-zinc-900/50 border border-zinc-800 focus:border-emerald-500/30 rounded px-2.5 py-1.5 text-xs text-zinc-300 placeholder-zinc-700 focus:outline-none transition-colors"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && replyText.trim()) {
                    handlePostReply();
                  }
                }}
              />
              <button
                onClick={handlePostReply}
                disabled={!replyText.trim() || isSubmittingReply}
                className="px-2.5 py-1.5 rounded text-[10px] font-bold bg-emerald-950/25 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-900/30 transition-colors disabled:opacity-40 cursor-pointer font-sans"
              >
                Reply
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
