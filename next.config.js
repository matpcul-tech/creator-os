/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['avatars.githubusercontent.com', 'images.unsplash.com'],
  },
  experimental: {
    // Load `ws` from node_modules at runtime instead of bundling it.
    // When webpack bundles ws, its optional bufferutil hook is replaced with a
    // stub and every send throws "mask is not a function", so the neural voice
    // never answers and Studio waits 20 seconds per request.
    serverComponentsExternalPackages: ['ws'],
  },
};

module.exports = nextConfig;
