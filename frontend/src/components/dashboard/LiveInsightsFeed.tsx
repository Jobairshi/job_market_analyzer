'use client';

import { useEffect, useState, useCallback } from 'react';
import { api, MarketInsight, TrendsResponse, TrendSkill } from '@/lib/api';

/* ── Severity badge ────────────────────────────────────── */
function severity(s: string) {
  switch (s) {
    case 'high':
      return 'bg-red-100 text-red-700';
    case 'medium':
      return 'bg-yellow-100 text-yellow-700';
    default:
      return 'bg-blue-100 text-blue-700';
  }
}

function TrendBadge({ growth }: { growth: number }) {
  if (growth > 0) {
    return (
      <span className="inline-flex items-center text-xs font-semibold text-green-700">
        <svg className="mr-0.5 h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L10 6.414l-3.293 3.293a1 1 0 01-1.414 0z"
            clipRule="evenodd"
          />
        </svg>
        +{Math.round(growth)}%
      </span>
    );
  }
  if (growth < 0) {
    return (
      <span className="inline-flex items-center text-xs font-semibold text-red-700">
        <svg className="mr-0.5 h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M14.707 10.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L10 13.586l3.293-3.293a1 1 0 011.414 0z"
            clipRule="evenodd"
          />
        </svg>
        {Math.round(growth)}%
      </span>
    );
  }
  return <span className="text-xs text-gray-400">0%</span>;
}

/* ── Main Component ────────────────────────────────────── */
export default function LiveInsightsFeed() {
  const [insights, setInsights] = useState<MarketInsight[]>([]);
  const [trends, setTrends] = useState<TrendsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [insightsData, trendsData] = await Promise.all([
        api.getInsights(10),
        api.getTrends(),
      ]);
      setInsights(insightsData);
      setTrends(trendsData);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60_000); // auto-refresh 60s
    return () => clearInterval(interval);
  }, [fetchData]);

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="h-24 animate-pulse rounded-xl border border-gray-200 bg-gray-100"
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-600">
        {error}
      </div>
    );
  }

  return (
    <section className="space-y-6">
      {/* Trend Summary */}
      {trends && (
        <div className="grid gap-4 sm:grid-cols-3">
          {/* Trending Up */}
          <div className="rounded-xl border border-green-200 bg-green-50 p-5">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-green-700">
              Trending Up
            </h3>
            {(trends.trending_skills ?? []).length === 0 ? (
              <p className="text-sm text-green-600">No upward trends yet.</p>
            ) : (
              <ul className="space-y-1.5">
                {(trends.trending_skills ?? []).slice(0, 6).map((t) => (
                  <li key={t.skill} className="flex items-center justify-between text-sm">
                    <span className="font-medium text-gray-800">{t.skill}</span>
                    <TrendBadge growth={t.growth_pct} />
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Trending Down */}
          <div className="rounded-xl border border-red-200 bg-red-50 p-5">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-red-700">
              Trending Down
            </h3>
            {(trends.declining_skills ?? []).length === 0 ? (
              <p className="text-sm text-red-600">Nothing declining.</p>
            ) : (
              <ul className="space-y-1.5">
                {(trends.declining_skills ?? []).slice(0, 6).map((t) => (
                  <li key={t.skill} className="flex items-center justify-between text-sm">
                    <span className="font-medium text-gray-800">{t.skill}</span>
                    <TrendBadge growth={t.growth_pct} />
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Job Volume */}
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
              Job Volume
            </h3>
            <div className="flex items-end gap-6">
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  {trends.jobs_24h ?? 0}
                </p>
                <p className="text-xs text-gray-500">last 24 hours</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  {trends.jobs_7d ?? 0}
                </p>
                <p className="text-xs text-gray-500">last 7 days</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Insight Cards */}
      <div>
        <h2 className="mb-3 text-lg font-semibold text-gray-900">
          AI Market Insights
        </h2>
        {insights.length === 0 ? (
          <p className="text-sm text-gray-500">
            No insights yet — they are generated hourly by the cron job.
          </p>
        ) : (
          <div className="space-y-4">
            {insights.map((ins) => (
              <div
                key={ins.id}
                className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-semibold text-gray-900">{ins.title}</h3>
                  <div className="flex shrink-0 gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${severity(ins.severity)}`}
                    >
                      {ins.severity}
                    </span>
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                      {ins.insight_type}
                    </span>
                  </div>
                </div>
                <p className="mt-2 text-sm text-gray-700 whitespace-pre-wrap">
                  {ins.text}
                </p>
                <p className="mt-2 text-xs text-gray-400">
                  {new Date(ins.created_at).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
