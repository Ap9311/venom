/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { 
  X, 
  Upload, 
  ShieldCheck, 
  Eye, 
  List, 
  Plus, 
  Trash2, 
  FileText, 
  HelpCircle,
  Hash
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { generatePostHash } from '../utils/crypto';
import { compressImageToBase64 } from '../utils/image';
import { getClientIp, getDeviceDetails, getDeviceImei, isMobileDevice, getDeviceSerial } from '../utils/ip';
import { getDoc } from 'firebase/firestore';
import { checkIpBlockStatus } from '../utils/blockChecker';
import { motion } from 'motion/react';

interface NewVenomModalProps {
  onClose: () => void;
  onPostCreated: () => void;
}

export default function NewVenomModal({ onClose, onPostCreated }: NewVenomModalProps) {
  const [type, setType] = useState<'text' | 'image' | 'poll' | 'qa'>('text');

  // Disable body scroll when modal is active to prevent background scrolling
  React.useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('general');
  const [content, setContent] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState('');
  
  // Poll Options State
  const [pollOptions, setPollOptions] = useState<string[]>(['', '']);
  const [correctOptionIndex, setCorrectOptionIndex] = useState<number | undefined>(undefined);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [dragActive, setDragActive] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const categories = [
    { value: 'general', label: 'General Discussion' },
    { value: 'tech', label: 'Technology & Dev' },
    { value: 'design', label: 'Design & Creative' },
    { value: 'gaming', label: 'Gaming & Esports' },
    { value: 'lifestyle', label: 'Lifestyle & Stories' },
  ];

  // Drag and Drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const processFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setErrorMsg('Invalid image format. Please select an image file.');
      return;
    }
    setErrorMsg('');
    setImageFile(file);
    try {
      // Create visual local preview instantly
      const localUrl = URL.createObjectURL(file);
      setImagePreview(localUrl);

      // Perform background compression to lightweight optimized base64
      const compressedBase64 = await compressImageToBase64(file, 1080, 0.85);
      setImageUrl(compressedBase64);
    } catch (e) {
      console.error('Failed to compress image', e);
      setErrorMsg('Failed to optimize image. Try another file.');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const handleAddPollOption = () => {
    if (pollOptions.length < 10) {
      setPollOptions([...pollOptions, '']);
    }
  };

  const handleRemovePollOption = (index: number) => {
    if (pollOptions.length > 2) {
      const updated = [...pollOptions];
      updated.splice(index, 1);
      setPollOptions(updated);
      
      // Correct correctOptionIndex bounds if it was the last option removed or exceeded bounds
      if (correctOptionIndex !== undefined && correctOptionIndex >= updated.length) {
        setCorrectOptionIndex(undefined);
      }
    }
  };

  const handlePollOptionChange = (index: number, value: string) => {
    const updated = [...pollOptions];
    updated[index] = value;
    setPollOptions(updated);
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleRemoveImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setImageFile(null);
    setImagePreview('');
    setImageUrl('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    // Validate generic inputs
    if (!title.trim()) {
      setErrorMsg('Title is required.');
      return;
    }
    if (type !== 'image' && !content.trim()) {
      setErrorMsg('Content body is required.');
      return;
    }

    // Validate image inputs
    if (type === 'image' && !imageUrl) {
      setErrorMsg('An image attachment is required for this post type.');
      return;
    }

    // Validate poll/qa inputs
    let cleanedOptions: string[] = [];
    if (type === 'poll' || type === 'qa') {
      cleanedOptions = pollOptions.map((o) => o.trim()).filter((o) => o !== '');
      if (cleanedOptions.length < 2) {
        setErrorMsg('At least 2 non-empty choices are required for polls and Q&As.');
        return;
      }
    }

    setIsSubmitting(true);
    setErrorMsg('');

    // Generate cipher hash for aesthetic verification
    const cipherHash = generatePostHash();

    // Prepare initial pollVotes structure
    const initialPollVotes: { [key: string]: number } = {};
    if (type === 'poll' || type === 'qa') {
      cleanedOptions.forEach((_, idx) => {
        initialPollVotes[idx] = 0;
      });
    }

    try {
      const userIp = await getClientIp();
      const userImei = getDeviceImei();
      const deviceDetails = getDeviceDetails();

      // Check if user is blocked by IP address or IMEI before writing to firestore
      const block = await checkIpBlockStatus(userIp, userImei);
      if (block.isBlocked) {
        setErrorMsg(`YOUR DEVICE IP HAS BEEN SUSPENDED FROM POSTING VENOMS. Status: ${block.timeLeftLabel}. Reason: ${block.reason || 'Guidelines violation'}`);
        setIsSubmitting(false);
        return;
      }

      const postsRef = collection(db, 'posts');
      const customDocRef = doc(postsRef); // pre-generate document ID
      const newPostId = customDocRef.id;

      const payload: any = {
        id: newPostId, // Now correctly matching document ID to satisfy security rules
        type,
        title: title.trim(),
        content: content.trim(),
        category,
        likesCount: 0,
        upvotesCount: 0,
        downvotesCount: 0,
        commentsCount: 0,
        createdAt: serverTimestamp(),
        encryptedHash: cipherHash,
        postedFromIp: userIp,
        postedFromDevice: deviceDetails,
        postedFromImei: getDeviceImei(),
        postedFromSerial: getDeviceSerial(),
        postedFromDeviceType: isMobileDevice() ? 'MOBILE' : 'DESKTOP',
      };

      // Set imageUrl if any exists (poll, qa, text, or image type)
      if (imageUrl) {
        payload.imageUrl = imageUrl;
      }

      if (type === 'poll' || type === 'qa') {
        payload.pollOptions = cleanedOptions;
        payload.pollVotes = initialPollVotes;
      }

      if (type === 'qa' && correctOptionIndex !== undefined) {
        payload.correctOptionIndex = correctOptionIndex;
      }

      await setDoc(customDocRef, payload);
      onPostCreated();
      onClose();
    } catch (err) {
      setErrorMsg('Failed to post. Please try again.');
      handleFirestoreError(err, OperationType.WRITE, 'posts');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 overflow-y-auto px-4 pt-4 pb-24 md:pb-4 flex justify-center items-start md:items-center">
      {/* Click outside backdrop overlay */}
      <div className="fixed inset-0" onClick={onClose} />
      
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ duration: 0.2 }}
        className="bg-zinc-950 border border-zinc-900 rounded-xl max-w-lg w-full text-zinc-300 shadow-2xl flex flex-col my-auto relative z-10"
      >
        {/* Header Title */}
        <div className="flex items-center justify-between border-b border-zinc-900/80 px-5 py-4 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 font-mono">
              CREATE A NEW POST
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-zinc-500 hover:text-zinc-200 rounded transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal content Form */}
        <form onSubmit={handleSubmit} className="p-5 flex-1 space-y-4">
          
          {/* Action Choice Tabs */}
          <div>
            <label className="block text-[10px] text-zinc-500 font-bold tracking-wider mb-2 font-mono">
              POST FORMAT
            </label>
            <div className="grid grid-cols-4 gap-1.5 bg-zinc-900/60 p-1 rounded border border-zinc-900">
              {(['text', 'image', 'poll', 'qa'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => { setType(tab); setErrorMsg(''); }}
                  className={`py-2 rounded text-[10px] font-bold font-mono tracking-wider uppercase transition-all flex flex-col sm:flex-row items-center justify-center gap-1 cursor-pointer ${
                    type === tab
                      ? 'bg-emerald-500 text-zinc-950 font-black shadow-lg'
                      : 'text-zinc-400 hover:text-emerald-400 hover:bg-zinc-950/40'
                  }`}
                >
                  {tab === 'text' && <FileText className="w-3.5 h-3.5" />}
                  {tab === 'image' && <Eye className="w-3.5 h-3.5" />}
                  {tab === 'poll' && <List className="w-3.5 h-3.5" />}
                  {tab === 'qa' && <HelpCircle className="w-3.5 h-3.5" />}
                  <span>{tab}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Form input elements */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] text-zinc-500 font-bold tracking-wider mb-1.5 font-mono">
                SELECT CHANNEL / CATEGORY
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-emerald-500/30 font-sans"
              >
                {categories.map((cat) => (
                  <option key={cat.value} value={cat.value} className="bg-zinc-950">
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-[10px] text-zinc-500 font-bold tracking-wider mb-1.5 font-mono">
                POST SIGNATURE
              </label>
              <div className="w-full bg-zinc-900/40 border border-zinc-900/80 rounded px-2.5 py-1.5 text-xs text-zinc-600 select-none flex items-center gap-1.5 font-mono">
                <Hash className="w-3.5 h-3.5" />
                <span>ANONYMOUS</span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-[10px] text-zinc-500 font-bold tracking-wider mb-1.5 font-mono">
              TITLE
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Give your post an interesting title..."
              maxLength={200}
              className="w-full bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-xs text-zinc-200 placeholder-zinc-700 focus:outline-none focus:border-emerald-500/30"
            />
          </div>

          <div>
            <label className="block text-[10px] text-zinc-500 font-bold tracking-wider mb-1.5 font-mono">
              CONTENT / DESCRIPTION
            </label>
            <textarea
              required={type !== 'image'}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={type === 'image' ? "Add an optional description for your image..." : "What would you like to share?"}
              rows={4}
              maxLength={5000}
              className="w-full bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-xs text-zinc-200 placeholder-zinc-700 focus:outline-none focus:border-emerald-500/30"
            />
          </div>

          {/* --- Render Image File Drag-Drop Area (Now optional for text/poll/qa, required for image) --- */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="block text-[10px] text-zinc-500 font-bold tracking-wider font-mono">
                IMAGE ATTACHMENT {type === 'image' ? '(REQUIRED)' : '(OPTIONAL)'}
              </label>
              {imagePreview && (
                <button
                  type="button"
                  onClick={handleRemoveImage}
                  className="text-[10px] text-rose-400 hover:text-rose-300 flex items-center gap-1 cursor-pointer font-mono"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>REMOVE IMAGE</span>
                </button>
              )}
            </div>
            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={triggerFileSelect}
              className={`border-2 border-dashed rounded p-5 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all ${
                dragActive 
                  ? 'border-emerald-400 bg-emerald-950/10' 
                  : imagePreview 
                    ? 'border-zinc-800 bg-zinc-900/10' 
                    : 'border-zinc-800/80 hover:border-emerald-500/20 bg-zinc-900/30 hover:bg-zinc-900/50'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
              
              {imagePreview ? (
                <div className="relative max-h-36 overflow-hidden rounded border border-zinc-800">
                  <img 
                    src={imagePreview} 
                    alt="Uploaded attachment preview" 
                    className="max-h-36 object-contain" 
                  />
                  <div className="absolute inset-0 bg-black/40 hover:bg-black/10 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                    <span className="text-[10px] text-zinc-300 bg-zinc-950/80 px-2 py-1 rounded font-bold border border-zinc-800 font-mono">
                      CHANGE IMAGE
                    </span>
                  </div>
                </div>
              ) : (
                <>
                  <Upload className="w-8 h-8 text-zinc-600" />
                  <p className="text-xs text-zinc-400 text-center">
                    <span className="text-emerald-400 font-bold">Drag & drop</span> image or click to choose file
                  </p>
                  <p className="text-[10px] text-zinc-600 text-center uppercase tracking-wide font-mono">
                    High-quality auto compression (PNG, JPG, WEBP)
                  </p>
                </>
              )}
            </div>
          </div>

          {/* --- Render Poll Options Panel --- */}
          {(type === 'poll' || type === 'qa') && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="block text-[10px] text-zinc-500 font-bold tracking-wider uppercase font-mono">
                  {type === 'poll' ? 'POLL OPTIONS' : 'Q&A CHOICES'}
                </label>
                <button
                  type="button"
                  disabled={pollOptions.length >= 10}
                  onClick={handleAddPollOption}
                  className="text-[10px] text-emerald-400 font-bold hover:text-emerald-300 flex items-center gap-1 cursor-pointer disabled:opacity-40 font-mono"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>ADD CHOICE</span>
                </button>
              </div>

              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {pollOptions.map((option, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <span className="text-xs text-zinc-600 font-mono w-4 font-bold">{idx + 1}.</span>
                    <input
                      type="text"
                      required
                      value={option}
                      onChange={(e) => handlePollOptionChange(idx, e.target.value)}
                      placeholder={`Option choice ${idx + 1}...`}
                      maxLength={150}
                      className="flex-1 bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-emerald-500/30 font-sans"
                    />

                    {/* Q&A Correct option selector */}
                    {type === 'qa' && (
                      <button
                        type="button"
                        onClick={() => setCorrectOptionIndex(idx)}
                        className={`px-2 py-1.5 rounded text-[9px] font-bold tracking-wider border transition-all cursor-pointer font-mono ${
                          correctOptionIndex === idx
                            ? 'bg-emerald-500 text-zinc-950 border-emerald-400'
                            : 'bg-zinc-900 text-zinc-500 border-zinc-800/80 hover:text-emerald-400/80 hover:border-emerald-500/10'
                        }`}
                      >
                        {correctOptionIndex === idx ? 'CORRECT' : 'SET CORRECT'}
                      </button>
                    )}

                    {pollOptions.length > 2 && (
                      <button
                        type="button"
                        onClick={() => handleRemovePollOption(idx)}
                        className="p-1.5 border border-zinc-850 hover:border-rose-500/30 text-zinc-600 hover:text-rose-400 rounded transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Submission and error block */}
          {errorMsg && (
            <div className="bg-rose-950/20 border border-rose-500/20 text-rose-400 p-3 rounded text-xs leading-relaxed font-mono">
              <span>⚠ ERROR: {errorMsg}</span>
            </div>
          )}

          <div className="pt-4 border-t border-zinc-900/60 flex items-center justify-end gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-zinc-900 hover:bg-zinc-850 text-zinc-400 hover:text-zinc-200 border border-zinc-800 rounded text-xs transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !title.trim() || (type !== 'image' && !content.trim()) || (type === 'image' && !imageUrl)}
              className="bg-emerald-500 hover:bg-emerald-400 text-zinc-950 px-5 py-2 rounded text-xs font-bold tracking-wider flex items-center gap-1.5 transition-all disabled:opacity-40 cursor-pointer font-sans"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>{isSubmitting ? 'Publishing...' : 'Publish'}</span>
            </button>
          </div>

          {/* Spacer for mobile devices to prevent floating bottom-bar overlap */}
          <div className="h-24 block md:hidden pointer-events-none" />

        </form>
      </motion.div>
    </div>
  );
}
