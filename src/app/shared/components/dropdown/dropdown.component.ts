// dropdown.component.ts
import { Component, ElementRef, EventEmitter, HostListener, Input, OnInit, Output, Renderer2, OnDestroy, ViewChild } from '@angular/core';

@Component({
  selector: 'app-dropdown',
  template: `
    <!-- Dropdown Container -->
    <div (click)="toggleDropdown($event)" id="dropdownContainer">
      <ng-content></ng-content>
    </div>
  `,
  styles: [`
    :host ::ng-deep .dropdown-portal {
      position: fixed;
      z-index: 1000;
    }
  `]
})
export class DropdownComponent implements OnInit, OnDestroy {
  @Input() options: any[] = [];
  @Output() optionSelected = new EventEmitter<any>();
  
  isOpen = false;
  selectedOption = 'Sélectionnez une option';
  private dropdownElement: HTMLElement | null = null;

  constructor(
    private elementRef: ElementRef,
    private renderer: Renderer2
  ) {}

  ngOnInit() {
    this.createDropdownElement();
  }

  ngOnDestroy() {
    this.removeDropdownElement();
  }

  private createDropdownElement() {
    // Créer l'élément dropdown
    this.dropdownElement = this.renderer.createElement('div');
    this.renderer.addClass(this.dropdownElement, 'dropdown-portal');
    this.renderer.addClass(this.dropdownElement, 'absolute');
    this.renderer.addClass(this.dropdownElement, 'z-10');
    this.renderer.addClass(this.dropdownElement, 'bg-white');
    this.renderer.addClass(this.dropdownElement, 'divide-y');
    this.renderer.addClass(this.dropdownElement, 'divide-gray-100');
    this.renderer.addClass(this.dropdownElement, 'rounded-lg');
    this.renderer.addClass(this.dropdownElement, 'shadow-lg');
    this.renderer.addClass(this.dropdownElement, 'w-44');
    this.renderer.addClass(this.dropdownElement, 'overflow-auto');
    this.renderer.addClass(this.dropdownElement, 'max-h-[130px]');
    this.renderer.addClass(this.dropdownElement, 'dark:bg-gray-700');
    this.renderer.addClass(this.dropdownElement, 'dark:divide-gray-600');
    
    // Créer la liste
    const ulElement = this.renderer.createElement('ul');
    this.renderer.addClass(ulElement, 'py-2');
    this.renderer.addClass(ulElement, 'text-sm');
    this.renderer.addClass(ulElement, 'text-gray-700');
    this.renderer.addClass(ulElement, 'dark:text-gray-200');

    // Ajouter les options
    this.options.forEach(option => {
      const liElement = this.renderer.createElement('li');
      const aElement = this.renderer.createElement('a');
      
      this.renderer.addClass(aElement, 'block');
      this.renderer.addClass(aElement, 'px-4');
      this.renderer.addClass(aElement, 'py-2');
      this.renderer.addClass(aElement, 'hover:bg-gray-100');
      this.renderer.addClass(aElement, 'dark:hover:bg-gray-600');
      this.renderer.addClass(aElement, 'dark:hover:text-white');
      this.renderer.addClass(aElement, 'cursor-pointer');
      
      this.renderer.setProperty(aElement, 'innerText', option.label || option);
      
      this.renderer.listen(aElement, 'click', () => {
        this.selectOption(option);
      });
      
      this.renderer.appendChild(liElement, aElement);
      this.renderer.appendChild(ulElement, liElement);
    });

    this.renderer.appendChild(this.dropdownElement, ulElement);
    this.renderer.appendChild(document.body, this.dropdownElement);
    this.renderer.setStyle(this.dropdownElement, 'display', 'none');
  }

  private removeDropdownElement() {
    if (this.dropdownElement && document.body.contains(this.dropdownElement)) {
      this.renderer.removeChild(document.body, this.dropdownElement);
    }
  }

  toggleDropdown(event: Event) {
    event.stopPropagation();
    this.isOpen = !this.isOpen;
    
    if (this.isOpen) {
      this.showDropdown();
    } else {
      this.hideDropdown();
    }
  }

  private showDropdown() {
    if (!this.dropdownElement) return;
  
    const triggerRect = this.elementRef.nativeElement.getBoundingClientRect();
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
    
    // Ajouter scrollTop à la position top
    this.renderer.setStyle(
      this.dropdownElement, 
      'top', 
      `${triggerRect.bottom + scrollTop}px`
    );
    
    // Ajouter scrollLeft à la position left si nécessaire
    this.renderer.setStyle(
      this.dropdownElement, 
      'left', 
      `${triggerRect.left + scrollLeft}px`
    );
    
    this.renderer.setStyle(this.dropdownElement, 'display', 'block');
  
    this.adjustDropdownPosition();
  }
  

  private hideDropdown() {
    if (this.dropdownElement) {
      this.renderer.setStyle(this.dropdownElement, 'display', 'none');
    }
  }

  private adjustDropdownPosition() {
    if (!this.dropdownElement) return;
  
    const dropdownRect = this.dropdownElement.getBoundingClientRect();
    const windowHeight = window.innerHeight;
    const windowWidth = window.innerWidth;
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
  
    if (dropdownRect.bottom > windowHeight + scrollTop) {
      const triggerRect = this.elementRef.nativeElement.getBoundingClientRect();
      this.renderer.setStyle(
        this.dropdownElement, 
        'top', 
        `${triggerRect.top + scrollTop - dropdownRect.height}px`
      );
    }
  
    if (dropdownRect.right > windowWidth + scrollLeft) {
      this.renderer.setStyle(
        this.dropdownElement, 
        'left', 
        `${windowWidth + scrollLeft - dropdownRect.width}px`
      );
    }
  }
  

  selectOption(option: any) {
    this.selectedOption = option;
    this.optionSelected.emit(option);
    this.isOpen = false;
    this.hideDropdown();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event) {
    if (!this.elementRef.nativeElement.contains(event.target) && 
        this.dropdownElement && 
        !this.dropdownElement.contains(event.target as Node)) {
      this.isOpen = false;
      this.hideDropdown();
    }
  }

  @HostListener('window:resize', ['$event'])
  onWindowChange() {
    if (this.isOpen) {
      this.hideDropdown();
    }
  }
}
