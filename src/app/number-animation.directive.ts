import { Directive, ElementRef, Input, OnChanges, SimpleChanges } from '@angular/core';

@Directive({
  selector: '[numberAnimation]'
})
export class NumberAnimationDirective implements OnChanges {
  @Input('numberAnimation') value: any;
  private previousValue: any;

  constructor(private el: ElementRef) {}

  ngOnChanges(changes: SimpleChanges) {
    if (changes['value'] && !changes['value'].firstChange) {
      // Vérifie si la valeur a réellement changé
      if (this.previousValue !== changes['value'].currentValue) {
        this.el.nativeElement.classList.remove('number-update');
        void this.el.nativeElement.offsetWidth; // Force reflow
        this.el.nativeElement.classList.add('number-update');
      }
    }
    this.previousValue = changes['value'].currentValue;
  }
}
