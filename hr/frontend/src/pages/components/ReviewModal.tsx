import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Coins } from 'lucide-react';
import type { Review } from '../types';

interface Props {
  isOpen: boolean;
  candidateName: string;
  decision: 'approve' | 'reject';
  onClose: () => void;
  onSubmit: (review: Review) => void;
  candidateId: string;
}

export const ReviewModal: React.FC<Props> = ({
  isOpen,
  candidateName,
  decision,
  onClose,
  onSubmit,
  candidateId,
}) => {
  const [feedback, setFeedback] = useState('');
  const [reviewStatus, setReviewStatus] = useState<'approve' | 'reject' | ''>(decision);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewStatus) return;
  
    onSubmit({
      candidateId,
      decision: reviewStatus,
      ...(feedback.trim() && { feedback: feedback.trim() }),
    });
  
    setFeedback('');
    setReviewStatus('');
    onClose();
  };
  

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 z-50"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="glass-strong rounded-2xl w-full max-w-lg p-6 relative border border-white/10"
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-slate-500 hover:text-slate-300 transition-colors"
        >
          <X className="w-6 h-6" />
        </button>

        <h3 className="text-2xl font-bold text-white mb-2">
          {candidateName}
        </h3>

        <div className="flex items-center gap-2 text-amber-400 mb-4">
          <Coins className="w-5 h-5" />
          <p className="text-sm font-medium">Earn 5 coins by providing feedback!</p>
        </div>

        <form onSubmit={handleSubmit}>
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="Enter your feedback here (optional)..."
            className="w-full h-32 p-3 glass-input rounded-xl resize-none"
          />

          <div className="flex justify-between gap-3 mt-4">
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setReviewStatus('approve')}
                className={`border rounded-md px-4 py-2 transition-colors ${
                  reviewStatus === 'approve'
                    ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                    : 'border-emerald-500/60 text-emerald-400 hover:bg-emerald-500/10'
                }`}
              >
                Accept
              </button>
              <button
                type="button"
                onClick={() => setReviewStatus('reject')}
                className={`border rounded-md px-4 py-2 transition-colors ${
                  reviewStatus === 'reject'
                    ? 'bg-rose-500/20 border-rose-400 text-rose-300'
                    : 'border-rose-500/60 text-rose-400 hover:bg-rose-500/10'
                }`}
              >
                Reject
              </button>
            </div>
            <button
              type="submit"
              disabled={!reviewStatus}
              className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                reviewStatus
                  ? 'gradient-btn text-white'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-white/10'
              }`}
            >
              Submit Review
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
};