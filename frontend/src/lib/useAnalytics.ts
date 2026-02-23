'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  api,
  AnalyticsSummary,
  SkillTrendItem,
  CompanyDemandItem,
  LocationDistItem,
  JobsOverTimeItem,
  SkillClusterData,
} from '@/lib/api';

export interface AnalyticsFilters {
  range: '7d' | '30d' | '90d' | 'all';
  skill?: string;
  location?: string;
}

export interface AnalyticsData {
  summary: AnalyticsSummary | null;
  skills: SkillTrendItem[];
  companies: CompanyDemandItem[];
  locations: LocationDistItem[];
  timeline: JobsOverTimeItem[];
  clusters: SkillClusterData | null;
  loading: boolean;
  error: string | null;
  filters: AnalyticsFilters;
  setFilters: (f: Partial<AnalyticsFilters>) => void;
  lastUpdated: Date | null;
}

const POLL_INTERVAL = 60_000; // 60 seconds

export function useAnalytics(): AnalyticsData {
  const [filters, setFiltersState] = useState<AnalyticsFilters>({ range: '30d' });
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [skills, setSkills] = useState<SkillTrendItem[]>([]);
  const [companies, setCompanies] = useState<CompanyDemandItem[]>([]);
  const [locations, setLocations] = useState<LocationDistItem[]>([]);
  const [timeline, setTimeline] = useState<JobsOverTimeItem[]>([]);
  const [clusters, setClusters] = useState<SkillClusterData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const setFilters = useCallback((partial: Partial<AnalyticsFilters>) => {
    setFiltersState((prev) => ({ ...prev, ...partial }));
  }, []);

  const buildParams = useCallback((): Record<string, string> => {
    const p: Record<string, string> = {};
    if (filters.range && filters.range !== 'all') p.range = filters.range;
    if (filters.skill) p.skill = filters.skill;
    if (filters.location) p.location = filters.location;
    return p;
  }, [filters]);

  const fetchAll = useCallback(async () => {
    try {
      setError(null);
      const params = buildParams();

      const [s, sk, co, lo, tl, cl] = await Promise.all([
        api.getAnalyticsSummary(params),
        api.getSkillsTrend(params),
        api.getCompanyDemand(params),
        api.getLocationDistribution(params),
        api.getJobsOverTime(params),
        api.getSkillClusters(params),
      ]);

      setSummary(s);
      setSkills(sk);
      setCompanies(co);
      setLocations(lo);
      setTimeline(tl);
      setClusters(cl);
      setLastUpdated(new Date());
    } catch (err: any) {
      setError(err.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, [buildParams]);

  // Fetch on mount + when filters change
  useEffect(() => {
    setLoading(true);
    fetchAll();
  }, [fetchAll]);

  // Poll every 60 seconds
  useEffect(() => {
    intervalRef.current = setInterval(fetchAll, POLL_INTERVAL);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchAll]);

  return {
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
  };
}
