// captcha.component.ts
import { Component, OnInit, ElementRef, ViewChild, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'app-captcha',
  template: `
    <div #captchaContainer></div>
  `
})
export class CaptchaComponent implements OnInit {
  @ViewChild('captchaContainer') captchaContainer!: ElementRef;
  @Output() onSuccess = new EventEmitter<string>();
  @Output() onError = new EventEmitter<any>();

  private isCaptchaInitialized = false;

  ngOnInit() {
    this.initCaptcha();
  }

  private async initCaptcha() {
    try {
      // Attendre que le SDK AWS WAF soit chargé
      await this.waitForAwsWaf();
      
      if (!this.isCaptchaInitialized && this.captchaContainer) {
        // Initialiser le captcha
        (window as any).AwsWafCaptcha.renderCaptcha(
          this.captchaContainer.nativeElement,
          {
            apiKey: 'VOTRE_CLE_API', // Remplacez par votre clé API
            onSuccess: (token: string) => {
              this.onSuccess.emit(token);
              this.isCaptchaInitialized = false;
            },
            onError: (error: any) => {
              this.onError.emit(error);
              this.isCaptchaInitialized = false; 
            }
          }
        );
        this.isCaptchaInitialized = true;
      }
    } catch (error) {
      console.error('Erreur lors de l\'initialisation du captcha:', error);
    }
  }

  private waitForAwsWaf(): Promise<boolean> {
    return new Promise((resolve) => {
      if ((window as any).AwsWafCaptcha) {
        resolve(true);
        return;
      }

      const checkInterval = setInterval(() => {
        if ((window as any).AwsWafCaptcha) {
          clearInterval(checkInterval);
          resolve(true);
        }
      }, 100);
    });
  }
}
