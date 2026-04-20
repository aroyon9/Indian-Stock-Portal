/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  experimental: {
    webpackBuildWorker: false,
    workerThreads: true
  }
};

export default nextConfig;
