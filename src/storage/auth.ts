export interface AuthCredentialRecord {
  salt: string;
  hash: string;
  iterations: number;
  algorithm: 'PBKDF2-SHA256';
  createdAt: number;
}

const DB_NAME = 'morsalin-carrom-db';
const DB_VERSION = 1;
const STORE_NAME = 'app_data';
const AUTH_KEY = 'auth_credential_v1';
const AUTH_LS_FALLBACK_KEY = 'morsalin_carrom_auth_v1';
const PBKDF2_ITERATIONS = 120_000;

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

function getSubtleCrypto(): SubtleCrypto {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error('Web Crypto API PBKDF2 is unavailable in this environment.');
  }
  return subtle;
}

async function derivePbkdf2Hash(
  password: string,
  salt: Uint8Array,
  iterations: number
): Promise<Uint8Array> {
  const subtle = getSubtleCrypto();
  const encoder = new TextEncoder();
  const keyMaterial = await subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );

  // Copy salt into a fresh ArrayBuffer-backed Uint8Array for strict BufferSource typing
  const saltBuffer = new Uint8Array(salt.length);
  saltBuffer.set(salt);

  const derivedBits = await subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBuffer,
      iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );

  return new Uint8Array(derivedBits);
}

export async function createPasswordCredential(
  password: string
): Promise<AuthCredentialRecord> {
  const salt = new Uint8Array(16);
  globalThis.crypto.getRandomValues(salt);
  const hashBytes = await derivePbkdf2Hash(password, salt, PBKDF2_ITERATIONS);

  return {
    salt: bytesToBase64(salt),
    hash: bytesToBase64(hashBytes),
    iterations: PBKDF2_ITERATIONS,
    algorithm: 'PBKDF2-SHA256',
    createdAt: Date.now(),
  };
}

export async function verifyPasswordCredential(
  password: string,
  record: AuthCredentialRecord
): Promise<boolean> {
  if (!password || !record?.salt || !record?.hash) return false;
  try {
    const saltBytes = base64ToBytes(record.salt);
    const expectedHash = base64ToBytes(record.hash);
    const actualHash = await derivePbkdf2Hash(
      password,
      saltBytes,
      record.iterations || PBKDF2_ITERATIONS
    );
    return constantTimeEqual(actualHash, expectedHash);
  } catch {
    return false;
  }
}

const IDB_TIMEOUT_MS = 450;

function openAuthDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !('indexedDB' in window)) {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    let settled = false;
    const timer = window.setTimeout(() => {
      if (!settled) {
        settled = true;
        reject(new Error('IndexedDB open timeout'));
      }
    }, IDB_TIMEOUT_MS);

    try {
      const req = window.indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      req.onsuccess = () => {
        window.clearTimeout(timer);
        if (settled) {
          req.result.close();
          return;
        }
        settled = true;
        resolve(req.result);
      };
      req.onerror = () => {
        window.clearTimeout(timer);
        if (!settled) {
          settled = true;
          reject(req.error || new Error('Failed to open IndexedDB'));
        }
      };
      req.onblocked = () => {
        window.clearTimeout(timer);
        if (!settled) {
          settled = true;
          reject(new Error('IndexedDB blocked'));
        }
      };
    } catch (err) {
      window.clearTimeout(timer);
      if (!settled) {
        settled = true;
        reject(err instanceof Error ? err : new Error('IndexedDB error'));
      }
    }
  });
}

function isValidCredential(raw: unknown): raw is AuthCredentialRecord {
  if (!raw || typeof raw !== 'object') return false;
  const rec = raw as Partial<AuthCredentialRecord>;
  return (
    typeof rec.salt === 'string' &&
    rec.salt.length > 0 &&
    typeof rec.hash === 'string' &&
    rec.hash.length > 0 &&
    typeof rec.iterations === 'number' &&
    rec.algorithm === 'PBKDF2-SHA256'
  );
}

function readAuthLocalFallback(): AuthCredentialRecord | null {
  try {
    const raw = window.localStorage.getItem(AUTH_LS_FALLBACK_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (isValidCredential(parsed)) {
        return parsed;
      }
    }
  } catch {
    // Ignore storage read error
  }
  return null;
}

export async function loadAuthCredential(): Promise<AuthCredentialRecord | null> {
  const localFallback = readAuthLocalFallback();
  let db: IDBDatabase | null = null;
  try {
    db = await openAuthDB();
    const database = db;
    return await new Promise<AuthCredentialRecord | null>((resolve) => {
      let done = false;
      const timer = window.setTimeout(() => {
        if (!done) {
          done = true;
          resolve(localFallback);
        }
      }, IDB_TIMEOUT_MS);

      try {
        const tx = database.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const getReq = store.get(AUTH_KEY);
        getReq.onsuccess = () => {
          window.clearTimeout(timer);
          if (done) return;
          done = true;
          if (isValidCredential(getReq.result)) {
            resolve(getReq.result);
          } else {
            resolve(localFallback);
          }
        };
        getReq.onerror = () => {
          window.clearTimeout(timer);
          if (done) return;
          done = true;
          resolve(localFallback);
        };
      } catch {
        window.clearTimeout(timer);
        if (!done) {
          done = true;
          resolve(localFallback);
        }
      }
    });
  } catch {
    return localFallback;
  } finally {
    db?.close();
  }
}

export async function saveAuthCredential(
  record: AuthCredentialRecord
): Promise<void> {
  try {
    window.localStorage.setItem(AUTH_LS_FALLBACK_KEY, JSON.stringify(record));
  } catch {
    // Ignore fallback write error
  }

  let db: IDBDatabase | null = null;
  try {
    db = await openAuthDB();
    const database = db;
    await new Promise<void>((resolve, reject) => {
      const tx = database.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(record, AUTH_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Fallback already stored if IndexedDB unavailable
  } finally {
    db?.close();
  }
}
