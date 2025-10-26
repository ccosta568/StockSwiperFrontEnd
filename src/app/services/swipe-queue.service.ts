import { Injectable } from '@angular/core';
import { StockApiService } from './stock-api.service';

interface QueuedSwipe {
  symbol: string;
  liked: boolean;
  attempts: number;
  enqueuedAt: number;
}

const STORAGE_KEY = 'stockswiper-swipe-queue';

@Injectable({ providedIn: 'root' })
export class SwipeQueueService {
  private flushing = false;

  constructor(private api: StockApiService) {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.flush().catch(() => {}));
      // Attempt a flush shortly after app start
      setTimeout(() => this.flush().catch(() => {}), 2000);
    }
  }

  enqueue(symbol: string, liked: boolean) {
    if (typeof window === 'undefined') return;
    const queue = this.readQueue();
    queue.push({ symbol, liked, attempts: 0, enqueuedAt: Date.now() });
    this.writeQueue(queue);
  }

  async flush(deviceId?: string): Promise<void> {
    if (typeof window === 'undefined' || this.flushing || !navigator.onLine) return;
    this.flushing = true;
    try {
      let queue = this.readQueue();
      const next: QueuedSwipe[] = [];
      for (const item of queue) {
        const delay = Math.min(15000, 500 * Math.pow(2, item.attempts));
        if (item.attempts > 0) await this.sleep(delay);
        try {
          if (!deviceId) break; // need device to proceed
          await this.api.recordSwipe(deviceId, item.symbol, item.liked).toPromise();
        } catch {
          item.attempts += 1;
          next.push(item);
        }
      }
      this.writeQueue(next);
    } finally {
      this.flushing = false;
    }
  }

  hasPending(): boolean {
    if (typeof window === 'undefined') return false;
    return this.readQueue().length > 0;
  }

  private readQueue(): QueuedSwipe[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as QueuedSwipe[]) : [];
    } catch {
      return [];
    }
  }

  private writeQueue(queue: QueuedSwipe[]) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
    } catch {}
  }

  private sleep(ms: number) {
    return new Promise((res) => setTimeout(res, ms));
  }
}
