import {
  IsNumber,
  IsOptional,
  Min,
  Max,
  IsInt,
} from 'class-validator';
import { Type } from 'class-transformer';

export class NearbyJobsDto {
  /** Latitude of the search center (-90 to 90) */
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat!: number;

  /** Longitude of the search center (-180 to 180) */
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng!: number;

  /** Search radius in meters (default: 50 000 = 50 km) */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1000)
  @Max(500000)
  radius?: number = 50000;

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
