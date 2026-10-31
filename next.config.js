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
    // ffmpeg-static and resvg ship native binaries. Leave them external so the
    // file trace picks up the binary next to the package instead of a webpack stub.
    serverComponentsExternalPackages: ['ws', 'ffmpeg-static', '@resvg/resvg-js'],
    outputFileTracingIncludes: {
      '/api/produce': [
        './node_modules/ffmpeg-static/**/*',
        './node_modules/@resvg/resvg-js/**/*',
        './assets/fonts/**/*',
      ],
      '/api/thumbnails/render': [
        './node_modules/@resvg/resvg-js/**/*',
        './assets/fonts/**/*',
      ],
    },
  },
};

module.exports = nextConfig;
