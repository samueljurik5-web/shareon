import { BarChart3, Bell, Home, MapPin, MessageSquare, Plus, Search, ClipboardList, User, ShieldCheck, LogOut, Settings } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Logo } from './Logo';
import { useAuth } from '../context/AuthContext';
import { get, post } from '../api/client';
import type { Notification } from '../api/types';
import { formatDateTime } from '../lib/format';
import { Avatar } from './Avatar';
import { ErrorBoundary } from './ErrorBoundary';
import { INSTAGRAM_URL, OPERATOR } from '../lib/site';

const desktopLinks = [
  { to: '/search', label: 'Objaviť' },
  { to: '/items/new', label: 'Pridať predmet' },
  { to: '/profile?tab=items', label: 'Moje predmety' },
  { to: '/requests', label: 'Moje žiadosti' },
  { to: '/protection', label: 'Ochrana prenájmu' },
];

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // New page → top; with an #anchor (e.g. /#spatna-vazba, /ako-to-funguje#kontakt) → that section.
  useEffect(() => {
    if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView({ block: 'start' });
    else window.scrollTo(0, 0);
  }, [location.pathname, location.hash]);

  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-elevated focus:px-4 focus:py-2">Preskočiť na obsah</a>
      <header className="sticky top-0 z-40 border-b border-line bg-night/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4">
          <Logo />
          <span className="hidden items-center gap-1 rounded-full bg-card px-3 py-1 text-xs font-semibold text-ink-2 sm:inline-flex lg:hidden xl:inline-flex">
            <MapPin className="h-3.5 w-3.5 text-neon-blue" aria-hidden />Košice
          </span>
          <nav aria-label="Hlavná navigácia" className="ml-2 hidden flex-1 items-center gap-0.5 lg:flex">
            {desktopLinks.map((l) => (
              <NavLink key={l.to} to={l.to} className={({ isActive }) => `whitespace-nowrap rounded-full px-2.5 py-2 text-sm font-semibold transition-colors duration-200 ease-out ${isActive ? 'bg-card text-ink' : 'text-ink-2 hover:bg-card/60 hover:text-ink'}`}>
                {l.label}
              </NavLink>
            ))}
            {user?.role === 'ADMIN' && (
              <NavLink to="/admin" className={({ isActive }) => `whitespace-nowrap rounded-full px-2.5 py-2 text-sm font-semibold transition-colors duration-200 ease-out ${isActive ? 'bg-card text-ink' : 'text-neon-pink hover:text-ink'}`}>Admin</NavLink>
            )}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {user ? (
              <>
                <NotificationsButton unread={user.unreadNotifications ?? 0} />
                <Link to="/profile" className="hidden items-center gap-2 rounded-full bg-card py-1 pl-1 pr-3 text-sm font-semibold sm:flex" aria-label="Profil">
                  <Avatar name={user.name} url={user.avatarUrl} size={30} />
                  <span className="max-w-28 truncate lg:hidden xl:inline">{user.name.split(' ')[0]}</span>
                </Link>
                <Link to="/profile" className="sm:hidden" aria-label="Profil"><Avatar name={user.name} url={user.avatarUrl} size={34} /></Link>
                <button className="btn btn-ghost btn-sm hidden lg:inline-flex" onClick={async () => { await logout(); navigate('/'); }} aria-label="Odhlásiť sa">
                  <LogOut className="h-4 w-4" aria-hidden />
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="btn btn-ghost btn-sm">Prihlásiť</Link>
                <Link to="/register" className="btn btn-primary btn-sm hidden sm:inline-flex">Registrovať</Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 pb-10 pt-5 md:pb-12">
        <ErrorBoundary resetKey={location.pathname}>
          <div key={location.pathname} className="animate-page">
            <Outlet />
          </div>
        </ErrorBoundary>
      </main>

      <footer className="border-t border-line pb-28 pt-6 text-center text-xs text-ink-3 md:pb-6">
        <nav aria-label="Pätička" className="mx-auto mb-3 flex max-w-6xl flex-wrap justify-center gap-x-5 gap-y-2 px-4 text-sm font-semibold text-ink-2">
          <Link to="/ako-to-funguje" className="hover:text-ink">Ako to funguje</Link>
          <Link to="/protection" className="hover:text-ink">Ochrana prenájmu</Link>
          <Link to="/ako-to-funguje#kontakt" className="hover:text-ink">Kontakt</Link>
          <Link to="/#spatna-vazba" className="hover:text-ink">Spätná väzba</Link>
          <Link to="/podmienky" className="hover:text-ink">Podmienky</Link>
          <Link to="/ochrana-udajov" className="hover:text-ink">Ochrana osobných údajov</Link>
          {INSTAGRAM_URL ? (
            <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" className="hover:text-ink">Instagram</a>
          ) : (
            <span className="text-ink-3" title="Instagram profil pripravujeme">Instagram – čoskoro</span>
          )}
        </nav>
        <p className="px-4">
          {OPERATOR.name ? `${OPERATOR.name}${OPERATOR.id ? `, IČO ${OPERATOR.id}` : ''} · ` : ''}ShareOn – testovacia verzia · Košice · Bez kaucie, s Ochranou prenájmu v cene · Platby sú zatiaľ simulované
          <span className="mx-2">·</span>
          <span title="Verzia aplikácie (git commit)">verzia {__APP_VERSION__}</span>
        </p>
      </footer>

      <BottomNav />
    </div>
  );
}

