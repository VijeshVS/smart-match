import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, UserPlus, Sparkles } from 'lucide-react';

function Layout() {
  const location = useLocation();

  const navItems = [
    { to: '/', label: 'Home', icon: Sparkles },
    { to: '/register', label: 'Register', icon: UserPlus },
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  ];

  return (
    <div className="min-h-screen relative">
      {/* Animated mesh background */}
      <div className="mesh-bg" />

      {/* Top Navbar */}
      <nav className="relative z-30 glass-strong border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Brand */}
            <NavLink to="/" className="flex items-center gap-3 group">
              <div className="w-9 h-9 rounded-xl gradient-btn flex items-center justify-center">
                <Sparkles size={18} className="text-white relative z-10" />
              </div>
              <span className="text-lg font-bold tracking-tight">
                <span className="gradient-text">Smart</span>
                <span className="text-white"> Match</span>
              </span>
            </NavLink>

            {/* Nav links */}
            <div className="flex items-center gap-1">
              {navItems.map(({ to, label, icon: Icon }) => {
                const isActive = location.pathname === to;
                return (
                  <NavLink
                    key={to}
                    to={to}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 ${
                      isActive
                        ? 'gradient-btn shadow-lg shadow-violet-500/20'
                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <Icon size={16} className="relative z-10" />
                    <span className="relative z-10 hidden sm:inline">{label}</span>
                  </NavLink>
                );
              })}
            </div>
          </div>
        </div>
      </nav>

      {/* Page content */}
      <main className="relative z-10">
        <Outlet />
      </main>
    </div>
  );
}

export default Layout;
