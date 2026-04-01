import { useState, useRef, useEffect } from 'react';
import { MapPin, Loader2, X } from 'lucide-react';

interface AddressResult {
  display: string;
  lng: number;
  lat: number;
}

interface Props {
  onSelect: (lng: number, lat: number, label: string) => void;
  placeholder?: string;
  className?: string;
}

/**
 * Type-ahead address search using the Photon geocoder (OpenStreetMap data, hosted by Komoot).
 * Returns coordinates on selection; parent calls map.flyTo().
 */
export function AddressSearch({ onSelect, placeholder = 'Search address...', className = '' }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<AddressResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced geocode
  const handleInput = (value: string) => {
    setQuery(value);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (value.length < 3) {
      setResults([]);
      setOpen(false);
      return;
    }
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(value)}&format=jsonv2&limit=6&countrycodes=us&addressdetails=1`
        );
        const data = await res.json();
        const items: AddressResult[] = data.map((r: any) => {
          const a = r.address || {};
          const parts = [a.house_number, a.road, a.city || a.town || a.village, a.state, a.postcode].filter(Boolean);
          return {
            display: parts.length > 0 ? parts.join(', ') : r.display_name?.split(',').slice(0, 3).join(',') || 'Unknown',
            lng: Number(r.lon),
            lat: Number(r.lat),
          };
        });
        setResults(items);
        setOpen(items.length > 0);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
  };

  const handleSelect = (result: AddressResult) => {
    setQuery(result.display);
    setOpen(false);
    onSelect(result.lng, result.lat, result.display);
  };

  const handleClear = () => {
    setQuery('');
    setResults([]);
    setOpen(false);
  };

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className={`relative ${className}`} ref={ref}>
      <MapPin size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
      {loading && <Loader2 size={12} className="absolute right-7 top-1/2 -translate-y-1/2 text-gray-400 animate-spin" />}
      <input
        type="text"
        value={query}
        onChange={(e) => handleInput(e.target.value)}
        onFocus={() => { if (results.length > 0) setOpen(true); }}
        placeholder={placeholder}
        className="h-9 w-full pl-8 pr-8 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
      />
      {query && (
        <button
          onClick={handleClear}
          aria-label="Clear search"
          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
        >
          <X size={12} />
        </button>
      )}
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border rounded-md shadow-lg max-h-56 overflow-auto right-0">
          {results.map((r, i) => (
            <button
              key={`${r.lat}-${r.lng}-${i}`}
              onClick={() => handleSelect(r)}
              className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 flex items-center gap-2"
              title={r.display}
            >
              <MapPin size={12} className="text-gray-400 shrink-0" />
              <span className="truncate text-gray-900">{r.display}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
