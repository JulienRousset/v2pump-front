// auto-resize-text.directive.ts
import { AfterViewInit, Directive, ElementRef, Input, OnChanges, NgZone, SimpleChanges } from '@angular/core';

@Directive({
  selector: '[appAutoResizeText]'
})
export class AutoResizeTextDirective implements AfterViewInit, OnChanges {
  @Input() maxFontSize: number = 16;
  @Input() minFontSize: number = 13;
  @Input() appAutoResizeText: string | any;
  
  private originalText: string = '';

  constructor(
    private el: ElementRef,
    private zone: NgZone
  ) {}

  ngAfterViewInit() {
    this.zone.runOutsideAngular(() => {
      setTimeout(() => {
        this.originalText = this.el.nativeElement.textContent || '';
        this.adjustTextSize();
      }, 50);
    });
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['appAutoResizeText']) {
      this.zone.runOutsideAngular(() => {
        setTimeout(() => {
          this.originalText = this.el.nativeElement.textContent || '';
          this.adjustTextSize();
        }, 50);
      });
    }
  }

  private adjustTextSize() {
    const element = this.el.nativeElement;
    const parent = element.parentElement;
    if (!parent) return;
    
    // Créer un élément de mesure "caché"
    const measure = document.createElement('span');
    measure.style.visibility = 'hidden';
    measure.style.position = 'absolute';
    measure.style.whiteSpace = 'nowrap'; // Force sur une seule ligne
    measure.style.fontSize = `${this.maxFontSize}px`;
    measure.innerText = this.originalText;
    
    // Ajouter l'élément de mesure au DOM
    document.body.appendChild(measure);
    
    // Calculer les dimensions
    const textWidth = measure.offsetWidth;
    const containerWidth = parent.clientWidth;
    
    // Supprimer l'élément de mesure
    document.body.removeChild(measure);
    
    // Réinitialiser la taille de police
    element.style.fontSize = `${this.maxFontSize}px`;
    
    // Si le texte est plus large que le conteneur, réduire la taille
    if (textWidth > containerWidth) {
      let currentSize = this.maxFontSize;
      const ratio = containerWidth / textWidth;
      
      // Calculer directement la taille idéale
      let idealSize = Math.floor(currentSize * ratio * 0.95); // 0.95 pour une marge de sécurité
      
      // Ne pas descendre sous la taille minimale
      idealSize = Math.max(idealSize, this.minFontSize);
      
      // Appliquer la nouvelle taille
      element.style.fontSize = `${idealSize}px`;
      
      // Si on veut être précis, on peut faire des ajustements fins
      setTimeout(() => {
        const lineHeight = parseInt(getComputedStyle(element).lineHeight, 10) || element.offsetHeight;
        if (element.offsetHeight > lineHeight * 1.2) { // Si hauteur > ~1 ligne
          this.reduceUntilSingleLine(element, idealSize);
        }
      }, 0);
    }
  }
  
  private reduceUntilSingleLine(element: HTMLElement, startSize: number) {
    let currentSize = startSize;
    const lineHeight = parseInt(getComputedStyle(element).lineHeight, 10) || element.offsetHeight;
    
    while (element.offsetHeight > lineHeight * 1.2 && currentSize > this.minFontSize) {
      currentSize -= 0.5;
      element.style.fontSize = `${currentSize}px`;
    }
  }
}
