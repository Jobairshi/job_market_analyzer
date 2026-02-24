'use client';

/**
 * GeoControls — floating control panel for the map page.
 *
 *  • Toggle clustering
 *  • Toggle heatmap
 *  • "Jobs Near Me" button
 *  • Radius selector
 *  • Reset view
 */

interface GeoControlsProps {
  showClusters: boolean;
  setShowClusters: (v: boolean) => void;
  showHeatmap: boolean;
  setShowHeatmap: (v: boolean) => void;
  radius: number;
  setRadius: (v: number) => void;
  onFindNearMe: () => void;
  onReset: () => void;
  locating: boolean;
  jobCount: number;
  nearbyCount: number;
}

const RADII = [
  { label: '10 km', value: 10000 },
  { label: '25 km', value: 25000 },
  { label: '50 km', value: 50000 },
  { label: '100 km', value: 100000 },
];

export default function GeoControls({
  showClusters,
  setShowClusters,
  showHeatmap,
  setShowHeatmap,
  radius,
  setRadius,
  onFindNearMe,
  onReset,
  locating,
  jobCount,
  nearbyCount,
}: GeoControlsProps) {
  return (
    <div className="absolute left-4 top-4 z-[1000] w-64 rounded-xl border border-gray-200 bg-white/95 p-4 shadow-lg backdrop-blur">
      <h3 className="mb-3 text-sm font-bold text-gray-800">Map Controls</h3>

      {/* Stats */}
      <div className="mb-3 flex gap-2 text-xs">
        <span className="rounded bg-indigo-50 px-2 py-1 text-indigo-700 font-medium">
          {jobCount} jobs
        </span>
        {nearbyCount > 0 && (
          <span className="rounded bg-green-50 px-2 py-1 text-green-700 font-medium">
            {nearbyCount} nearby
          </span>
        )}
      </div>

      {/* Toggle: Clustering */}
      <label className="mb-2 flex cursor-pointer items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={showClusters}
          onChange={(e) => setShowClusters(e.target.checked)}
          className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
        />
        Cluster markers
      </label>

      {/* Toggle: Heatmap */}
      <label className="mb-3 flex cursor-pointer items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={showHeatmap}
          onChange={(e) => setShowHeatmap(e.target.checked)}
          className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
        />
        Show heatmap
      </label>

      {/* Radius selector */}
      <div className="mb-3">
        <span className="mb-1 block text-xs font-medium text-gray-500">
          Search radius
        </span>
        <div className="grid grid-cols-2 gap-1">
          {RADII.map((r) => (
            <button
              key={r.value}
              onClick={() => setRadius(r.value)}
              className={`rounded px-2 py-1 text-xs font-medium transition ${
                radius === r.value
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Find Near Me */}
      <button
        onClick={onFindNearMe}
        disabled={locating}
        className="mb-2 flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-60"
      >
        {locating ? (
          <>
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
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
            Locating…
          </>
        ) : (
          <>📍 Find Jobs Near Me</>
        )}
      </button>

      {/* Reset */}
      <button
        onClick={onReset}
        className="w-full rounded-lg bg-gray-100 px-3 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-200"
      >
        ↺ Reset View
      </button>
    </div>
  );
}
