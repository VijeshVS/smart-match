import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  Bell,
  CheckCheck,
  Coins,
  LayoutDashboard,
  LogOut,
  ScanSearch,
  Shuffle,
  Users,
  Gift,
} from 'lucide-react';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarRail,
  SidebarSeparator,
} from '@/components/ui/sidebar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import { useWallet } from '@/lib/wallet';
import { useNotifications } from '@/lib/use-notifications';
import { BrandWordmark } from '@/components/brand';
import { formatNumber, formatRelativeTime, initials } from '@/lib/format';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/candidates', label: 'Candidates', icon: Users, end: false },
  { to: '/swipe', label: 'TalentSwipe', icon: Shuffle, end: false },
  { to: '/lens', label: 'TalentLens', icon: ScanSearch, end: false },
  { to: '/rewards', label: 'Rewards', icon: Gift, end: false },
] as const;

const TITLES: Record<string, { title: string; subtitle: string }> = {
  '/': { title: 'Recruiter Dashboard', subtitle: 'Pipeline health, credits and hiring momentum' },
  '/candidates': { title: 'Candidate Directory', subtitle: 'Verified talent across every tier' },
  '/swipe': { title: 'TalentSwipe', subtitle: 'Review candidates one decision at a time' },
  '/lens': { title: 'TalentLens', subtitle: 'Natural-language search over the talent graph' },
  '/rewards': { title: 'Rewards Store', subtitle: 'Redeem TalentCredits for partner vouchers' },
};

function NotificationsMenu() {
  const { items, unread, loading, status, markRead, markAllRead } = useNotifications(true);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell />
          {unread > 0 ? (
            <span className="absolute -top-0.5 -right-0.5 flex min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
              {unread > 9 ? '9+' : unread}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
          <div>
            <p className="text-sm font-semibold">Notifications</p>
            <p className="text-xs text-muted-foreground">
              {status === 'connected' ? 'Live' : 'Realtime offline'}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void markAllRead()}
            disabled={unread === 0}
          >
            <CheckCheck data-icon="inline-start" />
            Mark all read
          </Button>
        </div>

        <ScrollArea className="h-80 max-h-[calc(100vh-9rem)]">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Spinner className="size-5 text-muted-foreground" />
            </div>
          ) : items.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">
              You are all caught up.
            </p>
          ) : (
            <ul className="flex flex-col">
              {items.map((notification) => (
                <li key={notification.id}>
                  <button
                    type="button"
                    onClick={() => void markRead(notification.id)}
                    className={cn(
                      'flex w-full flex-col gap-1 border-b px-4 py-3 text-left transition-colors hover:bg-muted/60',
                      !notification.read && 'bg-primary/5',
                    )}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">{notification.title}</span>
                      {!notification.read ? (
                        <span className="size-2 shrink-0 rounded-full bg-primary" />
                      ) : null}
                    </span>
                    <span className="text-xs text-muted-foreground">{notification.body}</span>
                    <span className="text-[11px] text-muted-foreground/70">
                      {formatRelativeTime(notification.createdAt)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

function UserMenu() {
  const { snapshot, org, signOut } = useAuth();
  const user = snapshot.user;
  const name = org?.profile.fullName ?? user?.fullName ?? 'Recruiter';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-9 gap-2 px-1.5">
          <Avatar className="size-7">
            <AvatarFallback className="bg-primary/15 text-xs font-semibold text-primary">
              {initials(name)}
            </AvatarFallback>
          </Avatar>
          <span className="hidden text-sm font-medium sm:inline">{name}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="text-sm font-medium">{name}</span>
          <span className="text-xs font-normal text-muted-foreground">{user?.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={() => void signOut()}>
          <LogOut data-icon="inline-start" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AppShell() {
  const { pathname } = useLocation();
  const { snapshot, org, signOut } = useAuth();
  const { wallet } = useWallet();
  const meta = TITLES[pathname] ?? TITLES['/'];

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon" variant="inset">
        <SidebarHeader className="px-3 py-4">
          <BrandWordmark subtitle="Recruiter" className="px-1" />
        </SidebarHeader>
        <SidebarSeparator />
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Workspace</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => {
                  const isActive = end ? pathname === to : pathname.startsWith(to);
                  return (
                    <SidebarMenuItem key={to}>
                      <SidebarMenuButton asChild isActive={isActive} tooltip={label}>
                        <NavLink to={to} end={end}>
                          <Icon />
                          <span>{label}</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter className="gap-3 p-3">
          <div className="rounded-xl border bg-gradient-to-br from-primary/15 via-brand/10 to-brand-cyan/15 p-3 group-data-[collapsible=icon]:hidden">
            <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Coins className="size-3.5 text-brand-cyan" />
              TalentCredits
            </p>
            <p className="mt-1 text-2xl font-semibold tracking-tight">
              {wallet ? formatNumber(wallet.balance) : '—'}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {org?.organization.name ?? 'Your organization'}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="justify-start gap-2 group-data-[collapsible=icon]:justify-center"
            onClick={() => void signOut()}
          >
            <LogOut />
            <span className="group-data-[collapsible=icon]:hidden">Sign out</span>
          </Button>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      <SidebarInset>
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur-xl">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-5" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{meta.title}</p>
            <p className="hidden truncate text-xs text-muted-foreground sm:block">
              {meta.subtitle}
            </p>
          </div>

          <Badge variant="outline" className="hidden gap-1.5 sm:inline-flex">
            <Coins className="size-3.5 text-brand-cyan" />
            {wallet ? `${formatNumber(wallet.balance)} TC` : 'Wallet'}
          </Badge>

          <NotificationsMenu />
          {snapshot.user?.role === 'ADMIN' ? <Badge variant="secondary">Admin</Badge> : null}
          <UserMenu />
        </header>

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
