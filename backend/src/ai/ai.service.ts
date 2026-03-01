import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '../common/cache.service';
import * as crypto from 'crypto';

@Injectable()
export class AIService {
  private readonly logger = new Logger(AIService.name);
  private readonly aiEngineUrl: string;

  constructor(
    private readonly config: ConfigService,
    private readonly cache: CacheService,
  ) {
    this.aiEngineUrl =
      this.config.get<string>('AI_ENGINE_URL') || 'http://localhost:8000';
  }

  /** Hash helper for cache keys */
  private hash(input: string): string {
    return crypto.createHash('sha256').update(input).digest('hex').slice(0, 16);
  }

  /** POST JSON to AI Engine and return parsed response. */
  private async postJson<T>(path: string, body: Record<string, any>): Promise<T> {
    const url = `${this.aiEngineUrl}${path}`;
    this.logger.log(`→ AI Engine: POST ${url}`);

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const detail = (err as any).detail || `AI Engine returned ${res.status}`;
        throw new HttpException(detail, res.status);
      }

      return (await res.json()) as T;
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      this.logger.error(`AI Engine unreachable: ${error.message}`);
      throw new HttpException(
        'AI Engine is not reachable.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  /** GET from AI Engine */
  private async getJson<T>(path: string): Promise<T> {
    const url = `${this.aiEngineUrl}${path}`;
    this.logger.log(`→ AI Engine: GET ${url}`);

    try {
      const res = await fetch(url);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new HttpException((err as any).detail || `AI Engine returned ${res.status}`, res.status);
      }
      return (await res.json()) as T;
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      this.logger.error(`AI Engine unreachable: ${error.message}`);
      throw new HttpException('AI Engine is not reachable.', HttpStatus.SERVICE_UNAVAILABLE);
    }
  }

  /** POST multipart file to AI Engine. */
  private async postFile<T>(path: string, file: Express.Multer.File, params: Record<string, string> = {}): Promise<T> {
    const qs = new URLSearchParams(params).toString();
    const url = `${this.aiEngineUrl}${path}${qs ? '?' + qs : ''}`;
    this.logger.log(`→ AI Engine: POST ${url} (file: ${file.originalname})`);

    const blob = new Blob([new Uint8Array(file.buffer)], { type: file.mimetype });
    const form = new FormData();
    form.append('file', blob, file.originalname);

    try {
      const res = await fetch(url, { method: 'POST', body: form });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new HttpException((err as any).detail || `AI Engine returned ${res.status}`, res.status);
      }

      return (await res.json()) as T;
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      this.logger.error(`AI Engine unreachable: ${error.message}`);
      throw new HttpException('AI Engine is not reachable.', HttpStatus.SERVICE_UNAVAILABLE);
    }
  }

  /* ── Existing methods ──────────────────────────────── */

  async queryIntelligence(query: string) {
    const key = `ai:query:${this.hash(query)}`;
    const cached = await this.cache.get(key);
    if (cached) return cached;

    const result = await this.postJson('/ai/query', { query });
    await this.cache.set(key, result, 3600); // 1 hour
    return result;
  }

  async getRecommendations(body: {
    resume_text?: string;
    preferred_skills?: string[];
    preferred_location?: string;
    top_k?: number;
  }) {
    const key = `ai:recommend:${this.hash(JSON.stringify(body))}`;
    const cached = await this.cache.get(key);
    if (cached) return cached;

    const result = await this.postJson('/ai/recommend', body);
    await this.cache.set(key, result, 3600);
    return result;
  }

  async resumeMatchWithExplanation(file: Express.Multer.File, topK: number, explain: boolean) {
    return this.postFile('/ai/resume-match', file, {
      top_k: String(topK),
      explain: String(explain),
    });
  }

  async analyzeSkillGap(resumeText: string, jobDescription: string) {
    const key = `skillgap:${this.hash(resumeText + jobDescription)}`;
    const cached = await this.cache.get(key);
    if (cached) return cached;

    const result = await this.postJson('/ai/skill-gap', {
      resume_text: resumeText,
      job_description: jobDescription,
    });
    await this.cache.set(key, result, 3600);
    return result;
  }

  /* ── NEW: Enhanced Skill Gap (market-based) ─────── */

  async analyzeSkillGapMarket(resumeText: string) {
    const key = `skillgap:market:${this.hash(resumeText)}`;
    const cached = await this.cache.get(key);
    if (cached) return cached;

    const result = await this.postJson('/ai/skill-gap-market', {
      resume_text: resumeText,
    });
    await this.cache.set(key, result, 3600);
    return result;
  }

  /* ── NEW: Salary Prediction ────────────────────── */

  async predictSalary(body: {
    skills: string[];
    location?: string;
    experience?: string;
    title?: string;
  }) {
    const key = `salary:${this.hash(JSON.stringify(body))}`;
    const cached = await this.cache.get(key);
    if (cached) return cached;

    const result = await this.postJson('/ai/predict-salary', body);
    await this.cache.set(key, result, 21600); // 6 hours
    return result;
  }

  async trainSalaryModel() {
    return this.postJson('/ai/train-salary-model', {});
  }

  /* ── NEW: Market Insights ──────────────────────── */

  async getInsights(limit: number = 10) {
    const key = `insights:latest:${limit}`;
    const cached = await this.cache.get(key);
    if (cached) return cached;

    const result = await this.getJson(`/ai/insights?limit=${limit}`);
    await this.cache.set(key, result, 300); // 5 min
    return result;
  }

  async getTrends() {
    const key = 'insights:trends';
    const cached = await this.cache.get(key);
    if (cached) return cached;

    const result = await this.getJson('/ai/insights/trends');
    await this.cache.set(key, result, 600); // 10 min
    return result;
  }

  async generateInsights() {
    await this.cache.del('insights:trends');
    await this.cache.delPattern('insights:latest:*');
    return this.postJson('/ai/insights/generate', {});
  }

  /* ── NEW: Skill Heatmap ────────────────────────── */

  async getSkillHeatmap(skill: string) {
    const key = `heatmap:${skill.toLowerCase()}`;
    const cached = await this.cache.get(key);
    if (cached) return cached;

    const result = await this.getJson(`/ai/skill-heatmap?skill=${encodeURIComponent(skill)}`);
    await this.cache.set(key, result, 600); // 10 min
    return result;
  }
}
