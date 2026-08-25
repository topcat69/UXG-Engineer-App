import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdfkit reads its bundled .afm font metrics files off disk at runtime
  // via __dirname-relative paths; bundled into the server build, those
  // paths point at a virtual module graph instead of real files (ENOENT).
  // Excluding it here makes Next.js load it as a plain CommonJS require
  // against the real node_modules on disk instead — and, as a documented
  // side effect, tells the `output: "standalone"` file tracer below to
  // copy pdfkit's whole package directory (including those .afm files)
  // into the standalone bundle verbatim, instead of trying to trace and
  // cherry-pick only the files a normal bundled dependency would need.
  serverExternalPackages: ["pdfkit"],
  // Self-hosted Docker deploy (see Dockerfile/DEPLOYMENT.md): produces a
  // `.next/standalone` folder containing only the production server plus
  // the node_modules subset it actually needs, instead of requiring the
  // full node_modules (incl. devDependencies) inside the runtime image.
  output: "standalone",
  experimental: {
    // Next's own default is 1MB for any Server Action's request body —
    // uploadJobDocument (office/jobs/[id]/actions.ts, the RAMS/site-plan
    // upload) sends the raw file straight through a Server Action's
    // FormData, so a multi-page RAMS PDF routinely exceeds that default
    // and gets rejected by the framework itself before the action ever
    // runs, surfacing as a generic "server error" page with no useful
    // message. Field-app photo/video capture is unaffected — that goes
    // straight to Supabase Storage from the browser (Phase 3's outbox),
    // never through a Server Action.
    serverActions: { bodySizeLimit: "20mb" },
  },
};

export default nextConfig;
