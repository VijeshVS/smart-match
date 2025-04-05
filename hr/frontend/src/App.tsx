import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ThumbsUp, ThumbsDown, ScrollText, CheckCircle, Coins, MessageSquare } from 'lucide-react';
import { CandidateCard } from './components/CandidateCard';
import { ReviewModal } from './components/ReviewModal';
import type { Review, UserStats } from './types';

import { useEffect } from 'react';



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

  const [candidates, setCandidates] = useState<{ id: number; education?: { college: string; degree: string; branchOfStudy: string; yearOfGraduation: string; gpa: string; }[]; previousExperience?: { company: string; role: string; duration: string; responsibilities: string[]; }[]; name: string; }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCandidates = async () => {
      try {
        const res = await fetch("http://localhost:5000/api/candidates"); // update port if needed
        const data = await res.json();
        setCandidates(data);
        setLoading(false);
      } catch (err) {
        console.error("Failed to fetch candidates", err);
      }
    };

    fetchCandidates();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-600 text-xl">
        Loading candidates...
      </div>
    );
  }
  

  const handleSwipe = (direction: number) => {
    if (direction !== 0) {
      setDirection(direction);
      setCurrentDecision(direction > 0 ? 'approve' : 'reject');

      // Submit review without feedback
      handleReviewSubmit({
        candidateId: currentCandidate.id,
        decision: direction > 0 ? 'approve' : 'reject',
      });
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

  const handleReviewClick = () => {
    setShowReviewModal(true);
  };

  const currentCandidate = candidates[currentIndex];

  if (isDone) {
    return (
      <div className="min-h-screen bg-[#faf6f0] flex flex-col items-center justify-center p-8">
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
            className="text-4xl font-bold text-gray-700 mb-4"
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
            <div className="flex items-center justify-center gap-2 text-amber-600">
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
            className="px-8 py-3 bg-gradient-to-r from-amber-400 to-amber-500 text-white rounded-lg font-semibold shadow-lg hover:from-amber-500 hover:to-amber-600 transition-all"
          >
            Review Again
          </motion.button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#faf6f0] flex flex-col items-center py-8">
      <div className="flex items-center gap-2 text-amber-600 mb-4">
        <Coins className="w-6 h-6" />
        <span className="text-lg font-semibold">{userStats.coins} coins</span>
      </div>

      <h1 className="text-4xl font-bold text-gray-700 mb-2">
        Candidate Review
      </h1>
      <p className="text-gray-500 mb-8">Swipe right to approve, left to reject, or skip to review later</p>

      <div className="flex flex-col items-center justify-center">
        {/* Main row with three cards and buttons */}
        <div className="relative flex items-start justify-center gap-6">
          {/* Education Card */}
          <div className="w-[250px] h-[600px] bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col">
            <div className="p-4 bg-gradient-to-br from-blue-400 to-indigo-500">
              <h3 className="text-xl font-bold text-white">Education</h3>
            </div>
            <div className="p-4 space-y-4 overflow-y-auto scrollbar-hide" style={{ height: 'calc(600px - 60px)' }}>
              {currentCandidate.education?.map((edu, index) => (
                <div key={index} className="p-3 bg-blue-50 rounded-lg">
                  <h4 className="font-semibold text-gray-700">{edu.college}</h4>
                  <p className="text-sm text-gray-600">{edu.degree}</p>
                  <p className="text-sm text-gray-500">{edu.branchOfStudy}</p>
                  <div className="flex justify-between mt-2 text-xs text-gray-400">
                    <span>Graduated: {edu.yearOfGraduation}</span>
                    <span>GPA: {edu.gpa}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Main Candidate Card with Buttons */}
          <div className="flex flex-col items-center">
            <div className="relative w-[600px] h-[600px]">
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

            {/* Action Buttons - Positioned absolutely */}
            <div className="absolute -bottom-5 flex items-center gap-8 z-10">
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                className="p-4 bg-red-400 rounded-full text-white shadow-lg hover:bg-red-500 transition-colors"
                onClick={() => handleSwipe(-1)}
              >
                <ThumbsDown className="w-6 h-6" />
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                className="p-4 bg-gray-400 rounded-full text-white shadow-lg hover:bg-gray-500 transition-colors"
                onClick={handleSkip}
              >
                <ScrollText className="w-6 h-6" />
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                className="p-4 bg-green-400 rounded-full text-white shadow-lg hover:bg-green-500 transition-colors"
                onClick={() => handleSwipe(1)}
              >
                <ThumbsUp className="w-6 h-6" />
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                className="p-4 bg-blue-400 rounded-full text-white shadow-lg hover:bg-blue-500 transition-colors"
                onClick={handleReviewClick}
              >
                <MessageSquare className="w-6 h-6" />
              </motion.button>
            </div>
          </div>

          {/* Experience Card */}
          <div className="w-[250px] h-[600px] bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col">
            <div className="p-4 bg-gradient-to-br from-green-400 to-emerald-500">
              <h3 className="text-xl font-bold text-white">Previous Experience</h3>
            </div>
            <div className="p-4 space-y-4 overflow-y-auto scrollbar-hide" style={{ height: 'calc(600px - 60px)' }}>
              {currentCandidate.previousExperience?.map((exp, index) => (
                <div key={index} className="p-3 bg-green-50 rounded-lg">
                  <h4 className="font-semibold text-gray-700">{exp.company}</h4>
                  <p className="text-sm text-gray-600">{exp.role}</p>
                  <p className="text-xs text-gray-500 mt-1">{exp.duration}</p>
                  <ul className="mt-2 space-y-1">
                    {exp.responsibilities.slice(0, 2).map((resp, i) => (
                      <li key={i} className="text-xs text-gray-500 flex items-start">
                        <span className="mt-1 mr-1 w-1 h-1 bg-green-400 rounded-full flex-shrink-0" />
                        {resp}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showReviewModal && currentCandidate && (
          <ReviewModal
            isOpen={showReviewModal}
            candidateName={currentCandidate.name}
            decision={currentDecision || 'approve'}
            onClose={() => {
              setShowReviewModal(false);
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