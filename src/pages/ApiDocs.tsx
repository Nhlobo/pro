import { useEffect } from "react";
import { Helmet } from "react-helmet-async";

const SWAGGER_CSS = "https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.17.14/swagger-ui.css";
const SWAGGER_JS = "https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.17.14/swagger-ui-bundle.js";
const SWAGGER_PRESET_JS =
  "https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.17.14/swagger-ui-standalone-preset.js";

declare global {
  interface Window {
    SwaggerUIBundle?: any;
    SwaggerUIStandalonePreset?: any;
  }
}

const loadScript = (src: string) =>
  new Promise<void>((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });

const loadCss = (href: string) => {
  if (document.querySelector(`link[href="${href}"]`)) return;
  const l = document.createElement("link");
  l.rel = "stylesheet";
  l.href = href;
  document.head.appendChild(l);
};

const ApiDocs = () => {
  useEffect(() => {
    let cancelled = false;
    loadCss(SWAGGER_CSS);
    (async () => {
      try {
        await loadScript(SWAGGER_JS);
        await loadScript(SWAGGER_PRESET_JS);
        if (cancelled || !window.SwaggerUIBundle) return;
        window.SwaggerUIBundle({
          url: "/openapi.yaml",
          dom_id: "#swagger-ui",
          deepLinking: true,
          presets: [
            window.SwaggerUIBundle.presets.apis,
            window.SwaggerUIStandalonePreset?.slice(1),
          ].filter(Boolean),
          layout: "BaseLayout",
        });
      } catch (e) {
        console.error("Swagger UI load failed", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <Helmet>
        <title>API Documentation — Medico-Legal Pro</title>
        <meta name="description" content="Interactive Swagger UI for the Medico-Legal Pro edge function API." />
      </Helmet>
      <main className="min-h-screen bg-background">
        <header className="border-b px-6 py-4">
          <h1 className="text-xl font-semibold text-foreground">API Documentation</h1>
          <p className="text-sm text-muted-foreground">
            OpenAPI 3.1 spec served from <code>/openapi.yaml</code>
          </p>
        </header>
        <div id="swagger-ui" className="bg-white" />
      </main>
    </>
  );
};

export default ApiDocs;
