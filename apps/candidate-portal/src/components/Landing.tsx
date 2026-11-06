import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, ArrowRight, UserPlus, Zap, TrendingUp } from 'lucide-react';
import { appConfig } from '../config';
import { apiClient } from '../lib/api';

function Landing() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Legacy monolith endpoint via the shared client. The absolute URL
      // preserves the legacy host; Phase 8.2 will switch to relative
      // gateway paths (e.g. /api/v1/talent).
      const { data } = await apiClient.get<{ email: string }[]>(
        `${appConfig.legacyApiUrl}/api/candidates`,
      );
      const user = data.find(
        (u: { email: string }) => u.email.toLowerCase() === email.toLowerCase()
      );

      if (user) {
        navigate('/dashboard', { state: { email } });
      } else {
        setError('No account found with this email. Please register first.');
      }
    } catch {
      setError('Unable to connect to the server. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const features = [
    {
      icon: Zap,
      title: 'AI-Powered Insights',
      desc: 'Get personalized profile summaries and improvement suggestions powered by AI.',
    },
    {
      icon: Zap,
      title: 'AI-Powered Matching',
      desc: 'Your profile is matched with top companies looking for your exact skill set.',
    },
    {
      icon: TrendingUp,
      title: 'Track Progress',
      desc: 'Monitor your approvals, rejections, and career growth in real time.',
    },
  ];

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col">
      {/* Hero Section */}
      <section className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="max-w-6xl mx-auto w-full grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Left: Branding */}
          <div className="animate-slide-up">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass mb-6 text-sm text-slate-300">
              <Zap size={14} className="text-accent-cyan" />
              <span>Your career, supercharged by talent.ai</span>
            </div>
            <h1 className="text-5xl sm:text-6xl font-extrabold leading-tight mb-6">
              Find Your
              <br />
              <span className="gradient-text">Perfect Match</span>
            </h1>
            <p className="text-lg text-slate-400 mb-10 max-w-lg leading-relaxed">
              Create your candidate profile, get AI-powered suggestions, and connect
              with companies that value your unique skills.
            </p>

            {/* Feature pills */}
            <div className="space-y-4">
              {features.map(({ icon: Icon, title, desc }, i) => (
                <div
                  key={title}
                  className="flex items-start gap-4 glass rounded-2xl p-4 card-hover animate-slide-up"
                  style={{ animationDelay: `${0.2 + i * 0.1}s`, animationFillMode: 'both' }}
                >
                  <div className="stat-card-icon shrink-0">
                    <Icon size={20} className="text-accent-violet" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white text-sm">{title}</h3>
                    <p className="text-slate-400 text-sm mt-0.5">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Login Card */}
          <div className="flex justify-center lg:justify-end animate-scale-in" style={{ animationDelay: '0.3s', animationFillMode: 'both' }}>
            <div className="w-full max-w-md glass-strong rounded-3xl p-8">
              <div className="text-center mb-8">
                <div className="w-16 h-16 rounded-2xl gradient-btn mx-auto mb-4 flex items-center justify-center">
                  <Mail size={28} className="text-white relative z-10" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Welcome Back</h2>
                <p className="text-slate-400 text-sm">Enter your email to access your dashboard</p>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label htmlFor="login-email" className="block text-sm font-medium text-slate-300 mb-2">
                    Email Address
                  </label>
                  <input
                    id="login-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full px-4 py-3 rounded-xl glass-input text-base"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-xl gradient-btn flex items-center justify-center gap-2 text-base disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span>{loading ? 'Signing in...' : 'View Dashboard'}</span>
                  {!loading && <ArrowRight size={18} className="relative z-10" />}
                </button>

                {error && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-red-400 text-sm text-center animate-fade-in">
                    {error}
                  </div>
                )}
              </form>

              <div className="mt-6 pt-6 border-t border-white/5 text-center">
                <p className="text-slate-500 text-sm mb-3">Don't have an account yet?</p>
                <button
                  onClick={() => navigate('/register')}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl border border-white/10 text-white hover:bg-white/5 transition-all text-sm font-medium"
                >
                  <UserPlus size={16} />
                  <span>Create Profile</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default Landing;
