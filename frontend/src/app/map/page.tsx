'use client';

/**
 * /map — Geo Job Intelligence page.
 *
 * Features:
 *  - Interactive map with marker clustering
 *  - "Jobs Near Me" geolocation
 *  - Job density heatmap toggle
 *  - Auto-refresh every 60s via SWR
 */

import { useState, useCallback } from 'react';
import useSWR from 'swr';
import JobMap from '@/components/JobMap';
import GeoControls from '@/components/GeoControls';
import { api } from '@/lib/api';
import type { GeoJob, SkillHeatmapPoint } from '@/lib/api';

/* ── Data fetcher ──────────────────────────────────────────────── */

const fetchAllGeo = async (): Promise<GeoJob[]> => {
  const res = await api.geoAll();
  return res.data;
};

export default function MapPage() {
  /* ── SWR: auto-refresh every 60s ──────────────────────────────── */
  const { data: jobs = [], isLoading } = useSWR('geo-all', fetchAllGeo, {
    refreshInterval: 60_000,
    revalidateOnFocus: false,
    dedupingInterval: 30_000,
  });

  /* ── Local state ──────────────────────────────────────────────── */
  const [showClusters, setShowClusters] = useState(true);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [radius, setRadius] = useState(50_000);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [nearbyIds, setNearbyIds] = useState<Set<string>>(new Set());
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clickMode, setClickMode] = useState(false);
  const [skillHeatmap, setSkillHeatmap] = useState<SkillHeatmapPoint[]>([]);
  const [skillFilterLoading, setSkillFilterLoading] = useState(false);

  /* ── Helper: apply lat/lng once we have it ───────────────────── */
  const applyLocation = useCallback(
    async (lat: number, lng: number) => {
      setUserLocation({ lat, lng });
      try {
        const res = await api.geoNearby(lat, lng, radius, 1, 100);
        setNearbyIds(new Set(res.data.map((j) => j.id)));
      } catch {
        const nearSet = new Set<string>();
        for (const j of jobs) {
          if (haversine(lat, lng, j.latitude, j.longitude) <= radius) nearSet.add(j.id);
        }
        setNearbyIds(nearSet);
      }
      setLocating(false);
    },
    [radius, jobs],
  );

  /* ── IP-based fallback — proxied via local API route to avoid CORS */
  const locateViaIP = useCallback(async () => {
    try {
      const res = await fetch('/api/geoip');
      const data = await res.json();
      // 422 with localhost_loopback = dev environment, can't geolocate loopback IP
      if (!res.ok) {
        const isLocalhost = data?.error === 'localhost_loopback';
        setError(
          isLocalhost
            ? 'Running locally — click anywhere on the map to set your location.'
            : 'Could not detect location — click anywhere on the map to set it manually.',
        );
        setClickMode(true);
        setLocating(false);
        return true; // handled (don't double-set error)
      }
      if (data.latitude && data.longitude) {
        await applyLocation(data.latitude, data.longitude);
        return true;
      }
    } catch {/* ignore */}
    return false;
  }, [applyLocation]);

  /* ── "Find Near Me" handler ───────────────────────────────────── */
  const handleFindNearMe = useCallback(() => {
    setLocating(true);
    setError(null);

    // If no geolocation API, go straight to IP fallback
    if (!navigator.geolocation) {
      locateViaIP().then((ok) => {
        if (!ok) { setError('Could not detect location — click the map to set it manually.'); setClickMode(true); setLocating(false); }
      });
      return;
    }

    // Try network-based location first (no GPS = works on Mac desktops)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        await applyLocation(pos.coords.latitude, pos.coords.longitude);
      },
      async () => {
        // Browser geolocation failed (e.g. macOS CoreLocation) — try IP
        const ok = await locateViaIP();
        if (!ok) {
          setError('Could not detect location — click anywhere on the map to set it manually.');
          setClickMode(true);
          setLocating(false);
        }
      },
      { enableHighAccuracy: false, timeout: 8_000, maximumAge: 60_000 },
    );
  }, [applyLocation, locateViaIP]);

  /* ── Reset ────────────────────────────────────────────────────── */
  const handleReset = useCallback(() => {
    setUserLocation(null);
    setNearbyIds(new Set());
    setError(null);
    setClickMode(false);
    setSkillHeatmap([]);
  }, []);

  /* ── Skill heatmap filter ────────────────────────────────────── */
  const handleSkillFilter = useCallback(async (skill: string) => {
    setSkillFilterLoading(true);
    try {
      const data = await api.getSkillHeatmap(skill);
      setSkillHeatmap(data);
      // Auto-enable heatmap when skill filter is used
      setShowHeatmap(true);
    } catch {
      setSkillHeatmap([]);
    } finally {
      setSkillFilterLoading(false);
    }
  }, []);

  /* ── Map click handler (fallback for geolocation) ──────────────── */
  const handleMapClick = useCallback(
    async (lat: number, lng: number) => {
      if (!clickMode) return;
      setError(null);
      setClickMode(false);
      setLocating(true);
      await applyLocation(lat, lng);
    },
    [clickMode, applyLocation],
  );

  return (
    <div className="relative h-[calc(100vh-4rem)] w-full">
      {/* Controls overlay */}
      <GeoControls
        showClusters={showClusters}
        setShowClusters={setShowClusters}
        showHeatmap={showHeatmap}
        setShowHeatmap={setShowHeatmap}
        radius={radius}
        setRadius={setRadius}
        onFindNearMe={handleFindNearMe}
        onReset={handleReset}
        locating={locating}
        jobCount={jobs.length}
        nearbyCount={nearbyIds.size}
        onSkillFilter={handleSkillFilter}
        skillFilterLoading={skillFilterLoading}
        skillHeatmapCount={skillHeatmap.length}
      />

      {/* Error / click-mode banner */}
      {error && (
        <div className="absolute right-4 top-4 z-[1000] max-w-sm rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-700 shadow">
          {error}
        </div>
      )}
      {clickMode && !error && (
        <div className="absolute right-4 top-4 z-[1000] max-w-sm rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm text-indigo-700 shadow">
          📍 Click anywhere on the map to set your location
        </div>
      )}

      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 z-[900] flex items-center justify-center bg-white/60 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3">
            <svg className="h-10 w-10 animate-spin text-indigo-500" viewBox="0 0 24 24" fill="none">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
              />
            </svg>
            <p className="text-sm text-gray-500">Loading geo data…</p>
          </div>
        </div>
      )}

      {/* Map */}
      <JobMap
        jobs={jobs}
        showClusters={showClusters}
        showHeatmap={showHeatmap}
        userLocation={userLocation}
        radiusMeters={radius}
        nearbyJobIds={nearbyIds}
        onMapClick={handleMapClick}
        skillHeatmapPoints={skillHeatmap}
      />
    </div>
  );
}

/* ── Haversine distance (meters) — client-side fallback ────────── */

function haversine(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6_371_000; // Earth radius in meters
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
