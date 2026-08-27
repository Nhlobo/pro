/**
 * Phase 4 rollback switch for the new enterprise access-control system
 * (access_role_assignments / role_module_defaults / user_module_overrides).
 *
 * false (default): useModuleAccess and AdminPortalRoute behave exactly
 * as they did before this file existed — reading function_permissions,
 * no per-route enforcement beyond authentication. Shipping this code
 * with the flag off changes nothing about live behavior.
 *
 * true: useModuleAccess computes access from the new tables, and
 * AdminPortalRoute actively enforces per-route access (redirecting a
 * denied direct URL visit instead of rendering it — closing the gap
 * where typing /admin/finance directly bypassed the sidebar).
 *
 * Flip this back to false at any time to instantly revert to the old
 * behavior — no database change required, nothing to undo. This is
 * the single switch described in every prior migration/rollback plan
 * for this project.
 */
export const NEW_ACCESS_CONTROL_ENABLED = false;
