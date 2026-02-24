import { Controller, Get, Query } from '@nestjs/common';
import { GeoService } from './geo.service';
import { NearbyJobsDto } from './dto/nearby-jobs.dto';

@Controller('geo')
export class GeoController {
  constructor(private readonly geoService: GeoService) {}

  /**
   * GET /api/geo/nearby?lat=40.71&lng=-74.00&radius=50000&page=1&limit=20
   * Find jobs within a radius of a given point.
   */
  @Get('nearby')
  findNearby(@Query() dto: NearbyJobsDto) {
    return this.geoService.findNearby(dto);
  }

  /**
   * GET /api/geo/all
   * Return all geocoded jobs (for map rendering).
   */
  @Get('all')
  getAllGeoJobs() {
    return this.geoService.getAllGeoJobs();
  }

  /**
   * GET /api/geo/stats
   * Aggregated geo stats for heatmap / clustering.
   */
  @Get('stats')
  getGeoStats() {
    return this.geoService.getGeoStats();
  }
}
