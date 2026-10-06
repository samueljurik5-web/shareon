import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ApiError } from '../api/client';
import { TextField } from '../components/Field';
import { useAuth } from '../context/AuthContext';
import { useUi } from '../context/UiContext';

const Shell = ({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) => (
  <div className="mx-auto max-w-md py-6">
    <h1 className="text-gradient text-3xl font-extrabold">{title}</h1>
    <p className="mt-2 text-ink-2">{subtitle}</p>
    <div className="card mt-6 p-6">{children}</div>
  </div>
);

export function LoginPage() {
  const { login } = useAuth();
  const { toast } = useUi();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!/^\S+@\S+\.\S+$/.test(email)) errs.email = 'Zadaj platný e-mail.';
    if (!password) errs.password = 'Heslo je povinné.';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    setFormError(null);
    try {
      await login(email, password);
      toast('Vitaj späť!');
      navigate((location.state as { from?: string } | null)?.from ?? '/');
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.fieldErrors());
        setFormError(err.message);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell title="Prihlásenie" subtitle="Prihlás sa a požičiavaj vo svojom okolí.">
      <form onSubmit={submit} noValidate className="space-y-4">
        {formError && <p role="alert" className="notice notice-warn">{formError}</p>}
        <TextField id="email" type="email" autoComplete="email" label="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} />
        <TextField id="password" type="password" autoComplete="current-password" label="Heslo" value={password} onChange={(e) => setPassword(e.target.value)} error={errors.password} />
        <button className="btn btn-primary w-full" disabled={busy}>{busy ? 'Prihlasujem…' : 'Prihlásiť sa'}</button>
        <p className="text-center text-sm text-ink-2">Nemáš účet? <Link to="/register" className="font-semibold text-neon-blue">Zaregistruj sa</Link></p>
      </form>
    </Shell>
  );
}

export function RegisterPage() {
  const { register } = useAuth();
  const { toast } = useUi();
  const navigate = useNavigate();
  const [f, setF] = useState({ name: '', email: '', password: '', phone: '', city: 'Košice' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((s) => ({ ...s, [k]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (f.name.trim().length < 2) errs.name = 'Meno musí mať aspoň 2 znaky.';
    if (!/^\S+@\S+\.\S+$/.test(f.email)) errs.email = 'Zadaj platný e-mail.';
    if (f.password.length < 8) errs.password = 'Heslo musí mať aspoň 8 znakov.';
    else if (!/[A-Za-z]/.test(f.password) || !/[0-9]/.test(f.password)) errs.password = 'Heslo musí obsahovať písmeno aj číslo.';
    if (!/^\+?[0-9 ]{9,16}$/.test(f.phone.trim())) errs.phone = 'Zadaj platné telefónne číslo, napr. +421 900 123 456.';
    if (f.city.trim().length < 2) errs.city = 'Zadaj mesto.';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      await register(f);
      toast('Účet bol vytvorený. Vitaj v ShareOn!');
      navigate('/');
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors({ ...err.fieldErrors(), ...(err.status === 409 ? { email: err.message } : {}) });
        if (err.status !== 409) toast(err.message, 'error');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell title="Registrácia" subtitle="Vytvor si účet a začni požičiavať.">
      <form onSubmit={submit} noValidate className="space-y-4">
        <TextField id="name" autoComplete="name" label="Meno a priezvisko" value={f.name} onChange={set('name')} error={errors.name} />
        <TextField id="email" type="email" autoComplete="email" label="E-mail" value={f.email} onChange={set('email')} error={errors.email} />
        <TextField id="password" type="password" autoComplete="new-password" label="Heslo" value={f.password} onChange={set('password')} error={errors.password} hint="Aspoň 8 znakov, písmeno a číslo." />
        <TextField id="phone" type="tel" autoComplete="tel" label="Telefón" value={f.phone} onChange={set('phone')} error={errors.phone} hint="Zobrazí sa len druhej strane po prijatí žiadosti." />
        <TextField id="city" autoComplete="address-level2" label="Mesto" value={f.city} onChange={set('city')} error={errors.city} />
        <button className="btn btn-primary w-full" disabled={busy}>{busy ? 'Vytváram účet…' : 'Vytvoriť účet'}</button>
        <p className="text-center text-sm text-ink-2">Už máš účet? <Link to="/login" className="font-semibold text-neon-blue">Prihlás sa</Link></p>
      </form>
    </Shell>
  );
}
