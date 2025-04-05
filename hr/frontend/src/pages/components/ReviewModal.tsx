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
  const [reviewStatus, setReviewStatus] = useState<'approve' | 'reject' | ''>('');


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
      className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 relative"
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-gray-400 hover:text-gray-600"
        >
          <X className="w-6 h-6" />
        </button>

        <h3 className="text-2xl font-bold text-gray-800 mb-2">
          {decision === 'approve' ? 'Approved' : 'Rejected'}: {candidateName}
        </h3>

        <div className="flex items-center gap-2 text-yellow-600 mb-4">
          <Coins className="w-5 h-5" />
          <p className="text-sm font-medium">Earn 5 coins by providing feedback!</p>
        </div>

        <form onSubmit={handleSubmit}>
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="Enter your feedback here (optional)..."
            className="w-full h-32 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
          />

          <div className="flex justify-between gap-3 mt-4">
          <div className="flex gap-3">
  <button
    type="button"
    onClick={() => setReviewStatus('approve')}
    className={`border rounded-md px-4 py-2 transition-colors ${
      reviewStatus === 'approve' ? 'bg-green-100 border-green-600 text-green-700' : 'border-green-600 text-green-600 hover:text-green-800'
    }`}
  >
    Accept
  </button>
  <button
    type="button"
    onClick={() => setReviewStatus('reject')}
    className={`border rounded-md px-4 py-2 transition-colors ${
      reviewStatus === 'reject' ? 'bg-red-100 border-red-600 text-red-700' : 'border-red-600 text-red-600 hover:text-red-800'
    }`}
  >
    Reject
  </button>
</div>


            <button
              type="submit"
              disabled={!feedback.trim()}
              className={`px-4 py-2 rounded-lg font-semibold shadow-md transition-all ${feedback.trim()
                ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}
            >
              Submit Feedback
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
};