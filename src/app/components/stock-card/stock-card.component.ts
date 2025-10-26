import { Component, EventEmitter, HostListener, Input, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StockItem } from '../../services/stock-api.service';

@Component({
  selector: 'app-stock-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './stock-card.component.html',
  styleUrls: ['./stock-card.component.scss']
})
export class StockCardComponent {
  @Input() stock!: StockItem;
  @Output() swipe = new EventEmitter<boolean>();

  // drag state
  dx = signal(0);
  dragging = signal(false);

  private startX = 0;

  onPointerDown(ev: PointerEvent) {
    (ev.target as HTMLElement).setPointerCapture(ev.pointerId);
    this.startX = ev.clientX;
    this.dragging.set(true);
  }

  onPointerMove(ev: PointerEvent) {
    if (!this.dragging()) return;
    this.dx.set(ev.clientX - this.startX);
  }

  onPointerUp(ev: PointerEvent) {
    if (!this.dragging()) return;
    this.dragging.set(false);
    const delta = this.dx();
    const threshold = 100;
    if (delta > threshold) {
      this.swipe.emit(true);
      this.dx.set(0);
    } else if (delta < -threshold) {
      this.swipe.emit(false);
      this.dx.set(0);
    } else {
      this.dx.set(0);
    }
  }

  like() { this.swipe.emit(true); }
  dislike() { this.swipe.emit(false); }

  get transform() {
    const d = this.dx();
    const rot = d / 20;
    return `translateX(${d}px) rotate(${rot}deg)`;
  }

  get likeOpacity() { return Math.max(0, Math.min(1, this.dx() / 120)); }
  get nopeOpacity() { return Math.max(0, Math.min(1, -this.dx() / 120)); }
}
