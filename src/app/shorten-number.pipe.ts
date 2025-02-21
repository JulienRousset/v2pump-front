import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'shortenNumber'
})
export class ShortenNumberPipe implements PipeTransform {
  transform(value: number): string {
    if (value >= 1_000_000_000) {
      return (value / 1_000_000_000).toFixed(2) + 'B'; // Milliards
    } else if (value >= 1_000_000) {
      return (value / 1_000_000).toFixed(2) + 'M'; // Millions
    } else if (value >= 1_000) {
      return (value / 1_000).toFixed(2) + 'K'; // Milliers
    } else {
      return Number(value).toFixed(2) // Moins de 1K, pas besoin d'abrégation
    }
  }
}
