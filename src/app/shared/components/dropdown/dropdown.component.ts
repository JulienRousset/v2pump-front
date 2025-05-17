import { 
  Component, 
  ElementRef, 
  EventEmitter, 
  HostListener, 
  Input, 
  OnInit, 
  Output, 
  OnDestroy, 
  ViewChild, 
  TemplateRef, 
  ViewContainerRef, 
  AfterViewInit,
  Renderer2
} from '@angular/core';

@Component({
  selector: 'app-dropdown',
  templateUrl: './dropdown.component.html',
})
export class DropdownComponent implements OnInit, AfterViewInit, OnDestroy {
  @Input() options: any[] = [];
  @Output() optionSelected = new EventEmitter<any>();
  @Input() set defaultSelected(value: any) {
    if (value !== undefined && value !== null) {
      this.selectedOption = value;
    }
  }
  
  @ViewChild('dropdownTemplate') dropdownTemplate!: TemplateRef<any>;
  
  isOpen = false;
  selectedOption: any = null;
  private portalHost: HTMLElement | null = null;
  private viewRef: any = null;

  constructor(
    private elementRef: ElementRef,
    private renderer: Renderer2,
    private viewContainerRef: ViewContainerRef
  ) {}

  ngOnInit() {
    // Créer l'élément hôte qui sera ajouté au document.body
    this.portalHost = this.renderer.createElement('div');
    this.renderer.addClass(this.portalHost, 'dropdown-portal');
    this.renderer.appendChild(document.body, this.portalHost);
  }

  ngAfterViewInit() {
    // Le template est maintenant disponible
  }

  ngOnDestroy() {
    // Nettoyer le portail lors de la destruction du composant
    if (this.viewRef) {
      this.viewRef.destroy();
    }
    
    if (this.portalHost && document.body.contains(this.portalHost)) {
      this.renderer.removeChild(document.body, this.portalHost);
    }
  }

  toggleDropdown(event: Event) {
    event.stopPropagation();
    this.isOpen = !this.isOpen;
    
    if (this.isOpen) {
      this.showDropdown();
    } else {
      this.hideDropdown();
      // Pas de réinitialisation de selectedOption ici
    }
  }

  private showDropdown() {
    if (!this.portalHost) return;

    // Détruire la vue précédente si elle existe
    if (this.viewRef) {
      this.viewRef.destroy();
      this.viewRef = null;
    }
    
    // Créer une nouvelle vue à partir du template
    this.viewRef = this.viewContainerRef.createEmbeddedView(this.dropdownTemplate);
    
    // Ajouter les éléments de la vue au portail
    this.viewRef.rootNodes.forEach((node: Node) => {
      this.renderer.appendChild(this.portalHost, node);
    });
    
    // Positionner le dropdown
    this.updateDropdownPosition();
    
    // Forcer la détection de changements
    this.viewRef.detectChanges();
  }

  private hideDropdown() {
    // Juste fermer visuellement sans affecter la sélection
    if (this.viewRef) {
      this.selectedOption = null;
      this.viewRef.destroy();
      this.viewRef = null;
    }
  }

  private updateDropdownPosition() {
    // Code de positionnement inchangé...
    if (!this.portalHost) return;
    
    const triggerRect = this.elementRef.nativeElement.getBoundingClientRect();
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
    
    this.renderer.setStyle(
      this.portalHost, 
      'position', 
      'absolute'
    );
    
    this.renderer.setStyle(
      this.portalHost, 
      'top', 
      `${triggerRect.bottom + scrollTop}px`
    );
    
    this.renderer.setStyle(
      this.portalHost, 
      'left', 
      `${triggerRect.left + scrollLeft}px`
    );
    
    this.adjustDropdownPosition();
  }

  private adjustDropdownPosition() {
    // Code d'ajustement inchangé...
    if (!this.portalHost) return;
    
    const dropdownRect = this.portalHost.getBoundingClientRect();
    const windowHeight = window.innerHeight;
    const windowWidth = window.innerWidth;
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
    
    if (dropdownRect.bottom > windowHeight) {
      const triggerRect = this.elementRef.nativeElement.getBoundingClientRect();
      this.renderer.setStyle(
        this.portalHost, 
        'top', 
        `${triggerRect.top + scrollTop - dropdownRect.height}px`
      );
    }
    
    if (dropdownRect.right > windowWidth) {
      this.renderer.setStyle(
        this.portalHost, 
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
    // La sélection est conservée
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event) {
    const clickedInsideTrigger = this.elementRef.nativeElement.contains(event.target as Node);
    const clickedInsideDropdown = this.portalHost?.contains(event.target as Node);
    
    if (!clickedInsideTrigger && !clickedInsideDropdown) {
      this.isOpen = false;
      this.hideDropdown();
      // Pas de réinitialisation de selectedOption ici
    }
  }

  @HostListener('window:resize')
  onWindowResize() {
    if (this.isOpen) {
      this.updateDropdownPosition();
    }
  }
}
