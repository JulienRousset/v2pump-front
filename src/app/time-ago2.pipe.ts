import { ChangeDetectorRef, NgZone, Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'timeAgo2',
  pure: false // Important : mettre pure à false pour permettre la mise à jour
})
export class TimeAgo2Pipe implements PipeTransform {
  private timer: number | null = null;
  private lastValue: number = 0;
  private lastResult: string = '';

  constructor(
    private changeDetectorRef: ChangeDetectorRef,
    private ngZone: NgZone
  ) {}

  transform(timestamp: number): string {
    if (this.lastValue !== timestamp) {
      this.lastValue = timestamp;
      this.removeTimer();
      
      // Démarrer le timer en dehors de la zone Angular
      this.ngZone.runOutsideAngular(() => {
        this.timer = window.setInterval(() => {
          this.ngZone.run(() => {
            // Forcer la mise à jour du composant
            this.lastResult = this.calculateTimeAgo(timestamp);
            this.changeDetectorRef.markForCheck();
          });
        }, 1000);
      });
    }

    return this.calculateTimeAgo(timestamp);
  }

  private calculateTimeAgo(timestamp: number): string {
    const seconds = Math.floor((Date.now() - timestamp * 1000) / 1000);

    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  }

  ngOnDestroy() {
    this.removeTimer();
  }

  private removeTimer() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
