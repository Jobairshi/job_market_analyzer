import { Injectable, Inject, Logger } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../config/supabase.module';
import {
  AnalyticsFilterDto,
  SummaryResponse,
  SkillTrendItem,
  CompanyDemandItem,
  LocationDistItem,
  JobsOverTimeItem,
  SkillClusterResponse,
  ClusterNode,
  ClusterLink,
} from './dto/analytics.dto';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  /** In-memory cache: key → { data, expiresAt } */
  private cache = new Map<string, { data: unknown; expiresAt: number }>();
  private readonly TTL_MS = 60_000; // 60-second cache

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
  ) {}

  /* ───────────────────────────── helpers ───────────────────────────── */

  /** Simple TTL cache wrapper. */
  private async cached<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
    const entry = this.cache.get(key);
    if (entry && Date.now() < entry.expiresAt) {
      return entry.data as T;
    }
    const data = await fetcher();
    this.cache.set(key, { data, expiresAt: Date.now() + this.TTL_MS });
    return data;
  }

  /** Returns an ISO date string N days ago. */
  private daysAgo(n: number): string {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString();
  }

  /** Converts the range string to a cutoff ISO date (or null for 'all'). */
  private rangeCutoff(range?: string): string | null {
    switch (range) {
      case '7d':
        return this.daysAgo(7);
      case '30d':
        return this.daysAgo(30);
      case '90d':
        return this.daysAgo(90);
      default:
        return null;
    }
  }

  /** Apply common filters (range, skill, location) to a query builder. */
  private applyFilters(
    query: any,
    filters: AnalyticsFilterDto,
  ) {
    const cutoff = this.rangeCutoff(filters.range);
    if (cutoff) {
      query = query.gte('scraped_at', cutoff);
    }
    if (filters.skill) {
      query = query.contains('cleaned_tags', [filters.skill.toLowerCase()]);
    }
    if (filters.location) {
      query = query.ilike('location', `%${filters.location}%`);
    }
    return query;
  }

  /* ─────────────────── 1. Summary KPIs ─────────────────── */

  async getSummary(filters: AnalyticsFilterDto): Promise<SummaryResponse> {
    const cacheKey = `summary:${JSON.stringify(filters)}`;
    return this.cached(cacheKey, async () => {
      this.logger.log('Computing summary KPIs');

      // Total jobs (with filters)
      let totalQuery = this.supabase
        .from('jobs')
        .select('*', { count: 'exact', head: true });
      totalQuery = this.applyFilters(totalQuery, filters);
      const { count: totalJobs } = await totalQuery;

      // Jobs last 24h
      const yesterday = this.daysAgo(1);
      let last24Query = this.supabase
        .from('jobs')
        .select('*', { count: 'exact', head: true })
        .gte('scraped_at', yesterday);
      last24Query = this.applyFilters(last24Query, {
        ...filters,
        range: undefined,
      });
      const { count: jobsLast24h } = await last24Query;

      // Fetch company + location + cleaned_tags for aggregation
      let dataQuery = this.supabase
        .from('jobs')
        .select('company, location, cleaned_tags');
      dataQuery = this.applyFilters(dataQuery, filters);
      const { data: rows } = await dataQuery;

      const jobs = rows ?? [];

      // Remote percentage
      const remoteCount = jobs.filter((j) => {
        const loc = (j.location ?? '').toLowerCase();
        return loc.includes('remote') || loc.includes('anywhere') || loc === '';
      }).length;
      const remotePercentage =
        jobs.length > 0 ? Math.round((remoteCount / jobs.length) * 100) : 0;

      // Top company
      const compFreq = new Map<string, number>();
      for (const j of jobs) {
        const comp = (j.company ?? 'Unknown').trim();
        if (comp) compFreq.set(comp, (compFreq.get(comp) ?? 0) + 1);
      }
      const topCompany =
        [...compFreq.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'N/A';

      // Top skill
      const skillFreq = new Map<string, number>();
      for (const j of jobs) {
        for (const tag of j.cleaned_tags ?? []) {
          skillFreq.set(tag, (skillFreq.get(tag) ?? 0) + 1);
        }
      }
      const topSkill =
        [...skillFreq.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'N/A';

      return {
        totalJobs: totalJobs ?? 0,
        jobsLast24h: jobsLast24h ?? 0,
        remotePercentage,
        topCompany,
        topSkill,
      };
    });
  }

  /* ─────────────────── 2. Skills Trend ─────────────────── */

  async getSkillsTrend(filters: AnalyticsFilterDto): Promise<SkillTrendItem[]> {
    const cacheKey = `skills:${JSON.stringify(filters)}`;
    return this.cached(cacheKey, async () => {
      this.logger.log('Computing skills trend');

      let query = this.supabase.from('jobs').select('cleaned_tags');
      query = this.applyFilters(query, filters);
      const { data } = await query;

      const freq = new Map<string, number>();
      for (const row of data ?? []) {
        for (const tag of row.cleaned_tags ?? []) {
          freq.set(tag, (freq.get(tag) ?? 0) + 1);
        }
      }

      return [...freq.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15)
        .map(([skill, count]) => ({ skill, count }));
    });
  }

  /* ─────────────────── 3. Company Demand ─────────────────── */

  async getCompanyDemand(
    filters: AnalyticsFilterDto,
  ): Promise<CompanyDemandItem[]> {
    const cacheKey = `companies:${JSON.stringify(filters)}`;
    return this.cached(cacheKey, async () => {
      this.logger.log('Computing company demand');

      let query = this.supabase.from('jobs').select('company');
      query = this.applyFilters(query, filters);
      const { data } = await query;

      const freq = new Map<string, number>();
      for (const row of data ?? []) {
        const comp = (row.company ?? 'Unknown').trim();
        if (comp) freq.set(comp, (freq.get(comp) ?? 0) + 1);
      }

      return [...freq.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([company, count]) => ({ company, count }));
    });
  }

  /* ─────────────────── 4. Location Distribution ─────────────────── */

  async getLocationDistribution(
    filters: AnalyticsFilterDto,
  ): Promise<LocationDistItem[]> {
    const cacheKey = `locations:${JSON.stringify(filters)}`;
    return this.cached(cacheKey, async () => {
      this.logger.log('Computing location distribution');

      let query = this.supabase.from('jobs').select('location');
      query = this.applyFilters(query, filters);
      const { data } = await query;

      const freq = new Map<string, number>();
      for (const row of data ?? []) {
        const loc = (row.location ?? 'Unknown').trim() || 'Unknown';
        freq.set(loc, (freq.get(loc) ?? 0) + 1);
      }

      return [...freq.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15)
        .map(([location, count]) => ({ location, count }));
    });
  }

  /* ─────────────────── 5. Jobs Over Time ─────────────────── */

  async getJobsOverTime(
    filters: AnalyticsFilterDto,
  ): Promise<JobsOverTimeItem[]> {
    const cacheKey = `timeline:${JSON.stringify(filters)}`;
    return this.cached(cacheKey, async () => {
      this.logger.log('Computing jobs over time');

      let query = this.supabase
        .from('jobs')
        .select('scraped_at')
        .order('scraped_at', { ascending: true });
      query = this.applyFilters(query, filters);
      const { data } = await query;

      const freq = new Map<string, number>();
      for (const row of data ?? []) {
        const date = new Date(row.scraped_at).toISOString().slice(0, 10);
        freq.set(date, (freq.get(date) ?? 0) + 1);
      }

      return [...freq.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([date, count]) => ({ date, count }));
    });
  }

  /* ─────────────────── 6. Skill Clusters ─────────────────── */

  async getSkillClusters(
    filters: AnalyticsFilterDto,
  ): Promise<SkillClusterResponse> {
    const cacheKey = `clusters:${JSON.stringify(filters)}`;
    return this.cached(cacheKey, async () => {
      this.logger.log('Computing skill clusters');

      let query = this.supabase.from('jobs').select('cleaned_tags');
      query = this.applyFilters(query, filters);
      const { data } = await query;

      // Count individual skill frequencies
      const skillFreq = new Map<string, number>();
      // Count co-occurrences (pairs within same job)
      const coOccur = new Map<string, number>();

      for (const row of data ?? []) {
        const tags: string[] = row.cleaned_tags ?? [];
        for (const tag of tags) {
          skillFreq.set(tag, (skillFreq.get(tag) ?? 0) + 1);
        }
        // Pairwise co-occurrence
        for (let i = 0; i < tags.length; i++) {
          for (let j = i + 1; j < tags.length; j++) {
            const key = [tags[i], tags[j]].sort().join('||');
            coOccur.set(key, (coOccur.get(key) ?? 0) + 1);
          }
        }
      }

      // Keep top 25 skills as nodes
      const topSkills = [...skillFreq.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 25);

      const topSet = new Set(topSkills.map(([s]) => s));

      // Simple community detection: assign groups based on strongest link
      // First pass: build adjacency for top skills
      const adj = new Map<string, Map<string, number>>();
      for (const [key, weight] of coOccur.entries()) {
        const [a, b] = key.split('||');
        if (!topSet.has(a) || !topSet.has(b)) continue;
        if (!adj.has(a)) adj.set(a, new Map());
        if (!adj.has(b)) adj.set(b, new Map());
        adj.get(a)!.set(b, weight);
        adj.get(b)!.set(a, weight);
      }

      // Greedy label propagation for groups
      const groupMap = new Map<string, number>();
      let groupId = 0;
      const visited = new Set<string>();

      for (const [skill] of topSkills) {
        if (visited.has(skill)) continue;
        // BFS from this skill
        const queue = [skill];
        visited.add(skill);
        groupMap.set(skill, groupId);
        while (queue.length > 0) {
          const curr = queue.shift()!;
          const neighbors = adj.get(curr);
          if (!neighbors) continue;
          // Only follow strong links (top 3 neighbors)
          const sorted = [...neighbors.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3);
          for (const [nb] of sorted) {
            if (!visited.has(nb)) {
              visited.add(nb);
              groupMap.set(nb, groupId);
              queue.push(nb);
            }
          }
        }
        groupId++;
      }

      const nodes: ClusterNode[] = topSkills.map(([id, count]) => ({
        id,
        count,
        group: groupMap.get(id) ?? 0,
      }));

      // Build links: only between top skills, min weight threshold
      const minWeight = 2;
      const links: ClusterLink[] = [];
      for (const [key, weight] of coOccur.entries()) {
        if (weight < minWeight) continue;
        const [source, target] = key.split('||');
        if (topSet.has(source) && topSet.has(target)) {
          links.push({ source, target, weight });
        }
      }

      // Sort links by weight and take top 60 for readability
      links.sort((a, b) => b.weight - a.weight);

      return {
        nodes,
        links: links.slice(0, 60),
      };
    });
  }
}
