/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from 'react';
import { motion, AnimatePresence, useDragControls } from 'motion/react';
import { X, MessageSquare } from 'lucide-react';
import { Post } from '../types';
import CommentsPane from './CommentsPane';

interface InstagramCommentsSheetProps {
  post: Post | null;
  onClose: () => void;
  isBlocked?: boolean;
  onBlockedActionTriggered?: () => void;
  onCommentsCountChange?: (postId: string, newCount: number) => void;
}

export default function InstagramCommentsSheet({
  post,
  onClose,
  isBlocked = false,
  onBlockedActionTriggered,
  onCommentsCountChange,
}: InstagramCommentsSheetProps) {
  const dragControls = useDragControls();

  // Lock body scroll when drawer is active
  useEffect(() => {
    if (post) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          onClose();
        }
      };
      window.addEventListener('keydown', handleKeyDown);

      return () => {
        document.body.style.overflow = originalOverflow;
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [post, onClose]);

  if (!post) return null;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end pointer-events-auto">
      {/* Darkened Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Slide-up Instagram Reels Style Sheet Drawer */}
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 350 }}
        drag="y"
        dragControls={dragControls}
        dragListener={false}
        dragConstraints={{ top: 0 }}
        dragElastic={0.15}
        onDragEnd={(_, info) => {
          if (info.offset.y > 120 || info.velocity.y > 450) {
            onClose();
          }
        }}
        className="relative w-full max-w-2xl mx-auto bg-zinc-950 border-t border-x border-zinc-850 rounded-t-2xl sm:rounded-t-3xl shadow-[0_-16px_48px_rgba(0,0,0,0.9)] flex flex-col overflow-hidden h-[75vh] max-h-[calc(100vh-68px)] bottom-0 z-10"
      >
        {/* Drag Handle & Header Bar */}
        <div className="pt-2.5 pb-3 px-4 border-b border-zinc-900 bg-zinc-950/95 backdrop-blur-md shrink-0 flex flex-col">
          {/* Centered Drag Pill - Active Drag Target */}
          <div 
            onPointerDown={(e) => dragControls.start(e)}
            className="w-12 h-1.5 bg-zinc-700/80 hover:bg-zinc-500 rounded-full mx-auto mb-2.5 cursor-grab active:cursor-grabbing transition-colors touch-none" 
            title="Drag down to close"
          />

          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <MessageSquare className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="font-mono font-bold text-xs uppercase tracking-wider text-zinc-200">
                Comments
              </span>
              {post.commentsCount !== undefined && (
                <span className="text-[10px] font-mono text-emerald-400 font-bold bg-emerald-950/40 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                  {post.commentsCount}
                </span>
              )}
            </div>

            <button
              onClick={onClose}
              className="p-1.5 hover:bg-zinc-900 rounded-full text-zinc-400 hover:text-rose-400 transition-colors cursor-pointer"
              title="Close Comments (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Post Context Bar */}
          <div className="mt-2 text-xs text-zinc-400 truncate font-sans bg-zinc-900/60 px-3 py-1.5 rounded-lg border border-zinc-850">
            <span className="text-zinc-500 font-mono text-[10px] mr-1.5 uppercase tracking-wider font-bold">Post:</span>
            <span className="text-zinc-200 font-medium">"{post.title}"</span>
          </div>
        </div>

        {/* Scrollable Comments Content Container */}
        <div className="flex-1 min-h-0 flex flex-col bg-zinc-950">
          <CommentsPane
            postId={post.id}
            isBlocked={isBlocked}
            onBlockedActionTriggered={onBlockedActionTriggered}
            onCommentsCountChange={(cnt) => {
              if (onCommentsCountChange) onCommentsCountChange(post.id, cnt);
            }}
            isDrawerMode={true}
          />
        </div>
      </motion.div>
    </div>
  );
}
