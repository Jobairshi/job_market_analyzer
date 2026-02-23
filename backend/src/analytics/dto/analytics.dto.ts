import { IsOptional, IsString, IsIn } from 'class-validator';

/** Query params for analytics endpoints that support filtering. */
export class AnalyticsFilterDto {
  /** Filter by time range: 7d, 30d, 90d, or all (default: 30d) */
  @IsOptional()
  @IsString()
  @IsIn(['7d', '30d', '90d', 'all'])
  range?: '7d' | '30d' | '90d' | 'all' = '30d';

  /** Filter by a specific skill */
  @IsOptional()
  @IsString()
  skill?: string;

  /** Filter by location */
  @IsOptional()
  @IsString()
  location?: string;
}

/* ── Response shapes (for documentation / frontend typing) ── */

export interface SummaryResponse {
  totalJobs: number;
  jobsLast24h: number;
  remotePercentage: number;
  topCompany: string;
  topSkill: string;
}

export interface SkillTrendItem {
  skill: string;
  count: number;
}

export interface CompanyDemandItem {
  company: string;
  count: number;
}

export interface LocationDistItem {
  location: string;
  count: number;
}

export interface JobsOverTimeItem {
  date: string;   // YYYY-MM-DD
  count: number;
}

export interface ClusterNode {
  id: string;
  count: number;
  group: number;
}

export interface ClusterLink {
  source: string;
  target: string;
  weight: number;
}

export interface SkillClusterResponse {
  nodes: ClusterNode[];
  links: ClusterLink[];
}
