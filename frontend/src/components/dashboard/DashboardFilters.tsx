'use client';

import type { AnalyticsFilters } from '@/lib/useAnalytics';

interface Props {
  filters: AnalyticsFilters;
  onChange: (f: Partial<AnalyticsFilters>) => void;
}

const ranges: { value: AnalyticsFilters['range']; label: string }[] = [
  { value: '7d', label: '7 Days' },
  { value: '30d', label: '30 Days' },
  { value: '90d', label: '90 Days' },
  { value: 'all', label: 'All Time' },
];

export default function DashboardFilters({ filters, onChange }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Time range pills */}
      <div className="flex rounded-lg border border-gray-200 bg-white p-0.5">
        {ranges.map((r) => (
          <button
            key={r.value}
            onClick={() => onChange({ range: r.value })}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
              filters.range === r.value
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* Skill filter */}
      <input
        type="text"
        placeholder="Filter by skill..."
        value={filters.skill ?? ''}
        onChange={(e) => onChange({ skill: e.target.value || undefined })}
        className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 placeholder-gray-400 shadow-sm outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
      />

      {/* Location filter */}
      <input
        type="text"
        placeholder="Filter by location..."
        value={filters.location ?? ''}
        onChange={(e) => onChange({ location: e.target.value || undefined })}
        className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 placeholder-gray-400 shadow-sm outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
      />
    </div>
  );
}
