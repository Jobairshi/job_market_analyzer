import {
  Controller,
  Post,
  Body,
  UseInterceptors,
  UploadedFile,
  Query,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AIService } from './ai.service';
import { AIQueryDto, RecommendDto, SkillGapDto } from './dto/ai.dto';

@Controller('ai')
export class AIController {
  private readonly logger = new Logger(AIController.name);

  constructor(private readonly aiService: AIService) {}

  /**
   * POST /api/ai/query
   * RAG-based job market intelligence.
   */
  @Post('query')
  async query(@Body() body: AIQueryDto) {
    try {
      return await this.aiService.queryIntelligence(body.query);
    } catch (error: any) {
      this.logger.error(`AI query failed: ${error.message}`);
      throw error instanceof HttpException
        ? error
        : new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * POST /api/ai/recommend
   * Personalized job recommendations.
   */
  @Post('recommend')
  async recommend(@Body() body: RecommendDto) {
    try {
      return await this.aiService.getRecommendations({
        resume_text: body.resume_text,
        preferred_skills: body.preferred_skills,
        preferred_location: body.preferred_location,
        top_k: body.top_k ?? 10,
      });
    } catch (error: any) {
      this.logger.error(`Recommendation failed: ${error.message}`);
      throw error instanceof HttpException
        ? error
        : new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * POST /api/ai/resume-match
   * Resume match with AI explanation.
   */
  @Post('resume-match')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        if (
          file.mimetype === 'application/pdf' ||
          file.originalname?.toLowerCase().endsWith('.pdf')
        ) {
          cb(null, true);
        } else {
          cb(new HttpException('Only PDF files are accepted.', HttpStatus.BAD_REQUEST), false);
        }
      },
    }),
  )
  async resumeMatch(
    @UploadedFile() file: Express.Multer.File,
    @Query('top_k') topK?: string,
    @Query('explain') explain?: string,
  ) {
    if (!file) {
      throw new HttpException('No file uploaded.', HttpStatus.BAD_REQUEST);
    }
    try {
      const k = Math.min(Math.max(parseInt(topK || '5', 10) || 5, 1), 20);
      const doExplain = explain !== 'false';
      return await this.aiService.resumeMatchWithExplanation(file, k, doExplain);
    } catch (error: any) {
      this.logger.error(`AI resume match failed: ${error.message}`);
      throw error instanceof HttpException
        ? error
        : new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * POST /api/ai/skill-gap
   * Skill gap analysis.
   */
  @Post('skill-gap')
  async skillGap(@Body() body: SkillGapDto) {
    try {
      return await this.aiService.analyzeSkillGap(body.resume_text, body.job_description);
    } catch (error: any) {
      this.logger.error(`Skill gap analysis failed: ${error.message}`);
      throw error instanceof HttpException
        ? error
        : new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
