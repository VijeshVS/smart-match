import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import axios from 'axios';
import {
  UserCircle, ThumbsUp, ThumbsDown, TrendingUp,
  Mail, Phone, Code, GraduationCap, Briefcase,
  Lightbulb, Sparkles, CheckCircle, XCircle, Loader2,
} from 'lucide-react';
import type { UserData } from '../types';

/* ─── Sub-components ─────────────────────────────────── */

function StatCard({ title, value, icon: Icon, color }: {
  title: string;
  value: string | number;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  color: string;
}) {
  return (
    <div className="glass rounded-2xl p-6 card-hover">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-slate-400">{title}</h3>
        <div className={`stat-card-icon ${color}`}>
          <Icon size={20} />
        </div>
      </div>
      <p className="text-3xl font-bold text-white">{value}</p>
    </div>
  );
}

function EducationCard({ education }: { education: UserData['education'][0] }) {
  return (
    <div className="glass rounded-2xl p-5 card-hover">
      <div className="flex items-center gap-3 mb-3">
        <div className="stat-card-icon">
          <GraduationCap size={18} className="text-accent-violet" />
        </div>
        <h4 className="font-semibold text-white">{education.college}</h4>
      </div>
      <div className="space-y-1.5 text-sm text-slate-400 ml-12">
        <p>
          <span className="text-slate-300">{education.degree}</span> in {education.branchOfStudy}
        </p>
        <p>Class of {education.yearOfGraduation} · GPA: <span className="text-accent-cyan font-medium">{education.gpa}</span></p>
      </div>
    </div>
  );
}

