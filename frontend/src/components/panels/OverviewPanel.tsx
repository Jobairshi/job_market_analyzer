'use client';

/**
 * Overview panel — KPI cards, charts, cluster graph.
 * Extracted from the original /dashboard page.
 */

import { useAnalytics } from '@/lib/useAnalytics';
import StatsCard, { StatsCardSkeleton } from '@/components/dashboard/StatsCard';
import SkillsBarChart, { SkillsBarChartSkeleton } from '@/components/dashboard/SkillsBarChart';
import JobsLineChart, { JobsLineChartSkeleton } from '@/components/dashboard/JobsLineChart';
import CompanyPieChart, { CompanyPieChartSkeleton } from '@/components/dashboard/CompanyPieChart';
import LocationBarChart, { LocationBarChartSkeleton } from '@/components/dashboard/LocationBarChart';
import SkillClusterGraph, { SkillClusterGraphSkeleton } from '@/components/dashboard/SkillClusterGraph';
import DashboardFilters from '@/components/dashboard/DashboardFilters';

/* ── Icons ─────────────────────────────────────────────── */

const BriefcaseIcon = () => (
  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.073a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5V14.15m16.5 0a1.5 1.5 0 00.348-.848l-1.323-5.953A1.5 1.5 0 0017.795 6H6.205a1.5 1.5 0 00-1.48 1.349L3.403 13.3a1.5 1.5 0 00.347.849m16.5 0H3.75m7.5-6.75V3.375c0-.621.504-1.125 1.125-1.125h.75c.621 0 1.125.504 1.125 1.125V7.4" />
  </svg>
);
const ClockIcon = () => (
  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);
const GlobeIcon = () => (
  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5a17.92 17.92 0 01-8.716-4.247m0 0A8.966 8.966 0 013 12c0-1.777.514-3.433 1.4-4.83" />
  </svg>
);
const BuildingIcon = () => (
  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
  </svg>
);
const SparklesIcon = () => (
  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715l-.75 2.625-.75-2.625a3.375 3.375 0 00-2.318-2.318L11.816 5.25l2.625-.75a3.375 3.375 0 002.318-2.318L17.509 0l.75 2.182a3.375 3.375 0 002.318 2.318l2.625.75-2.625.75a3.375 3.375 0 00-2.318 2.715z" />
  </svg>
);

/* ── Panel ─────────────────────────────────────────────── */

export default function OverviewPanel() {
  const {
    summary,
    skills,
    companies,
    locations,
    timeline,
    clusters,
    loading,
    error,
    filters,
    setFilters,
    lastUpdated,
  } = useAnalytics();

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Overview</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            Real-time analytics from AI/ML job postings
            {lastUpdated && (
              <span className="ml-2 text-xs text-gray-400">
                Updated {lastUpdated.toLocaleTimeString()}
              </span>
            )}
          </p>
        </div>
        <DashboardFilters filters={filters} onChange={setFilters} />
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* KPI Cards */}
      <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => <StatsCardSkeleton key={i} />)
        ) : summary ? (
          <>
            <StatsCard title="Total Jobs" value={summary.totalJobs.toLocaleString()} icon={<BriefcaseIcon />} color="indigo" />
            <StatsCard title="Last 24 Hours" value={summary.jobsLast24h.toLocaleString()} subtitle="New jobs today" icon={<ClockIcon />} color="emerald" />
            <StatsCard title="Remote %" value={`${summary.remotePercentage}%`} subtitle="Of all listings" icon={<GlobeIcon />} color="cyan" />
            <StatsCard title="Top Company" value={summary.topCompany} icon={<BuildingIcon />} color="amber" />
            <StatsCard title="Top Skill" value={summary.topSkill} icon={<SparklesIcon />} color="rose" />
          </>
        ) : null}
      </section>

      {/* Charts Row 1 */}
      <section className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {loading ? (
          <><JobsLineChartSkeleton /><SkillsBarChartSkeleton /></>
        ) : (
          <><JobsLineChart data={timeline} /><SkillsBarChart data={skills} /></>
        )}
      </section>

      {/* Charts Row 2 */}
      <section className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {loading ? (
          <><CompanyPieChartSkeleton /><LocationBarChartSkeleton /></>
        ) : (
          <><CompanyPieChart data={companies} /><LocationBarChart data={locations} /></>
        )}
      </section>

      {/* Skill Clusters */}
      <section className="mb-6">
        {loading ? <SkillClusterGraphSkeleton /> : clusters ? <SkillClusterGraph data={clusters} /> : null}
      </section>

      <div className="text-center text-xs text-gray-400">Auto-refreshes every 60s</div>
    </div>
  );
}
