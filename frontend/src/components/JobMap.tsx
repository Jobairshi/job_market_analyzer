'use client';

/**
 * JobMap — SSR-safe dynamic import wrapper for MapInner.
 * Leaflet requires `window`, so we use next/dynamic with ssr: false.
 */

import dynamic from 'next/dynamic';
import type { MapInnerProps } from './MapInner';

const MapInner = dynamic(() => import('./MapInner'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center rounded-xl bg-gray-100">
      <div className="flex flex-col items-center gap-2 text-gray-400">
        <svg className="h-8 w-8 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
          />
        </svg>
        <span className="text-sm">Loading map…</span>
      </div>
    </div>
  ),
});

export default function JobMap(props: MapInnerProps) {
  return <MapInner {...props} />;
}
