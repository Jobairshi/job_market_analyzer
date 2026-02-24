/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['react-leaflet', 'react-leaflet-cluster', 'leaflet'],
};

module.exports = nextConfig;
 