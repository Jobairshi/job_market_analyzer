import { Controller, Get, Query, Logger } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { AnalyticsFilterDto } from './dto/analytics.dto';

@Controller('analytics')
export class AnalyticsController {
  private readonly logger = new Logger(AnalyticsController.name);

  constructor(private readonly analyticsService: AnalyticsService) {}

  /** GET /api/analytics/summary — KPI summary cards */
  @Get('summary')
  getSummary(@Query() filters: AnalyticsFilterDto) {
    this.logger.log('GET /analytics/summary');
    return this.analyticsService.getSummary(filters);
  }

  /** GET /api/analytics/skills-trend — Top 15 skills by frequency */
  @Get('skills-trend')
  getSkillsTrend(@Query() filters: AnalyticsFilterDto) {
    this.logger.log('GET /analytics/skills-trend');
    return this.analyticsService.getSkillsTrend(filters);
  }

  /** GET /api/analytics/company-demand — Top 10 hiring companies */
  @Get('company-demand')
  getCompanyDemand(@Query() filters: AnalyticsFilterDto) {
    this.logger.log('GET /analytics/company-demand');
    return this.analyticsService.getCompanyDemand(filters);
  }

  /** GET /api/analytics/location-distribution — Job count by location */
  @Get('location-distribution')
  getLocationDistribution(@Query() filters: AnalyticsFilterDto) {
    this.logger.log('GET /analytics/location-distribution');
    return this.analyticsService.getLocationDistribution(filters);
  }

  /** GET /api/analytics/jobs-over-time — Daily job counts for line chart */
  @Get('jobs-over-time')
  getJobsOverTime(@Query() filters: AnalyticsFilterDto) {
    this.logger.log('GET /analytics/jobs-over-time');
    return this.analyticsService.getJobsOverTime(filters);
  }

  /** GET /api/analytics/skill-clusters — Force-directed skill co-occurrence graph */
  @Get('skill-clusters')
  getSkillClusters(@Query() filters: AnalyticsFilterDto) {
    this.logger.log('GET /analytics/skill-clusters');
    return this.analyticsService.getSkillClusters(filters);
  }
}
