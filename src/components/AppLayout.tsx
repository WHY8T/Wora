import { useEffect, useState } from "react";
import { Link, Navigate, NavLink, Outlet, useLocation, useNavigate } from "react-router";
import {
  BookOpenText,
  Compass,
  Home,
  LibraryBig,
  LogOut,
  MessageCircle,
  Moon,
  Search,
  Settings,
  Sun,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Toaster } from "@/components/ui/sonner";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/providers/theme";
import { UserAvatar } from "./UserAvatar";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Home", icon: Home },
  { to: "/search", label: "Discover", icon: Compass },
  { to: "/communities", label: "Communities", icon: BookOpenText },
  { to: "/messages", label: "Messages", icon: MessageCircle },
  { to: "/shelves", label: "My Shelves", icon: LibraryBig },
];

function useUnreadBadge(to: string) {
  const { data } = trpc.chat.unreadCount.useQuery(undefined, {
    refetchInterval: 15000,
  });
  return to === "/messages" && data?.count ? data.count : null;
}

function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle theme">
      {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
    </Button>
  );
}

function Wordmark() {
  return (
    <Link to="/" className="flex items-center gap-2">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <BookOpenText size={18} />
      </span>
      <span className="font-display text-xl font-semibold tracking-tight">Wora</span>
    </Link>
  );
}

function SearchBox() {
  const navigate = useNavigate();
  const location = useLocation();
  const [q, setQ] = useState(() => new URLSearchParams(location.search).get("q") ?? "");
  useEffect(() => {
    if (location.pathname !== "/search") setQ("");
  }, [location.pathname]);
  return (
    <form
      className="relative w-full max-w-md"
      onSubmit={(e) => {
        e.preventDefault();
        if (q.trim()) navigate(`/search?q=${encodeURIComponent(q.trim())}`);
      }}
    >
      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search books, authors…"
        className="pl-9 bg-secondary/60 border-transparent focus-visible:border-border"
      />
    </form>
  );
}

/** Compact stand-in for <SearchBox> on narrow screens, where a full inline
 * input has no room to breathe next to the logo + action icons. Routes to
 * the dedicated Discover/Search page, which has its own full-width input. */
function MobileSearchButton() {
  return (
    <Button asChild variant="ghost" size="icon" aria-label="Search" className="sm:hidden">
      <Link to="/search">
        <Search size={19} />
      </Link>
    </Button>
  );
}

function MyCommunities() {
  const { isAuthenticated } = useAuth();
  const { data } = trpc.communities.mine.useQuery(undefined, { enabled: isAuthenticated });
  if (!data?.length) return null;
  return (
    <div className="mt-6">
      <p className="px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        My communities
      </p>
      <div className="mt-2 space-y-0.5">
        {data.map((c) => (
          <NavLink
            key={c.id}
            to={`/w/${c.slug}`}
            className="flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c.color }} />
            w/{c.slug}
          </NavLink>
        ))}
      </div>
    </div>
  );
}

function SidebarNavItem({
  to,
  label,
  Icon,
}: {
  to: string;
  label: string;
  Icon: typeof Home;
}) {
  const badge = useUnreadBadge(to);
  return (
    <NavLink
      to={to}
      end={to === "/"}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
          isActive
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
        )
      }
    >
      <Icon size={17} />
      {label}
      {badge ? (
        <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">
          {badge}
        </span>
      ) : null}
    </NavLink>
  );
}

function Sidebar() {
  return (
    <aside className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] w-60 shrink-0 overflow-y-auto border-r bg-sidebar-background px-3 py-4 md:block">
      <nav className="space-y-0.5">
        {NAV.map(({ to, label, icon: Icon }) => (
          <SidebarNavItem key={to} to={to} label={label} Icon={Icon} />
        ))}
      </nav>
      <MyCommunities />
    </aside>
  );
}

function MobileNavItem({
  to,
  label,
  Icon,
  active,
}: {
  to: string;
  label: string;
  Icon: typeof Home;
  active: boolean;
}) {
  const badge = useUnreadBadge(to);
  return (
    <Link
      to={to}
      className={cn(
        "relative flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px]",
        active ? "text-primary" : "text-muted-foreground",
      )}
    >
      <Icon size={19} />
      {label}
      {badge ? (
        <span className="absolute right-1/4 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-semibold text-primary-foreground">
          {badge}
        </span>
      ) : null}
    </Link>
  );
}

function MobileNav({ username }: { username?: string | null }) {
  const location = useLocation();
  const items = [
    ...NAV,
    { to: username ? `/u/${username}` : "/settings", label: "Profile", icon: UserRound },
  ];
  return (
    <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 flex h-14 items-stretch justify-around border-t bg-background/95 backdrop-blur md:hidden">
      {items.map(({ to, label, icon: Icon }) => {
        const active = to === "/" ? location.pathname === "/" : location.pathname.startsWith(to);
        return <MobileNavItem key={to} to={to} label={label} Icon={Icon} active={active} />;
      })}
    </nav>
  );
}

function UserMenu() {
  const { user, logout } = useAuth();
  const { data } = trpc.profile.me.useQuery(undefined, { enabled: !!user });
  const username = data?.profile?.username;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="rounded-full transition-transform hover:scale-105">
          <UserAvatar name={user?.name} avatar={user?.avatar} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel className="truncate">{user?.name ?? "Reader"}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {username ? (
          <DropdownMenuItem asChild>
            <Link to={`/u/${username}`} className="gap-2">
              <UserRound size={15} /> Profile
            </Link>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem asChild>
          <Link to="/shelves" className="gap-2">
            <LibraryBig size={15} /> My shelves
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/settings" className="gap-2">
            <Settings size={15} /> Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={logout} className="gap-2 text-destructive">
          <LogOut size={15} /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function AppLayout() {
  const { user, isLoading } = useAuth({ redirectOnUnauthenticated: true });
  const { data: me, isLoading: meLoading } = trpc.profile.me.useQuery(undefined, {
    enabled: !!user,
  });
  const location = useLocation();

  if (isLoading || (user && meLoading)) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="flex w-full max-w-md flex-col gap-3 p-6">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      </div>
    );
  }
  if (!user) return null; // redirect handled by useAuth
  if (me && !me.profile) return <Navigate to="/welcome" state={{ from: location.pathname }} replace />;

  return (
    <div className="min-h-dvh">
      <header className="safe-top sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
        <div className="flex h-14 items-center gap-2 px-3 sm:gap-3 sm:px-5">
          <Wordmark />
          <div className="hidden flex-1 justify-center px-2 sm:flex">
            <SearchBox />
          </div>
          <div className="flex flex-1 items-center justify-end gap-1 sm:flex-none sm:gap-2">
            <MobileSearchButton />
            <ThemeToggle />
            <UserMenu />
          </div>
        </div>
      </header>
      <div className="flex">
        <Sidebar />
        <main className="min-w-0 flex-1 px-3 pb-[calc(3.5rem+env(safe-area-inset-bottom,0px)+1rem)] pt-5 sm:px-6 md:pb-10">
          <Outlet />
        </main>
      </div>
      <MobileNav username={me?.profile?.username} />
      <Toaster richColors position="bottom-center" />
    </div>
  );
}