import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'shortenAddress'
})
export class ShortenAddressPipe implements PipeTransform {
  transform(address: string) {
    if (address) {
      return `${String(address).slice(0, 6)}`; // Exemple : x0434...34543
    }
    return address; // Si l'adresse est déjà courte, pas besoin de tronquer
  }
}
