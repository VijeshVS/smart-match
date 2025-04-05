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

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      candidateId,
      decision,
      ...(feedback.trim() && { feedback: feedback.trim() }),
    });
    setFeedback('');
    onClose();
  };

  const handleSkip = () => {
    onSubmit({
      candidateId,
      decision,
    });
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

          <div className="flex justify-end gap-3 mt-4">
            <button
              type="button"
              onClick={handleSkip}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
            >
              Skip
            </button>
            <button
              type="submit"
              disabled={!feedback.trim()}
              className={`px-4 py-2 rounded-lg font-semibold shadow-md transition-all ${
                feedback.trim()
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