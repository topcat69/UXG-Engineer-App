import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdfkit reads its bundled .afm font metrics files off disk at runtime
  // via __dirname-relative paths; bundled into the server build, those
  // paths point at a virtual module graph instead of real files (ENOENT).
  // Excluding it here makes Next.js load it as a plain CommonJS require
  // against the real node_modules on disk instead.
  serverExternalPackages: ["pdfkit"],
};

export default nextConfig;