function ExperienceCard({ experience }: { experience: UserData['previousExperience'][0] }) {
  return (
    <div className="glass rounded-2xl p-5 card-hover">
      <div className="flex items-center gap-3 mb-3">
        <div className="stat-card-icon">
          <Briefcase size={18} className="text-accent-cyan" />
        </div>
        <div>
          <h4 className="font-semibold text-white">{experience.role}</h4>
          <p className="text-sm text-slate-400">{experience.company} · {experience.duration} months</p>
        </div>
      </div>
      <ul className="space-y-1 ml-12 text-sm text-slate-400">
        {experience.responsibilities.map((r, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className="text-accent-violet mt-1.5 shrink-0">•</span>
            <span>{r}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ReviewCard({ review }: { review: { swipe: string; comment: string } }) {
  const isApproved = review.swipe === 'approve';
  return (
    <div
      className={`glass rounded-2xl p-5 card-hover border-l-2 ${
        isApproved ? 'border-l-emerald-500' : 'border-l-red-500'
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        {isApproved ? (
          <CheckCircle size={16} className="text-emerald-400" />
        ) : (
          <XCircle size={16} className="text-red-400" />
        )}
        <span className={`text-xs font-medium ${isApproved ? 'text-emerald-400' : 'text-red-400'}`}>
          {isApproved ? 'Approved' : 'Rejected'}
        </span>
      </div>
      <p className="text-sm text-slate-300 leading-relaxed">{review.comment}</p>
    </div>
  );
}

function InsightCard({ title, items, icon: Icon, iconColor }: {
  title: string;
  items: string[];
  icon: React.ComponentType<{ size?: number; className?: string }>;
  iconColor: string;
}) {
  return (
    <div className="glass rounded-2xl p-6 card-hover">
      <div className="flex items-center gap-3 mb-5">
        <div className="stat-card-icon">
          <Icon size={20} className={iconColor} />
        </div>
        <h3 className="font-semibold text-white">{title}</h3>
      </div>
      <ul className="space-y-3">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-3 text-sm text-slate-300 leading-relaxed">
            <span className={`mt-1 shrink-0 ${iconColor}`}>›</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ─── Main Dashboard ──────────────────────────────────── */

function Dashboard() {
  const location = useLocation();
  const stateEmail = (location.state as { email?: string })?.email;

  const [email, setEmail] = useState(stateEmail || '');
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [summary, setSummary] = useState<string[]>([]);
  const [needsLogin, setNeedsLogin] = useState(!stateEmail);

  useEffect(() => {
    if (stateEmail) {
      fetchProfile(stateEmail);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchProfile = async (loginEmail: string) => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch('http://localhost:3000/api/candidates');
      if (!response.ok) throw new Error('Failed to fetch');

      const data = await response.json();
      const user = data.find(
        (u: { email: string }) => u.email.toLowerCase() === loginEmail.toLowerCase()
      );

      if (!user) {
        setError('No account found with this email.');
        setLoading(false);
        return;
      }

      setUserData(user);
      setNeedsLogin(false);

      // Fetch AI insights in parallel
      const [suggestRes, summaryRes] = await Promise.all([
        axios.post('http://localhost:3000/suggestProfile', { profile: user }),
        axios.post('http://localhost:3000/summariseProfile', { profile: user }),
      ]);

      setSuggestions(suggestRes.data.suggestions || []);
      setSummary(summaryRes.data.summary || []);
    } catch {
      setError('Unable to connect to the server.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    fetchProfile(email);
  };

  // Login prompt
  if (needsLogin && !loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4">
        <div className="glass-strong rounded-3xl p-8 max-w-md w-full animate-scale-in">
          <div className="text-center mb-6">
            <div className="w-14 h-14 rounded-2xl gradient-btn mx-auto mb-4 flex items-center justify-center">
              <Mail size={24} className="text-white relative z-10" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Access Dashboard</h2>
            <p className="text-slate-400 text-sm">Enter your email to view your profile</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-4 py-3 rounded-xl glass-input"
              required
            />
            <button
              type="submit"
              className="w-full py-3 rounded-xl gradient-btn text-base"
            >
              <span>View Dashboard</span>
            </button>
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-red-400 text-sm text-center animate-fade-in">
                {error}
              </div>
            )}
          </form>
        </div>
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="text-center animate-fade-in">
          <Loader2 size={48} className="text-accent-violet mx-auto mb-4 animate-spin" />
          <p className="text-slate-400">Loading your profile...</p>
        </div>
      </div>
    );
  }

  if (!userData) return null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Profile Header */}
      <div className="glass-strong rounded-3xl p-8 mb-8 animate-slide-up">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="w-20 h-20 rounded-2xl gradient-btn flex items-center justify-center shrink-0">
              <UserCircle size={40} className="text-white relative z-10" />
            </div>
            <div>
              <h1 className="text-3xl font-extrabold text-white">{userData.name}</h1>
              <div className="flex items-center gap-2 mt-1">
                <Code size={14} className="text-accent-cyan" />
                <span className="text-accent-cyan font-medium text-sm">{userData.field}</span>
                <span className="text-slate-600">·</span>
                <span className="text-slate-400 text-sm">Level {userData.level}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 text-sm">
            <div className="flex items-center gap-3 text-slate-400">
              <Mail size={15} className="text-accent-violet" />
              <span>{userData.email}</span>
            </div>
            <div className="flex items-center gap-3 text-slate-400">
              <Phone size={15} className="text-accent-violet" />
              <span>{userData.phone}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
        <div className="animate-slide-up" style={{ animationDelay: '0.1s', animationFillMode: 'both' }}>
          <StatCard title="Approvals" value={userData.rightSwipes} icon={ThumbsUp} color="text-emerald-400" />
        </div>
        <div className="animate-slide-up" style={{ animationDelay: '0.2s', animationFillMode: 'both' }}>
          <StatCard title="Rejections" value={userData.leftSwipes} icon={ThumbsDown} color="text-red-400" />
        </div>
        <div className="animate-slide-up" style={{ animationDelay: '0.3s', animationFillMode: 'both' }}>
          <StatCard title="Experience" value={`${userData.experience} yrs`} icon={TrendingUp} color="text-accent-cyan" />
        </div>
      </div>

      {/* Skills */}
      <div className="glass rounded-2xl p-6 mb-8 animate-slide-up" style={{ animationDelay: '0.15s', animationFillMode: 'both' }}>
        <h2 className="text-lg font-semibold text-white mb-4">Skills</h2>
        <div className="flex flex-wrap gap-2">
          {userData.skills.map((skill, i) => (
            <span
              key={i}
              className="px-4 py-1.5 rounded-full text-sm font-medium skill-chip-active"
            >
              {skill}
            </span>
          ))}
        </div>
      </div>

      {/* AI Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="animate-slide-up" style={{ animationDelay: '0.2s', animationFillMode: 'both' }}>
          <InsightCard
            title="Profile Summary"
            items={summary}
            icon={Sparkles}
            iconColor="text-accent-cyan"
          />
        </div>
        <div className="animate-slide-up" style={{ animationDelay: '0.25s', animationFillMode: 'both' }}>
          <InsightCard
            title="Suggestions for Improvement"
            items={suggestions}
            icon={Lightbulb}
            iconColor="text-yellow-400"
          />
        </div>
      </div>

      {/* Education & Experience + Reviews */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Left column */}
        <div className="space-y-6 animate-slide-up" style={{ animationDelay: '0.3s', animationFillMode: 'both' }}>
          <div>
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <GraduationCap size={18} className="text-accent-violet" />
              Education
            </h2>
            <div className="space-y-4">
              {userData.education.map((edu, i) => (
                <EducationCard key={i} education={edu} />
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Briefcase size={18} className="text-accent-cyan" />
              Experience
            </h2>
            <div className="space-y-4">
              {userData.previousExperience.map((exp, i) => (
                <ExperienceCard key={i} experience={exp} />
              ))}
            </div>
          </div>
        </div>

        {/* Right column: Reviews */}
        <div className="animate-slide-up" style={{ animationDelay: '0.35s', animationFillMode: 'both' }}>
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <CheckCircle size={18} className="text-emerald-400" />
            Reviews
          </h2>
          <div className="space-y-4">
            {userData.reviews && userData.reviews.length > 0 ? (
              userData.reviews.map((review, i) => (
                <ReviewCard key={i} review={review} />
              ))
            ) : (
              <div className="glass rounded-2xl p-8 text-center">
                <p className="text-slate-500">No reviews yet</p>
                <p className="text-slate-600 text-sm mt-1">Reviews from companies will appear here</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
