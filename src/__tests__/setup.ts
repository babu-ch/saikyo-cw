import { vi } from "vitest";

// chrome.storage.sync のモック
const store: Record<string, unknown> = {};
const listeners: Array<
  (
    changes: Record<string, chrome.storage.StorageChange>,
    area: string,
  ) => void
> = [];

const storageSyncMock = {
  get: vi.fn(async (keys: string | string[] | Record<string, unknown> | null) => {
    if (keys === null) return { ...store };
    if (typeof keys === "string") return { [keys]: store[keys] };
    if (Array.isArray(keys)) {
      const result: Record<string, unknown> = {};
      for (const k of keys) result[k] = store[k];
      return result;
    }
    const result: Record<string, unknown> = {};
    for (const k of Object.keys(keys)) result[k] = store[k] ?? keys[k];
    return result;
  }),
  set: vi.fn(async (items: Record<string, unknown>) => {
    const changes: Record<string, chrome.storage.StorageChange> = {};
    for (const [key, value] of Object.entries(items)) {
      changes[key] = { oldValue: store[key], newValue: value };
      store[key] = value;
    }
    for (const listener of listeners) {
      listener(changes, "sync");
    }
  }),
  remove: vi.fn(async (keys: string | string[]) => {
    const arr = typeof keys === "string" ? [keys] : keys;
    for (const k of arr) delete store[k];
  }),
  clear: vi.fn(async () => {
    for (const k of Object.keys(store)) delete store[k];
  }),
};

const chromeStorageMock = {
  sync: storageSyncMock,
  onChanged: {
    addListener: vi.fn((fn: (changes: Record<string, chrome.storage.StorageChange>, area: string) => void) => {
      listeners.push(fn);
    }),
    removeListener: vi.fn((fn: (changes: Record<string, chrome.storage.StorageChange>, area: string) => void) => {
      const idx = listeners.indexOf(fn);
      if (idx >= 0) listeners.splice(idx, 1);
    }),
  },
};

const chromeRuntimeMock = {
  onInstalled: {
    addListener: vi.fn(),
  },
};

// @ts-expect-error -- chrome APIモック
globalThis.chrome = {
  storage: chromeStorageMock,
  runtime: chromeRuntimeMock,
};

// テスト間でstoreをリセットするヘルパー
export function resetStore(): void {
  for (const k of Object.keys(store)) delete store[k];
  listeners.length = 0;
}
