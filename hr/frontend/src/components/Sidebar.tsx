import { NavLink } from 'react-router-dom';
import { Home, Shuffle, Filter, Sparkles, Users } from 'lucide-react';

function Sidebar() {
  const navItems = [
    { to: '/', label: 'Home', icon: Home },
    { to: '/candidates', label: 'Candidates', icon: Users },
    { to: '/jumble', label: 'Jobify', icon: Shuffle },
    { to: '/filter', label: 'Filterify', icon: Filter },
  ];

  return (
    <aside className="w-72 shrink-0 relative z-20 glass-strong border-r border-white/10 min-h-screen flex flex-col sticky top-0">
      {/* Brand */}
      <div className="p-6">
        <NavLink to="/" className="flex items-center gap-3 group mb-10">
          <div className="w-11 h-11 rounded-xl gradient-btn flex items-center justify-center shrink-0">
            <Sparkles size={20} className="text-white relative z-10" />
          </div>
          <div>
            <span className="text-xl font-bold tracking-tight">
              <span className="gradient-text">Smart</span>
              <span className="text-white"> Match</span>
            </span>
            <p className="text-[10px] text-slate-400/80 font-medium tracking-widest uppercase">HR Portal</p>
          </div>
        </NavLink>

        {/* Navigation */}
        <nav className="space-y-2">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-300 border ${
                  isActive
                    ? 'gradient-btn border-transparent shadow-lg shadow-violet-500/20'
                    : 'text-slate-300 border-white/10 hover:text-white hover:bg-white/5'
                }`
              }
            >
              <Icon size={18} className="relative z-10" />
              <span className="relative z-10">{label}</span>
            </NavLink>
          ))}
        </nav>
      </div>

      {/* Bottom section */}
      <div className="mt-auto p-6 border-t border-white/10">
        <div className="glass rounded-xl p-4">
          <p className="text-xs text-slate-500 mb-1">Powered by</p>
          <p className="text-sm font-semibold gradient-text">Gemini AI</p>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;