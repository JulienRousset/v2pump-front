import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'numberFormat'
})
export class NumberFormatPipe implements PipeTransform {
  transform(value: number): string {
    if (value === null || value === undefined) {
      return '';
    }

    // Convertit le nombre en string et retire les décimales s'il y en a
    const numberStr = Math.floor(value).toString();
    
    // Sépare les milliers avec des points
    return numberStr.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }
}