function BottomNav() {
  const items = [
    { to: '/', label: 'Domov', icon: Home, end: true },
    { to: '/search', label: 'Hľadať', icon: Search },
    { to: '/items/new', label: 'Pridať', icon: Plus, primary: true },
    { to: '/requests', label: 'Žiadosti', icon: ClipboardList },
    { to: '/profile', label: 'Profil', icon: User },
  ];
  return (
    <nav aria-label="Mobilná navigácia" className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-night-2/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden">
      <ul className="mx-auto grid max-w-md grid-cols-5">
        {items.map(({ to, label, icon: Icon, primary, end }) => (
          <li key={to}>
            <NavLink to={to} end={end} className={({ isActive }) => `flex flex-col items-center gap-0.5 py-2 text-[11px] font-semibold transition-colors duration-200 ease-out ${isActive ? 'text-ink' : 'text-ink-3'}`}>
              {({ isActive }) => (
                <>
                  <span className={`grid place-items-center rounded-full transition-[color,transform] duration-200 ease-out active:scale-95 ${primary ? 'h-10 w-10 bg-grad-primary text-night shadow-[var(--shadow-neon)]' : 'h-7 w-7'} ${isActive && !primary ? 'text-neon-blue' : ''}`}>
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  {label}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function NotificationsButton({ unread }: { unread: number }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[] | null>(null);
  const [count, setCount] = useState(unread);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => setCount(unread), [unread]);
  useEffect(() => {
    if (!open) return;
    get<{ notifications: Notification[] }>('/api/notifications').then((r) => setItems(r.notifications)).catch(() => setItems([]));
    const onDoc = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const markAll = async () => {
    await post('/api/notifications/read-all');
    setCount(0);
    setItems((i) => i?.map((n) => ({ ...n, readAt: new Date().toISOString() })) ?? null);
  };

  return (
    <div className="relative" ref={ref}>
      <button className="relative grid h-10 w-10 place-items-center rounded-full bg-card" onClick={() => setOpen((o) => !o)} aria-label={`Upozornenia${count ? `, ${count} neprečítaných` : ''}`} aria-expanded={open}>
        <Bell className="h-5 w-5" aria-hidden />
        {count > 0 && <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-neon-pink px-1 text-[10px] font-bold text-night">{count > 9 ? '9+' : count}</span>}
      </button>
      {open && (
        <div className="modal-panel card absolute right-0 top-12 z-50 w-[min(22rem,calc(100vw-2rem))] p-2" role="dialog" aria-label="Upozornenia">
          <div className="flex items-center justify-between px-2 py-1">
            <span className="font-bold">Upozornenia</span>
            {count > 0 && <button className="text-xs font-semibold text-neon-blue" onClick={markAll}>Označiť ako prečítané</button>}
          </div>
          <ul className="max-h-96 overflow-y-auto">
            {items === null && <li className="p-3 text-sm text-ink-3">Načítavam…</li>}
            {items?.length === 0 && <li className="p-3 text-sm text-ink-3">Žiadne upozornenia.</li>}
            {items?.map((n) => (
              <li key={n.id}>
                <Link to={n.link ?? '#'} onClick={() => setOpen(false)} className={`block rounded-2xl p-3 text-sm hover:bg-elevated ${n.readAt ? 'text-ink-2' : 'text-ink'}`}>
                  <div className="flex items-start gap-2">
                    {!n.readAt && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-neon-pink" aria-label="Neprečítané" />}
                    <div>
                      <div className="font-semibold">{n.title}</div>
                      {n.body && <div className="text-xs text-ink-3">{n.body}</div>}
                      <div className="mt-1 text-[11px] text-ink-3">{formatDateTime(n.createdAt)}</div>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function AdminNav() {
  const links = [
    { to: '/admin', label: 'Prehľad', end: true, icon: ShieldCheck },
    { to: '/admin/users', label: 'Používatelia', icon: User },
    { to: '/admin/items', label: 'Predmety', icon: ClipboardList },
    { to: '/admin/reports', label: 'Hlásenia', icon: Bell },
    { to: '/admin/insights', label: 'Štatistiky', icon: BarChart3 },
    { to: '/admin/feedback', label: 'Spätná väzba', icon: MessageSquare },
    { to: '/admin/settings', label: 'Nastavenia', icon: Settings },
  ];
  return (
    <nav aria-label="Admin navigácia" className="h-scroll mb-5">
      {links.map(({ to, label, end }) => (
        <NavLink key={to} to={to} end={end} className={({ isActive }) => `chip ${isActive ? 'chip-active' : ''}`}>{label}</NavLink>
      ))}
    </nav>
  );
}
