/** @type {import('next').NextConfig} */
const nextConfig = {
  // react-pdf-highlighter@7 starts an async PDFViewer init from a class
  // componentDidMount without cancelling it on unmount. React Strict Mode's
  // dev-only remount check can leave that init reading a cleared ref, which
  // crashes the fidelity PDF panel with `Error("!")` / missing getPageView.
  reactStrictMode: false,
  serverExternalPackages: ["@napi-rs/canvas", "pdfjs-dist"],
};

export default nextConfig;
