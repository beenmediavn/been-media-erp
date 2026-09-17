export type OfflineQueueStatus = "pending" | "syncing" | "error" | "conflict";

export type OfflineQueueItem = {
  id: string;
  type: "job_bundle" | "customer_upsert";
  payload: any;
  createdAt: string;
  updatedAt: string;
  attempts: number;
  status: OfflineQueueStatus;
  lastError?: string;
};

const DB_NAME = "been-media-erp-offline";
const DB_VERSION = 2;
const STORE = "sync_queue";
const CACHE_STORE = "data_cache";
const EVENT = "been:offline-queue-changed";

function emitChanged() {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(EVENT));
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("IndexedDB không khả dụng"));
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("status", "status", { unique: false });
        store.createIndex("createdAt", "createdAt", { unique: false });
      }
      if (!db.objectStoreNames.contains(CACHE_STORE)) {
        db.createObjectStore(CACHE_STORE, { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Không mở được IndexedDB"));
  });
}

async function withStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = run(tx.objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("Lỗi IndexedDB"));
    tx.oncomplete = () => db.close();
    tx.onerror = () => { db.close(); reject(tx.error || new Error("Lỗi transaction IndexedDB")); };
  });
}

export async function putOfflineItem(item: OfflineQueueItem) {
  await withStore("readwrite", (store) => store.put(item));
  emitChanged();
}

export async function addOfflineItem(type: OfflineQueueItem["type"], payload: any, forcedId?: string) {
  const now = new Date().toISOString();
  const item: OfflineQueueItem = {
    id: forcedId || (globalThis.crypto?.randomUUID?.() || `offline-${Date.now()}-${Math.random().toString(16).slice(2)}`),
    type,
    payload,
    createdAt: now,
    updatedAt: now,
    attempts: 0,
    status: "pending",
  };
  await putOfflineItem(item);
  return item;
}

export async function getOfflineItems(): Promise<OfflineQueueItem[]> {
  const rows = await withStore<OfflineQueueItem[]>("readonly", (store) => store.getAll());
  return (rows || []).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function getOfflineCount() {
  return withStore<number>("readonly", (store) => store.count());
}

export async function deleteOfflineItem(id: string) {
  await withStore("readwrite", (store) => store.delete(id));
  emitChanged();
}

export async function patchOfflineItem(id: string, patch: Partial<OfflineQueueItem>) {
  const items = await getOfflineItems();
  const current = items.find((x) => x.id === id);
  if (!current) return;
  await putOfflineItem({ ...current, ...patch, id, updatedAt: new Date().toISOString() });
}

export async function setOfflineCache(key:string,data:any){
  const db=await openDb();
  return new Promise<void>((resolve,reject)=>{
    const tx=db.transaction(CACHE_STORE,"readwrite");
    tx.objectStore(CACHE_STORE).put({key,data,updatedAt:new Date().toISOString()});
    tx.oncomplete=()=>{db.close();resolve()};
    tx.onerror=()=>{db.close();reject(tx.error||new Error("Không lưu được cache"))};
  });
}

export async function getOfflineCache<T=any>(key:string):Promise<{key:string;data:T;updatedAt:string}|null>{
  const db=await openDb();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(CACHE_STORE,"readonly");
    const req=tx.objectStore(CACHE_STORE).get(key);
    req.onsuccess=()=>resolve(req.result||null);
    req.onerror=()=>reject(req.error||new Error("Không đọc được cache"));
    tx.oncomplete=()=>db.close();
  });
}

export function subscribeOfflineQueue(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(EVENT, callback);
  return () => window.removeEventListener(EVENT, callback);
}
