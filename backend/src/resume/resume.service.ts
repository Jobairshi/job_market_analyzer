import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** Shape returned by Python AI Engine. */
interface MatchedJob {
  id: string;
  title: string;
  company: string;
  location: string;
  link: string;
  cleaned_tags: string[];
  similarity: number;
  skill_overlap: number;
  final_score: number;
  matched_skills: string[];
}

export interface PythonResponse {
  matches: MatchedJob[];
  total: number;
  resume_filename: string;
}

@Injectable()
export class ResumeService {
  private readonly logger = new Logger(ResumeService.name);
  private readonly aiEngineUrl: string;

  constructor(private readonly config: ConfigService) {
    this.aiEngineUrl =
      this.config.get<string>('AI_ENGINE_URL') || 'http://localhost:8000';
  }

  /**
   * Forward the uploaded file to the Python AI Engine's /resume/match endpoint.
   */
  async matchResume(
    file: Express.Multer.File,
    topK: number,
  ): Promise<PythonResponse> {
    const url = `${this.aiEngineUrl}/resume/match?top_k=${topK}`;
    this.logger.log(`Forwarding resume to AI Engine: ${url}`);

    // Use Node 18+ native FormData + Blob so native fetch handles the
    // multipart boundary correctly (the npm "form-data" package is
    // stream-based and incompatible with native fetch).
    const blob = new Blob([new Uint8Array(file.buffer)], { type: file.mimetype });
    const form = new FormData();
    form.append('file', blob, file.originalname);

    try {
      const response = await fetch(url, {
        method: 'POST',
        body: form,
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        const detail =
          (body as any).detail || `AI Engine returned ${response.status}`;
        this.logger.error(`AI Engine error: ${detail}`);
        throw new HttpException(detail, response.status);
      }

      const data = (await response.json()) as PythonResponse;
      this.logger.log(`Received ${data.total} matches from AI Engine.`);
      return data;
    } catch (error: any) {
      if (error instanceof HttpException) throw error;

      this.logger.error(`Failed to reach AI Engine: ${error.message}`);
      throw new HttpException(
        'AI Engine is not reachable. Make sure it is running on port 8000.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }
}
