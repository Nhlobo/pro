import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface IndexCheckRow {
  severity: 'ok' | 'warning' | 'error';
  code: string;
  message: string;
  index_name: string | null;
}

const SESSION_KEY = 'fp_index_check_done_v1';

/**
 * Admin-only startup verification for `function_permissions` unique indexes.
 *
 * Calls the `verify_function_permissions_indexes` RPC once per browser
 * session. If it finds a missing safe (COALESCE) unique index or any legacy
 * raw unique index that treats NULL `sub_function` as distinct, it raises a
 * persistent toast warning so the admin can take corrective action before
 * the bulk-upsert duplicate-row bug recurs.
 *
 * Silently no-ops for non-admins (the RPC raises and we swallow it).
 */
export function useFunctionPermissionIndexCheck(enabled: boolean) {
  const ranRef = useRef(false);

  useEffect(() => {
    if (!enabled || ranRef.current) return;
    if (typeof window !== 'undefined' && sessionStorage.getItem(SESSION_KEY)) {
      return;
    }
    ranRef.current = true;

    (async () => {
      try {
        const { data, error } = await supabase.rpc(
          'verify_function_permissions_indexes' as never,
        );
        if (error) {
          // Most common: non-admin → "Admin privileges required". Silent.
          if (!/admin privileges/i.test(error.message)) {
            console.warn('[fp-index-check] rpc error:', error.message);
          }
          return;
        }

        sessionStorage.setItem(SESSION_KEY, '1');

        const rows = (data ?? []) as IndexCheckRow[];
        const errors = rows.filter((r) => r.severity === 'error');
        const warnings = rows.filter((r) => r.severity === 'warning');

        if (errors.length === 0 && warnings.length === 0) return;

        const lines = [...errors, ...warnings]
          .map((r) =>
            r.index_name
              ? `• [${r.severity.toUpperCase()}] ${r.message} (index: ${r.index_name})`
              : `• [${r.severity.toUpperCase()}] ${r.message}`,
          )
          .join('\n');

        const fn = errors.length > 0 ? toast.error : toast.warning;
        fn('Permissions schema check failed', {
          description: lines,
          duration: Infinity,
          closeButton: true,
        });

        console.warn('[fp-index-check]', rows);
      } catch (err) {
        console.warn('[fp-index-check] unexpected error:', err);
      }
    })();
  }, [enabled]);
}
