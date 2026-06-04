import type { User } from "@supabase/supabase-js";
import type { UserProfile } from "@/hooks/useUserProfile";

export const getUserDisplayName = (user: User | null, profile: UserProfile | null): string => {
  if (profile?.first_name && profile?.last_name) return `${profile.first_name} ${profile.last_name}`;
  if (profile?.first_name) return profile.first_name;
  const metaFirst = (user?.user_metadata as any)?.first_name;
  if (metaFirst) return metaFirst;
  return user?.email?.split("@")[0] || "User";
};

export const getUserRoleLabel = (profile: UserProfile | null): string => {
  if (profile?.user_type === "admin") return "Administrator";
  if (profile?.user_type === "employee") return profile?.position || "Company Employee";
  if (profile?.user_type === "referring_attorney" && profile?.law_firm?.name) {
    return profile.law_firm.name;
  }
  if (profile?.position) return profile.position;
  return "Internal User";
};
