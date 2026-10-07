import { LogOut, Plus } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ApiError, get, patch } from '../api/client';
import type { ItemCard, Review } from '../api/types';
import { useAuth } from '../context/AuthContext';
import { useUi } from '../context/UiContext';
import { useAsync } from '../lib/useAsync';
import { Avatar } from '../components/Avatar';
import { ItemGrid } from '../components/ItemCard';
import { CardSkeletons, EmptyState, ErrorState } from '../components/States';
import { RatingDistribution } from '../components/Rating';
import { ReviewList } from '../components/ReviewList';
import { TextArea, TextField } from '../components/Field';
import { PhotoUploader } from '../components/PhotoUploader';
import { EMPTY } from '../lib/format';

const TABS = [
  ['items', 'Moje predmety'],
  ['favorites', 'Obľúbené'],
  ['reviews', 'Hodnotenia'],
  ['settings', 'Upraviť profil'],
] as const;

export function ProfilePage() {
  const { user, logout, refresh } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') ?? 'items';
  if (!user) return null;

  return (
    <div className="space-y-6">
      <section className="card flex flex-col gap-5 p-5 sm:flex-row sm:items-center">
        <Avatar name={user.name} url={user.avatarUrl} size={72} />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-extrabold">{user.name}</h1>
          <p className="text-sm text-ink-2">{user.email} · {user.phone} · {user.city}</p>
          {user.bio && <p className="mt-2 text-sm text-ink-2">{user.bio}</p>}
        </div>
        <div className="grid grid-cols-4 gap-2 text-center">
          <Stat label="Hodnotenie" value={user.rating?.average?.toFixed(1) ?? '–'} sub={`${user.rating?.count ?? 0}×`} />
          <Stat label="Dokončené" value={user.stats?.completedRentals ?? 0} />
          <Stat label="Vrátenia" value={user.stats?.successfulReturns ?? 0} />
          <Stat label="Zrušené" value={user.stats?.cancelledRentals ?? 0} />
        </div>
      </section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="h-scroll" role="tablist" aria-label="Profil">
          {TABS.map(([k, label]) => (
            <button key={k} role="tab" aria-selected={tab === k} className={`chip ${tab === k ? 'chip-active' : ''}`} onClick={() => setParams({ tab: k })}>{label}</button>
          ))}
        </div>
        <div className="flex gap-2">
          <Link to={`/users/${user.id}`} className="btn btn-ghost btn-sm">Verejný profil</Link>
          <button className="btn btn-secondary btn-sm" onClick={async () => { await logout(); navigate('/'); }}><LogOut className="h-4 w-4" aria-hidden />Odhlásiť sa</button>
        </div>
      </div>
      <div role="tabpanel">
        {tab === 'items' && <MyItems />}
        {tab === 'favorites' && <Favorites />}
        {tab === 'reviews' && <MyReviews userId={user.id} />}
        {tab === 'settings' && <EditProfile onSaved={refresh} />}
      </div>
      <p className="text-center text-xs text-ink-3">ShareOn · verzia {__APP_VERSION__}</p>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="card-elevated min-w-16 px-2 py-2">
      <div className="text-lg font-extrabold">{value}{sub && <span className="ml-0.5 text-xs font-medium text-ink-3">{sub}</span>}</div>
      <div className="text-[11px] text-ink-3">{label}</div>
    </div>
  );
}

function MyItems() {
  const { data, loading, error, reload } = useAsync(() => get<{ items: ItemCard[] }>('/api/users/me/items'), []);
  if (loading) return <CardSkeletons />;
  if (error) return <ErrorState message={error.message} onRetry={reload} />;
  return (
    <div className="space-y-4">
      <Link to="/items/new" className="btn btn-primary btn-sm"><Plus className="h-4 w-4" aria-hidden />Pridať predmet</Link>
      {data!.items.length ? <ItemGrid items={data!.items} /> : <EmptyState message={EMPTY.items} />}
    </div>
  );
}

function Favorites() {
  const { data, loading, error, reload } = useAsync(() => get<{ items: ItemCard[] }>('/api/users/me/favorites'), []);
  if (loading) return <CardSkeletons />;
  if (error) return <ErrorState message={error.message} onRetry={reload} />;
  return data!.items.length ? <ItemGrid items={data!.items} /> : <EmptyState message="Zatiaľ nemáš žiadne obľúbené predmety." />;
}

function MyReviews({ userId }: { userId: string }) {
  const { data, loading, error } = useAsync(() => get<{ reviews: Review[]; summary: Parameters<typeof RatingDistribution>[0]['summary'] }>(`/api/users/${userId}/reviews`), [userId]);
  if (loading) return <CardSkeletons count={2} />;
  if (error) return <ErrorState message={error.message} />;
  if (!data!.reviews.length) return <EmptyState message={EMPTY.reviews} />;
  return (
    <div className="card space-y-5 p-5">
      <RatingDistribution summary={data!.summary} />
      <ReviewList reviews={data!.reviews} />
    </div>
  );
}

function EditProfile({ onSaved }: { onSaved: () => Promise<void> }) {
  const { user } = useAuth();
  const { toast } = useUi();
  const [f, setF] = useState({ name: user!.name, phone: user!.phone, city: user!.city, bio: user!.bio ?? '' });
  const [avatar, setAvatar] = useState<string[]>(user!.avatarUrl ? [user!.avatarUrl] : []);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const avatarUrl = avatar[0] && avatar[0].startsWith('/uploads/') ? avatar[0] : avatar.length ? undefined : null;
      await patch('/api/users/me', { ...f, bio: f.bio || null, ...(avatarUrl !== undefined ? { avatarUrl } : {}) });
      await onSaved();
      toast('Profil bol uložený.');
      setErrors({});
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.fieldErrors());
        toast(err.message, 'error');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="card max-w-xl space-y-4 p-5" noValidate>
      <PhotoUploader value={avatar} onChange={setAvatar} max={1} label="Profilová fotka" />
      <TextField id="p-name" label="Meno" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} error={errors.name} />
      <TextField id="p-phone" label="Telefón" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} error={errors.phone} />
      <TextField id="p-city" label="Mesto" value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} error={errors.city} />
      <TextArea id="p-bio" label="O mne" value={f.bio} onChange={(e) => setF({ ...f, bio: e.target.value })} error={errors.bio} maxLength={500} />
      <button className="btn btn-primary" disabled={busy}>{busy ? 'Ukladám…' : 'Uložiť'}</button>
    </form>
  );
}
