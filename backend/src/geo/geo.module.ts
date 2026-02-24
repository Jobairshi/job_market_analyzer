import { Module } from '@nestjs/common';
import { SupabaseModule } from '../config/supabase.module';
import { GeoController } from './geo.controller';
import { GeoService } from './geo.service';

@Module({
  imports: [SupabaseModule],
  controllers: [GeoController],
  providers: [GeoService],
})
export class GeoModule {}
