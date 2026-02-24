'use client';

/**
 * MapInner — Leaflet map with clustering, heatmap, and "Jobs Near Me".
 *
 * Uses react-leaflet v4 (React 18 compatible) + leaflet.markercluster.
 * Never import directly — use JobMap.tsx (dynamic, ssr: false).
 */

import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Circle,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import 'leaflet.markercluster';

import {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
  memo,
} from 'react';

import type { GeoJob } from '@/lib/api';

/* ── Fix default Leaflet icon (broken in Webpack/Next.js) ──────── */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const USER_ICON = new L.Icon({
  iconUrl:
    'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

/* ── Types ─────────────────────────────────────────────────────── */

export interface MapInnerProps {
  jobs: GeoJob[];
  showClusters: boolean;
  showHeatmap: boolean;
  userLocation: { lat: number; lng: number } | null;
  radiusMeters: number;
  nearbyJobIds: Set<string>;
  onMapClick?: (lat: number, lng: number) => void;
}

/* ── Heatmap canvas overlay ────────────────────────────────────── */

function HeatLayer({
  points,
}: {
  points: [number, number, number][];
}) {
  const map = useMap();

  useEffect(() => {
    if (!points.length) return;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const overlay = L.DomUtil.create('div', 'leaflet-heat-layer');
    overlay.style.position = 'absolute';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.pointerEvents = 'none';
    overlay.style.zIndex = '400';
    overlay.appendChild(canvas);

    const pane = map.getPane('overlayPane');
    if (pane) pane.appendChild(overlay);

    function draw() {
      const size = map.getSize();
      canvas.width = size.x;
      canvas.height = size.y;
      ctx!.clearRect(0, 0, size.x, size.y);

      const bounds = map.getBounds();
      const radius = Math.max(15, Math.min(40, 25 - (map.getZoom() - 5) * 2));

      for (const [lat, lng, intensity] of points) {
        if (!bounds.contains([lat, lng])) continue;
        const pt = map.latLngToContainerPoint([lat, lng]);

        const gradient = ctx!.createRadialGradient(
          pt.x, pt.y, 0,
          pt.x, pt.y, radius,
        );
        gradient.addColorStop(0, `rgba(255, 0, 0, ${0.4 * intensity})`);
        gradient.addColorStop(0.4, `rgba(255, 165, 0, ${0.2 * intensity})`);
        gradient.addColorStop(1, 'rgba(255, 255, 0, 0)');

        ctx!.fillStyle = gradient;
        ctx!.fillRect(pt.x - radius, pt.y - radius, radius * 2, radius * 2);
      }

      // Position overlay to match map pane origin
      const topLeft = map.containerPointToLayerPoint([0, 0]);
      L.DomUtil.setPosition(overlay, topLeft);
    }

    draw();
    map.on('moveend zoomend', draw);

    return () => {
      map.off('moveend zoomend', draw);
      overlay.remove();
    };
  }, [map, points]);

  return null;
}

/* ── Viewport tracker: only show markers in visible bounds ─────── */

function BoundsTracker({
  onBoundsChange,
}: {
  onBoundsChange: (b: L.LatLngBounds) => void;
}) {
  const map = useMapEvents({
    moveend: () => onBoundsChange(map.getBounds()),
    zoomend: () => onBoundsChange(map.getBounds()),
  });

  useEffect(() => {
    onBoundsChange(map.getBounds());
  }, [map, onBoundsChange]);

  return null;
}

/* ── Fly-to helper ─────────────────────────────────────────────── */
function FlyTo({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, zoom, { duration: 1.2 });
  }, [map, center, zoom]);
  return null;
}

/* ── Click handler for manual location picking ─────────────────── */

