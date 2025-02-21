import { Pipe, PipeTransform, NgZone, ChangeDetectorRef, OnDestroy } from '@angular/core';

@Pipe({
  name: 'timeAgo',
  pure: false // Important pour permettre les mises à jour
})
export class TimeAgoPipe implements PipeTransform, OnDestroy {
  private timer: number | null = null;
  private value: string | number | Date = '';
  private lastString = '';

  constructor(
    private changeDetectorRef: ChangeDetectorRef,
    private ngZone: NgZone
  ) {}

  transform(value: string | number | Date): string {
    if (!value) return '';

    this.value = value;
    
    // Nettoyer le timer précédent si il existe
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    const date = new Date(value);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const months = Math.floor(days / 30);
    const years = Math.floor(days / 365);

    // Configurer une mise à jour automatique seulement pour les secondes et minutes
    if (minutes < 60) {
      this.ngZone.runOutsideAngular(() => {
        this.timer = window.setInterval(() => {
          this.ngZone.run(() => this.changeDetectorRef.markForCheck());
        }, 1000); // Mise à jour toutes les secondes
      });
    }

    if (seconds < 60) {
      return `${seconds}s`;
    } else if (minutes < 60) {
      return `${minutes}m`;
    } else if (hours < 24) {
      return `${hours}h`;
    } else if (days < 30) {
      return `${days}d`;
    } else if (months < 12) {
      return `${months}month`;
    } else {
      return `${years}year`;
    }
  }

  ngOnDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
