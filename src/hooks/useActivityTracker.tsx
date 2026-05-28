import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { resolveActivity } from "@/config/activityLabels";

const IDLE_MS = 90_000;          // 90s no interaction → paused
const FLUSH_INTERVAL_MS = 60_000; // flush buffer every 60s
const MIN_FLUSH_SECONDS = 5;     // don't send tiny fragments

interface Bucket {
  key: string;
  label: string;
  seconds: number;
}

/**
 * Tracks active time per route per authenticated user.
 * - One hook instance per app, mounted inside Router + AuthProvider.
 * - Idle when no mouse/keyboard for IDLE_MS or tab hidden.
 * - Buffers locally and flushes via RPC log_activity_time.
 */
export function useActivityTracker() {
  const { user } = useAuth();
  const location = useLocation();
  const bufferRef = useRef<Map<string, Bucket>>(new Map());
  const currentRef = useRef<{ key: string; label: string } | null>(null);
  const lastTickRef = useRef<number>(Date.now());
  const lastInteractionRef = useRef<number>(Date.now());
  const isVisibleRef = useRef<boolean>(typeof document !== "undefined" ? !document.hidden : true);

  // Accumulate seconds into the active bucket since the last tick.
  const accrue = () => {
    if (!user || !currentRef.current) { lastTickRef.current = Date.now(); return; }
    const now = Date.now();
    const elapsed = Math.floor((now - lastTickRef.current) / 1000);
    lastTickRef.current = now;
    if (elapsed <= 0) return;
    const idle = now - lastInteractionRef.current > IDLE_MS;
    if (!isVisibleRef.current || idle) return;
    const { key, label } = currentRef.current;
    const existing = bufferRef.current.get(key);
    if (existing) existing.seconds += elapsed;
    else bufferRef.current.set(key, { key, label, seconds: elapsed });
  };

  const flush = async () => {
    accrue();
    if (!user || bufferRef.current.size === 0) return;
    const entries = Array.from(bufferRef.current.values()).filter(b => b.seconds >= MIN_FLUSH_SECONDS);
    if (entries.length === 0) return;
    // Optimistically clear; on failure we just lose this small slice.
    bufferRef.current.clear();
    await Promise.all(entries.map(b =>
      supabase.rpc("log_activity_time", {
        _activity_key: b.key,
        _activity_label: b.label,
        _seconds: b.seconds,
      }).then(({ error }) => { if (error) console.warn("activity log failed", error); })
    ));
  };

  // Track current route
  useEffect(() => {
    accrue();
    currentRef.current = resolveActivity(location.pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, user?.id]);

  // Interaction + visibility listeners
  useEffect(() => {
    if (!user) return;
    const onInteract = () => { lastInteractionRef.current = Date.now(); };
    const onVisibility = () => {
      accrue();
      isVisibleRef.current = !document.hidden;
      lastTickRef.current = Date.now();
      if (document.hidden) void flush();
    };
    const onBeforeUnload = () => { void flush(); };

    window.addEventListener("mousemove", onInteract, { passive: true });
    window.addEventListener("keydown", onInteract);
    window.addEventListener("click", onInteract);
    window.addEventListener("scroll", onInteract, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("beforeunload", onBeforeUnload);

    const tickId = window.setInterval(accrue, 15_000);
    const flushId = window.setInterval(() => { void flush(); }, FLUSH_INTERVAL_MS);

    return () => {
      window.removeEventListener("mousemove", onInteract);
      window.removeEventListener("keydown", onInteract);
      window.removeEventListener("click", onInteract);
      window.removeEventListener("scroll", onInteract);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.clearInterval(tickId);
      window.clearInterval(flushId);
      void flush();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);
}

export const ActivityTrackerMount = () => {
  useActivityTracker();
  return null;
};
