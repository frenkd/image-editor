/** IndexedDB history for remove-bg originals + cutouts (survives refresh). */

export const RMBG_HISTORY_MAX = 20;

export type ColorMode = "original" | "black" | "white" | "custom";

export type StoredHistoryItem = {
  id: string;
  createdAt: number;
  source: Blob;
  cutout: Blob;
  colorMode: ColorMode;
  customColor: string;
};

const DB_NAME = "image-editor-rmbg";
const DB_VERSION = 1;
const STORE = "history";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB open failed"));
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("createdAt", "createdAt");
      }
    };
    req.onsuccess = () => resolve(req.result);
  });
}

function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB request failed"));
  });
}

export async function listHistoryItems(): Promise<StoredHistoryItem[]> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE, "readonly");
    const all = await reqToPromise(
      tx.objectStore(STORE).getAll() as IDBRequest<StoredHistoryItem[]>,
    );
    return all.sort((a, b) => b.createdAt - a.createdAt);
  } finally {
    db.close();
  }
}

export async function putHistoryItem(item: StoredHistoryItem): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    await reqToPromise(store.put(item));

    const all = await reqToPromise(
      store.getAll() as IDBRequest<StoredHistoryItem[]>,
    );
    if (all.length > RMBG_HISTORY_MAX) {
      const oldest = [...all].sort((a, b) => a.createdAt - b.createdAt);
      const drop = oldest.slice(0, all.length - RMBG_HISTORY_MAX);
      await Promise.all(drop.map((row) => reqToPromise(store.delete(row.id))));
    }

    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("IndexedDB write failed"));
    });
  } finally {
    db.close();
  }
}

export async function updateHistoryColors(
  id: string,
  colorMode: ColorMode,
  customColor: string,
): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const existing = await reqToPromise(
      store.get(id) as IDBRequest<StoredHistoryItem | undefined>,
    );
    if (!existing) return;
    await reqToPromise(
      store.put({ ...existing, colorMode, customColor }),
    );
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("IndexedDB write failed"));
    });
  } finally {
    db.close();
  }
}

export async function deleteHistoryItem(id: string): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE, "readwrite");
    await reqToPromise(tx.objectStore(STORE).delete(id));
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("IndexedDB delete failed"));
    });
  } finally {
    db.close();
  }
}

export async function blobFromSrc(src: string): Promise<Blob> {
  const res = await fetch(src);
  if (!res.ok) throw new Error("Could not read image bytes for history.");
  return res.blob();
}

export function newHistoryId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `rmbg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
