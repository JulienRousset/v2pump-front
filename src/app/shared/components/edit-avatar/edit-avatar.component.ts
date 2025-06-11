// avatar.component.ts
import { Component, OnInit, ViewChild, ElementRef, EventEmitter, Output, Input } from '@angular/core';
import { BehaviorSubject, Observable, throwError, } from 'rxjs';
import { AvatarService } from './services/avatar.service';
import { AvatarOption } from './models/types';
import { WrapperShape, WidgetType, FaceShape } from './models/enums';
import html2canvas from 'html2canvas';
import { SvgAssetsService } from './services/svg.service';
import { BeardShape, ClothesShape, EarringsShape, EarShape, EyebrowsShape, EyesShape, GlassesShape, MouthShape, NoseShape, TopsShape } from "./models/enums";
import { HttpClient } from '@angular/common/http';
import { catchError, finalize } from 'rxjs/operators';

@Component({
  selector: 'app-edit-avatar',
  templateUrl: './edit-avatar.component.html',
  styleUrls: ['./edit-avatar.component.scss']
})
export class EditAvatarComponent implements OnInit {
  @ViewChild('avatarRef') avatarRef!: ElementRef;
  @Input() user: any;
  @Input() picture: any;
  public _isOpen = false;
  // Configuration
  avatarSize = 280;
  downloading = false;
  flipped = false;
  showConfig = false;
  svgContent = '';
  biography = '';

  username: string = 'kk';
  exists: any = false;
  checked: boolean = false;
  isLoading: boolean = false;
  isLoadingBio: boolean = false;


  bioStatus = {
    show: true,
    isSuccess: false,
    message: 'test'
  };

  @Input() set isOpen(value: boolean) {
    this._isOpen = value;
    if (!value) {
      setTimeout(() => {
        this.isOpenChange.emit(this._isOpen);
      }, 300);
    } else {
      this.isOpenChange.emit(this._isOpen);
    }
  }
  get isOpen(): boolean {
    return this._isOpen;
  }

  @Output() isOpenChange = new EventEmitter<boolean>();

  @Output() avatarUpdated = new EventEmitter<AvatarOption>();

  @Output() userUpdated = new EventEmitter<any>();

  // History Management
  private history: AvatarOption[] = [];
  private currentIndex = -1;

  canUndo = false;
  canRedo = false;

  // Avatar State
  private avatarOptionSubject = new BehaviorSubject<AvatarOption>(
    this.avatarService.generateRandomAvatar()
  );
  avatarOption$ = this.avatarOptionSubject.asObservable();

  get currentAvatar(): AvatarOption {
    return this.avatarOptionSubject.value;
  }

  constructor(
    private avatarService: AvatarService,
    public svgAssetsService: SvgAssetsService,
    private http: HttpClient
  ) { }

  ngOnInit() {
    console.log('picture', this.picture)
    console.log('user', this.user)
    console.log(this.avatarOptionSubject.value)
    if (typeof this.picture === 'string') {
      try {
        this.picture = JSON.parse(this.picture);
      } catch (e) {
        console.warn('Erreur de parsing JSON sur picture', e);
        this.picture = null;
      }
    }
    
    if (this.picture?.m && this.picture?.d) {
      const unpacked = this.unpackAvatar(this.picture);
      this.avatarOptionSubject.next(unpacked);
    } else {
      this.generateAvatar(); // fallback
    }
  
    
    this.username = this.user.name;
    this.biography = this.user.description;
    this.updateSize();
    if(!this.picture){
      this.generateAvatar();
    }
    this.avatarOption$.subscribe(() => {
      this.updateSvgContent();
    });
  }

  updateSize() {
    const isLargeScreen = window.innerWidth >= 1024; // Tailwind lg = 1024px
    this.avatarSize = isLargeScreen ? 280 : 180;
  }

  private unpackAvatar(packed: any): AvatarOption {
    if (!packed?.m || !Array.isArray(packed.m) || !packed.d) {
      console.warn('Invalid packed avatar format', packed);
      return {} as AvatarOption;
    }
  
    const mapArray: [string, string][] = packed.m;
    const data = packed.d;
  
    const shortToFull: { [key: string]: string } = {};
    for (const [full, short] of mapArray) {
      shortToFull[short] = full;
    }
  
    const unpacked: any = {};
  
    for (const shortKey in data) {
      const fullKey = shortToFull[shortKey];
      const value = data[shortKey];
  
      // Gestion spéciale pour les widgets
      if (shortKey === 'i') {
        const widgets: any = {};
        for (const widgetShortKey in value) {
          const widgetFullKey = shortToFull[widgetShortKey] || widgetShortKey;
          widgets[widgetFullKey] = {
            shape: value[widgetShortKey].s,
            fillColor: value[widgetShortKey].fc,
            zIndex: value[widgetShortKey].z,
          };
        }
        unpacked['widgets'] = widgets;
      }
  
      // Gestion spéciale pour background
      else if (shortKey === 'b') {
        unpacked['background'] = {
          color: value.c,
          borderColor: value.bc,
        };
      }
  
      // Autres cas simples
      else {
        unpacked[fullKey] = value;
      }
    }
  
    return unpacked;
  }
  
  
  

