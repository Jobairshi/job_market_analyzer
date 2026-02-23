import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  HttpException,
  HttpStatus,
  Logger,
  Query,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ResumeService } from './resume.service';

@Controller('resume')
export class ResumeController {
  private readonly logger = new Logger(ResumeController.name);

  constructor(private readonly resumeService: ResumeService) {}

  /**
   * POST /api/resume/upload
   *
   * Accepts a PDF file (multipart/form-data), forwards it to the
   * Python AI Engine for vector matching, and returns top job matches.
   */
  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
      fileFilter: (_req, file, cb) => {
        if (
          file.mimetype === 'application/pdf' ||
          file.originalname?.toLowerCase().endsWith('.pdf')
        ) {
          cb(null, true);
        } else {
          cb(
            new HttpException(
              'Only PDF files are accepted.',
              HttpStatus.BAD_REQUEST,
            ),
            false,
          );
        }
      },
    }),
  )
  async uploadResume(
    @UploadedFile() file: Express.Multer.File,
    @Query('top_k') topK?: string,
  ) {
    if (!file) {
      throw new HttpException(
        'No file uploaded. Please upload a PDF resume.',
        HttpStatus.BAD_REQUEST,
      );
    }

    this.logger.log(
      `Resume uploaded: ${file.originalname} (${file.size} bytes)`,
    );

    const k = topK ? parseInt(topK, 10) : 10;
    if (isNaN(k) || k < 1 || k > 50) {
      throw new HttpException(
        'top_k must be between 1 and 50.',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const result = await this.resumeService.matchResume(file, k);
      return result;
    } catch (error: any) {
      this.logger.error(`Resume matching failed: ${error.message}`);
      throw new HttpException(
        error.message || 'Resume matching failed.',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
