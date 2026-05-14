import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type CheckStatus = "pending" | "ok" | "degraded" | "down";

interface Check {
  name: string;
  status: CheckStatus;
  latencyMs?: number;
  message?: string;
}

const dot = (s: CheckStatus) =>
  s === "ok"
    ? "bg-green-500"
    : s === "degraded"
    ? "bg-yellow-500"
    : s === "down"
    ? "bg-red-500"
    : "bg-muted-foreground";

async function timed<T>(fn: () => Promise<T>) {
  const t0 = performance.now();
  try {
    const data = await fn();
    return { ok: true as const, data, ms: Math.round(performance.now() - t0) };
  } catch (err) {
    return {
      ok: false as const,
      err: err instanceof Error ? err.message : String(err),
      ms: Math.round(performance.now() - t0),
    };
  }
}

/**
 * App-level health page. Pings Supabase Auth and a public RPC/table to confirm
 * the backend is reachable. Returns a JSON body when requested with
 * `?format=json` so monitoring tools can scrape it.
 */
export default function Health() {
  const [checks, setChecks] = useState<Check[]>([
    { name: "Frontend", status: "ok" },
    { name: "Supabase Auth", status: "pending" },
    { name: "Supabase DB", status: "pending" },
  ]);
  const [overall, setOverall] = useState<CheckStatus>("pending");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const auth = await timed(() => supabase.auth.getSession());
      const db = await timed(async () => {
        // Lightweight reachability check — head request, no rows fetched.
        const { error } = await supabase
          .from("referring_attorneys")
          .select("id", { count: "exact", head: true })
          .limit(1);
        if (error) throw error;
        return true;
      });

      if (cancelled) return;

      const next: Check[] = [
        { name: "Frontend", status: "ok" },
        {
          name: "Supabase Auth",
          status: auth.ok ? "ok" : "down",
          latencyMs: auth.ms,
          message: auth.ok ? undefined : auth.err,
        },
        {
          name: "Supabase DB",
          status: db.ok ? "ok" : "down",
          latencyMs: db.ms,
          message: db.ok ? undefined : db.err,
        },
      ];
      setChecks(next);

      const downCount = next.filter((c) => c.status === "down").length;
      const overallStatus: CheckStatus =
        downCount === 0 ? "ok" : downCount === next.length ? "down" : "degraded";
      setOverall(overallStatus);

      // JSON mode for monitoring scrapers
      if (
        typeof window !== "undefined" &&
        new URLSearchParams(window.location.search).get("format") === "json"
      ) {
        document.title = `health: ${overallStatus}`;
        document.body.innerText = JSON.stringify(
          {
            status: overallStatus,
            checks: next,
            timestamp: new Date().toISOString(),
          },
          null,
          2,
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="min-h-screen bg-background text-foreground p-6 flex items-start justify-center">
      <div className="max-w-lg w-full bg-card border border-border rounded-lg p-6 shadow-sm">
        <header className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-semibold">System health</h1>
          <span
            className={`inline-flex items-center gap-2 text-sm font-medium px-3 py-1 rounded-full bg-muted`}
          >
            <span className={`w-2 h-2 rounded-full ${dot(overall)}`} />
            {overall}
          </span>
        </header>

        <ul className="divide-y divide-border">
          {checks.map((c) => (
            <li
              key={c.name}
              className="py-3 flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className={`w-2.5 h-2.5 rounded-full ${dot(c.status)}`} />
                <div className="min-w-0">
                  <div className="font-medium truncate">{c.name}</div>
                  {c.message && (
                    <div className="text-xs text-muted-foreground truncate">
                      {c.message}
                    </div>
                  )}
                </div>
              </div>
              <div className="text-xs text-muted-foreground tabular-nums">
                {c.latencyMs != null ? `${c.latencyMs}ms` : "—"}
              </div>
            </li>
          ))}
        </ul>

        <p className="mt-6 text-xs text-muted-foreground">
          Add <code>?format=json</code> for a machine-readable response.
          Container probes use <code>/healthz</code> at the edge.
        </p>
      </div>
    </main>
  );
}
