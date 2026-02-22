import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { JobsService } from './jobs.service';
import { FilterJobsDto } from './dto/filter-jobs.dto';

@Controller('jobs')
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  /**
   * GET /api/jobs?source=...&search=...&skill=...&page=1&limit=20
   * Requires authentication. Both admin and user can access.
   */
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.Admin, Role.User)
  @Get()
  findAll(@Query() filters: FilterJobsDto) {
    return this.jobsService.findAll(filters);
  }

  /** GET /api/jobs/sources — list of unique sources */
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.Admin, Role.User)
  @Get('sources')
  getSources() {
    return this.jobsService.getSources();
  }

  /** GET /api/jobs/skills — top skills for filter dropdown */
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.Admin, Role.User)
  @Get('skills')
  getTopSkills() {
    return this.jobsService.getTopSkills();
  }
}
