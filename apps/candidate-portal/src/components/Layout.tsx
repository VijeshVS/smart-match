import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { authApi } from '@talent-ai/api-client';
import {
  LayoutDashboard,
  LogOut,
  Menu,
  Sparkles,
  UserPlus,
} from 'lucide-react';
import { BrandWordmark } from '@/components/brand';
import { AuthDialog } from '@/components/auth-dialog';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';

const navItems = [
  { to: '/', label: 'Home', icon: Sparkles },
  { to: '/register', label: 'Profile', icon: UserPlus },
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
];

function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

export function Layout() {
  const navigate = useNavigate();
  const { user, status } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleSignOut = async () => {
    await authApi.logout();
    navigate('/');
  };

  return (
    <div className="relative min-h-screen">
      <div className="mesh-bg" aria-hidden="true" />

      <header className="sticky top-0 z-40 border-b border-white/5 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <BrandWordmark subtitle="Candidate" />

          <nav className="hidden items-center gap-1 md:flex">
            {navItems.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  cn(
                    'inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary/15 text-foreground'
                      : 'text-muted-foreground hover:bg-white/5 hover:text-foreground',
                  )
                }
              >
                <Icon className="size-4" aria-hidden="true" />
                {label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            {status === 'loading' ? (
              <div className="h-9 w-24 animate-pulse rounded-lg bg-muted" />
            ) : user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="gap-2 px-2">
                    <Avatar className="size-8">
                      <AvatarFallback className="bg-primary/20 text-xs font-semibold text-primary">
                        {initials(user.fullName)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="hidden text-sm sm:inline">{user.fullName}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="flex flex-col gap-0.5">
                    <span>{user.fullName}</span>
                    <span className="text-xs font-normal text-muted-foreground">{user.email}</span>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuItem onSelect={() => navigate('/dashboard')}>
                      <LayoutDashboard />
                      Dashboard
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => navigate('/register')}>
                      <UserPlus />
                      Edit profile
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onSelect={handleSignOut}>
                    <LogOut />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button onClick={() => setAuthOpen(true)}>Sign in</Button>
            )}

            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="md:hidden">
                  <Menu />
                  <span className="sr-only">Open navigation</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-72">
                <SheetTitle className="sr-only">Navigation</SheetTitle>
                <div className="flex flex-col gap-1 px-4 pt-12">
                  {navItems.map(({ to, label, icon: Icon }) => (
                    <NavLink
                      key={to}
                      to={to}
                      end={to === '/'}
                      onClick={() => setMobileOpen(false)}
                      className={({ isActive }) =>
                        cn(
                          'inline-flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                          isActive
                            ? 'bg-primary/15 text-foreground'
                            : 'text-muted-foreground hover:bg-white/5 hover:text-foreground',
                        )
                      }
                    >
                      <Icon className="size-4" aria-hidden="true" />
                      {label}
                    </NavLink>
                  ))}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      <main className="relative z-10">
        <Outlet />
      </main>

      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} />
    </div>
  );
}

export default Layout;
