import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

export interface UserProfile {
  first_name?: string;
  last_name?: string;
  position?: string;
  user_type?: string;
  law_firm?: {
    name: string;
    contact_person: string;
  };
}

export const useUserProfile = (user: User | null) => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) {
      setProfile(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error: qError } = await supabase
        .from("profiles")
        .select(
          `first_name, last_name, position, user_type,
           referring_attorneys:referring_attorney_id ( name, contact_person )`
        )
        .eq("id", user.id)
        .maybeSingle();

      if (qError) throw qError;
      if (!data) {
        setProfile(null);
        return;
      }
      setProfile({
        first_name: data.first_name ?? undefined,
        last_name: data.last_name ?? undefined,
        position: data.position ?? undefined,
        user_type: data.user_type ?? undefined,
        law_firm: (data as any).referring_attorneys ?? undefined,
      });
    } catch (e: any) {
      console.error("Error fetching user profile:", e);
      setError(e?.message ?? "Failed to load profile");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  return { profile, loading, error, reload: load };
};
