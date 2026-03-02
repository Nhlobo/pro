

## Fix: Resend User Confirmation Edge Function Boot Error

### Problem
The `resend-user-confirmation` edge function fails to boot because the variable `userError` is declared twice in the same scope (line ~63 for `getUser()` and line ~105 for `listUsers()`). This prevents the function from loading entirely.

### Solution
Rename the second `userError` variable (used with `listUsers()`) to `listError` to resolve the naming conflict.

### Technical Details

**File**: `supabase/functions/resend-user-confirmation/index.ts`

Change:
```typescript
const { data: existingUser, error: userError } = await supabaseAdmin.auth.admin.listUsers();
```
To:
```typescript
const { data: existingUser, error: listError } = await supabaseAdmin.auth.admin.listUsers();
```

And update the subsequent reference:
```typescript
if (listError) {
  console.error("Error fetching users:", listError);
```

Additionally, the admin role check currently reads from the `profiles` table instead of using the secure `has_role` RPC function. This should also be updated to use `has_role` for consistency with the security model used in `create-user`.