  saveBiography() {
    if (this.biography.length >= 60) {
      this.bioStatus.show = true;
      this.bioStatus.message = 'Description cannot exceed 60 characters';
      this.bioStatus.isSuccess = false;
      return
    };
    if (!this.username) {
      this.checked = true;
      this.exists = 'Username cannot be empty';
      return
    }
    if (!this.currentAvatar) {
      return
    };

    this.isLoading = true;
    this.isLoadingBio = true;
    this.bioStatus.show = false;

    // Remplace avec ton endpoint API
    this.http.post('http://127.0.0.1:3000/user/update', {
      description: this.biography,
      picture: this.currentAvatar,
      name: this.username
    }).pipe(
      finalize(() => {
        this.isLoadingBio = false;
        this.isLoading = false;
      })
    )
      .subscribe({
        next: (response: any) => {
          this.bioStatus.show = true;
          this.bioStatus.message = 'Profile updated successfully'
          this.bioStatus.isSuccess = true;
          this.exists = false;
          this.checked = true;
        },
        error: (error) => {
          if (error.status === 400) {
            this.bioStatus.show = true;
            this.bioStatus.message = error.error.message;
            this.bioStatus.isSuccess = false;
          } else {
            console.error('Error checking username:', error);
          }
          this.checked = true;
          this.isLoading = false;
        }
      });
  }

  closeModal() {
    this.isOpen = false;
    this.isOpenChange.emit(false);
    this.avatarUpdated.emit(this.avatarOptionSubject.value);
    let user = {
      description: this.biography,
      picture: this.currentAvatar,
      name: this.username
    }
    this.userUpdated.emit(user);
  }

  // Avatar Generation
  generateAvatar() {
    const newAvatar = this.avatarService.generateRandomAvatar();
    this.updateAvatarOption(newAvatar);
  }

  handleGenerate() {
    this.generateAvatar();
  }

  generateMultiple(count: number = 30) {
    const avatars = this.avatarService.generateMultipleAvatars(count);
  }

  // Avatar Manipulation
  handleFlip() {
    this.flipped = !this.flipped;
  }

  checkUsername() {
    if (this.username) {
      this.isLoading = true;
      this.checked = false;

      this.http.post(`http://127.0.0.1:3000/user/verify`, { name: this.username })
        .pipe(
          finalize(() => {
            this.isLoading = false;
          })
        )
        .subscribe({
          next: (response: any) => {
            if (response.error) {
              this.exists = response.message;
            } else {
              this.exists = false;
            }
            this.checked = true;
          },
          error: (error) => {
            if (error.status === 400) {
              this.exists = error.error.message; // Maintenant vous aurez accès à l'objet d'erreur complet
            } else {
              console.error('Error checking username:', error);
            }
            this.checked = true;
          }
        });
    }
  }


  updateAvatarOption(option: AvatarOption) {
    this.addToHistory(option);
    this.generateWidgetsSVG(option);
    this.avatarOptionSubject.next(option);
  }

  // History Management
  addToHistory(option: AvatarOption) {
    this.history = this.history.slice(0, this.currentIndex + 1);
    this.history.push(option);
    this.currentIndex = this.history.length - 1;
    this.updateHistoryState();
  }

  handleUndo() {
    if (this.canUndo) {
      this.currentIndex--;
      this.avatarOptionSubject.next(this.history[this.currentIndex]);
      this.updateHistoryState();
    }
  }

  handleRedo() {
    if (this.canRedo) {
      this.currentIndex++;
      this.avatarOptionSubject.next(this.history[this.currentIndex]);
      this.updateHistoryState();
    }
  }

  private updateHistoryState() {
    this.canUndo = this.currentIndex > 0;
    this.canRedo = this.currentIndex < this.history.length - 1;
  }

  // Download Management
  async handleDownload() {
    if (!this.avatarRef || this.downloading) return;

    this.downloading = true;
    try {
      const canvas = await html2canvas(this.avatarRef.nativeElement, {
        backgroundColor: null,
      });

      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = 'avatar.png';
      link.click();
    } catch (error) {
      console.error('Error downloading avatar:', error);
    } finally {
      setTimeout(() => {
        this.downloading = false;
      }, 800);
    }
  }

