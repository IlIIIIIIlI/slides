import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // react-pdf-highlighter@7 starts an async PDFViewer init from a class
  // componentDidMount without cancelling it on unmount. React Strict Mode's
  // dev-only remount check can leave that init reading a cleared ref, which
  // crashes the fidelity PDF panel with `Error("!")` / missing getPageView.
  reactStrictMode: false,
  serverExternalPackages: ["@napi-rs/canvas", "pdfjs-dist"],
  webpack: (config, { isServer, webpack }) => {
    if (!isServer) {
      // pptxgenjs' ESM entry statically imports node: builtins (fs/https/…) for
      // its Node file-write path; in the browser they're unused (it writes via a
      // Blob). webpack's `node:`-scheme handler errors before alias resolution, so
      // rewrite `node:fs` → `fs` first, then stub the bare builtins on the client.
      // Turbopack (dev) already handles this, so this only affects `next build`.
      config.plugins = config.plugins ?? [];
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(/^node:/, (resource: { request: string }) => {
          resource.request = resource.request.replace(/^node:/, "");
        }),
      );
      config.resolve = config.resolve ?? {};
      config.resolve.fallback = {
        ...(config.resolve.fallback ?? {}),
        fs: false,
        https: false,
        http: false,
        os: false,
        path: false,
      };
    }
    return config;
  },
};

export default nextConfig;
