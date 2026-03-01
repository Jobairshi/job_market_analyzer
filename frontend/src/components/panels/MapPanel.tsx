'use client';

/**
 * Map panel — geo job intelligence (from /map page).
 * Full-height interactive map with controls.
 */

import { useState, useCallback } from 'react';
import useSWR from 'swr';
import JobMap from '@/components/JobMap';
import GeoControls from '@/components/GeoControls';
import { api } from '@/lib/api';
import type { GeoJob, SkillHeatmapPoint } from '@/lib/api';

const fetchAllGeo = async (): Promise<GeoJob[]> => {
  const res = await api.geoAll();
  return res.data;
};

export default function MapPanel() {
  const { data: jobs = [], isLoading } = useSWR('geo-all', fetchAllGeo, {
    refreshInterval: 60_000,
    revalidateOnFocus: false,
    dedupingInterval: 30_000,
  });

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

  const applyLocation = useCallback(async (lat: number, lng: number) => {
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
  }, [radius, jobs]);

  const locateViaIP = useCallback(async () => {
    try {
      const res = await fetch('/api/geoip');
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error === 'localhost_loopback'
          ? 'Running locally — click anywhere on the map to set your location.'
          : 'Could not detect location — click anywhere on the map.');
        setClickMode(true); setLocating(false);
        return true;
      }
      if (data.latitude && data.longitude) { await applyLocation(data.latitude, data.longitude); return true; }
    } catch { /* ignore */ }
    return false;
  }, [applyLocation]);

  const handleFindNearMe = useCallback(() => {
    setLocating(true); setError(null);
    if (!navigator.geolocation) {
      locateViaIP().then((ok) => { if (!ok) { setError('Could not detect location.'); setClickMode(true); setLocating(false); } });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => { await applyLocation(pos.coords.latitude, pos.coords.longitude); },
      async () => { const ok = await locateViaIP(); if (!ok) { setError('Click the map to set location.'); setClickMode(true); setLocating(false); } },
      { enableHighAccuracy: false, timeout: 8_000, maximumAge: 60_000 },
    );
  }, [applyLocation, locateViaIP]);

  const handleReset = useCallback(() => {
    setUserLocation(null); setNearbyIds(new Set()); setError(null); setClickMode(false); setSkillHeatmap([]);
  }, []);

  const handleSkillFilter = useCallback(async (skill: string) => {
    setSkillFilterLoading(true);
    try { setSkillHeatmap(await api.getSkillHeatmap(skill)); setShowHeatmap(true); }
    catch { setSkillHeatmap([]); }
    finally { setSkillFilterLoading(false); }
  }, []);

  const handleMapClick = useCallback(async (lat: number, lng: number) => {
    if (!clickMode) return;
    setError(null); setClickMode(false); setLocating(true);
    await applyLocation(lat, lng);
  }, [clickMode, applyLocation]);

  return (
    <div className="relative h-full w-full">
      <GeoControls
        showClusters={showClusters} setShowClusters={setShowClusters}
        showHeatmap={showHeatmap} setShowHeatmap={setShowHeatmap}
        radius={radius} setRadius={setRadius}
        onFindNearMe={handleFindNearMe} onReset={handleReset}
        locating={locating} jobCount={jobs.length} nearbyCount={nearbyIds.size}
        onSkillFilter={handleSkillFilter} skillFilterLoading={skillFilterLoading}
        skillHeatmapCount={skillHeatmap.length}
      />

      {error && (
        <div className="absolute right-4 top-4 z-[1000] max-w-sm rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-700 shadow">
          {error}
        </div>
      )}
      {clickMode && !error && (
        <div className="absolute right-4 top-4 z-[1000] max-w-sm rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm text-indigo-700 shadow">
          Click on the map to set your location
        </div>
      )}

      {isLoading && (
        <div className="absolute inset-0 z-[900] flex items-center justify-center bg-white/60 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3">
            <svg className="h-10 w-10 animate-spin text-indigo-500" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
            <p className="text-sm text-gray-500">Loading geo data...</p>
          </div>
        </div>
      )}

      <JobMap
        jobs={jobs} showClusters={showClusters} showHeatmap={showHeatmap}
        userLocation={userLocation} radiusMeters={radius} nearbyJobIds={nearbyIds}
        onMapClick={handleMapClick} skillHeatmapPoints={skillHeatmap}
      />
    </div>
  );
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
