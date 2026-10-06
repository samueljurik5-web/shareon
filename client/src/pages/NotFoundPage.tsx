import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="py-16 text-center">
      <h1 className="text-gradient text-5xl font-extrabold">404</h1>
      <p className="mt-3 text-ink-2">Táto stránka neexistuje.</p>
      <Link to="/" className="btn btn-primary mt-6">Späť domov</Link>
    </div>
  );
}
