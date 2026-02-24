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
import type { GeoJob } from '@/lib/api';

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

  /* ── "Find Near Me" handler ───────────────────────────────────── */
  const handleFindNearMe = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.');
      return;
    }

    setLocating(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        setUserLocation({ lat, lng });

        try {
          const res = await api.geoNearby(lat, lng, radius, 1, 100);
          setNearbyIds(new Set(res.data.map((j) => j.id)));
        } catch (err) {
          console.error('Nearby search failed:', err);
          // Fallback: client-side distance filtering
          const nearSet = new Set<string>();
          for (const j of jobs) {
            const dist = haversine(lat, lng, j.latitude, j.longitude);
            if (dist <= radius) nearSet.add(j.id);
          }
          setNearbyIds(nearSet);
        }

        setLocating(false);
      },
      (err) => {
        setError('Geolocation failed — click anywhere on the map to set your location instead.');
        setClickMode(true);
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }, [radius, jobs]);

  /* ── Reset ────────────────────────────────────────────────────── */
  const handleReset = useCallback(() => {
    setUserLocation(null);
    setNearbyIds(new Set());
    setError(null);
    setClickMode(false);
  }, []);

  /* ── Map click handler (fallback for geolocation) ──────────────── */
  const handleMapClick = useCallback(
    async (lat: number, lng: number) => {
      if (!clickMode) return; // only pick when in click mode
      setUserLocation({ lat, lng });
      setError(null);
      setClickMode(false);

      try {
        const res = await api.geoNearby(lat, lng, radius, 1, 100);
        setNearbyIds(new Set(res.data.map((j) => j.id)));
      } catch {
        const nearSet = new Set<string>();
        for (const j of jobs) {
          const dist = haversine(lat, lng, j.latitude, j.longitude);
          if (dist <= radius) nearSet.add(j.id);
        }
        setNearbyIds(nearSet);
      }
    },
    [clickMode, radius, jobs],
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
