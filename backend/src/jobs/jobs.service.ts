import { Injectable, Inject } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../config/supabase.module';
import { FilterJobsDto } from './dto/filter-jobs.dto';

@Injectable()
export class JobsService {
  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
  ) {}

  /**
   * List jobs with filtering, search, and pagination.
   * Returns { data, total, page, limit }.
   */
  async findAll(filters: FilterJobsDto) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const offset = (page - 1) * limit;

    let query = this.supabase
      .from('jobs')
      .select(
        'id, source, title, company, location, tags, cleaned_tags, link, description, scraped_at',
        { count: 'exact' },
      )
      .order('scraped_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // — Exact filters —
    if (filters.source) {
      query = query.eq('source', filters.source.toLowerCase());
    }
    if (filters.company) {
      query = query.ilike('company', `%${filters.company}%`);
    }
    if (filters.location) {
      query = query.ilike('location', `%${filters.location}%`);
    }

    // — Skill filter (checks if cleaned_tags array contains the skill) —
    if (filters.skill) {
      query = query.contains('cleaned_tags', [filters.skill.toLowerCase()]);
    }

    // — Free-text search (title or company) —
    if (filters.search) {
      query = query.or(
        `title.ilike.%${filters.search}%,company.ilike.%${filters.search}%`,
      );
    }

    const { data, count, error } = await query;

    if (error) {
      throw new Error(`Supabase query failed: ${error.message}`);
    }

    return {
      data: data ?? [],
      total: count ?? 0,
      page,
      limit,
    };
  }

  /** Get all unique sources for the filter dropdown. */
  async getSources(): Promise<string[]> {
    const { data, error } = await this.supabase
      .from('jobs')
      .select('source')
      .order('source');

    if (error) throw new Error(error.message);

    const unique = [...new Set((data ?? []).map((r) => r.source as string))];
    return unique;
  }

  /** Get top N skills across all jobs (for filter dropdown). */
  async getTopSkills(n = 30): Promise<{ skill: string; count: number }[]> {
    const { data, error } = await this.supabase
      .from('jobs')
      .select('cleaned_tags');

    if (error) throw new Error(error.message);

    const freq = new Map<string, number>();
    for (const row of data ?? []) {
      for (const tag of row.cleaned_tags ?? []) {
        freq.set(tag, (freq.get(tag) ?? 0) + 1);
      }
    }

    return [...freq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([skill, count]) => ({ skill, count }));
  }
}
