declare global {
  interface Window { __stockswiperDeviceId?: string }
}

export function generateDeviceId(): string | null {
  if (typeof window === 'undefined') return null;
  const fallback = () =>
    (globalThis.crypto && 'randomUUID' in globalThis.crypto)
      ? (globalThis.crypto as Crypto).randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  // Try persistent storage first
  try {
    const key = 'stockswiper-device-id';
    let deviceId = localStorage.getItem(key);
    if (!deviceId) {
      deviceId = fallback();
      localStorage.setItem(key, deviceId);
    }
    return deviceId;
  } catch {
    // If localStorage is blocked (privacy mode), keep an in-memory id for this session
    if (!window.__stockswiperDeviceId) {
      window.__stockswiperDeviceId = fallback();
    }
    return window.__stockswiperDeviceId;
  }
}