  // Styling
  getWrapperShapeStyle() {
    const shape = this.currentAvatar.wrapperShape;
    switch (shape) {
      case WrapperShape.Circle:
        return { borderRadius: '50%' };
      case WrapperShape.Square:
        return { borderRadius: '0' };
      case WrapperShape.Squircle:
        return { borderRadius: '25px' };
      default:
        return { borderRadius: '50%' };
    }
  }

  // SVG Generation
  private async updateSvgContent() {
    // Cette méthode devrait être implémentée pour générer le contenu SVG
    // basé sur les options d'avatar actuelles
    const avatar = this.currentAvatar;

    this.svgContent = await this.generateWidgetsSVG(avatar);
  }

  async generateWidgetsSVG(avatar: AvatarOption): Promise<string> {
    let svgContent = '';

    const sortedWidgets = Object.entries(avatar.widgets)
      .sort(([typeA, widgetA], [typeB, widgetB]) => {
        const zIndexA = widgetA?.zIndex ?? this.avatarService.getWidgetZIndex(typeA as WidgetType);
        const zIndexB = widgetB?.zIndex ?? this.avatarService.getWidgetZIndex(typeB as WidgetType);
        return zIndexA - zIndexB;
      });

    let baseGroup = '';
    let otherElements = '';

    for (const [type, widget] of sortedWidgets) {
      if (widget && widget.shape !== 'none') {
        const widgetType = type as WidgetType;
        const zIndex = widget.zIndex ?? this.avatarService.getWidgetZIndex(widgetType);
        const fillColor = widget.fillColor || this.getDefaultColor(widgetType);

        try {
          let currentElement = `<g id="widget-${type}" style="z-index: ${zIndex}">`;

          switch (widgetType) {
            case WidgetType.Face:
              const facePath = await this.svgAssetsService.getFacePath(widget.shape as FaceShape).toPromise();
              if (facePath.includes('<path')) {
                // Remplacer à la fois fill="$fillColor" et $fillColor
                let updatedPath = facePath
                  .replace(/\$fillColor/g, widget.fillColor || '#F8D9CE');
                baseGroup += currentElement + updatedPath + '</g>';
              } else {
                baseGroup += currentElement + `
                  <path 
                    d="${facePath}" 
                    fill="${widget.fillColor || '#F8D9CE'}"
                    stroke="none"
                  />
                </g>`;
              }
              break;

            case WidgetType.Tops:
              const topsPath = await this.svgAssetsService.getTopsPath(widget.shape as TopsShape).toPromise();
              if (topsPath.includes('<circle') || topsPath.includes('<ellipse')) {
                // Pour les formes SVG complètes (cercles ou ellipses)
                const updatedTopsPath = topsPath
                  //@ts-ignore
                  .replace(/currentColor/g, widget.fillColor)
                  //@ts-ignore

                  .replace(/\$fillColor/g, widget.fillColor);
                otherElements += currentElement + updatedTopsPath + '</g>';
              } else if (topsPath.includes('<path')) {
                // Pour les chemins SVG
                const updatedTopsPath = topsPath
                  //@ts-ignore
                  .replace(/\$fillColor/g, widget.fillColor);
                otherElements += currentElement + updatedTopsPath + '</g>';
              } else {
                // Pour les données de chemin brutes
                otherElements += currentElement + `
                <path 
                  d="${topsPath}" 
                  fill="${widget.fillColor}"
                  stroke="none"
                />
              </g>`;
              }
              break;


            case WidgetType.Eyes:
              const eyesPath = await this.svgAssetsService.getEyesPath(widget.shape as EyesShape).toPromise();
              if (eyesPath.includes('<circle') || eyesPath.includes('<ellipse')) {
                // Pour les formes SVG complètes (cercles ou ellipses)
                const updatedEyesPath = eyesPath
                  .replace(/currentColor/g, '#2C1810')
                  .replace(/\$fillColor/g, '#2C1810');
                otherElements += currentElement + updatedEyesPath + '</g>';
              } else if (eyesPath.includes('<path')) {
                // Pour les chemins SVG
                const updatedEyesPath = eyesPath
                  .replace(/\$fillColor/g, '#2C1810');
                otherElements += currentElement + updatedEyesPath + '</g>';
              } else {
                // Pour les données de chemin brutes
                otherElements += currentElement + `
                    <path 
                      d="${eyesPath}" 
                      fill="#2C1810"
                      stroke="none"
                    />
                  </g>`;
              }
              break;


              case WidgetType.Clothes:
                const clothesPath = await this.svgAssetsService.getClothesPath(widget.shape as ClothesShape).toPromise();
              
                if (clothesPath.includes('<path')) {
                  // Remplace tous les fill existants et ajoute un fill s'il est manquant
                  const updatedPaths = clothesPath
                    // Remplace tous les attributs fill="..." par le bon
                    .replace(/fill="[^"]*"/g, `fill="${widget.fillColor}"`)
                    // Ajoute fill si absent du path
                    .replace(/<path\b(?![^>]*fill=)/g, `<path fill="${widget.fillColor}"`);
              
                  baseGroup += currentElement + updatedPaths + '</g>';
                } else {
                  // Cas rare : un d seul, sans <path>
                  baseGroup += currentElement + `
                    <path 
                      d="${clothesPath}" 
                      fill="${widget.fillColor}"
                      stroke="none"
                    />
                  </g>`;
                }
                break;

                case WidgetType.Glasses:
                                    const glassesPath = await this.svgAssetsService.getGlassesPath(widget.shape as GlassesShape).toPromise();
                                  
                                    if (glassesPath.includes('<path')) {
                                      // Remplace tous les fill existants et ajoute un fill s'il est manquant
                                      const updatedPaths = glassesPath
                                        // Remplace tous les attributs fill="..." par le bon
                                        .replace(/fill="[^"]*"/g, `fill="${widget.fillColor}"`)
                                        // Ajoute fill si absent du path
                                        .replace(/<path\b(?![^>]*fill=)/g, `<path fill="${widget.fillColor}"`);
                                  
                                      baseGroup += currentElement + updatedPaths + '</g>';
                                    } else {
                                      // Cas rare : un d seul, sans <path>
                                      baseGroup += currentElement + `
                                        <path 
                                          d="${glassesPath}" 
                                          fill="${widget.fillColor}"
                                          stroke="none"
                                        />
                                      </g>`;
                                    }
                                    break;
              

            case WidgetType.Ear:
              const paths = await this.svgAssetsService.getEarPath(widget.shape as EarShape).toPromise();
              // Utiliser la même couleur que le visage
              const faceColor = avatar.widgets.face?.fillColor || '#F8D9CE';
              if (paths.includes('<path') || paths.includes('<circle')) {
                otherElements += currentElement + this.updateSvgColors(paths, faceColor, false) + '</g>';
              } else {
                otherElements += currentElement + this.createPathElement(paths, faceColor, false) + '</g>';
              }
              break;

            case WidgetType.Mouth:
              const mouthPath = await this.svgAssetsService.getMouthPath(widget.shape as MouthShape).toPromise();
              if (mouthPath.includes('<path')) {
                // Pour les chemins SVG complexes avec des attributs
                let updatedPath = mouthPath
                  .replace(/\$fillColor/g, widget.fillColor || '#2C1810');
                otherElements += currentElement + updatedPath + '</g>';
              } else {
                // Pour les chemins SVG simples
                otherElements += currentElement + `
                    <path 
                      d="${mouthPath}" 
                      fill="${widget.fillColor || '#2C1810'}"
                      stroke="none"
                    />
                  </g>`;
              }
              break;



            default:
              const path = await this.getSvgPathForType(widgetType, widget).toPromise();
              //@ts-ignore
              const colorToUse = widgetType === WidgetType.Ear
                ? (avatar.widgets.face?.fillColor || '#F8D9CE')
                : (widget.fillColor || this.getDefaultColor(widgetType));

              if (path.includes('<path') || path.includes('<circle')) {
                otherElements += currentElement + this.updateSvgColors(path, colorToUse, this.shouldBeStroked(widgetType)) + '</g>';
              } else {
                otherElements += currentElement + this.createPathElement(path, colorToUse, this.shouldBeStroked(widgetType)) + '</g>';
              }
              break;

          }
        } catch (error) {
          console.error(`Error loading SVG for widget ${type}:`, error);
        }
      }
    }

    return `
      <svg 
        width="${this.avatarSize}" 
        height="${this.avatarSize}" 
      viewBox="0 0 ${this.avatarSize / 0.7} ${this.avatarSize / 0.7}"
      preserveAspectRatio="xMidYMax meet"
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
        style="background: transparent;">
        <defs>
          <style>
            .widget { transition: all 0.2s ease; }
            .stroked { stroke-linecap: round; stroke-linejoin: round; }
          </style>
        </defs>
        <g transform="translate(100, 71)">
        ${baseGroup}
        ${otherElements}
        </g>
      </svg>
    `;
  }

