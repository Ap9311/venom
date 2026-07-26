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
  query, 
  orderBy, 
  onSnapshot, 
  increment, 
  serverTimestamp 
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Comment, Reply } from '../types';
import { 
  isCommentLiked, 
  toggleCommentLikeStore, 
  isReplyLiked, 
  toggleReplyLikeStore 
} from '../utils/storage';
import { Heart, CornerDownRight, MessageSquare, Send, ShieldAlert, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface CommentsPaneProps {
  postId: string;
  onCommentsCountChange?: (newCount: number) => void;
  isBlocked?: boolean;
  onBlockedActionTriggered?: () => void;
}

export default function CommentsPane({ 
  postId, 
  onCommentsCountChange,
  isBlocked = false,
  onBlockedActionTriggered,
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
        
        setComments(fetchedComments);
        if (onCommentsCountChange) {
          onCommentsCountChange(fetchedComments.length);
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, `posts/${postId}/comments`);
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
      const customCommentRef = doc(commentsRef); // Pre-generate ID
      const newCommentId = customCommentRef.id;

      await setDoc(customCommentRef, {
        id: newCommentId, // This matches the document ID and satisfies firestore rules perfectly!
        content: text,
        likesCount: 0,
        repliesCount: 0,
        createdAt: serverTimestamp(),
      });

      // Increment comments count on the post
      const postRef = doc(db, 'posts', postId);
      await updateDoc(postRef, {
        commentsCount: increment(1),
      });

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

  return (
    <div className="border-t border-zinc-900 bg-zinc-950/40 p-4 sm:p-5 font-sans">
      <div className="flex items-center gap-2 mb-4 text-xs text-zinc-400 font-semibold uppercase tracking-wider font-mono">
        <MessageSquare className="w-4 h-4 text-emerald-500/80" />
        <span>COMMENTS ({comments.length})</span>
      </div>

      {/* Input Form */}
      <form onSubmit={handlePostComment} className="flex gap-2 mb-6">
        <input
          type="text"
          value={newCommentText}
          onChange={(e) => setNewCommentText(e.target.value)}
          placeholder="Write a comment..."
          maxLength={1000}
          className="flex-1 bg-zinc-900/60 border border-zinc-800/80 focus:border-emerald-500/40 rounded px-3 py-2 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none transition-colors"
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
      <div className="space-y-4">
        {comments.length === 0 ? (
          <div className="text-center py-6 text-xs text-zinc-600 flex flex-col items-center gap-2 font-mono">
            <ShieldAlert className="w-5 h-5 text-zinc-700 animate-pulse" />
            <span>No comments yet. Share your thoughts above!</span>
          </div>
        ) : (
          comments.map((comment, index) => (
            <CommentItem
              key={comment.id}
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
  const [replies, setReplies] = useState<Reply[]>([]);
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);
  const [likesCount, setLikesCount] = useState(comment.likesCount);
  const [commentLiked, setCommentLiked] = useState(isCommentLiked(`${postId}_${comment.id}`));

  useEffect(() => {
    setLikesCount(comment.likesCount);
    setCommentLiked(isCommentLiked(`${postId}_${comment.id}`));
  }, [comment.id, comment.likesCount, postId]);

  // Real-time listener for replies on THIS comment
  useEffect(() => {
    const repliesRef = collection(db, 'posts', postId, 'comments', comment.id, 'replies');
    const q = query(repliesRef, orderBy('createdAt', 'asc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fetchedReplies = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        })) as Reply[];
        setReplies(fetchedReplies);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, `posts/${postId}/comments/${comment.id}/replies`);
      }
    );

    return () => unsubscribe();
  }, [postId, comment.id]);

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
    } catch (error) {
      // Revert local state and storage on failure
      toggleCommentLikeStore(key);
      setCommentLiked(!liked);
      setLikesCount(prev => prev + (!liked ? 1 : -1));
      handleFirestoreError(error, OperationType.UPDATE, `posts/${postId}/comments/${comment.id}`);
    }
  };

  const handleReplyLike = async (replyId: string) => {
    if (isBlocked) {
      if (onBlockedActionTriggered) onBlockedActionTriggered();
      return;
    }
    const key = `${comment.id}_${replyId}`;
    const liked = toggleReplyLikeStore(key);

    // Optimistically update the replies array to show the new like count instantly
    setReplies(prev => prev.map(r => r.id === replyId ? { ...r, likesCount: r.likesCount + (liked ? 1 : -1) } : r));

    try {
      const replyRef = doc(db, 'posts', postId, 'comments', comment.id, 'replies', replyId);
      await updateDoc(replyRef, {
        likesCount: increment(liked ? 1 : -1),
      });
    } catch (error) {
      // Revert
      toggleReplyLikeStore(key);
      setReplies(prev => prev.map(r => r.id === replyId ? { ...r, likesCount: r.likesCount + (!liked ? 1 : -1) } : r));
      handleFirestoreError(error, OperationType.UPDATE, `posts/${postId}/comments/${comment.id}/replies/${replyId}`);
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
      const repliesRef = collection(db, 'posts', postId, 'comments', comment.id, 'replies');
      const customReplyRef = doc(repliesRef); // Pre-generate ID
      const newReplyId = customReplyRef.id;

      await setDoc(customReplyRef, {
        id: newReplyId,
        content: text,
        likesCount: 0,
        createdAt: serverTimestamp(),
      });

      // Increment replies count on comment
      const commentRef = doc(db, 'posts', postId, 'comments', comment.id);
      await updateDoc(commentRef, {
        repliesCount: increment(1),
      });

    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `posts/${postId}/comments/${comment.id}/replies`);
    } finally {
      setIsSubmittingReply(false);
    }
  };

  const signature = `User#${comment.id.substring(0, 4).toUpperCase()}`;

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
          <span>{comment.repliesCount || replies.length} { (comment.repliesCount || replies.length) === 1 ? 'reply' : 'replies'}</span>
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
            {replies.length > 0 && (
              <div className="space-y-3 pt-1">
                {replies.map((reply) => {
                  const replyLiked = isReplyLiked(`${comment.id}_${reply.id}`);
                  const replySig = `User#${reply.id.substring(0, 4).toUpperCase()}`;

                  return (
                    <div key={reply.id} className="bg-zinc-950/20 p-2 rounded border border-zinc-900/60 font-sans">
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
