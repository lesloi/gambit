/** The three calls the session needs from a Storage, so a test can stand in for the browser's. */
export interface SessionStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** Reading the global can throw where storage is blocked, so both steps are guarded. */
export function browserStorage(): SessionStorage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}
