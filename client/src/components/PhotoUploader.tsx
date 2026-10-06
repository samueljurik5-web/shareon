import { ImagePlus, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { uploadImage, ApiError } from '../api/client';
import { imageUrl } from '../lib/format';

const MAX_BYTES = 5 * 1024 * 1024;
const TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export function PhotoUploader({ value, onChange, max = 5, label = 'Fotografie' }: { value: string[]; onChange: (v: string[]) => void; max?: number; label?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setError(null);
    const list = Array.from(files).slice(0, max - value.length);
    for (const f of list) {
      if (!TYPES.includes(f.type)) return setError('Povolené sú len obrázky JPG, PNG alebo WEBP.');
      if (f.size > MAX_BYTES) return setError('Súbor je príliš veľký (max. 5 MB).');
    }
    setBusy(true);
    try {
      const urls: string[] = [];
      for (const f of list) urls.push(await uploadImage(f));
      onChange([...value, ...urls]);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Nahrávanie zlyhalo.');
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };

  return (
    <div>
      <span className="label">{label} ({value.length}/{max})</span>
      <div className="flex flex-wrap gap-2">
        {value.map((url, i) => (
          <div key={url} className="relative h-20 w-20 overflow-hidden rounded-2xl border border-line">
            <img src={imageUrl(url)} alt={`Fotografia ${i + 1}`} className="h-full w-full object-cover" />
            <button type="button" className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-night/80" onClick={() => onChange(value.filter((u) => u !== url))} aria-label={`Odstrániť fotografiu ${i + 1}`}>
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
        ))}
        {value.length < max && (
          <button type="button" disabled={busy} onClick={() => input.current?.click()} className="grid h-20 w-20 place-items-center rounded-2xl border border-dashed border-line text-ink-2 hover:border-neon-blue hover:text-ink">
            {busy ? <span className="h-5 w-5 animate-spin rounded-full border-2 border-neon-blue border-t-transparent" aria-label="Nahrávam" /> : <ImagePlus className="h-6 w-6" aria-hidden />}
            <span className="sr-only">Pridať fotografiu</span>
          </button>
        )}
      </div>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={(e) => onFiles(e.target.files)} aria-label="Vybrať fotografie" />
      {error && <p className="field-error" role="alert">{error}</p>}
    </div>
  );
}