function ClickHandler({ onClick }: { onClick?: (lat: number, lng: number) => void }) {
  useMapEvents({
    click: (e) => {
      if (onClick) onClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

/* ── Imperative cluster layer using leaflet.markercluster ──────── */

function ClusterLayer({
  jobs,
  nearbyJobIds,
}: {
  jobs: GeoJob[];
  nearbyJobIds: Set<string>;
}) {
  const map = useMap();
  const clusterRef = useRef<L.MarkerClusterGroup | null>(null);

  useEffect(() => {
    const cluster = L.markerClusterGroup({
      chunkedLoading: true,
      maxClusterRadius: 50,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
    });

    const markers = jobs.map((job) => {
      const marker = L.marker([job.latitude, job.longitude]);
      const isNearby = nearbyJobIds.has(job.id);
      const tags = (job.cleaned_tags ?? [])
        .slice(0, 5)
        .map(
          (t: string) =>
            `<span style="display:inline-block;background:#eef2ff;color:#4338ca;padding:1px 6px;border-radius:4px;font-size:10px;margin:1px">${t}</span>`,
        )
        .join('');

      marker.bindPopup(`
        <div style="min-width:200px">
          <h3 style="margin:0 0 4px;font-size:14px;font-weight:600">${job.title}</h3>
          <p style="margin:0;font-size:12px;color:#6b7280">${job.company ?? 'Unknown'}</p>
          <p style="margin:0;font-size:12px;color:#9ca3af">${job.location ?? ''}</p>
          ${tags ? `<div style="margin-top:4px">${tags}</div>` : ''}
          ${isNearby ? '<span style="display:inline-block;margin-top:4px;background:#dcfce7;color:#15803d;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:500">Near you</span>' : ''}
          <a href="${job.link}" target="_blank" rel="noopener noreferrer" style="display:block;margin-top:8px;font-size:12px;color:#4f46e5;text-decoration:none">View Job →</a>
        </div>
      `);
      return marker;
    });

    cluster.addLayers(markers);
    map.addLayer(cluster);
    clusterRef.current = cluster;

    return () => {
      map.removeLayer(cluster);
      clusterRef.current = null;
    };
  }, [map, jobs, nearbyJobIds]);

  return null;
}

/* ── Main map component ────────────────────────────────────────── */

function MapInner({
  jobs,
  showClusters,
  showHeatmap,
  userLocation,
  radiusMeters,
  nearbyJobIds,
  onMapClick,
}: MapInnerProps) {
  const [bounds, setBounds] = useState<L.LatLngBounds | null>(null);
  const onBoundsChange = useCallback((b: L.LatLngBounds) => setBounds(b), []);

  // Filter jobs to visible bounds for performance (plain markers only)
  const visibleJobs = useMemo(() => {
    if (!bounds || showClusters) return jobs; // cluster layer handles its own viewport
    return jobs.filter((j) => bounds.contains([j.latitude, j.longitude]));
  }, [jobs, bounds, showClusters]);

  // Heatmap data points
  const heatPoints = useMemo<[number, number, number][]>(() => {
    if (!showHeatmap) return [];
    // Group by rounded coords for density
    const density = new Map<string, { lat: number; lng: number; count: number }>();
    for (const j of jobs) {
      const key = `${j.latitude.toFixed(2)},${j.longitude.toFixed(2)}`;
      const cur = density.get(key);
      if (cur) {
        cur.count += 1;
      } else {
        density.set(key, { lat: j.latitude, lng: j.longitude, count: 1 });
      }
    }
    const maxCount = Math.max(1, ...Array.from(density.values()).map((d) => d.count));
    return Array.from(density.values()).map((d) => [
      d.lat,
      d.lng,
      Math.min(1, d.count / maxCount + 0.2),
    ]);
  }, [jobs, showHeatmap]);

  // Fly target
  const flyTarget = useMemo<{ center: [number, number]; zoom: number } | null>(() => {
    if (userLocation) return { center: [userLocation.lat, userLocation.lng], zoom: 10 };
    return null;
  }, [userLocation]);

  return (
    <MapContainer
      center={[30, 0]}
      zoom={2}
      minZoom={2}
      maxZoom={18}
      scrollWheelZoom
      style={{ height: '100%', width: '100%' }}
      className="rounded-xl"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <BoundsTracker onBoundsChange={onBoundsChange} />
      <ClickHandler onClick={onMapClick} />

      {flyTarget && <FlyTo center={flyTarget.center} zoom={flyTarget.zoom} />}

      {/* Markers: clustered (imperative) or plain (React) */}
      {!(showHeatmap && !showClusters) && (
        showClusters ? (
          <ClusterLayer jobs={jobs} nearbyJobIds={nearbyJobIds} />
        ) : (
          visibleJobs.map((job) => {
            const isNearby = nearbyJobIds.has(job.id);
            return (
              <Marker key={job.id} position={[job.latitude, job.longitude]}>
                <Popup>
                  <div style={{ minWidth: 200 }}>
                    <h3 style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 600 }}>{job.title}</h3>
                    <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>{job.company ?? 'Unknown'}</p>
                    <p style={{ margin: 0, fontSize: 12, color: '#9ca3af' }}>{job.location ?? ''}</p>
                    {isNearby && (
                      <span style={{ display: 'inline-block', marginTop: 4, background: '#dcfce7', color: '#15803d', padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 500 }}>
                        Near you
                      </span>
                    )}
                    <a href={job.link} target="_blank" rel="noopener noreferrer" style={{ display: 'block', marginTop: 8, fontSize: 12, color: '#4f46e5' }}>
                      View Job →
                    </a>
                  </div>
                </Popup>
              </Marker>
            );
          })
        )
      )}

      {showHeatmap && <HeatLayer points={heatPoints} />}

      {/* User location marker + radius circle */}
      {userLocation && (
        <>
          <Marker position={[userLocation.lat, userLocation.lng]} icon={USER_ICON}>
            <Popup>
              <p className="font-semibold text-sm">📍 Your Location</p>
            </Popup>
          </Marker>
          <Circle
            center={[userLocation.lat, userLocation.lng]}
            radius={radiusMeters}
            pathOptions={{
              color: '#6366f1',
              fillColor: '#6366f1',
              fillOpacity: 0.08,
              weight: 2,
              dashArray: '6 4',
            }}
          />
        </>
      )}
    </MapContainer>
  );
}

export default memo(MapInner);
