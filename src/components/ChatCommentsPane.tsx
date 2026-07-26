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

interface ChatCommentsPaneProps {
  communityId: string;
  chatId: string;
  isBlocked?: boolean;
  onBlockedActionTriggered?: () => void;
}

export default function ChatCommentsPane({ 
  communityId, 
  chatId, 
  isBlocked = false,
  onBlockedActionTriggered,
}: ChatCommentsPaneProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newCommentText, setNewCommentText] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

  // Real-time listener for chat comments
  useEffect(() => {
    const commentsRef = collection(db, 'communities', communityId, 'chats', chatId, 'comments');
    const q = query(commentsRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fetchedComments = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        })) as Comment[];
        
        setComments(fetchedComments);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, `communities/${communityId}/chats/${chatId}/comments`);
      }
    );

    return () => unsubscribe();
  }, [communityId, chatId]);

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
      const commentsRef = collection(db, 'communities', communityId, 'chats', chatId, 'comments');
      const customCommentRef = doc(commentsRef);
      const newCommentId = customCommentRef.id;

      await setDoc(customCommentRef, {
        id: newCommentId,
        content: text,
        likesCount: 0,
        repliesCount: 0,
        createdAt: serverTimestamp(),
      });

      // Increment comments count on parent chat
      const chatRef = doc(db, 'communities', communityId, 'chats', chatId);
      await updateDoc(chatRef, {
        commentsCount: increment(1),
      });

    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `communities/${communityId}/chats/${chatId}/comments`);
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
    <div className="border-t border-zinc-900 bg-zinc-950/40 p-4 font-sans mt-3.5 rounded-b-2xl">
      <div className="flex items-center gap-2 mb-4 text-[10px] text-zinc-500 font-semibold uppercase tracking-wider font-mono">
        <MessageSquare className="w-3.5 h-3.5 text-emerald-500/85" />
        <span>COMMENTS ({comments.length})</span>
      </div>

      {/* Input Form */}
      <form onSubmit={handlePostComment} className="flex gap-2 mb-4">
        <input
          type="text"
          value={newCommentText}
          onChange={(e) => setNewCommentText(e.target.value)}
          placeholder="Add your anonymous comment..."
          maxLength={1000}
          className="flex-1 bg-zinc-900/60 border border-zinc-850 focus:border-emerald-500/40 rounded px-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-700 focus:outline-none transition-colors"
        />
        <button
          type="submit"
          disabled={!newCommentText.trim() || isSubmittingComment}
          className="bg-emerald-950/40 text-emerald-400 hover:bg-emerald-900/50 hover:text-emerald-300 border border-emerald-500/30 disabled:opacity-40 disabled:hover:bg-emerald-950/40 px-3 py-1.5 rounded text-xs font-semibold tracking-wider flex items-center gap-1 transition-all cursor-pointer font-sans"
        >
          <Send className="w-3 h-3" />
          <span>Comment</span>
        </button>
      </form>

      {/* Comments List */}
      <div className="space-y-4 max-h-[400px] overflow-y-auto pr-1">
        {comments.length === 0 ? (
          <div className="text-center py-4 text-[10px] text-zinc-600 flex flex-col items-center gap-1 font-mono">
            <ShieldAlert className="w-4 h-4 text-zinc-800 animate-pulse" />
            <span>No arguments recorded yet. Be first!</span>
          </div>
        ) : (
          comments.map((comment, index) => (
            <ChatCommentItem
              key={comment.id}
              communityId={communityId}
              chatId={chatId}
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

interface ChatCommentItemProps {
  key?: any;
  communityId: string;
  chatId: string;
  comment: Comment;
  index: number;
  isBlocked: boolean;
  onBlockedActionTriggered?: () => void;
  formatTimestamp: (ts: any) => string;
}

function ChatCommentItem({
  communityId,
  chatId,
  comment,
  index,
  isBlocked,
  onBlockedActionTriggered,
  formatTimestamp,
}: ChatCommentItemProps) {
  const [replies, setReplies] = useState<Reply[]>([]);
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);
  const [likesCount, setLikesCount] = useState(comment.likesCount);
  const [commentLiked, setCommentLiked] = useState(isCommentLiked(`${chatId}_${comment.id}`));

  useEffect(() => {
    setLikesCount(comment.likesCount);
    setCommentLiked(isCommentLiked(`${chatId}_${comment.id}`));
  }, [comment.id, comment.likesCount, chatId]);

  // Real-time listener for replies on THIS comment
  useEffect(() => {
    const repliesRef = collection(db, 'communities', communityId, 'chats', chatId, 'comments', comment.id, 'replies');
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
        handleFirestoreError(error, OperationType.GET, `communities/${communityId}/chats/${chatId}/comments/${comment.id}/replies`);
      }
    );

    return () => unsubscribe();
  }, [communityId, chatId, comment.id]);

  const handleCommentLike = async () => {
    if (isBlocked) {
      if (onBlockedActionTriggered) onBlockedActionTriggered();
      return;
    }
    const key = `${chatId}_${comment.id}`;
    const liked = toggleCommentLikeStore(key);
    setCommentLiked(liked);
    setLikesCount(prev => prev + (liked ? 1 : -1));
    
    try {
      const commentRef = doc(db, 'communities', communityId, 'chats', chatId, 'comments', comment.id);
      await updateDoc(commentRef, {
        likesCount: increment(liked ? 1 : -1),
      });
    } catch (error) {
      toggleCommentLikeStore(key);
      setCommentLiked(!liked);
      setLikesCount(prev => prev + (!liked ? 1 : -1));
      handleFirestoreError(error, OperationType.UPDATE, `communities/${communityId}/chats/${chatId}/comments/${comment.id}`);
    }
  };

  const handleReplyLike = async (replyId: string) => {
    if (isBlocked) {
      if (onBlockedActionTriggered) onBlockedActionTriggered();
      return;
    }
    const key = `${comment.id}_${replyId}`;
    const liked = toggleReplyLikeStore(key);
    
    // Optimistic UI updates
    setReplies(prev => prev.map(r => r.id === replyId ? { ...r, likesCount: r.likesCount + (liked ? 1 : -1) } : r));

    try {
      const replyRef = doc(db, 'communities', communityId, 'chats', chatId, 'comments', comment.id, 'replies', replyId);
      await updateDoc(replyRef, {
        likesCount: increment(liked ? 1 : -1),
      });
    } catch (error) {
      toggleReplyLikeStore(key);
      // Rollback on failure
      setReplies(prev => prev.map(r => r.id === replyId ? { ...r, likesCount: r.likesCount + (!liked ? 1 : -1) } : r));
      handleFirestoreError(error, OperationType.UPDATE, `communities/${communityId}/chats/${chatId}/comments/${comment.id}/replies/${replyId}`);
    }
  };

  const handlePostReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isBlocked) {
      if (onBlockedActionTriggered) onBlockedActionTriggered();
      return;
    }
    if (!replyText.trim() || isSubmittingReply) return;

    setIsSubmittingReply(true);
    const text = replyText.trim();
    setReplyText('');

    try {
      const repliesRef = collection(db, 'communities', communityId, 'chats', chatId, 'comments', comment.id, 'replies');
      const customReplyRef = doc(repliesRef);
      const newReplyId = customReplyRef.id;

      await setDoc(customReplyRef, {
        id: newReplyId,
        content: text,
        likesCount: 0,
        createdAt: serverTimestamp(),
      });

      // Increment replies count on comment document
      const commentRef = doc(db, 'communities', communityId, 'chats', chatId, 'comments', comment.id);
      await updateDoc(commentRef, {
        repliesCount: increment(1),
      });

      setShowReplyInput(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `communities/${communityId}/chats/${chatId}/comments/${comment.id}/replies`);
    } finally {
      setIsSubmittingReply(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: Math.min(index * 0.05, 0.3) }}
      className="p-3 border border-zinc-900 rounded-xl bg-zinc-950/80 space-y-2 relative"
    >
      <div className="flex justify-between items-center text-[9px] font-mono text-zinc-500">
        <span className="text-emerald-500/80">ANONYMOUS MEMBER</span>
        <span className="flex items-center gap-1">
          <Clock className="w-2.5 h-2.5 text-zinc-600" />
          {formatTimestamp(comment.createdAt)}
        </span>
      </div>

      <p className="text-xs text-zinc-300 leading-relaxed break-words">{comment.content}</p>

      {/* Action Footer */}
      <div className="flex items-center gap-4 text-[10px] text-zinc-500 font-mono select-none">
        {/* Like Button */}
        <button 
          onClick={handleCommentLike}
          className={`flex items-center gap-1 hover:text-emerald-400 transition-colors cursor-pointer font-bold ${
            commentLiked ? 'text-emerald-400' : ''
          }`}
        >
          <Heart className={`w-3 h-3 ${commentLiked ? 'fill-emerald-400 text-emerald-400' : ''}`} />
          <span>{likesCount}</span>
        </button>

        {/* Reply Toggle */}
        <button 
          onClick={() => setShowReplyInput(!showReplyInput)}
          className="flex items-center gap-1 hover:text-emerald-400 transition-colors cursor-pointer font-bold"
        >
          <MessageSquare className="w-3 h-3" />
          <span>Reply</span>
        </button>
      </div>

      {/* Reply Input Form */}
      <AnimatePresence>
        {showReplyInput && (
          <motion.form 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            onSubmit={handlePostReply}
            className="flex gap-2 pt-2 border-t border-zinc-900/40"
          >
            <input
              type="text"
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Write a nested reply..."
              required
              className="flex-1 bg-zinc-900/80 border border-zinc-850 focus:border-emerald-500/30 rounded px-2.5 py-1 text-xs text-zinc-300 placeholder-zinc-700 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!replyText.trim() || isSubmittingReply}
              className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-emerald-400 hover:text-emerald-300 px-3 py-1 rounded text-[10px] font-bold"
            >
              Reply
            </button>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Nested Replies List */}
      {replies.length > 0 && (
        <div className="pl-4 border-l border-zinc-900/60 mt-3 space-y-2.5">
          {replies.map((reply) => {
            const replyLiked = isReplyLiked(`${comment.id}_${reply.id}`);
            return (
              <div key={reply.id} className="text-xs bg-zinc-900/20 p-2.5 rounded-lg space-y-1.5 border border-zinc-900/40 relative">
                <div className="flex justify-between items-center text-[8px] font-mono text-zinc-600">
                  <span className="flex items-center gap-0.5">
                    <CornerDownRight className="w-2.5 h-2.5 text-zinc-700" />
                    COHORT RESPONSE
                  </span>
                  <span>{formatTimestamp(reply.createdAt)}</span>
                </div>
                <p className="text-zinc-300 break-words font-sans">{reply.content}</p>
                
                {/* Reply Footer */}
                <div className="flex items-center gap-3 text-[9px] text-zinc-500 font-mono">
                  <button 
                    onClick={() => handleReplyLike(reply.id)}
                    className={`flex items-center gap-0.5 hover:text-emerald-400 transition-colors cursor-pointer font-bold ${
                      replyLiked ? 'text-emerald-400' : ''
                    }`}
                  >
                    <Heart className={`w-2.5 h-2.5 ${replyLiked ? 'fill-emerald-400 text-emerald-400' : ''}`} />
                    <span>{reply.likesCount || 0}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
