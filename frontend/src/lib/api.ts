/** Thin wrapper around fetch for talking to the NestJS backend. */

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
}

async function request<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(opts.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API}${path}`, { ...opts, headers });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `Request failed: ${res.status}`);
  }

  return res.json() as Promise<T>;
}

/* ── Auth ─────────────────────────────────────────────── */

export interface AuthResponse {
  access_token: string;
  user: { id: string; email: string; name: string; role: string };
}

export const api = {
  register: (body: { email: string; password: string; name: string }) =>
    request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  login: (body: { email: string; password: string }) =>
    request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  me: () => request<{ id: string; email: string; name: string; role: string }>('/auth/me'),

  /* ── Jobs ────────────────────────────────────────────── */

  getJobs: (params: Record<string, string | number>) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== '' && v !== undefined) qs.set(k, String(v));
    }
    return request<{
      data: Job[];
      total: number;
      page: number;
      limit: number;
    }>(`/jobs?${qs.toString()}`);
  },

  getSources: () => request<string[]>('/jobs/sources'),
  getTopSkills: () => request<{ skill: string; count: number }[]>('/jobs/skills'),

  /* ── Analytics ───────────────────────────────────────── */

  getAnalyticsSummary: (params?: Record<string, string>) => {
    const qs = new URLSearchParams(params);
    return request<AnalyticsSummary>(`/analytics/summary?${qs.toString()}`);
  },

  getSkillsTrend: (params?: Record<string, string>) => {
    const qs = new URLSearchParams(params);
    return request<SkillTrendItem[]>(`/analytics/skills-trend?${qs.toString()}`);
  },

  getCompanyDemand: (params?: Record<string, string>) => {
    const qs = new URLSearchParams(params);
    return request<CompanyDemandItem[]>(`/analytics/company-demand?${qs.toString()}`);
  },

  getLocationDistribution: (params?: Record<string, string>) => {
    const qs = new URLSearchParams(params);
    return request<LocationDistItem[]>(`/analytics/location-distribution?${qs.toString()}`);
  },

  getJobsOverTime: (params?: Record<string, string>) => {
    const qs = new URLSearchParams(params);
    return request<JobsOverTimeItem[]>(`/analytics/jobs-over-time?${qs.toString()}`);
  },

  getSkillClusters: (params?: Record<string, string>) => {
    const qs = new URLSearchParams(params);
    return request<SkillClusterData>(`/analytics/skill-clusters?${qs.toString()}`);
  },

  /* ── Resume Matching ─────────────────────────────────── */

  uploadResume: async (file: File, topK = 10): Promise<ResumeMatchResponse> => {
    const token = getToken();
    const form = new FormData();
    form.append('file', file);

    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${API}/resume/upload?top_k=${topK}`, {
      method: 'POST',
      headers,
      body: form,
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.message || body.detail || `Upload failed: ${res.status}`);
    }

    return res.json() as Promise<ResumeMatchResponse>;
  },

  /* ── AI Intelligence ─────────────────────────────────── */

  aiQuery: (query: string) =>
    request<AIQueryResponse>('/ai/query', {
      method: 'POST',
      body: JSON.stringify({ query }),
    }),

  aiRecommend: (body: {
    resume_text?: string;
    preferred_skills?: string[];
    preferred_location?: string;
    top_k?: number;
  }) =>
    request<AIRecommendResponse>('/ai/recommend', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  aiResumeMatch: async (file: File, topK = 5, explain = true): Promise<AIResumeMatchResponse> => {
    const token = getToken();
    const form = new FormData();
    form.append('file', file);

    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(
      `${API}/ai/resume-match?top_k=${topK}&explain=${explain}`,
      { method: 'POST', headers, body: form },
    );

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.message || body.detail || `Upload failed: ${res.status}`);
    }
    return res.json() as Promise<AIResumeMatchResponse>;
  },

  aiSkillGap: (resumeText: string, jobDescription: string) =>
    request<AISkillGapResponse>('/ai/skill-gap', {
      method: 'POST',
      body: JSON.stringify({ resume_text: resumeText, job_description: jobDescription }),
    }),

  /* ── Geo ──────────────────────────────────────────────── */

  geoNearby: (lat: number, lng: number, radius = 50000, page = 1, limit = 20) =>
    request<GeoNearbyResponse>(
      `/geo/nearby?lat=${lat}&lng=${lng}&radius=${radius}&page=${page}&limit=${limit}`,
    ),

  geoAll: () => request<GeoAllResponse>('/geo/all'),

  geoStats: () => request<GeoStatsResponse>('/geo/stats'),
};

/* ── Types ─────────────────────────────────────────────── */

export interface Job {
  id: string;
  source: string;
  title: string;
  company: string | null;
  location: string | null;
  latitude?: number | null;
  longitude?: number | null;
  tags: string[];
  cleaned_tags: string[];
  link: string;
  description: string | null;
  scraped_at: string;
}

/* ── Analytics types ───────────────────────────────────── */

export interface AnalyticsSummary {
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
  date: string;
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

export interface SkillClusterData {
  nodes: ClusterNode[];
  links: ClusterLink[];
}

/* ── Resume matching types ─────────────────────────────── */

export interface MatchedJob {
  id: string;
  title: string;
  company: string;
  location: string;
  link: string;
  cleaned_tags: string[];
  similarity: number;      // 0–100
  skill_overlap: number;   // 0–100
  final_score: number;     // 0–100
  matched_skills: string[];
}

export interface ResumeMatchResponse {
  matches: MatchedJob[];
  total: number;
  resume_filename: string;
}

/* ── AI Intelligence types ─────────────────────────────── */

export interface AIQueryResponse {
  summary: string;
  top_skills: string[];
  top_companies: string[];
  insight: string;
}

export interface AIRecommendResponse {
  recommendations: Array<{
    id: string;
    title: string;
    company: string;
    location: string;
    link: string;
    cleaned_tags: string[];
    semantic_similarity: number;
    skill_overlap: number;
    preference_match: number;
    final_score: number;
    matched_skills: string[];
  }>;
  total: number;
}

export interface MatchExplanation {
  job_title: string;
  match_score: number;
  why_match: string;
  missing_skills: string[];
  improvement_suggestions: string[];
}

export interface AIResumeMatchResponse {
  matches: Array<MatchedJob & { explanation?: MatchExplanation | null }>;
  total: number;
  resume_filename: string;
  ai_explained: boolean;
}

export interface LearningPathItem {
  skill: string;
  resource: string;
  type: 'course' | 'tool' | 'certification';
}

export interface AISkillGapResponse {
  missing_skills: string[];
  learning_path: LearningPathItem[];
  summary: string;
}

/* ── Geo types ─────────────────────────────────────────── */

export interface GeoJob {
  id: string;
  title: string;
  company: string | null;
  location: string | null;
  latitude: number;
  longitude: number;
  tags?: string[];
  cleaned_tags?: string[];
  link: string;
  scraped_at: string;
}

export interface GeoNearbyResponse {
  data: GeoJob[];
  total: number;
  page: number;
  limit: number;
  center: { lat: number; lng: number };
  radius: number;
  fallback?: boolean;
}

export interface GeoAllResponse {
  data: GeoJob[];
  total: number;
}

export interface GeoStatsItem {
  location: string;
  lat: number;
  lng: number;
  count: number;
}

export interface GeoStatsResponse {
  data: GeoStatsItem[];
  total: number;
}
