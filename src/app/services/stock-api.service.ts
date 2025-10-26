import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams, HttpResponse } from '@angular/common/http';
import { Observable, catchError, map, throwError } from 'rxjs';

export interface StockItem {
  symbol: string;
  name: string;
  sector: string;
  dividendYield: number;
  price: number;
  description: string;
  deckDate: string; // YYYY-MM-DD
}

export interface SwipeStatus {
  canSwipe: boolean;
  dailyLimit: number;
  remaining: number;
}

@Injectable({ providedIn: 'root' })
export class StockApiService {
  private readonly http = inject(HttpClient);
  private readonly base = '/api/stocks';

  getDeck(deviceId: string): Observable<{ deck: StockItem[]; remaining: number | null }>
  {
    return this.http.get<StockItem[]>(`${this.base}/deck`, {
      headers: { 'X-Device-Id': deviceId },
      observe: 'response'
    }).pipe(
      map((res: HttpResponse<StockItem[]>) => {
        const remainingHeader = res.headers.get('X-RateLimit-Remaining');
        const remaining = remainingHeader != null ? parseInt(remainingHeader, 10) : null;
        return { deck: res.body ?? [], remaining };
      }),
      catchError((err: HttpErrorResponse) => throwError(() => err))
    );
  }

  recordSwipe(deviceId: string, symbol: string, liked: boolean): Observable<number | null> {
    const params = new HttpParams().set('symbol', symbol).set('liked', String(liked));
    return this.http.post(`${this.base}/swipe`, null, {
      params,
      headers: { 'X-Device-Id': deviceId },
      observe: 'response'
    }).pipe(
      map((res) => {
        const remainingHeader = res.headers.get('X-RateLimit-Remaining');
        return remainingHeader != null ? parseInt(remainingHeader, 10) : null;
      }),
      catchError((err: HttpErrorResponse) => throwError(() => err))
    );
  }

  checkStatus(deviceId: string): Observable<SwipeStatus> {
    return this.http.get<SwipeStatus>(`${this.base}/swipe-status`, {
      headers: { 'X-Device-Id': deviceId }
    });
  }
}
