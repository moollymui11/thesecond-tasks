import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'งานประจำวัน · The Second',
    short_name: 'งานร้าน',
    start_url: '/',
    display: 'standalone',
    background_color: '#fbede0',
    theme_color: '#7a2531',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  };
}
