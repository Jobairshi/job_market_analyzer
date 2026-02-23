import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AIService {
  private readonly logger = new Logger(AIService.name);
  private readonly aiEngineUrl: string;

  constructor(private readonly config: ConfigService) {
    this.aiEngineUrl =
      this.config.get<string>('AI_ENGINE_URL') || 'http://localhost:8000';
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

  /* ── Public methods ─────────────────────────────────── */

  async queryIntelligence(query: string) {
    return this.postJson('/ai/query', { query });
  }

  async getRecommendations(body: {
    resume_text?: string;
    preferred_skills?: string[];
    preferred_location?: string;
    top_k?: number;
  }) {
    return this.postJson('/ai/recommend', body);
  }

  async resumeMatchWithExplanation(file: Express.Multer.File, topK: number, explain: boolean) {
    return this.postFile('/ai/resume-match', file, {
      top_k: String(topK),
      explain: String(explain),
    });
  }

  async analyzeSkillGap(resumeText: string, jobDescription: string) {
    return this.postJson('/ai/skill-gap', {
      resume_text: resumeText,
      job_description: jobDescription,
    });
  }
}
