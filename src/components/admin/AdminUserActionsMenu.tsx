import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Shield, ShieldOff, Lock, Unlock, KeyRound, LogOut, Mail, Ban, RefreshCcw, ChevronDown, Loader2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { UserProfile } from "@/hooks/usePermissions";

type Action =
  | "suspend"
  | "reactivate"
  | "disable"
  | "unlock"
  | "force-reset"
  | "force-setup"
  | "force-logout-all"
  | "resend-activation";

interface ActionConfig {
  id: Action;
  label: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
  destructive?: boolean;
  confirmTitle: string;
}

const ACTIONS: ActionConfig[] = [
  { id: "unlock", label: "Unlock account", desc: "Clears failed login lock", icon: Unlock, confirmTitle: "Unlock this user's account?" },
  { id: "force-reset", label: "Force password reset", desc: "User must set a new password on next sign-in", icon: KeyRound, confirmTitle: "Force a password reset?" },
  { id: "force-setup", label: "Re-run security setup", desc: "Forces the user back through 2FA / security wizard", icon: Shield, confirmTitle: "Force the security setup wizard?" },
  { id: "force-logout-all", label: "Force logout all sessions", desc: "Signs the user out everywhere", icon: LogOut, confirmTitle: "Sign this user out of all devices?" },
  { id: "resend-activation", label: "Resend activation email", desc: "Issues a new activation link", icon: Mail, confirmTitle: "Resend the activation email?" },
  { id: "suspend", label: "Suspend account", desc: "Temporary block; sessions revoked", icon: ShieldOff, destructive: true, confirmTitle: "Suspend this account?" },
  { id: "reactivate", label: "Reactivate account", desc: "Restores access; clears lock counters", icon: RefreshCcw, confirmTitle: "Reactivate this account?" },
  { id: "disable", label: "Disable account", desc: "Long-term block; sessions revoked", icon: Ban, destructive: true, confirmTitle: "Disable this account?" },
];

export function AccountStatusBadge({ user }: { user: UserProfile }) {
  const lockedUntil = user.locked_until ? new Date(user.locked_until) : null;
  const isLocked = lockedUntil && lockedUntil > new Date();
  const status = user.account_status ?? "active";

  if (isLocked) {
    return (
      <Badge variant="destructive" className="gap-1">
        <Lock className="h-3 w-3" /> Locked
      </Badge>
    );
  }
  switch (status) {
    case "suspended":
      return <Badge variant="destructive" className="gap-1"><ShieldOff className="h-3 w-3" />Suspended</Badge>;
    case "disabled":
      return <Badge variant="destructive" className="gap-1"><Ban className="h-3 w-3" />Disabled</Badge>;
    case "pending_activation":
      return <Badge variant="secondary" className="gap-1"><Mail className="h-3 w-3" />Pending Activation</Badge>;
    case "active":
    default:
      if (user.must_reset_password) {
        return <Badge variant="outline" className="gap-1 border-amber-500 text-amber-700"><KeyRound className="h-3 w-3" />Reset Required</Badge>;
      }
      return <Badge variant="outline" className="gap-1 border-green-500 text-green-700"><Shield className="h-3 w-3" />Active</Badge>;
  }
}

interface Props {
  user: UserProfile;
  onChanged?: () => void;
  size?: "sm" | "default";
}

export function AdminUserActionsMenu({ user, onChanged, size = "sm" }: Props) {
  const [pending, setPending] = useState<ActionConfig | null>(null);
  const [running, setRunning] = useState(false);

  const run = async (action: Action) => {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("auth-admin-user-actions", {
        body: { action, userId: user.id },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(`Action "${action}" applied to ${user.email ?? user.id}`);
      onChanged?.();
    } catch (e: any) {
      toast.error(e?.message || `Failed to run ${action}`);
    } finally {
      setRunning(false);
      setPending(null);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size={size} className="gap-1">
            <Shield className="h-4 w-4" />
            Admin Actions
            <ChevronDown className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72 bg-popover">
          <DropdownMenuLabel className="text-xs">Account controls</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {ACTIONS.map((a) => {
            const Icon = a.icon;
            return (
              <DropdownMenuItem
                key={a.id}
                onSelect={(e) => { e.preventDefault(); setPending(a); }}
                className={a.destructive ? "text-destructive focus:text-destructive" : ""}
              >
                <Icon className="h-4 w-4 mr-2" />
                <div className="flex flex-col">
                  <span className="text-sm">{a.label}</span>
                  <span className="text-[10px] text-muted-foreground">{a.desc}</span>
                </div>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{pending?.confirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              Target: <strong>{user.email || user.id}</strong>
              <br />
              {pending?.desc}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={running}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={running}
              onClick={(e) => { e.preventDefault(); if (pending) run(pending.id); }}
              className={pending?.destructive ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
            >
              {running ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
