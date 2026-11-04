import React from 'react';
import { Mail, ArrowRight, Users, Shuffle, Filter, CheckCircle } from 'lucide-react';

interface HomeProps {
  isAuthenticated: boolean;
  setIsAuthenticated: (value: boolean) => void;
  hrEmail: string;
  setHrEmail: (value: string) => void;
}

function Home({ isAuthenticated, setIsAuthenticated, hrEmail, setHrEmail }: HomeProps) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsAuthenticated(true);
  };

  const mockAcceptedCandidates = [
    {
      id: 1,
      name: 'John Doe',
      position: 'Frontend Developer',
      status: 'Accepted',
      date: '2024-03-15',
    },
    {
      id: 2,
      name: 'Jane Smith',
      position: 'UX Designer',
      status: 'Accepted',
      date: '2024-03-14',
    },
  ];

  // ── Login Screen ──
  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen p-6">
        <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Left: branding */}
          <div className="animate-slide-up">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass mb-6 text-sm text-slate-300">
              <Filter size={14} className="text-accent-cyan" />
              <span>AI-Powered Hiring</span>
            </div>
            <h1 className="text-5xl font-extrabold leading-tight mb-6">
              Hire Smarter,
              <br />
              <span className="gradient-text">Not Harder</span>
            </h1>
            <p className="text-lg text-slate-400 mb-10 max-w-md leading-relaxed">
              Review candidates with swipe-based workflows, AI-powered filtering,
              and intelligent profile evaluation — all in one portal.
            </p>

            <div className="space-y-3">
              {[
                { icon: Shuffle, title: 'TalentSwipe', desc: 'Swipe through verified talent in seconds' },
                { icon: Filter, title: 'TalentLens', desc: 'Natural-language search surfaces the best matches' },
                { icon: Users, title: 'Candidates', desc: 'Browse and review the full talent pool' },
              ].map(({ icon: Icon, title, desc }, i) => (
                <div
                  key={title}
                  className="flex items-start gap-4 glass rounded-2xl p-4 card-hover animate-slide-up"
                  style={{ animationDelay: `${0.2 + i * 0.1}s`, animationFillMode: 'both' }}
                >
                  <div className="stat-card-icon shrink-0">
                    <Icon size={18} className="text-accent-violet" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white text-sm">{title}</h3>
                    <p className="text-slate-400 text-sm mt-0.5">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Login card */}
          <div className="flex justify-center lg:justify-end animate-scale-in" style={{ animationDelay: '0.3s', animationFillMode: 'both' }}>
            <div className="w-full max-w-md glass-strong rounded-3xl p-8">
              <div className="text-center mb-8">
                <div className="w-16 h-16 rounded-2xl gradient-btn mx-auto mb-4 flex items-center justify-center">
                  <Mail size={28} className="text-white relative z-10" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Welcome to talent.ai</h2>
                <p className="text-slate-400 text-sm">Enter your recruiter email to continue</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="hr-email" className="block text-sm font-medium text-slate-300 mb-2">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 h-5 w-5" />
                    <input
                      type="email"
                      id="hr-email"
                      value={hrEmail}
                      onChange={(e) => setHrEmail(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 rounded-xl glass-input text-base"
                      placeholder="hr@company.com"
                      required
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  className="w-full py-3 rounded-xl gradient-btn flex items-center justify-center gap-2 text-base"
                >
                  <span>Continue to Dashboard</span>
                  <ArrowRight size={18} className="relative z-10" />
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Authenticated Dashboard ──
  return (
    <div className="p-8 animate-fade-in">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-white mb-1">Recruiter Dashboard</h1>
        <p className="text-slate-400">
          Welcome back, <span className="text-accent-cyan font-medium">{hrEmail}</span>
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
        {[
          { label: 'Total Candidates', value: '24', color: 'text-accent-violet' },
          { label: 'Accepted', value: '12', color: 'text-emerald-400' },
          { label: 'Pending Review', value: '8', color: 'text-amber-400' },
        ].map(({ label, value, color }, i) => (
          <div
            key={label}
            className="glass rounded-2xl p-6 card-hover animate-slide-up"
            style={{ animationDelay: `${0.1 + i * 0.1}s`, animationFillMode: 'both' }}
          >
            <p className="text-sm text-slate-400 mb-2">{label}</p>
            <p className={`text-3xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Accepted candidates table */}
      <div className="glass-strong rounded-2xl overflow-hidden animate-slide-up" style={{ animationDelay: '0.3s', animationFillMode: 'both' }}>
        <div className="p-6 border-b border-white/5">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <CheckCircle size={18} className="text-emerald-400" />
            Accepted Candidates
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Name</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Position</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Date</th>
              </tr>
            </thead>
            <tbody>
              {mockAcceptedCandidates.map((candidate) => (
                <tr key={candidate.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                  <td className="px-6 py-4 text-sm font-medium text-white">{candidate.name}</td>
                  <td className="px-6 py-4 text-sm text-slate-400">{candidate.position}</td>
                  <td className="px-6 py-4">
                    <span className="px-3 py-1 text-xs font-semibold rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                      {candidate.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-500">{candidate.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default Home;