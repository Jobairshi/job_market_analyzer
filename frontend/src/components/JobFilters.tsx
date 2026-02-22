'use client';

interface Props {
  sources: string[];
  filters: Record<string, string>;
  onChange: (key: string, value: string) => void;
}

export default function JobFilters({ sources, filters, onChange }: Props) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {/* Search */}
      <input
        type="text"
        placeholder="Search title or company…"
        value={filters.search ?? ''}
        onChange={(e) => onChange('search', e.target.value)}
        className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-gray-400
                   focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
      />

      {/* Source */}
      <select
        value={filters.source ?? ''}
        onChange={(e) => onChange('source', e.target.value)}
        className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm
                   focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
      >
        <option value="">All sources</option>
        {sources.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>

      {/* Location */}
      <input
        type="text"
        placeholder="Location…"
        value={filters.location ?? ''}
        onChange={(e) => onChange('location', e.target.value)}
        className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-gray-400
                   focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
      />

      {/* Skill */}
      <input
        type="text"
        placeholder="Skill (e.g. python)…"
        value={filters.skill ?? ''}
        onChange={(e) => onChange('skill', e.target.value)}
        className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-gray-400
                   focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
      />
    </div>
  );
}
