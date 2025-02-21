import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, BehaviorSubject } from 'rxjs';
import { catchError, switchMap, filter, take } from 'rxjs/operators';
import { TokenService } from 'src/app/token.service';
import { ErrorService } from 'src/app/error.service';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  private isRefreshing = false;
  private refreshTokenSubject: BehaviorSubject<any> = new BehaviorSubject<any>(null);
  private readonly API_URL = 'http://127.0.0.1:3000/auth'; // Remplacer par l'URL de votre API

  constructor(
    private tokenService: TokenService,
    private errorService: ErrorService
  ) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const token = this.tokenService.getToken();

    if (token) {
      req = this.addAuthorizationHeader(req, token);
    }

    return next.handle(req).pipe(
      catchError(error => {
        if (error instanceof HttpErrorResponse) {
          if (error.status === 401) {
            return this.handle401Error(req, next);
          }
          // Gérer les autres erreurs HTTP
          if (error.status === 403) {
            // Gérer les erreurs d'autorisation
            this.tokenService.clearToken();
            // Rediriger vers la page de connexion ou afficher un message
          }
        }
        return this.handleSpecificErrors(error);
      })
    );
  }

  private addAuthorizationHeader(request: HttpRequest<any>, token: string): HttpRequest<any> {
    return request.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
  }

  private handle401Error(request: HttpRequest<any>, next: HttpHandler) {
    if (!this.isRefreshing) {
      this.isRefreshing = true;
      this.refreshTokenSubject.next(null);

      const token = this.tokenService.getToken();

      if (token) {
        return this.refreshToken().pipe(
          switchMap((response: any) => {
            this.isRefreshing = false;
            
            if (response.token) {
              this.tokenService.setToken(response.token);
              this.refreshTokenSubject.next(response.token);
              
              return next.handle(this.addAuthorizationHeader(request, response.token));
            } else {
              // Si pas de nouveau token, déconnecter l'utilisateur
              this.tokenService.clearToken();
              return throwError(() => new Error('Refresh token failed'));
            }
          }),
          catchError((error) => {
            this.isRefreshing = false;
            this.tokenService.clearToken();
            return throwError(() => error);
          })
        );
      }
    }

    return this.refreshTokenSubject.pipe(
      filter(token => token !== null),
      take(1),
      switchMap(token => next.handle(this.addAuthorizationHeader(request, token)))
    );
  }

  private refreshToken(): Observable<any> {
    return new Observable(observer => {
      const token = this.tokenService.getToken();
      
      fetch(`${this.API_URL}/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      })
      .then(response => {
        if (!response.ok) {
          throw new Error('Refresh token failed');
        }
        return response.json();
      })
      .then(data => {
        observer.next(data);
        observer.complete();
      })
      .catch(error => {
        observer.error(error);
      });
    });
  }

  // Méthode utilitaire pour vérifier si une route doit être exclue de l'interception
  private isPublicRoute(url: string): boolean {
    const publicRoutes = [
      '/api/nonce',
      '/api/verify-wallet'
      // Ajouter d'autres routes publiques si nécessaire
    ];
    return publicRoutes.some(route => url.includes(route));
  }

  // Méthode utilitaire pour gérer les erreurs spécifiques
  private handleSpecificErrors(error: HttpErrorResponse): Observable<never> {
    switch (error.status) {
      case 401:
        // Erreur d'authentification
        return throwError(() => new Error('Non autorisé'));
      case 403:
        // Erreur d'autorisation
        this.tokenService.clearToken();
        return throwError(() => new Error('Non autorisé'));
      case 404:
        // Ressource non trouvée
        return throwError(() => new Error('Ressource non trouvée'));
      case 500:
        // Erreur serveur
        return throwError(() => new Error('Erreur serveur'));
      default:
        return throwError(() => error);
    }
  }
}

// Ajoutez ces types si nécessaire
interface RefreshResponse {
  token: string;
  user?: {
    id: number;
    wallet_address: string;
    // autres propriétés utilisateur
  };
}
