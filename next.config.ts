import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // 이미지 도메인은 BE가 외부 URL을 돌려주면 그때 추가한다.
  images: {
    remotePatterns: [],
  },
};

export default nextConfig;
