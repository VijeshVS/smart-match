import React from 'react';
import { motion, PanInfo } from 'framer-motion';
import { Briefcase, Clock, Code2, Building, GraduationCap, MapPin } from 'lucide-react';
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

  // Determine level based on years of experience
  const getLevel = (years: number) => {
    if (years > 8) return 'Level 3';
    if (years > 4) return 'Level 2';
    return 'Level 1';
  };

  return (
    <motion.div
      className="absolute w-[600px] bg-white rounded-2xl shadow-xl overflow-hidden"
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
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
              <span className="text-3xl font-bold text-white">{getInitials(candidate.name)}</span>
            </div>
            <div>
              <div className="flex items-center space-x-2 text-gray-600 mb-1">
                <Briefcase className="w-4 h-4" />
                <span className="font-medium">{candidate.role}</span>
              </div>
              <div className="flex items-center space-x-2 text-gray-500">
                <MapPin className="w-4 h-4" />
                <span className="text-sm">Remote</span>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2 p-3 bg-blue-50 rounded-lg">
              <Clock className="w-5 h-5 text-blue-500" />
              <span className="text-gray-700 font-medium">
                {candidate.yearsOfExperience} years
              </span>
            </div>
            <div className="flex items-center space-x-2 p-3 bg-green-50 rounded-lg">
              <GraduationCap className="w-5 h-5 text-green-500" />
              <span className="text-gray-700 font-medium">
                {getLevel(candidate.yearsOfExperience)}
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Code2 className="w-5 h-5 text-purple-500" />
              <span className="font-semibold text-gray-800">Technical Skills</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {candidate.skills.map((skill) => (
                <span 
                  key={skill}
                  className="px-3 py-1.5 bg-purple-50 text-purple-700 rounded-full text-sm font-medium"
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>

          <div className="space-y-3">
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
          </div>
        </div>
      </div>
    </motion.div>
  );
};