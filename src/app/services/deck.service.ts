import { Injectable, computed, effect, signal, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { StockApiService, StockItem } from './stock-api.service';
import { SwipeQueueService } from './swipe-queue.service';
import { generateDeviceId } from '../utils/device-id';

export type UiState = 'loading' | 'ready' | 'limit' | 'complete' | 'error';

interface DeckCache {
  date: string; // YYYY-MM-DD
  deck: StockItem[];
  index: number;
  liked: string[]; // symbols
}

const CACHE_KEY = 'stockswiper-deck';

function todayStr(): string {
  const now = new Date();
  return now.toISOString().slice(0, 10);
}

function midnightMs(): number {
  const d = new Date();
  d.setHours(24, 0, 0, 0);
  return d.getTime();
}

@Injectable({ providedIn: 'root' })
export class DeckService {
  readonly deviceId = signal<string | null>(null);
  readonly deck = signal<StockItem[]>([]);
  readonly index = signal(0);
  readonly swipesRemaining = signal<number>(20);
  readonly liked = signal<string[]>([]);
  readonly ui = signal<UiState>('loading');
  readonly errorMessage = signal<string | null>(null);
  readonly countdownMs = signal<number>(midnightMs() - Date.now());

  readonly current = computed(() => this.deck()[this.index()] ?? null);

  constructor(private api: StockApiService, private queue: SwipeQueueService) {
    const platformId = inject(PLATFORM_ID);
    // Tick countdown every second
    if (typeof window !== 'undefined') {
      setInterval(() => this.countdownMs.set(Math.max(0, midnightMs() - Date.now())), 1000);
    }

    // Initialize/fix device id and load deck
    const firstId = generateDeviceId();
    if (firstId) this.deviceId.set(firstId);
    this.loadFromCacheOrFetch();

    // If SSR instantiated this service without window, ensure we set device id on the browser
    if (isPlatformBrowser(platformId)) {
      queueMicrotask(() => {
        if (!this.deviceId()) {
          const newId = generateDeviceId();
          if (newId) this.deviceId.set(newId);
          // kick a fetch in case we were waiting on deviceId
          if (this.ui() === 'loading') this.fetchDeck();
        }
      });
    }

    // Try flushing queued swipes periodically
    if (typeof window !== 'undefined') {
      setInterval(() => this.queue.flush(this.deviceId() ?? undefined), 5000);
    }

    // Persist cache on relevant changes
    effect(() => {
      const state: DeckCache = {
        date: todayStr(),
        deck: this.deck(),
        index: this.index(),
        liked: this.liked(),
      };
      this.writeCache(state);
    });
  }

  async init(): Promise<void> {
    // kept for API compatibility if needed by components
  }

  like() { return this.onSwipe(true); }
  dislike() { return this.onSwipe(false); }

  async onSwipe(liked: boolean) {
    const current = this.current();
    if (!current) return;

    // haptic feedback
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try { navigator.vibrate?.(liked ? 15 : 10); } catch {}
    }

    const deviceId = this.deviceId();
    if (!deviceId) {
      this.queue.enqueue(current.symbol, liked);
    } else {
      try {
        const remaining = await this.api.recordSwipe(deviceId, current.symbol, liked).toPromise();
        if (remaining != null) this.swipesRemaining.set(remaining);
      } catch (e: any) {
        if (e?.status === 429) {
          this.ui.set('limit');
          return;
        }
        // enqueue for retry if network/api error
        this.queue.enqueue(current.symbol, liked);
      }
    }

    // track locally
    if (liked) this.liked.update((arr) => Array.from(new Set([...arr, current.symbol])));

    // move ahead
    const nextIndex = this.index() + 1;
    const outOfCards = nextIndex >= this.deck().length;
    const outOfSwipes = this.swipesRemaining() <= 0;
    if (outOfCards || outOfSwipes) {
      this.ui.set('complete');
      this.index.set(nextIndex);
    } else {
      this.index.set(nextIndex);
      this.ui.set('ready');
    }
  }

  async reloadDeck() {
    this.ui.set('loading');
    await this.fetchDeck(true);
  }

  private loadFromCacheOrFetch() {
    const cache = this.readCache();
    if (cache && cache.date === todayStr() && cache.deck?.length) {
      this.deck.set(cache.deck);
      this.index.set(cache.index ?? 0);
      this.liked.set(cache.liked ?? []);
      this.ui.set('ready');
    } else {
      this.fetchDeck();
    }
  }

  private async fetchDeck(force = false) {
    let id = this.deviceId();
    if (!id) {
      const generated = generateDeviceId();
      if (generated) {
        this.deviceId.set(generated);
        id = generated;
      }
    }
    if (!id) {
      // no device id yet, retry shortly on the browser; on the server we wait for hydration
      if (typeof window !== 'undefined') {
        console.debug('[DeckService] deviceId missing; retrying fetch in 300ms');
        setTimeout(() => this.fetchDeck(force), 300);
      } else {
        console.debug('[DeckService] deviceId unavailable during SSR; waiting for client hydration');
      }
      return;
    }
    try {
      console.debug('[DeckService] fetching deck for device', id);
      const res = await this.api.getDeck(id).toPromise();
      if (res) {
        this.deck.set(res.deck);
        if (res.remaining != null) this.swipesRemaining.set(res.remaining);
        this.index.set(0);
        this.liked.set([]);
        this.ui.set('ready');
        console.debug('[DeckService] deck loaded:', res.deck.length, 'stocks');
      }
    } catch (e: any) {
      console.error('[DeckService] fetch deck failed', e);
      if (e?.status === 429) {
        this.ui.set('limit');
        return;
      }
      // fallback to cache if exists
      const cache = this.readCache();
      if (cache && cache.date === todayStr() && cache.deck?.length) {
        this.deck.set(cache.deck);
        this.index.set(cache.index ?? 0);
        this.liked.set(cache.liked ?? []);
        this.ui.set('ready');
      } else {
        this.ui.set('error');
        this.errorMessage.set('Failed to load stocks. Check your connection and try again.');
      }
    }
  }

  private readCache(): DeckCache | null {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      return raw ? (JSON.parse(raw) as DeckCache) : null;
    } catch {
      return null;
    }
  }

  private writeCache(cache: DeckCache) {
    if (typeof window === 'undefined') return;
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch {}
  }
}
