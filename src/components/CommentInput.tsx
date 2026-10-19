import React from 'react';
import { Send } from 'lucide-react';
import { handleInputWithCursor } from '../utils/inputFix';

interface CommentInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  placeholder?: string;
  isSubmitting?: boolean;
  disabled?: boolean;
}

export const CommentInput = React.memo(({
  value,
  onChange,
  onSubmit,
  placeholder = "Write a comment...",
  isSubmitting = false,
  disabled = false,
}: CommentInputProps) => {
  return (
    <form onSubmit={onSubmit} className="flex gap-2">
      <input
        type="text"
        value={value}
        onChange={(e) => handleInputWithCursor(e, onChange)}
        placeholder={placeholder}
        maxLength={1000}
        disabled={disabled}
        className="flex-1 bg-zinc-900/60 border border-zinc-850 focus:border-emerald-500/40 rounded px-3 py-2 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none transition-colors"
      />
      <button
        type="submit"
        disabled={!value.trim() || isSubmitting || disabled}
        className="bg-emerald-950/40 text-emerald-400 hover:bg-emerald-900/50 hover:text-emerald-300 border border-emerald-500/30 disabled:opacity-40 disabled:hover:bg-emerald-950/40 px-4 py-2 rounded text-xs font-semibold tracking-wider flex items-center gap-1.5 transition-all cursor-pointer font-sans"
      >
        <Send className="w-3.5 h-3.5" />
        <span>Comment</span>
      </button>
    </form>
  );
});
