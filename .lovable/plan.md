

## Problem

The `send-appointment-confirmation` edge function fails to attach uploaded supporting documents because it downloads from the **wrong storage bucket**.

**Root cause** (line 758-761 of `send-appointment-confirmation/index.ts`):
```typescript
// WRONG: downloads from 'documents' bucket
const { data: fileData } = await supabase.storage
  .from('documents')
  .download(storagePath);
```

All documents are uploaded to the `attorney-documents` bucket (confirmed across all upload points in the codebase), but the edge function tries to download from a `documents` bucket. The path stripping logic (removing `documents/` prefix) is also incorrect — `documents/supporting/` is a folder path within `attorney-documents`, not a bucket prefix.

## Fix

**File**: `supabase/functions/send-appointment-confirmation/index.ts` (lines 753-761)

1. Change the storage bucket from `'documents'` to `'attorney-documents'`
2. Remove the incorrect path prefix stripping — the `file_path` stored in the database is already the correct path within the `attorney-documents` bucket (e.g., `documents/supporting/1234-file.pdf`)

```typescript
// BEFORE (broken):
const storagePath = docData.file_path.startsWith('documents/')
  ? docData.file_path.substring('documents/'.length)
  : docData.file_path;
const { data: fileData } = await supabase.storage
  .from('documents')
  .download(storagePath);

// AFTER (fixed):
const { data: fileData } = await supabase.storage
  .from('attorney-documents')
  .download(docData.file_path);
```

This is a single-line bucket name fix plus removing the unnecessary path manipulation. No other files need changes — the frontend already correctly passes `attachmentDocumentIds` and the rest of the attachment pipeline (base64 encoding, Resend API call) is working correctly.

