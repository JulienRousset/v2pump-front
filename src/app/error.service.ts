import { Injectable } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

@Injectable({
  providedIn: 'root'
})
export class ErrorService {
  constructor(private snackBar: MatSnackBar) {}

  handleError(error: any) {
    let message = 'Une erreur est survenue';

    if (error.status === 401) {
      message = 'Session expirée. Veuillez vous reconnecter.';
    } else if (error.status === 403) {
      message = 'Accès non autorisé';
    } else if (error.error?.message) {
      message = error.error.message;
    }

    this.snackBar.open(message, 'Fermer', {
      duration: 5000,
      horizontalPosition: 'center',
      verticalPosition: 'bottom',
    });

    return Promise.reject(error);
  }
}
