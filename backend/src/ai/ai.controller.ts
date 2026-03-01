import {
  Controller,
  Post,
  Get,
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
import {
  AIQueryDto,
  RecommendDto,
  SkillGapDto,
  SkillGapMarketDto,
  SalaryPredictDto,
} from './dto/ai.dto';

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

  /* ── NEW: Market-based Skill Gap ────────────────── */

  /**
   * POST /api/ai/skill-gap-market
   * Enhanced skill gap vs. current market demand.
   */
  @Post('skill-gap-market')
  async skillGapMarket(@Body() body: SkillGapMarketDto) {
    try {
      return await this.aiService.analyzeSkillGapMarket(body.resume_text);
    } catch (error: any) {
      this.logger.error(`Market skill gap failed: ${error.message}`);
      throw error instanceof HttpException
        ? error
        : new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /* ── NEW: Salary Prediction ─────────────────────── */

  /**
   * POST /api/ai/predict-salary
   * ML-based salary prediction.
   */
  @Post('predict-salary')
  async predictSalary(@Body() body: SalaryPredictDto) {
    try {
      return await this.aiService.predictSalary({
        skills: body.skills,
        location: body.location,
        experience: body.experience,
        title: body.title,
      });
    } catch (error: any) {
      this.logger.error(`Salary prediction failed: ${error.message}`);
      throw error instanceof HttpException
        ? error
        : new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * POST /api/ai/train-salary-model
   * Retrain the salary model.
   */
  @Post('train-salary-model')
  async trainSalaryModel() {
    try {
      return await this.aiService.trainSalaryModel();
    } catch (error: any) {
      this.logger.error(`Salary model training failed: ${error.message}`);
      throw error instanceof HttpException
        ? error
        : new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /* ── NEW: Market Insights ───────────────────────── */

  /**
   * GET /api/ai/insights
   * Latest market insights.
   */
  @Get('insights')
  async getInsights(@Query('limit') limit?: string) {
    try {
      const n = Math.min(Math.max(parseInt(limit || '10', 10) || 10, 1), 50);
      return await this.aiService.getInsights(n);
    } catch (error: any) {
      this.logger.error(`Get insights failed: ${error.message}`);
      throw error instanceof HttpException
        ? error
        : new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * GET /api/ai/insights/trends
   * Real-time 24h vs 7d trend data.
   */
  @Get('insights/trends')
  async getTrends() {
    try {
      return await this.aiService.getTrends();
    } catch (error: any) {
      this.logger.error(`Get trends failed: ${error.message}`);
      throw error instanceof HttpException
        ? error
        : new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * POST /api/ai/insights/generate
   * Manually trigger insight generation.
   */
  @Post('insights/generate')
  async generateInsights() {
    try {
      return await this.aiService.generateInsights();
    } catch (error: any) {
      this.logger.error(`Generate insights failed: ${error.message}`);
      throw error instanceof HttpException
        ? error
        : new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /* ── NEW: Skill Heatmap ─────────────────────────── */

  /**
   * GET /api/ai/skill-heatmap
   * Geo coordinates for jobs matching a skill.
   */
  @Get('skill-heatmap')
  async skillHeatmap(@Query('skill') skill?: string) {
    if (!skill) {
      throw new HttpException('Query parameter "skill" is required.', HttpStatus.BAD_REQUEST);
    }
    try {
      return await this.aiService.getSkillHeatmap(skill);
    } catch (error: any) {
      this.logger.error(`Skill heatmap failed: ${error.message}`);
      throw error instanceof HttpException
        ? error
        : new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
