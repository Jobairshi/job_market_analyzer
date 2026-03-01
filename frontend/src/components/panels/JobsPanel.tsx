'use client';

/**
 * Jobs panel — browse & filter listings (from /jobs page).
 */

import { useCallback, useEffect, useState } from 'react';
import { api, Job } from '@/lib/api';
import JobCard from '@/components/JobCard';
import JobFilters from '@/components/JobFilters';

export default function JobsPanel() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [sources, setSources] = useState<string[]>([]);
  const [filters, setFilters] = useState<Record<string, string>>({
    search: '',
    source: '',
    location: '',
    skill: '',
  });

  const [debounced, setDebounced] = useState(filters);
  useEffect(() => { const t = setTimeout(() => setDebounced(filters), 400); return () => clearTimeout(t); }, [filters]);

  useEffect(() => { api.getSources().then(setSources).catch(() => {}); }, []);

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getJobs({ ...debounced, page, limit: 20 });
      setJobs(res.data);
      setTotal(res.total);
    } catch { /* silent */ } finally { setLoading(false); }
  }, [debounced, page]);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);
  useEffect(() => { setPage(1); }, [debounced]);

  const totalPages = Math.max(1, Math.ceil(total / 20));
  const handleFilterChange = (key: string, value: string) => setFilters((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Job Listings</h1>
        <p className="mt-1 text-sm text-gray-500">{total} jobs found</p>
      </div>

      <JobFilters sources={sources} filters={filters} onChange={handleFilterChange} />

      {loading ? (
        <div className="mt-12 flex justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
        </div>
      ) : jobs.length === 0 ? (
        <p className="mt-12 text-center text-gray-400">No jobs match your filters.</p>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {jobs.map((j) => (
            <JobCard key={j.id} job={j} />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-3 text-sm">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-md border px-3 py-1.5 disabled:opacity-40">
            &larr; Prev
          </button>
          <span className="text-gray-500">Page {page} of {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="rounded-md border px-3 py-1.5 disabled:opacity-40">
            Next &rarr;
          </button>
        </div>
      )}
    </div>
  );
}
