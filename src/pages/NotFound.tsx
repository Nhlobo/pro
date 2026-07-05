import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div className="min-h-screen w-full gradient-nav flex items-center justify-center p-6">
      <Helmet>
        <title>Page not found — Medico-Legal Pro</title>
      </Helmet>
      <div className="w-full max-w-md bg-white p-8 text-center shadow-2xl">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-black/5">
          <AlertTriangle className="h-8 w-8 text-black" />
        </div>
        <div className="text-xs font-semibold uppercase tracking-[0.25em] text-[#00BAAD]">
          Error 404
        </div>
        <h1 className="mt-2 text-2xl font-bold text-black">Page not found</h1>
        <p className="mt-2 text-sm text-slate-600">
          We couldn&rsquo;t find <code className="rounded bg-black/5 px-1 py-0.5 text-xs">{location.pathname}</code>.
          It may have been moved or you may not have access.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button
            onClick={() => window.history.back()}
            variant="outline"
            className="h-11 rounded-none border-black/15 font-semibold uppercase tracking-wide text-black hover:bg-black/5"
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Go back
          </Button>
          <Link
            to="/auth"
            className="inline-flex h-11 items-center justify-center bg-black px-4 text-sm font-semibold uppercase tracking-wide text-white hover:bg-black/85"
          >
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
