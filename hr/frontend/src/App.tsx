import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ThumbsUp, ThumbsDown, ScrollText, CheckCircle, Coins } from 'lucide-react';
import { CandidateCard } from './components/CandidateCard';
import { ReviewModal } from './components/ReviewModal';
import { candidates } from './data';
import type { Review, UserStats } from './types';

function App() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(0);
  const [isDone, setIsDone] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [currentDecision, setCurrentDecision] = useState<'approve' | 'reject' | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [userStats, setUserStats] = useState<UserStats>({
    coins: 0,
    reviewsWithFeedback: 0,
    totalReviews: 0,
  });

  const handleSwipe = (direction: number) => {
    if (direction !== 0) {
      setDirection(direction);
      setCurrentDecision(direction > 0 ? 'approve' : 'reject');
      setShowReviewModal(true);
    }
  };

  const handleSkip = () => {
    if (currentIndex === candidates.length - 1) {
      setIsDone(true);
    } else {
      setCurrentIndex((prev) => prev + 1);
    }
  };

  const handleStartOver = () => {
    setCurrentIndex(0);
    setIsDone(false);
    setReviews([]);
  };

  const handleReviewSubmit = (review: Review) => {
    setReviews((prev) => [...prev, review]);
    setUserStats((prev) => ({
      coins: prev.coins + (review.feedback ? 5 : 0),
      reviewsWithFeedback: prev.reviewsWithFeedback + (review.feedback ? 1 : 0),
      totalReviews: prev.totalReviews + 1,
    }));
    
    if (currentIndex === candidates.length - 1) {
      setIsDone(true);
    } else {
      setCurrentIndex((prev) => prev + 1);
    }
    setDirection(0);
  };

  const currentCandidate = candidates[currentIndex];

  if (isDone) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-purple-50 to-pink-100 flex flex-col items-center justify-center p-8">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            className="inline-block mb-8"
          >
            <CheckCircle className="w-24 h-24 text-green-500" />
          </motion.div>
          <motion.h2
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-4xl font-bold text-gray-800 mb-4"
          >
            All Done!
          </motion.h2>
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="space-y-2 mb-8"
          >
            <p className="text-xl text-gray-600">
              You've reviewed all {candidates.length} candidates
            </p>
            <div className="flex items-center justify-center gap-2 text-yellow-600">
              <Coins className="w-6 h-6" />
              <p className="text-lg font-semibold">
                Total Coins Earned: {userStats.coins}
              </p>
            </div>
            <p className="text-sm text-gray-500">
              Feedback provided: {userStats.reviewsWithFeedback} of {userStats.totalReviews} reviews
            </p>
          </motion.div>
          <motion.button
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.8 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleStartOver}
            className="px-8 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-semibold shadow-lg hover:from-purple-700 hover:to-pink-700 transition-all"
          >
            Review Again
          </motion.button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-purple-50 to-pink-100 flex flex-col items-center py-8">
      <div className="flex items-center gap-2 text-yellow-600 mb-4">
        <Coins className="w-6 h-6" />
        <span className="text-lg font-semibold">{userStats.coins} coins</span>
      </div>
      
      <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-600 mb-2">
        Candidate Review
      </h1>
      <p className="text-gray-600 mb-8">Swipe right to approve, left to reject, or skip to review later</p>
      
      <div className="relative w-[340px] h-[600px]">
        <AnimatePresence mode="wait">
          {currentCandidate && (
            <CandidateCard
              key={currentCandidate.id}
              candidate={currentCandidate}
              onSwipe={handleSwipe}
            />
          )}
        </AnimatePresence>
      </div>

      <div className="mt-8 flex items-center gap-8">
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          className="p-4 bg-red-500 rounded-full text-white shadow-lg hover:bg-red-600 transition-colors"
          onClick={() => handleSwipe(-1)}
        >
          <ThumbsDown className="w-6 h-6" />
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          className="p-4 bg-gray-600 rounded-full text-white shadow-lg hover:bg-gray-700 transition-colors"
          onClick={handleSkip}
        >
          <ScrollText className="w-6 h-6" />
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          className="p-4 bg-green-500 rounded-full text-white shadow-lg hover:bg-green-600 transition-colors"
          onClick={() => handleSwipe(1)}
        >
          <ThumbsUp className="w-6 h-6" />
        </motion.button>
      </div>

      <AnimatePresence>
        {showReviewModal && currentCandidate && currentDecision && (
          <ReviewModal
            isOpen={showReviewModal}
            candidateName={currentCandidate.name}
            decision={currentDecision}
            onClose={() => {
              setShowReviewModal(false);
              handleReviewSubmit({
                candidateId: currentCandidate.id,
                decision: currentDecision,
              });
            }}
            onSubmit={handleReviewSubmit}
            candidateId={currentCandidate.id}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;