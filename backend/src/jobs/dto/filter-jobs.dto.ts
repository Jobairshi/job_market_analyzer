import { IsOptional, IsString, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class FilterJobsDto {
  /** Filter by source platform (e.g. "remoteok", "weworkremotely") */
  @IsOptional()
  @IsString()
  source?: string;

  /** Free-text search across title, company, location */
  @IsOptional()
  @IsString()
  search?: string;

  /** Filter by a specific company name */
  @IsOptional()
  @IsString()
  company?: string;

  /** Filter by location */
  @IsOptional()
  @IsString()
  location?: string;

  /** Filter by a single skill in cleaned_tags */
  @IsOptional()
  @IsString()
  skill?: string;

  /** Page number (1-based) */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  /** Items per page */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
