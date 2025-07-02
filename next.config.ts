import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 기본 성능 최적화
  compress: true,
  poweredByHeader: false,
  
  // 이미지 최적화 (안정적 설정)
  images: {
    unoptimized: false,
    formats: ['image/webp'],
  },
  
  // 안정적인 실험적 기능만 활성화
  experimental: {
    optimizePackageImports: [
      '@supabase/auth-helpers-nextjs',
      '@supabase/supabase-js'
    ]
  },
  
  // 번들 최적화
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        fs: false,
        net: false,
        tls: false,
      }
    }
    return config
  },
  
  // 캐시 헤더 최적화
  async headers() {
    return [
      {
        source: '/(.*)\\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ]
  },
};

export default nextConfig;
