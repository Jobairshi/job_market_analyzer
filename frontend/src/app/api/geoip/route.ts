import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/geoip
 * Server-side IP geolocation proxy — avoids browser CORS restrictions.
 * Tries ip-api.com (free, no key) then falls back to freeipapi.com.
 */

function clientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    req.headers.get('x-real-ip') ||
    ''
  );
}

function isLoopback(ip: string) {
  return !ip || ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.');
}

export async function GET(req: NextRequest) {
  const ip = clientIp(req);

  // On localhost the server IP is loopback — ip-api won't resolve it.
  // Return a 422 so the client skips to click-on-map mode cleanly.
  if (isLoopback(ip)) {
    return NextResponse.json({ error: 'localhost_loopback' }, { status: 422 });
  }

  // ── Try ip-api.com (free, generous rate limit, no CORS issue server-side) ──
  try {
    const res = await fetch(`http://ip-api.com/json/${ip}?fields=status,lat,lon,city,country`, {
      headers: { 'User-Agent': 'ai-job-analyzer/1.0' },
    });
    const data = await res.json();
    if (data.status === 'success' && data.lat && data.lon) {
      return NextResponse.json({ latitude: data.lat, longitude: data.lon, city: data.city ?? null, country: data.country ?? null });
    }
  } catch {/* fall through */}

  // ── Fallback: freeipapi.com ──
  try {
    const res = await fetch(`https://freeipapi.com/api/json/${ip}`, {
      headers: { 'User-Agent': 'ai-job-analyzer/1.0' },
    });
    const data = await res.json();
    if (data.latitude && data.longitude) {
      return NextResponse.json({ latitude: data.latitude, longitude: data.longitude, city: data.cityName ?? null, country: data.countryName ?? null });
    }
  } catch {/* fall through */}

  return NextResponse.json({ error: 'Location unavailable' }, { status: 422 });
}
