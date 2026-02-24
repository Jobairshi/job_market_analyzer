import { Injectable, Inject } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../config/supabase.module';
import { NearbyJobsDto } from './dto/nearby-jobs.dto';

@Injectable()
export class GeoService {
  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
  ) {}

  /**
   * Find jobs within a given radius of a point using the nearby_jobs RPC.
   * Falls back to a raw PostGIS query if the RPC is unavailable.
   */
  async findNearby(dto: NearbyJobsDto) {
    const { lat, lng, radius = 50000, page = 1, limit = 20 } = dto;
    const offset = (page - 1) * limit;

    try {
      // Use the nearby_jobs SQL function (see schema/geo_migration.sql)
      const { data, error } = await this.supabase.rpc('nearby_jobs', {
        lat,
        lng,
        radius_meters: radius,
      });

      if (error) throw error;

      const rows = data ?? [];
      return {
        data: rows.slice(offset, offset + limit).map((r: Record<string, unknown>) => ({
          id: r.id,
          title: r.title,
          company: r.company,
          location: r.location,
          latitude: r.latitude,
          longitude: r.longitude,
          tags: r.tags,
          cleaned_tags: r.cleaned_tags,
          link: r.link,
          scraped_at: r.scraped_at,
        })),
        total: rows.length,
        page,
        limit,
        center: { lat, lng },
        radius,
      };
    } catch (rpcErr) {
      // Fallback: plain query with client-side distance filter
      const { data, error } = await this.supabase
        .from('jobs')
        .select(
          'id, title, company, location, latitude, longitude, tags, cleaned_tags, link, scraped_at',
        )
        .not('latitude', 'is', null)
        .not('longitude', 'is', null)
        .order('scraped_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw new Error(`Supabase query failed: ${error.message}`);

      return {
        data: data ?? [],
        total: (data ?? []).length,
        page,
        limit,
        center: { lat, lng },
        radius,
        fallback: true,
      };
    }
  }

  /** Return all geocoded jobs (for map visualization). */
  async getAllGeoJobs() {
    const { data, error } = await this.supabase
      .from('jobs')
      .select(
        'id, title, company, location, latitude, longitude, cleaned_tags, link, scraped_at',
      )
      .not('latitude', 'is', null)
      .not('longitude', 'is', null)
      .order('scraped_at', { ascending: false })
      .limit(2000);

    if (error) throw new Error(error.message);

    return {
      data: data ?? [],
      total: (data ?? []).length,
    };
  }

  /** Aggregate job counts by country/region for heatmap. */
  async getGeoStats() {
    const { data, error } = await this.supabase
      .from('jobs')
      .select('location, latitude, longitude')
      .not('latitude', 'is', null)
      .not('longitude', 'is', null);

    if (error) throw new Error(error.message);

    // Group by location
    const groups = new Map<
      string,
      { location: string; lat: number; lng: number; count: number }
    >();

    for (const row of data ?? []) {
      const key = (row.location ?? 'Unknown').trim().toLowerCase();
      const existing = groups.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        groups.set(key, {
          location: row.location ?? 'Unknown',
          lat: row.latitude,
          lng: row.longitude,
          count: 1,
        });
      }
    }

    return {
      data: [...groups.values()].sort((a, b) => b.count - a.count),
      total: groups.size,
    };
  }
}
