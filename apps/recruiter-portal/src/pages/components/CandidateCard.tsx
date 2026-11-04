import React from 'react';
import { motion, PanInfo } from 'framer-motion';
import { Briefcase, Code2 } from 'lucide-react';
import { Candidate } from '../types';

interface Props {
  candidate: Candidate;
  onSwipe: (direction: number) => void;
}

export const CandidateCard: React.FC<Props> = ({ candidate, onSwipe }) => {
  const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const swipeThreshold = 100;
    const swipeDirection = info.offset.x > swipeThreshold ? 1 : info.offset.x < -swipeThreshold ? -1 : 0;
    onSwipe(swipeDirection);
  };

  // Get initials from full name
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase();
  };

  const getLevel = (years: number) => {
    if (years > 8) return 'Elite Principal';
    if (years > 4) return 'Pro Engineer';
    return 'Junior Fellow';
  };

  return (
    <motion.div
      className="w-full max-w-3xl min-h-[340px] glass-strong rounded-2xl overflow-hidden border border-white/10"
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      onDragEnd={handleDragEnd}
      whileDrag={{ scale: 1.05, rotate: 5 }}
      animate={{ scale: 1, rotate: 0 }}
      initial={{ scale: 0.95, rotate: 0 }}
      exit={{ 
        x: 0,
        opacity: 0,
        scale: 0.5,
        transition: { duration: 0.2 }
      }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
    >
      <div className="p-6 lg:p-7">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 gradient-btn rounded-2xl flex items-center justify-center">
              <span className="text-3xl font-bold text-white">{getInitials(candidate.name)}</span>
            </div>
            <div>
              <div className="text-white text-xl font-semibold">{candidate.name}</div>
              <div className="flex items-center space-x-2 text-slate-300 mb-1">
                <Briefcase className="w-4 h-4" />
                <span className="font-medium">{candidate.field}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2 p-3 bg-white/5 border border-white/10 rounded-lg">
              <span className="text-slate-100 font-medium">
                {candidate.experience} years
              </span>
            </div>
            <div className="flex items-center space-x-2 p-3 bg-white/5 border border-white/10 rounded-lg">
              <span className="text-slate-100 font-medium">
                {getLevel(candidate.experience)}
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Code2 className="w-5 h-5 text-purple-500" />
              <span className="font-semibold text-white">Technical Skills</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {candidate.skills.map((skill) => (
                <span
                  key={skill}
                  className="px-3 py-1.5 rounded-full text-sm font-medium skill-chip-active"
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>

          {/* <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Building className="w-5 h-5 text-green-500" />
              <h3 className="font-semibold text-gray-800">Professional Experience</h3>
            </div>
              <div className="space-y-3 max-h-[450px] overflow-y-auto pr-2">
                {candidate.experience.map((exp, index) => (
                  <div 
                    key={index} 
                    className="p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <p className="text-sm text-gray-700 leading-relaxed">{exp}</p>
                  </div>
                ))}
              </div>
          </div> */}
        </div>
      </div>
    </motion.div>
  );
};