import { useEffect, useState } from 'react'

const PREFIX = 'og-callcentre:'

// Same API as useState, but the value is mirrored to localStorage so the demo
// survives a page refresh. Storage can be unavailable (private mode, blocked
// site data), so every access is wrapped and falls back to the initial value.
export function usePersistentState<T>(key: string, initial: T | (() => T)) {
  const storageKey = PREFIX + key

  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(storageKey)
      if (raw !== null) return JSON.parse(raw) as T
    } catch {
      // ignore and fall through to the initial value
    }
    return typeof initial === 'function' ? (initial as () => T)() : initial
  })

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(value))
    } catch {
      // storage full or blocked: the app keeps working in memory
    }
  }, [storageKey, value])

  return [value, setValue] as const
}

/** Removes every key this app wrote. Used by "Reset demo data". */
export function clearPersistedState() {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(PREFIX))
      .forEach((k) => localStorage.removeItem(k))
  } catch {
    // nothing to clear
  }
}
