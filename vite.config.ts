import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === 'development' && componentTagger(),
    VitePWA({
      registerType: "autoUpdate",
      devOptions: {
        // Service worker is DISABLED in dev/preview to avoid stale caches in
        // the Lovable iframe preview. Offline works only on the published site.
        enabled: false,
      },
      includeAssets: ["favicon.ico", "robots.txt", "placeholder.svg"],
      manifest: {
        name: "Medico-Legal Pro",
        short_name: "Medico-Legal",
        description: "Medico-legal case management system",
        theme_color: "#0f172a",
        background_color: "#0f172a",
        display: "standalone",
        start_url: "/",
        scope: "/",
        icons: [
          {
            src: "https://storage.googleapis.com/gpt-engineer-file-uploads/GgfjkqALqUYnkdIcpfWWP8KgnXF3/uploads/1758050853809-Mobius.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any maskable",
          },
          {
            src: "https://storage.googleapis.com/gpt-engineer-file-uploads/GgfjkqALqUYnkdIcpfWWP8KgnXF3/uploads/1758050853809-Mobius.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        // Internal/OAuth routes must never be served by the SW
        navigateFallbackDenylist: [/^\/~oauth/, /^\/api/, /\/functions\/v1\//],
        // Bump cache limits for a large SPA
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webp,woff,woff2}"],
        runtimeCaching: [
          {
            // HTML navigations: NetworkFirst so new deploys are picked up
            urlPattern: ({ request }) => request.mode === "navigate",
            handler: "NetworkFirst",
            options: {
              cacheName: "html-cache",
              networkTimeoutSeconds: 3,
            },
          },
          {
            // Static assets
            urlPattern: ({ request }) =>
              ["style", "script", "worker", "font"].includes(request.destination),
            handler: "StaleWhileRevalidate",
            options: { cacheName: "asset-cache" },
          },
          {
            // Images
            urlPattern: ({ request }) => request.destination === "image",
            handler: "CacheFirst",
            options: {
              cacheName: "image-cache",
              expiration: { maxEntries: 200, maxAgeSeconds: 30 * 24 * 60 * 60 },
            },
          },
          {
            // NEVER cache Supabase REST/Functions/Auth — POPIA: no PII at rest
            urlPattern: ({ url }) =>
              url.hostname.endsWith(".supabase.co") ||
              url.hostname.endsWith(".supabase.in"),
            handler: "NetworkOnly",
          },
        ],
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
