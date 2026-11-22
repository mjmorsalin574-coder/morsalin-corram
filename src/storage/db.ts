import {
  ACHIEVEMENTS,
  DEFAULT_PROFILE,
  DEFAULT_SAVE_BUNDLE,
  DEFAULT_SETTINGS,
  DEFAULT_STATS,
} from '../data/themes';
import type { MatchRecord, PlayerStats, SaveBundle } from '../types/game';

const DB_NAME = 'morsalin-carrom-db';
const DB_VERSION = 1;
const STORE_NAME = 'app_data';
const SAVE_KEY = 'save_v1';
const LS_KEY = 'morsalin_carrom_save_v1';

function mergeSaveBundle(raw: Partial<SaveBundle> | null | undefined): SaveBundle {
  if (!raw || typeof raw !== 'object') {
    return structuredClone(DEFAULT_SAVE_BUNDLE);
  }
  return {
    profile: { ...DEFAULT_PROFILE, ...(raw.profile || {}) },
    stats: { ...DEFAULT_STATS, ...(raw.stats || {}) },
    settings: { ...DEFAULT_SETTINGS, ...(raw.settings || {}) },
    unlockedAchievements: { ...(raw.unlockedAchievements || {}) },
    history: Array.isArray(raw.history) ? raw.history.slice(0, 30) : [],
  };
}

function readLocalFallback(): SaveBundle | null {
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (!raw) return null;
    return mergeSaveBundle(JSON.parse(raw) as Partial<SaveBundle>);
  } catch {
    return null;
  }
}

function writeLocalFallback(bundle: SaveBundle) {
  try {
    window.localStorage.setItem(LS_KEY, JSON.stringify(bundle));
  } catch {
    // Storage quota exceeded or unavailable
  }
}

const IDB_TIMEOUT_MS = 450;

function openDB(): Promise<IDBDatabase> {
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

export function loadSaveDataSync(): SaveBundle {
  return readLocalFallback() ?? structuredClone(DEFAULT_SAVE_BUNDLE);
}

export async function loadSaveData(): Promise<SaveBundle> {
  const local = readLocalFallback();
  let db: IDBDatabase | null = null;
  try {
    db = await openDB();
    const database = db;
    return await new Promise<SaveBundle>((resolve) => {
      let done = false;
      const timer = window.setTimeout(() => {
        if (!done) {
          done = true;
          resolve(local ?? structuredClone(DEFAULT_SAVE_BUNDLE));
        }
      }, IDB_TIMEOUT_MS);

      try {
        const tx = database.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const getReq = store.get(SAVE_KEY);
        getReq.onsuccess = () => {
          window.clearTimeout(timer);
          if (done) return;
          done = true;
          if (getReq.result) {
            const merged = mergeSaveBundle(getReq.result as Partial<SaveBundle>);
            writeLocalFallback(merged);
            resolve(merged);
          } else if (local) {
            resolve(local);
          } else {
            resolve(structuredClone(DEFAULT_SAVE_BUNDLE));
          }
        };
        getReq.onerror = () => {
          window.clearTimeout(timer);
          if (done) return;
          done = true;
          resolve(local ?? structuredClone(DEFAULT_SAVE_BUNDLE));
        };
      } catch {
        window.clearTimeout(timer);
        if (!done) {
          done = true;
          resolve(local ?? structuredClone(DEFAULT_SAVE_BUNDLE));
        }
      }
    });
  } catch {
    return local ?? structuredClone(DEFAULT_SAVE_BUNDLE);
  } finally {
    db?.close();
  }
}

export async function persistSaveData(bundle: SaveBundle): Promise<void> {
  writeLocalFallback(bundle);
  let db: IDBDatabase | null = null;
  try {
    db = await openDB();
    const database = db;
    await new Promise<void>((resolve, reject) => {
      const tx = database.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(bundle, SAVE_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // LocalStorage fallback already written
  } finally {
    db?.close();
  }
}

export function evaluateAchievements(
  stats: PlayerStats,
  existing: Record<string, number>
): { updated: Record<string, number>; newlyUnlocked: string[] } {
  const updated = { ...existing };
  const newlyUnlocked: string[] = [];
  const now = Date.now();

  for (const ach of ACHIEVEMENTS) {
    if (!updated[ach.id] && stats[ach.statKey] >= ach.target) {
      updated[ach.id] = now;
      newlyUnlocked.push(ach.id);
    }
  }
  return { updated, newlyUnlocked };
}

export function applyMatchOutcome(
  current: SaveBundle,
  match: MatchRecord,
  p1StatsDelta: {
    coinsPocketed: number;
    queenCovered: boolean;
    fouls: number;
    bestTurn: number;
  }
): { nextBundle: SaveBundle; newlyUnlocked: string[] } {
  const won = match.winner === 'p1';
  const nextStats: PlayerStats = {
    ...current.stats,
    matchesPlayed: current.stats.matchesPlayed + 1,
    wins: current.stats.wins + (won ? 1 : 0),
    losses: current.stats.losses + (won ? 0 : 1),
    currentStreak: won ? current.stats.currentStreak + 1 : 0,
    bestStreak: won
      ? Math.max(current.stats.bestStreak, current.stats.currentStreak + 1)
      : current.stats.bestStreak,
    totalCoinsPocketed: current.stats.totalCoinsPocketed + p1StatsDelta.coinsPocketed,
    queensCovered: current.stats.queensCovered + (p1StatsDelta.queenCovered ? 1 : 0),
    totalFouls: current.stats.totalFouls + p1StatsDelta.fouls,
    bestTurnPocketed: Math.max(current.stats.bestTurnPocketed, p1StatsDelta.bestTurn),
    hardAiWins:
      current.stats.hardAiWins +
      (won && match.mode === 'VS_CPU' && match.difficulty === 'hard' ? 1 : 0),
    localMatchesPlayed:
      current.stats.localMatchesPlayed + (match.mode === 'PASS_AND_PLAY' ? 1 : 0),
    championshipWins:
      current.stats.championshipWins + (won && match.format === 'championship' ? 1 : 0),
  };

  const { updated, newlyUnlocked } = evaluateAchievements(
    nextStats,
    current.unlockedAchievements
  );

  const nextBundle: SaveBundle = {
    ...current,
    stats: nextStats,
    unlockedAchievements: updated,
    history: [match, ...current.history].slice(0, 30),
  };

  return { nextBundle, newlyUnlocked };
}

export async function resetAllSaveData(): Promise<SaveBundle> {
  const fresh = structuredClone(DEFAULT_SAVE_BUNDLE);
  await persistSaveData(fresh);
  return fresh;
}
