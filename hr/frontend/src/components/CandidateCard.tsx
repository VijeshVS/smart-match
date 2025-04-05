import React from 'react';
import { motion, PanInfo } from 'framer-motion';
import { Briefcase, Clock, Code2, Building } from 'lucide-react';
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

  return (
    <motion.div
      className="absolute w-[340px] bg-white rounded-2xl shadow-xl overflow-hidden"
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
      <div className="relative h-64">
        <img 
          src={candidate.photo} 
          alt={candidate.name}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <h2 className="text-2xl font-bold text-white mb-1">{candidate.name}</h2>
          <div className="flex items-center space-x-2 text-white/90">
            <Briefcase className="w-4 h-4" />
            <span className="text-sm">{candidate.role}</span>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Clock className="w-5 h-5 text-blue-500" />
            <span className="text-gray-700 font-medium">
              {candidate.yearsOfExperience} years experience
            </span>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <Code2 className="w-5 h-5 text-purple-500" />
            <span className="font-semibold text-gray-800">Skills</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {candidate.skills.map((skill) => (
              <span 
                key={skill}
                className="px-3 py-1 bg-purple-50 text-purple-700 rounded-full text-sm font-medium"
              >
                {skill}
              </span>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <Building className="w-5 h-5 text-green-500" />
            <h3 className="font-semibold text-gray-800">Experience</h3>
          </div>
          <ul className="space-y-2">
            {candidate.experience.map((exp, index) => (
              <li 
                key={index} 
                className="flex items-start space-x-2 text-sm text-gray-600"
              >
                <span className="mt-1.5 w-1.5 h-1.5 bg-green-500 rounded-full flex-shrink-0" />
                <span>{exp}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </motion.div>
  );
};