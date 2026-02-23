import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ResumeController } from './resume.controller';
import { ResumeService } from './resume.service';

@Module({
  imports: [ConfigModule],
  controllers: [ResumeController],
  providers: [ResumeService],
})
export class ResumeModule {}
