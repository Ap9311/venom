/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { Post, PostType } from '../../types';
import { X, Save, RefreshCw, AlertTriangle } from 'lucide-react';

interface AdminEditModalProps {
  post: Post | null;
  onClose: () => void;
  onSaved: () => void;
}

export const AdminEditModal: React.FC<AdminEditModalProps> = ({ post, onClose, onSaved }) => {
  const [postType, setPostType] = useState<PostType>('text');
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editCategory, setEditCategory] = useState('general');
  
  const [editLikes, setEditLikes] = useState<number>(0);
  const [editUpvotes, setEditUpvotes] = useState<number>(0);
  const [editDownvotes, setEditDownvotes] = useState<number>(0);
  
  const [editImageUrl, setEditImageUrl] = useState('');
  const [editPollOptions, setEditPollOptions] = useState<string[]>([]);
  const [editPollVotes, setEditPollVotes] = useState<{ [key: string]: number }>({});
  const [editCorrectOptionIndex, setEditCorrectOptionIndex] = useState<number | null>(null);
  
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Load post metadata when post prop shifts
  useEffect(() => {
    if (!post) return;

    setPostType(post.type || 'text');
    setEditTitle(post.title || '');
    setEditContent(post.content || '');
    setEditCategory(post.category || 'general');
    
    setEditLikes(post.likesCount || 0);
    setEditUpvotes(post.upvotesCount || 0);
    setEditDownvotes(post.downvotesCount || 0);
    
    setEditImageUrl(post.imageUrl || '');
    setEditPollOptions(post.pollOptions || []);
    setEditPollVotes(post.pollVotes || {});
    setEditCorrectOptionIndex(post.correctOptionIndex !== undefined ? post.correctOptionIndex : null);
    
    setErrorMessage(null);
  }, [post]);

  if (!post) return null;

  // Sync default options when switching type to poll or qa if empty
  const handleTypeChange = (newType: PostType) => {
    setPostType(newType);
    if ((newType === 'poll' || newType === 'qa') && editPollOptions.length === 0) {
      setEditPollOptions(['Option A', 'Option B']);
      setEditPollVotes({ '0': 0, '1': 0 });
    }
  };

  const addPollOption = () => {
    if (editPollOptions.length >= 10) return;
    const newIdx = editPollOptions.length;
    setEditPollOptions([...editPollOptions, `Option ${String.fromCharCode(65 + newIdx)}`]);
    setEditPollVotes({
      ...editPollVotes,
      [newIdx.toString()]: 0
    });
  };

  const removePollOption = (idxToRemove: number) => {
    if (editPollOptions.length <= 2) return;
    const newOptions = editPollOptions.filter((_, idx) => idx !== idxToRemove);
    
    // Recalculate poll votes map with shifted keys
    const newVotes: { [key: string]: number } = {};
    newOptions.forEach((_, newIdx) => {
      // Find what the old index was
      let oldIdx = newIdx;
      if (newIdx >= idxToRemove) {
        oldIdx = newIdx + 1;
      }
      newVotes[newIdx.toString()] = editPollVotes[oldIdx.toString()] || 0;
    });

    setEditPollOptions(newOptions);
    setEditPollVotes(newVotes);

    if (editCorrectOptionIndex !== null) {
      if (editCorrectOptionIndex === idxToRemove) {
        setEditCorrectOptionIndex(null);
      } else if (editCorrectOptionIndex > idxToRemove) {
        setEditCorrectOptionIndex(editCorrectOptionIndex - 1);
      }
    }
  };

  const handleSave = async () => {
    if (!editTitle.trim()) {
      setErrorMessage('Post Title is required.');
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      const postRef = doc(db, 'posts', post.id);
      
      const payload: any = {
        type: postType,
        title: editTitle.trim(),
        content: editContent.trim(),
        category: editCategory,
        likesCount: Number(editLikes),
        upvotesCount: Number(editUpvotes),
        downvotesCount: Number(editDownvotes),
      };

      // Set/Unset type-specific fields safely
      if (postType === 'image') {
        payload.imageUrl = editImageUrl.trim();
        // Remove poll configs to save database storage space
        payload.pollOptions = null;
        payload.pollVotes = null;
        payload.correctOptionIndex = null;
      } else if (postType === 'poll' || postType === 'qa') {
        // Build robust votes model
        const cleanVotes: { [key: string]: number } = {};
        editPollOptions.forEach((_, idx) => {
          cleanVotes[idx.toString()] = Number(editPollVotes[idx.toString()] || 0);
        });

        payload.pollOptions = editPollOptions;
        payload.pollVotes = cleanVotes;
        payload.imageUrl = null;

        if (postType === 'qa') {
          payload.correctOptionIndex = editCorrectOptionIndex !== null ? Number(editCorrectOptionIndex) : null;
        } else {
          payload.correctOptionIndex = null;
        }
      } else {
        // Standard text
        payload.imageUrl = null;
        payload.pollOptions = null;
        payload.pollVotes = null;
        payload.correctOptionIndex = null;
      }

      await updateDoc(postRef, payload);
      onSaved();
    } catch (err: any) {
      console.error('Failed to save post metadata:', err);
      setErrorMessage(`Failed to write database document. Ensure rules authorize this update.`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-[990] flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-zinc-950 border border-zinc-900 rounded-xl max-w-xl w-full my-8 p-6 shadow-2xl relative flex flex-col max-h-[90vh]">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-zinc-900 pb-3 mb-4">
          <div>
            <h3 className="text-sm font-bold text-zinc-100 uppercase tracking-widest font-mono flex items-center gap-2">
              <span className="w-2 h-2 bg-emerald-500 rounded-full inline-block animate-ping" />
              <span>Modify Venom Metadata</span>
            </h3>
            <span className="text-[9px] text-zinc-500 font-mono block mt-0.5">POST REFERENCE: {post.id}</span>
          </div>
          <button 
            onClick={onClose}
            className="p-1 hover:bg-zinc-900 border border-zinc-900 text-zinc-500 hover:text-zinc-200 rounded transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body - Scrollable */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-4 font-mono scrollbar-thin">
          
          {errorMessage && (
            <div className="bg-rose-950/20 border border-rose-500/20 text-rose-400 text-[10px] p-3 rounded flex items-start gap-2 leading-relaxed">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Post Type Selector */}
          <div className="space-y-1">
            <label className="text-[9px] uppercase text-zinc-500 block font-bold">VENOM CLASSIFICATION (TYPE)</label>
            <select
              value={postType}
              onChange={(e) => handleTypeChange(e.target.value as PostType)}
              className="w-full bg-zinc-900 border border-zinc-850 focus:border-emerald-500/30 rounded px-3 py-1.5 text-xs text-zinc-200 focus:outline-none"
            >
              <option value="text">Text Node (Encrypted Feed)</option>
              <option value="image">Image Attachment (optimized WebP)</option>
              <option value="poll">Poll/Opinion Survey (Multiple Choice)</option>
              <option value="qa">Interactive Q&A Trivia (Correct Choice Required)</option>
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Title */}
            <div className="space-y-1 sm:col-span-2">
              <label className="text-[9px] uppercase text-zinc-500 block font-bold">Title / Heading</label>
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-850 focus:border-emerald-500/30 rounded px-3 py-1.5 text-xs text-zinc-200 focus:outline-none"
              />
            </div>

            {/* Content body */}
            <div className="space-y-1 sm:col-span-2">
              <label className="text-[9px] uppercase text-zinc-500 block font-bold">Content (Decoded Body Payload)</label>
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                rows={4}
                className="w-full bg-zinc-900 border border-zinc-850 focus:border-emerald-500/30 rounded px-3 py-2 text-xs text-zinc-200 focus:outline-none placeholder-zinc-700 font-sans"
              />
            </div>

            {/* Category dropdown */}
            <div className="space-y-1">
              <label className="text-[9px] uppercase text-zinc-500 block font-bold">Channel (Category)</label>
              <select
                value={editCategory}
                onChange={(e) => setEditCategory(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-850 focus:border-emerald-500/30 rounded px-3 py-1.5 text-xs text-zinc-200 focus:outline-none"
              >
                <option value="general">#general</option>
                <option value="leaks">#leaks</option>
                <option value="theories">#theories</option>
                <option value="dossiers">#dossiers</option>
                <option value="intel">#intel</option>
              </select>
            </div>

            {/* Likes */}
            <div className="space-y-1">
              <label className="text-[9px] uppercase text-zinc-500 block font-bold">Device likes (Hits)</label>
              <input
                type="number"
                value={editLikes}
                onChange={(e) => setEditLikes(Number(e.target.value))}
                className="w-full bg-zinc-900 border border-zinc-850 focus:border-emerald-500/30 rounded px-3 py-1.5 text-xs text-zinc-200 focus:outline-none"
              />
            </div>

           </div>

          {/* Image URL Section */}
          {postType === 'image' && (
            <div className="space-y-1 border border-zinc-900 bg-zinc-900/10 p-3 rounded">
              <label className="text-[9px] uppercase text-emerald-400 block font-bold">IMAGE SOURCE URL (BASE64 OR DIRECT STRING)</label>
              <textarea
                value={editImageUrl}
                onChange={(e) => setEditImageUrl(e.target.value)}
                rows={3}
                placeholder="data:image/webp;base64,... or https://..."
                className="w-full bg-zinc-900 border border-zinc-850 focus:border-emerald-500/30 rounded px-3 py-2 text-xs text-zinc-200 focus:outline-none placeholder-zinc-700 font-mono break-all"
              />
            </div>
          )}

          {/* Poll or Q&A Section */}
          {(postType === 'poll' || postType === 'qa') && (
            <div className="space-y-3 bg-zinc-900/20 border border-zinc-900 p-3 rounded">
              <div className="flex items-center justify-between border-b border-zinc-900 pb-1.5 mb-1">
                <span className="text-[9px] uppercase text-emerald-400 font-bold tracking-wider">POLL / Q&A RESPONSE SCHEMATICS</span>
                <button
                  type="button"
                  onClick={addPollOption}
                  disabled={editPollOptions.length >= 10}
                  className="px-2 py-0.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-[8px] font-bold rounded border border-emerald-500/20 disabled:opacity-30 cursor-pointer uppercase font-mono"
                >
                  + Add Option
                </button>
              </div>
              
              <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1 scrollbar-thin">
                {editPollOptions.map((opt, idx) => (
                  <div key={idx} className="flex gap-2 items-center bg-zinc-950/40 p-2 border border-zinc-900 rounded">
                    <div className="flex-1 space-y-0.5">
                      <label className="text-[8px] uppercase text-zinc-500 block font-bold">Option {idx + 1} Text</label>
                      <input
                        type="text"
                        value={opt}
                        onChange={(e) => {
                          const newOpts = [...editPollOptions];
                          newOpts[idx] = e.target.value;
                          setEditPollOptions(newOpts);
                        }}
                        className="w-full bg-zinc-900 border border-zinc-850 focus:border-emerald-500/30 rounded px-2 py-1 text-xs text-zinc-200 focus:outline-none"
                      />
                    </div>
                    
                    {/* EDIT POLL VOTES/COLLECTED RESPONSES */}
                    <div className="w-20 space-y-0.5">
                      <label className="text-[8px] uppercase text-zinc-500 block font-bold">Responses</label>
                      <input
                        type="number"
                        value={editPollVotes[idx.toString()] !== undefined ? editPollVotes[idx.toString()] : 0}
                        onChange={(e) => {
                          const newVotes = { ...editPollVotes };
                          newVotes[idx.toString()] = Number(e.target.value);
                          setEditPollVotes(newVotes);
                        }}
                        className="w-full bg-zinc-900 border border-zinc-850 focus:border-emerald-500/30 rounded px-2 py-1 text-xs text-zinc-200 focus:outline-none font-mono"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => removePollOption(idx)}
                      disabled={editPollOptions.length <= 2}
                      className="mt-3.5 p-1 text-zinc-600 hover:text-rose-400 disabled:opacity-20 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Correct answer index for Q&A */}
              {postType === 'qa' && (
                <div className="space-y-1 pt-1.5 border-t border-zinc-900 mt-2">
                  <label className="text-[9px] uppercase text-rose-400 block font-bold">QA CORRECT SELECTION KEY</label>
                  <select
                    value={editCorrectOptionIndex !== null ? editCorrectOptionIndex : ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setEditCorrectOptionIndex(val === '' ? null : Number(val));
                    }}
                    className="w-full bg-zinc-900 border border-zinc-850 focus:border-emerald-500/30 rounded px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none"
                  >
                    <option value="">None Designated</option>
                    {editPollOptions.map((opt, idx) => (
                      <option key={idx} value={idx}>Option {idx + 1}: {opt.substring(0, 32)}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Modal Footer Actions */}
        <div className="flex justify-end gap-2 pt-3 mt-4 border-t border-zinc-900">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 bg-zinc-900 hover:bg-zinc-850 border border-zinc-850 text-zinc-400 hover:text-zinc-200 text-xs font-bold rounded transition-colors uppercase cursor-pointer disabled:opacity-50"
          >
            Abort
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-black rounded flex items-center gap-1.5 transition-all shadow-lg shadow-emerald-950/20 uppercase cursor-pointer disabled:opacity-50"
          >
            {isSaving ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            <span>{isSaving ? 'Deploying...' : 'Deploy Update'}</span>
          </button>
        </div>

      </div>
    </div>
  );
};