  private updateSvgColors(svgContent: string, fillColor: string, isStroked: boolean): string {
    if (isStroked) {
      return svgContent
        .replace(/fill="[^"]*"/g, 'fill="none"')
        .replace(/stroke="[^"]*"/g, `stroke="${fillColor}"`)
        .replace(/stroke-width="[^"]*"/g, 'stroke-width="2"');
    }
    return svgContent.replace(/fill="[^"]*"/g, `fill="${fillColor}"`);
  }

  private createPathElement(pathData: string, fillColor: string, isStroked: boolean = false): string {
    const strokeAttributes = isStroked ? `
      fill="none"
      stroke="${fillColor}"
      stroke-width="2"
      stroke-linecap="round"
    ` : `
      fill="${fillColor}"
      stroke="none"
    `;

    return `
      <path 
        d="${pathData}"
        ${strokeAttributes}
      />
    `;
  }

  private shouldBeStroked(widgetType: WidgetType): boolean {
    return [
      WidgetType.Eyebrows,
      WidgetType.Nose
    ].includes(widgetType);
  }

  private getDefaultColor(widgetType: WidgetType): string {
    switch (widgetType) {
      case WidgetType.Face:
      case WidgetType.Ear: // Assurez-vous que l'oreille utilise la même couleur que le visage
        return '#F8D9CE';
      case WidgetType.Eyes:
      case WidgetType.Eyebrows:
      case WidgetType.Nose:
      case WidgetType.Mouth:
      case WidgetType.Glasses:
        return '#2C1810';
      default:
        return '#000000';
    }
  }


