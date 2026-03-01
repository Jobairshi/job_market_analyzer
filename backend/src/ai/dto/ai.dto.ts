import { IsString, IsOptional, IsArray, IsInt, Min, Max, MinLength, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

export class AIQueryDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  query!: string;
}

export class RecommendDto {
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  resume_text?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  preferred_skills?: string[];

  @IsOptional()
  @IsString()
  preferred_location?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  @Type(() => Number)
  top_k?: number;
}

export class SkillGapDto {
  @IsString()
  @MinLength(10)
  @MaxLength(10000)
  resume_text!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(10000)
  job_description!: string;
}

export class SkillGapMarketDto {
  @IsString()
  @MinLength(10)
  @MaxLength(10000)
  resume_text!: string;
}

export class SalaryPredictDto {
  @IsArray()
  @IsString({ each: true })
  skills!: string[];

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  experience?: string;

  @IsOptional()
  @IsString()
  title?: string;
}
