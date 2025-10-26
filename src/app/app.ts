import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StockCardComponent } from './components/stock-card/stock-card.component';
import { DeckService } from './services/deck.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, StockCardComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit {
  private readonly deck = inject(DeckService);

  // expose signals for template
  ui = this.deck.ui;
  current = this.deck.current;
  swipesRemaining = this.deck.swipesRemaining;
  liked = this.deck.liked;
  countdownMs = this.deck.countdownMs;
  deviceId = this.deck.deviceId;

  title = signal('StockSwiper');

  onSwipe(liked: boolean) {
    this.deck.onSwipe(liked);
  }

  reload() { this.deck.reloadDeck(); }

  get countdownDisplay() {
    const ms = this.countdownMs();
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600).toString().padStart(2, '0');
    const m = Math.floor((totalSec % 3600) / 60).toString().padStart(2, '0');
    const s = Math.floor(totalSec % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  }

  ngOnInit(): void {
    // Simple runtime breadcrumb
    console.log('[StockSwiper] App initialized', {
      hasDevice: !!this.deviceId(),
      state: this.ui(),
    });
  }
}
