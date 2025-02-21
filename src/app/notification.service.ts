import { Injectable } from '@angular/core';
import { NotifierService } from 'angular-notifier';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  constructor(private notifier: NotifierService) {}

  showSuccess(message: string) {
    this.notifier.notify('success', message);
  }

  showError(message: string) {
    this.notifier.notify('error', message);
  }

  showWarning(message: string) {
    this.notifier.notify('warning', message);
  }
}
