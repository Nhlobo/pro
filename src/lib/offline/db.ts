import { openDB, type IDBPDatabase } from "idb";

const DB_NAME = "medico-legal-offline";
const DB_VERSION = 1;

export interface QueuedMutation {
  id?: number;
  /** Logical operation name, e.g. "support_ticket.create" */
  type: string;
  /** Arbitrary JSON-safe payload required to replay the mutation */
  payload: unknown;
  /** Optional human description shown in the offline indicator */
  description?: string;
  createdAt: number;
  attempts: number;
  lastError?: string;
}

export interface CachedRecord {
  /** key is `${collection}:${id}` */
  key: string;
  collection: string;
  id: string;
  data: unknown;
  updatedAt: number;
}

let dbPromise: Promise<IDBPDatabase> | null = null;

export function getDb() {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB unavailable"));
  }
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("queue")) {
          const store = db.createObjectStore("queue", {
            keyPath: "id",
            autoIncrement: true,
          });
          store.createIndex("createdAt", "createdAt");
        }
        if (!db.objectStoreNames.contains("cache")) {
          const store = db.createObjectStore("cache", { keyPath: "key" });
          store.createIndex("collection", "collection");
        }
      },
    });
  }
  return dbPromise;
}

/** Clear EVERYTHING — call on logout to respect POPIA. */
export async function clearOfflineData() {
  try {
    const db = await getDb();
    await db.clear("queue");
    await db.clear("cache");
  } catch (e) {
    console.warn("[offline] clearOfflineData failed", e);
  }
}

// ---------- Queue ----------

export async function enqueueMutation(
  m: Omit<QueuedMutation, "id" | "createdAt" | "attempts">,
): Promise<number> {
  const db = await getDb();
  const id = await db.add("queue", {
    ...m,
    createdAt: Date.now(),
    attempts: 0,
  });
  return id as number;
}

export async function listQueue(): Promise<QueuedMutation[]> {
  const db = await getDb();
  return (await db.getAll("queue")) as QueuedMutation[];
}

export async function deleteQueued(id: number) {
  const db = await getDb();
  await db.delete("queue", id);
}

export async function updateQueued(m: QueuedMutation) {
  const db = await getDb();
  await db.put("queue", m);
}

// ---------- Cache (read-through for safe, non-PII collections) ----------

export async function putCached(
  collection: string,
  id: string,
  data: unknown,
) {
  const db = await getDb();
  await db.put("cache", {
    key: `${collection}:${id}`,
    collection,
    id,
    data,
    updatedAt: Date.now(),
  } satisfies CachedRecord);
}

export async function getCached<T = unknown>(
  collection: string,
  id: string,
): Promise<T | null> {
  const db = await getDb();
  const rec = (await db.get("cache", `${collection}:${id}`)) as
    | CachedRecord
    | undefined;
  return (rec?.data as T) ?? null;
}

export async function listCached<T = unknown>(collection: string): Promise<T[]> {
  const db = await getDb();
  const recs = (await db.getAllFromIndex(
    "cache",
    "collection",
    collection,
  )) as CachedRecord[];
  return recs.map((r) => r.data as T);
}