  private getSvgPathForType(widgetType: WidgetType, widget: any): Observable<string> {
    switch (widgetType) {
      case WidgetType.Tops:
        return this.svgAssetsService.getTopsPath(widget.shape as TopsShape);
      case WidgetType.Ear:
        return this.svgAssetsService.getEarPath(widget.shape as EarShape);
      case WidgetType.Earrings:
        return this.svgAssetsService.getEarringsPath(widget.shape as EarringsShape);
      case WidgetType.Eyes:
        return this.svgAssetsService.getEyesPath(widget.shape as EyesShape);
      case WidgetType.Eyebrows:
        return this.svgAssetsService.getEyebrowsPath(widget.shape as EyebrowsShape);
      case WidgetType.Nose:
        return this.svgAssetsService.getNosePath(widget.shape as NoseShape);
      case WidgetType.Mouth:
        return this.svgAssetsService.getMouthPath(widget.shape as MouthShape);
      case WidgetType.Beard:
        return this.svgAssetsService.getBeardPath(widget.shape as BeardShape);
      case WidgetType.Glasses:
        return this.svgAssetsService.getGlassesPath(widget.shape as GlassesShape);
      default:
        return new Observable(subscriber => subscriber.next(''));
    }
  }

  // Fonction pour compresser
  compress(obj: any) {
    // Schéma de mappage pour réduire la taille des clés
    const keyMap: any = {
      "gender": "g",
      "wrapperShape": "w",
      "background": "b",
      "widgets": "i",
      "color": "c",
      "borderColor": "bc",
      "face": "f",
      "ear": "e",
      "earrings": "er",
      "eyebrows": "eb",
      "eyes": "ey",
      "nose": "n",
      "glasses": "gl",
      "mouth": "m",
      "beard": "br",
      "tops": "t",
      "clothes": "cl",
      "shape": "s",
      "fillColor": "fc",
      "zIndex": "z"
    };

    // Fonction récursive pour compresser l'objet
    function compress(o: any) {
      if (typeof o !== 'object' || o === null) return o;

      const result: any = Array.isArray(o) ? [] : {};

      //@ts-ignore
      for (const [key, value]: [any, any] of Object.entries(o)) {
        const newKey = keyMap[key] || key;

        // Compression des couleurs hexadécimales (#AABBCC -> #ABC si possible)
        if (typeof value === 'string' && value.startsWith('#') && value.length === 7) {
          if (value[1] === value[2] && value[3] === value[4] && value[5] === value[6]) {
            result[newKey] = '#' + value[1] + value[3] + value[5];
          } else {
            result[newKey] = value;
          }
        } else {
          result[newKey] = typeof value === 'object' ? compress(value) : value;
        }
      }

      return result;
    }

    // Compresser l'objet et inclure le schéma pour permettre la décompression
    return JSON.stringify({
      m: Object.entries(keyMap),  // Le mappage de clés
      d: compress(obj)            // Les données compressées
    });
  }





}
