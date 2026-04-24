import { useEffect, useState } from 'react';
import { Mail, Phone, Briefcase, Calendar, Loader2, Users } from 'lucide-react';
import type { Candidate } from './types';

function Candidates() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCandidates = async () => {
      try {
        const res = await fetch('http://localhost:3000/api/candidates');
        const data = await res.json();
        setCandidates(data);
        setLoading(false);
      } catch (err) {
        console.error('Failed to fetch candidates', err);
      }
    };

    fetchCandidates();
  }, []);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((word) => word[0])
      .join('')
      .toUpperCase();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center animate-fade-in">
          <Loader2 size={48} className="text-accent-violet mx-auto mb-4 animate-spin" />
          <p className="text-slate-400">Loading candidates...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-10 animate-fade-in">
      <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-white mb-1 flex items-center gap-3">
          <Users size={28} className="text-accent-violet" />
          Candidates
        </h1>
        <p className="text-slate-400">
          {candidates.length} candidate{candidates.length !== 1 ? 's' : ''} in the talent pool
        </p>
      </div>

      {candidates.length === 0 ? (
        <div className="glass-strong rounded-2xl p-10 text-center">
          <p className="text-lg text-white font-semibold mb-2">No candidates yet</p>
          <p className="text-slate-400">Candidates will appear here once onboarding submissions arrive.</p>
        </div>
      ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-6">
        {candidates.map((candidate, i) => (
          <div
            key={candidate._id || i}
            className="glass rounded-2xl overflow-hidden card-hover animate-slide-up"
            style={{ animationDelay: `${i * 0.05}s`, animationFillMode: 'both' }}
          >
            <div className="p-6">
              <div className="flex items-center gap-4 mb-5">
                <div className="w-14 h-14 rounded-xl gradient-btn flex items-center justify-center shrink-0 text-lg font-bold">
                  <span className="relative z-10">{getInitials(candidate.name)}</span>
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">{candidate.name}</h2>
                  <p className="text-sm text-slate-500">{candidate.field}</p>
                </div>
              </div>

              <div className="space-y-3 mb-5">
                <div className="flex items-center gap-3 text-sm text-slate-400">
                  <Mail size={15} className="text-accent-violet shrink-0" />
                  <span className="truncate">{candidate.email}</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-slate-400">
                  <Phone size={15} className="text-accent-violet shrink-0" />
                  <span>{candidate.phone}</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-slate-400">
                  <Briefcase size={15} className="text-accent-cyan shrink-0" />
                  <span className="font-medium text-accent-cyan">{candidate.field}</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-slate-400">
                  <Calendar size={15} className="text-accent-violet shrink-0" />
                  <span>{candidate.experience}+ years experience</span>
                </div>
              </div>

              {/* Skills */}
              {candidate.skills && candidate.skills.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-5">
                  {candidate.skills.slice(0, 5).map((skill, idx) => (
                    <span key={idx} className="px-2.5 py-1 rounded-full text-xs font-medium skill-chip-active">
                      {skill}
                    </span>
                  ))}
                  {candidate.skills.length > 5 && (
                    <span className="px-2.5 py-1 rounded-full text-xs font-medium skill-chip">
                      +{candidate.skills.length - 5}
                    </span>
                  )}
                </div>
              )}

              <button className="w-full py-2.5 rounded-xl gradient-btn text-sm">
                <span>View Profile</span>
              </button>
            </div>
          </div>
        ))}
      </div>
      )}
      </div>
    </div>
  );
}

export default Candidates;