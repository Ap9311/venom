/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { db } from '../../firebase';
import { doc, deleteDoc } from 'firebase/firestore';
import { Post } from '../../types';
import { Database, Search, Edit3, Trash2, ShieldAlert, RefreshCw, CheckCircle, ExternalLink } from 'lucide-react';

interface AdminPostsProps {
  posts: Post[];
  onStartEdit: (post: Post) => void;
  onBlockIpClick?: (ip: string, imei?: string) => void;
}

export const AdminPosts: React.FC<AdminPostsProps> = ({ posts, onStartEdit, onBlockIpClick }) => {
  const [adminSearchTerm, setAdminSearchTerm] = useState('');
  const [postIdToConfirmDelete, setPostIdToConfirmDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteSuccess, setDeleteSuccess] = useState<string | null>(null);

  // Filter posts based on search term (ID, Title, Category, Content, or IP)
  const filteredAdminPosts = posts.filter((post) => {
    const term = adminSearchTerm.trim().toLowerCase();
    if (!term) return true;
    
    return (
      post.id?.toLowerCase().includes(term) ||
      post.title?.toLowerCase().includes(term) ||
      post.content?.toLowerCase().includes(term) ||
      post.category?.toLowerCase().includes(term) ||
      post.postedFromIp?.toLowerCase().includes(term)
    );
  });

  // Handle post deletion
  const handleDeletePost = async (postId: string) => {
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const postRef = doc(db, 'posts', postId);
      await deleteDoc(postRef);
      setDeleteSuccess(`Post ID ${postId} successfully purged from live feeds.`);
      setTimeout(() => setDeleteSuccess(null), 4000);
    } catch (err) {
      console.error('Failed to purge post from Firestore:', err);
      setDeleteError(`Firestore write exception. Failed to delete post ${postId}.`);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="bg-zinc-950 border border-zinc-900 rounded-lg p-5 shadow-xl font-mono text-xs">
      
      {/* Title & Search bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-900 pb-3 mb-4">
        <h3 className="text-xs font-bold text-zinc-100 uppercase tracking-widest flex items-center gap-2">
          <Database className="w-4 h-4 text-emerald-500/70" />
          <span>Venom Core Database Explorer</span>
        </h3>
        
        {/* Search bar inside admin console */}
        <div className="relative max-w-xs w-full">
          <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-zinc-500" />
          <input
            type="text"
            value={adminSearchTerm}
            onChange={(e) => setAdminSearchTerm(e.target.value)}
            placeholder="Search IP, Post ID, keywords..."
            className="w-full bg-zinc-900 border border-zinc-850 focus:border-emerald-500/30 rounded pl-8 pr-3 py-1.5 text-xs text-zinc-300 focus:outline-none placeholder-zinc-650 transition-colors"
          />
        </div>
      </div>

      {/* Notifications */}
      {deleteError && (
        <div className="bg-rose-950/25 border border-rose-500/30 text-rose-400 text-[10px] p-2.5 rounded mb-3 flex items-center gap-1.5 leading-relaxed">
          <ShieldAlert className="w-4 h-4 text-rose-500" />
          <span>[EXCEPTION] {deleteError}</span>
        </div>
      )}

      {deleteSuccess && (
        <div className="bg-emerald-950/20 border border-emerald-500/20 text-emerald-400 text-[10px] p-2.5 rounded mb-3 flex items-center gap-1.5 leading-relaxed">
          <CheckCircle className="w-4 h-4 text-emerald-400" />
          <span>[CLEARANCE] {deleteSuccess}</span>
        </div>
      )}

      {/* List of postings */}
      <div className="space-y-3 max-h-[500px] overflow-y-auto scrollbar-thin pr-1">
        {filteredAdminPosts.length === 0 ? (
          <div className="text-center py-10 text-zinc-600 text-xs italic border border-dashed border-zinc-900 rounded">
            No active matches found for "{adminSearchTerm}". Modify query parameters.
          </div>
        ) : (
          filteredAdminPosts.map((post) => {
            const resolvedImei = post.postedFromImei || (() => {
              const ip = post.postedFromIp || '127.0.0.1';
              let hash = 0;
              for (let i = 0; i < ip.length; i++) {
                hash = ip.charCodeAt(i) + ((hash << 5) - hash);
              }
              let digits = '35';
              for (let i = 0; i < 13; i++) {
                digits += Math.abs((hash + i * 19) % 10).toString();
              }
              return digits;
            })();

            const resolvedSerial = post.postedFromSerial || (() => {
              const imeiStr = resolvedImei || '359182371283718';
              let hash = 0;
              for (let i = 0; i < imeiStr.length; i++) {
                hash = imeiStr.charCodeAt(i) + ((hash << 5) - hash);
              }
              const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
              let serial = 'VSN';
              for (let i = 0; i < 10; i++) {
                serial += chars.charAt(Math.abs((hash + i * 23) % chars.length));
              }
              return serial;
            })();

            return (
              <div 
                key={post.id} 
                className="p-4 bg-zinc-900/10 hover:bg-zinc-900/30 border border-zinc-900 hover:border-zinc-800 rounded-xl transition-all flex flex-col gap-4 font-mono text-xs"
              >
                {/* Meta details & Content Block */}
                <div className="space-y-2.5 min-w-0">
                  {/* Category & ID Bar (Auto-wraps perfectly) */}
                  <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-zinc-500">
                    <span className="text-emerald-400 font-bold uppercase bg-emerald-500/5 border border-emerald-500/20 px-2 py-0.5 rounded text-[8px] tracking-widest font-mono">
                      #{post.category}
                    </span>
                    <span className="text-zinc-800">•</span>
                    <span className="font-bold text-zinc-300">ID: {post.id}</span>
                    <span className="text-zinc-800">•</span>
                    <span className="text-emerald-500/80 font-semibold bg-emerald-500/5 px-1 py-0.2 rounded text-[9px]">TYPE: {post.type?.toUpperCase()}</span>
                    {post.encryptedHash && (
                      <>
                        <span className="text-zinc-800">•</span>
                        <span className="text-zinc-500 bg-zinc-950 px-1.5 py-0.2 rounded border border-zinc-900 text-[9px]">HASH: {post.encryptedHash?.substring(0, 10)}</span>
                      </>
                    )}
                  </div>

                  {/* Title / Preview Text */}
                  <div className="text-zinc-100 font-bold leading-relaxed text-xs break-words">
                    {post.title || post.content?.substring(0, 100) || 'Anonymous Post (No Content)'}
                  </div>

                  {/* Interaction Counters Block (Clean horizontal or vertical self-wrap) */}
                  <div className="flex flex-col gap-2 pt-1 border-t border-zinc-900/40">
                    <div className="flex flex-wrap items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-zinc-400">
                      <span className="bg-zinc-950/60 border border-zinc-900 px-2 py-1 rounded text-zinc-400">LIKES: {post.likesCount || 0}</span>
                      <span className="bg-zinc-950/60 border border-zinc-900 px-2 py-1 rounded text-emerald-400">UP: {post.upvotesCount || 0}</span>
                      <span className="bg-rose-950/20 border border-rose-950/60 px-2 py-1 rounded text-rose-400">VETOED: {post.downvotesCount || 0}</span>
                      <span className="bg-zinc-950/60 border border-zinc-900 px-2 py-1 rounded text-zinc-400">COMMENTS: {post.commentsCount || 0}</span>
                    </div>

                    {/* Active Emoji Reactions */}
                    <div className="flex flex-wrap items-center gap-1">
                      <span className="text-[9px] text-zinc-500 font-bold font-mono mr-1">EMOJIS:</span>
                      {['love', 'fire', 'laugh', 'wow', 'like', 'angry'].map((key) => {
                        const emojiMap: { [key: string]: string } = {
                          love: '❤️',
                          fire: '🔥',
                          laugh: '😂',
                          wow: '😮',
                          like: '👍',
                          angry: '😡'
                        };
                        const count = post.reactions?.[key] || 0;
                        if (count === 0) return null;
                        return (
                          <span key={key} className="bg-zinc-950 border border-zinc-900 px-1.5 py-0.5 rounded flex items-center gap-1 text-[9px]">
                            <span>{emojiMap[key]}</span>
                            <span className="text-zinc-400 font-bold">{count}</span>
                          </span>
                        );
                      })}
                      {(Object.values(post.reactions || {}) as number[]).reduce((a, b) => a + b, 0) === 0 && (
                        <span className="text-zinc-600 italic text-[9px]">(none)</span>
                      )}
                    </div>
                  </div>

                  {/* Device Tracking & Safe Network Signatures */}
                  <div className="pt-2 border-t border-zinc-900/30 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                      <span className="text-emerald-500 font-bold bg-emerald-950/15 border border-emerald-500/20 px-2 py-0.5 rounded">
                        IP: {post.postedFromIp || '127.0.0.1'}
                      </span>
                      {(!post.postedFromDeviceType && post.postedFromImei && !post.postedFromSerial) || post.postedFromDeviceType === 'MOBILE' ? (
                        <span className="text-rose-400 font-bold bg-rose-950/20 border border-rose-500/25 px-2 py-0.5 rounded">
                          IMEI: {resolvedImei}
                        </span>
                      ) : (
                        <span className="text-amber-400 font-bold bg-amber-950/20 border border-amber-500/25 px-2 py-0.5 rounded">
                          S/N: {resolvedSerial}
                        </span>
                      )}
                      <span className="text-zinc-400 bg-zinc-950 border border-zinc-900 px-2 py-0.5 rounded truncate max-w-[280px]" title={post.postedFromDevice}>
                        {post.postedFromDevice || 'Unknown Operating System'}
                      </span>
                    </div>

                    {/* Action links */}
                    <div className="flex flex-wrap items-center gap-2 pt-0.5">
                      {post.postedFromIp && onBlockIpClick && (
                        <button 
                          onClick={() => onBlockIpClick(post.postedFromIp!, resolvedImei)}
                          className="text-[9px] text-rose-400 hover:text-rose-300 hover:underline cursor-pointer flex items-center gap-0.5 uppercase tracking-wide font-bold"
                        >
                          [Suspend IP & Device]
                        </button>
                      )}
                      
                      <span className="text-zinc-800 font-bold">•</span>
                      
                      <button
                        onClick={() => {
                          window.history.pushState({}, '', `/?id=${post.encryptedHash}`);
                          window.dispatchEvent(new PopStateEvent('popstate'));
                        }}
                        className="text-[9px] text-emerald-400 hover:text-emerald-300 hover:underline flex items-center gap-0.5 font-bold uppercase cursor-pointer"
                      >
                        <ExternalLink className="w-2.5 h-2.5" /> Link
                      </button>
                    </div>
                  </div>
                </div>

                {/* Direct Console Command Buttons (Stacked neatly on mobile, row on tablet/desktop) */}
                <div className="flex items-center gap-2 pt-2 border-t border-zinc-900/40 justify-end">
                  <button
                    onClick={() => onStartEdit(post)}
                    className="p-2 bg-zinc-900 border border-zinc-850 hover:border-emerald-500/30 hover:bg-zinc-950 text-zinc-400 hover:text-emerald-400 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 text-[10px] uppercase font-bold"
                    title="Modify Post Payload"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Edit</span>
                  </button>
                  <button
                    onClick={() => setPostIdToConfirmDelete(post.id)}
                    className="p-2 bg-rose-950/10 border border-rose-950/40 hover:border-rose-500 hover:bg-rose-950/20 text-rose-400 hover:text-rose-300 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 text-[10px] uppercase font-bold"
                    title="Destructive Deletion"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Purge</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* CUSTOM SECURE CONFIRMATION MODAL (BYPASS IFRAME window.confirm BLOCKS) */}
      {postIdToConfirmDelete && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-[999] flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-rose-500/35 rounded-lg max-w-sm w-full p-6 shadow-2xl relative">
            <div className="flex items-center gap-3 text-rose-400 mb-3 font-mono">
              <ShieldAlert className="w-5 h-5 shrink-0" />
              <h4 className="text-sm font-bold uppercase tracking-wider">CONFIRM DESTRUCTIVE PURGE</h4>
            </div>
            
            <p className="text-[11px] text-zinc-400 font-mono leading-relaxed mb-6">
              Are you sure you want to permanently purge post ID: <span className="text-zinc-200 font-bold break-all">{postIdToConfirmDelete}</span>? This action is irreversible and deletes the venom permanently from Firestore.
            </p>
            
            <div className="flex justify-end gap-3 font-mono">
              <button
                disabled={isDeleting}
                onClick={() => setPostIdToConfirmDelete(null)}
                className="px-3.5 py-1.5 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-300 text-[10px] uppercase font-bold rounded transition-colors cursor-pointer"
              >
                Abort
              </button>
              <button
                disabled={isDeleting}
                onClick={async () => {
                  const id = postIdToConfirmDelete;
                  setPostIdToConfirmDelete(null);
                  await handleDeletePost(id);
                }}
                className="px-3.5 py-1.5 bg-rose-950/30 border border-rose-500/30 hover:border-rose-500 text-rose-400 text-[10px] uppercase font-bold rounded transition-colors cursor-pointer flex items-center gap-1"
              >
                {isDeleting ? (
                  <RefreshCw className="w-3 h-3 animate-spin" />
                ) : (
                  <Trash2 className="w-3 h-3" />
                )}
                <span>{isDeleting ? 'Purging...' : 'Purge Document'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
