// captcha.service.ts
import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class CaptchaService {
  private wafToken: string | null = null;

  setWafToken(token: string) {
    this.wafToken = token;
    // Stockez le token dans un cookie
    document.cookie = `aws-waf-token=${token}; path=/`;
  }

  getWafToken(): string | null {
    if (!this.wafToken) {
      // Récupérer le token depuis les cookies
      const cookies = document.cookie.split(';');
      const wafCookie = cookies.find(c => c.trim().startsWith('aws-waf-token='));
      if (wafCookie) {
        this.wafToken = wafCookie.split('=')[1];
      }
    }
    return this.wafToken;
  }

  addWafTokenToHeaders(headers: any): any {
    const token = this.getWafToken();
    if (token) {
      return {
        ...headers,
        'x-aws-waf-token': token
      };
    }
    return headers;
  }
}
