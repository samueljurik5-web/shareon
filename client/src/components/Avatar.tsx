import { imageUrl } from '../lib/format';

export function Avatar({ name, url, size = 40 }: { name: string; url?: string | null; size?: number }) {
  const initials = name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  if (url) return <img src={imageUrl(url)} alt={`Profilová fotka: ${name}`} width={size} height={size} className="rounded-full object-cover" style={{ width: size, height: size }} />;
  return (
    <span aria-hidden className="grid shrink-0 place-items-center rounded-full bg-grad-secondary font-bold text-night" style={{ width: size, height: size, fontSize: size * 0.38 }}>
      {initials}
    </span>
  );
}
