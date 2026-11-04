import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ThumbsUp, ThumbsDown, ScrollText, CheckCircle, Coins, MessageSquare, Loader2 } from 'lucide-react';
import { CandidateCard } from './components/CandidateCard';
import { ReviewModal } from './components/ReviewModal';
import type { Candidate, Review, UserStats } from './types';
import { appConfig } from '../config';

function Jumble() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isDone, setIsDone] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [currentDecision, setCurrentDecision] = useState<'approve' | 'reject' | null>(null);
  const [userStats, setUserStats] = useState<UserStats>({
    coins: 0,
    reviewsWithFeedback: 0,
    totalReviews: 0,
  });

  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchCandidates = async () => {
      try {
        const res = await fetch(`${appConfig.legacyApiUrl}/api/candidates`);
        const data = await res.json();
        setCandidates(data);
        setError('');
        setLoading(false);
      } catch (err) {
        console.error('Failed to fetch candidates', err);
        setError('Unable to load candidates right now. Please try again.');
        setLoading(false);
      }
    };

    fetchCandidates();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center animate-fade-in">
          <Loader2 size={44} className="mx-auto mb-4 text-accent-violet animate-spin" />
          <p className="text-slate-400">Loading candidates...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="glass-strong rounded-2xl p-8 text-center max-w-md">
          <p className="text-white font-semibold mb-2">Failed to load candidates</p>
          <p className="text-slate-400 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (candidates.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="glass-strong rounded-2xl p-8 text-center max-w-md">
          <p className="text-white font-semibold mb-2">No candidates to review</p>
          <p className="text-slate-400 text-sm">Add candidates first and come back to start swiping.</p>
        </div>
      </div>
    );
  }

  const handleSwipe = async (nextDirection: number, currentCandidate: Candidate) => {
    if (!currentCandidate) return;

    if (nextDirection === 0) return;

    const decision = nextDirection > 0 ? 'approve' : 'reject';
    setCurrentDecision(decision);

    const swipeEndpoint = nextDirection > 0 ? 'rights' : 'lefts';

    try {
      await fetch(`${appConfig.legacyApiUrl}/api/candidates/${currentCandidate._id}/${swipeEndpoint}`, {
        method: 'PATCH',
      });

      if (currentIndex === candidates.length - 1) {
        setIsDone(true);
      } else {
        setCurrentIndex((prev) => prev + 1);
      }
    } catch (error) {
      console.error('Error updating swipe count:', error);
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
  };

  const handleReviewSubmit = async (review: Review) => {
    setUserStats((prev) => ({
      coins: prev.coins + (review.feedback ? 5 : 0),
      reviewsWithFeedback: prev.reviewsWithFeedback + (review.feedback ? 1 : 0),
      totalReviews: prev.totalReviews + 1,
    }));
  
    try {
      await fetch(`${appConfig.legacyApiUrl}/api/candidates/${review.candidateId}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(review),
      });
    } catch (error) {
      console.error('Failed to submit review:', error);
    }

    if (currentIndex === candidates.length - 1) {
      setIsDone(true);
    } else {
      setCurrentIndex((prev) => prev + 1);
    }

  };

  const currentCandidate = candidates[currentIndex];

  if (isDone) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center glass-strong rounded-3xl p-10 max-w-2xl"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            className="inline-block mb-6"
          >
            <CheckCircle className="w-20 h-20 text-emerald-400" />
          </motion.div>
          <motion.h2
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-4xl font-bold text-white mb-4"
          >
            All Done!
          </motion.h2>
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="space-y-2 mb-8"
          >
            <p className="text-xl text-slate-300">
              You've reviewed all {candidates.length} candidates
            </p>
            <div className="flex items-center justify-center gap-2 text-amber-400">
              <Coins className="w-6 h-6" />
              <p className="text-lg font-semibold">
                Total TalentCredits earned: {userStats.coins} TC
              </p>
            </div>
            <p className="text-sm text-slate-400">
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
            className="px-8 py-3 rounded-xl gradient-btn text-white font-semibold"
          >
            Review Again
          </motion.button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-10 min-h-screen">
      <div className="max-w-[1400px] mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-1">TalentSwipe</h1>
            <p className="text-slate-400">Swipe right to approve, left to reject, or skip for later.</p>
          </div>
          <div className="glass rounded-xl px-4 py-2 flex items-center gap-2 text-amber-400">
            <Coins className="w-5 h-5" />
            <span className="text-sm font-semibold">{userStats.coins} TC</span>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[320px_minmax(520px,1fr)_320px] gap-6 items-start">
          <div className="glass rounded-2xl p-5">
            <h3 className="text-lg font-semibold text-white mb-4">Education</h3>
            <div className="space-y-3 max-h-[58vh] overflow-y-auto pr-1">
              {currentCandidate.education?.map((edu, index) => (
                <div key={index} className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <h4 className="font-medium text-white">{edu.college}</h4>
                  <p className="text-sm text-slate-300">{edu.degree}</p>
                  <p className="text-sm text-slate-400">{edu.branchOfStudy}</p>
                  <div className="flex justify-between mt-2 text-xs text-slate-400">
                    <span>{edu.yearOfGraduation}</span>
                    <span>GPA {edu.gpa}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col items-center">
            <div className="relative w-full max-w-3xl">
              <AnimatePresence mode="wait">
                {currentCandidate && (
                  <CandidateCard
                    key={currentCandidate._id}
                    candidate={currentCandidate}
                    onSwipe={(nextDirection) => handleSwipe(nextDirection, currentCandidate)}
                  />
                )}
              </AnimatePresence>
            </div>
            <div className="mt-6 glass rounded-2xl p-4 flex items-center gap-3">
              <motion.button
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.95 }}
                className="action-btn p-3 rounded-full bg-rose-500/85 text-white"
                onClick={() => handleSwipe(-1, currentCandidate)}
              >
                <ThumbsDown className="w-5 h-5" />
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.95 }}
                className="action-btn p-3 rounded-full bg-slate-500/85 text-white"
                onClick={handleSkip}
              >
                <ScrollText className="w-5 h-5" />
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.95 }}
                className="action-btn p-3 rounded-full bg-emerald-500/85 text-white"
                onClick={() => handleSwipe(1, currentCandidate)}
              >
                <ThumbsUp className="w-5 h-5" />
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.95 }}
                className="action-btn p-3 rounded-full bg-sky-500/85 text-white"
                onClick={() => setShowReviewModal(true)}
              >
                <MessageSquare className="w-5 h-5" />
              </motion.button>
            </div>
          </div>

          <div className="glass rounded-2xl p-5">
            <h3 className="text-lg font-semibold text-white mb-4">Previous Experience</h3>
            <div className="space-y-3 max-h-[58vh] overflow-y-auto pr-1">
              {currentCandidate.previousExperience?.map((exp, index) => (
                <div key={index} className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <h4 className="font-medium text-white">{exp.company}</h4>
                  <p className="text-sm text-slate-300">{exp.role}</p>
                  <p className="text-xs text-slate-400 mt-1">{exp.duration}+ years</p>
                  <ul className="mt-2 space-y-1">
                    {exp.responsibilities.slice(0, 2).map((resp, i) => (
                      <li key={i} className="text-xs text-slate-400 flex items-start">
                        <span className="mt-1 mr-2 w-1 h-1 bg-emerald-400 rounded-full flex-shrink-0" />
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

      <AnimatePresence mode="wait">
        {showReviewModal && currentCandidate && (
          <ReviewModal
            isOpen={showReviewModal}
            candidateName={candidates[currentIndex]?.name || ''}
            candidateId={candidates[currentIndex]?._id}
            decision={currentDecision || 'approve'}
            onClose={() => setShowReviewModal(false)}
            onSubmit={handleReviewSubmit}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export default Jumble;