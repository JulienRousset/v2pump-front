// avatar.component.ts
import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { SvgAssetsService } from '../edit-avatar/services/svg.service';
import { WrapperShape, WidgetType, TopsShape, EyesShape, ClothesShape, EarShape, MouthShape, FaceShape, NoseShape, EarringsShape, BeardShape, GlassesShape, EyebrowsShape } from '../edit-avatar/models/enums';
import { AvatarOption } from '../edit-avatar/models/types';
import { EditAvatarComponent } from '../edit-avatar/edit-avatar.component';
import { AvatarService } from '../edit-avatar/services/avatar.service';
import { Observable } from 'rxjs';

@Component({
    selector: 'app-avatar',
    templateUrl: './avatar.component.html',
    styles: [`
     .avatar {
    display: inline-block;
    overflow: hidden;
    position: relative;
    line-height: 0; /* Évite les espaces blancs indésirables */
  }
  .avatar > div {
    width: 100%;
    height: 100%;
  }
  `]
})
export class AvatarComponent implements OnChanges {
    @Input() encodedAvatar: string = '';
    @Input() width: number = 100;
    @Input() height: number = 100;
    @Input() borderRadius: string = '0%';  // Par défaut circulaire
    @Input() noPadding = false;

    public svgContent: any;
    avatarSize: number = 50;

    constructor(
        private sanitizer: DomSanitizer,
        public avatarService: AvatarService,
        private svgAssetsService: SvgAssetsService,
    ) { }

    ngOnChanges(changes: SimpleChanges): void {
        if (changes['encodedAvatar'] || changes['width'] || changes['height']) {
            this.generateAvatar();
        }
    }

    async generateAvatar() {
        if (!this.encodedAvatar) {
            this.svgContent = this.sanitizer.bypassSecurityTrustHtml('');
            return;
        }
        const avatar = this.decompress(this.encodedAvatar);
        //@ts-ignore
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
                                baseGroup += currentElement + clothesPath.replace(/fill="[^"]*"/, `fill="${widget.fillColor}"`) + '</g>';
                            } else {
                                baseGroup += currentElement + `
                     <path 
                       d="${clothesPath}" 
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

                        case WidgetType.Nose:
                            const nosePath = await this.svgAssetsService.getNosePath(widget.shape as NoseShape).toPromise();
                            if (nosePath.includes('<path')) {
                                // Pour les chemins SVG complexes avec des attributs
                                let updatedPath = nosePath
                                    .replace(/\$fillColor/g, widget.fillColor || '#2C1810');
                                otherElements += currentElement + updatedPath + '</g>';
                            } else {
                                // Pour les chemins SVG simples
                                otherElements += currentElement + `
                              <path 
                                d="${nosePath}" 
                                fill="${widget.fillColor || '#2C1810'}"
                                stroke="none"
                              />
                            </g>`;
                            }
                            break;



                        default:
                            //@ts-ignore
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
           width="${this.width}" 
           height="${this.width}" 
         viewBox="0 0 400 400"
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
           <g transform=" ${this.noPadding ? 'translate(60, 65)' : 'translate(100, 65)'}">
           ${baseGroup}
           ${otherElements}
           </g>
         </svg>
       `;
    }

    private async generateWidgetGroups(avatar: AvatarOption): Promise<{ baseGroup: string, otherElements: string }> {
        let baseGroup = '';
        let otherElements = '';

        //@ts-ignore
        const sortedWidgets = Object.entries(avatar.widgets)
            //@ts-ignore
            .sort(([, a], [, b]) => a.zIndex - b.zIndex);

        for (const [type, widget] of sortedWidgets) {
            if (!widget || widget.shape === 'none') continue;

            try {
                const widgetType = type as WidgetType;
                const fillColor = widget.fillColor || this.getDefaultColor(widgetType);
                const path: any = await this.getSvgPathForType(widgetType, widget);

                const groupElement = `
                    <g id="widget-${type}" style="z-index: ${widget.zIndex}">
                   
                    ${this.createSvgElement(path, widget, fillColor, widgetType, avatar)}
                    </g>
                `;

                if (widgetType === WidgetType.Face || widgetType === WidgetType.Clothes) {
                    baseGroup += groupElement;
                } else {
                    otherElements += groupElement;
                }
            } catch (error) {
                console.error(`Erreur lors du chargement du SVG pour le widget ${type}:`, error);
            }
        }

        return { baseGroup, otherElements };
    }


    private getSvgPathForType(widgetType: WidgetType, widget: any): Observable<any> {
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


    private createSvgElement(path: string, widget: any, fillColor: string, widgetType: WidgetType, avatar: any): string {
        // Gestion spécifique pour certains widgets
        if (widgetType === WidgetType.Ear) {
            // Utiliser la même couleur que le visage
            fillColor = avatar.widgets.face?.fillColor || '#F8D9CE';
        }

        // Déterminer si l'élément doit être stroke ou fill
        const isStroked = true

        if (path.includes('<path') || path.includes('<circle') || path.includes('<ellipse')) {
            // Pour les éléments SVG complexes
            return this.updateSvgColors(path, fillColor, isStroked);
        } else {
            // Pour les chemins SVG simples
            return this.createPathElement(path, fillColor, isStroked);
        }
    }

    private updateSvgColors(svgContent: string, fillColor: string, isStroked: boolean): string {
        if (isStroked) {
            return svgContent
                .replace(/fill="[^"]*"/g, 'fill="none"')
                .replace(/stroke="[^"]*"/g, `stroke="${fillColor}"`)
                .replace(/stroke-width="[^"]*"/g, 'stroke-width="2"')
                .replace(/\$fillColor/g, fillColor);
        }
        return svgContent
            .replace(/fill="[^"]*"/g, `fill="${fillColor}"`)
            .replace(/\$fillColor/g, fillColor);
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
            WidgetType.Nose,
            WidgetType.Glasses
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

    private superDecompress(str: string): AvatarOption {
        const reverseValueMap: { [key: string]: string } = {
            'lg1': 'linear-gradient(62deg, #8EC5FC, #E0C3FC)',
            'sq': 'squircle',
            'dt': 'detached',
            'sp': 'surprised',
            'es': 'eyeshadow',
            'eu': 'eyelashesup',
            'ed': 'eyelashesdown',
            'cv': 'curve',
            'sc': 'scruff',
            'cl': 'clean',
            'op': 'open',
            'bs': 'base',
            'hp': 'hoop',
            'm': 'male'
        };

        const [main, widgets] = str.split('>');
        const [gender, wrapperShape, bgColor, borderColor] = main.split('|');

        const obj: AvatarOption = {
            //@ts-ignore
            gender: reverseValueMap[gender] || gender,
            wrapperShape: (reverseValueMap[wrapperShape] || wrapperShape) as WrapperShape,
            background: {
                color: reverseValueMap[bgColor] || bgColor,
                borderColor: borderColor
            },
            widgets: {}
        };

        // Table de correspondance améliorée
        if (widgets) {
            widgets.split(';').forEach(w => {
                const [key, shape, color, zIndex] = w.split(':');

                // Mappage des abréviations vers les types de widgets
                let widgetKey = '';
                let widgetShape = reverseValueMap[shape] || shape;

                switch (key) {
                    case 'f': widgetKey = 'face'; break;
                    case 'e':
                        // Gérer les cas spéciaux pour 'e'
                        if (shape === 'hp') {
                            widgetKey = 'earrings';
                            widgetShape = 'hoop';
                        } else if (shape === 'eyelashesdown') {
                            widgetKey = 'eyes';
                            widgetShape = 'eyelashesdown';
                        } else if (shape === 'es') {
                            widgetKey = 'eyes';
                            widgetShape = 'eyeshadow';
                        } else {
                            widgetKey = 'ear';
                        }
                        break;
                    case 'r': widgetKey = 'earrings'; break;
                    case 'b': widgetKey = 'eyebrows'; break;
                    case 'y': widgetKey = 'eyes'; break;
                    case 'n': widgetKey = 'nose'; break;
                    case 'g': widgetKey = 'glasses'; break;
                    case 'm': widgetKey = 'mouth'; break;
                    case 'd': widgetKey = 'beard'; break;
                    case 't': widgetKey = 'tops'; break;
                    case 'c': widgetKey = 'clothes'; break;
                    default: widgetKey = key;
                }

                // Conversion de la chaîne en enum
                //@ts-ignore
                const widgetType = WidgetType[widgetKey.charAt(0).toUpperCase() + widgetKey.slice(1)];

                //@ts-ignore
                obj.widgets[widgetType] = {
                    shape: widgetShape,
                    fillColor: color || '',
                    zIndex: parseInt(zIndex) || 0
                };
            });
        }

        return obj;
    }



    decompress(str: any) {
        const { m, d } = JSON.parse(str);

        // @ts-ignore
        const reverseKeyMap = Object.fromEntries(m.map(([k, v]) => [v, k]));

        // Fonction récursive pour décompresser
        function decompress(o: any) {
            if (typeof o !== 'object' || o === null) return o;

            const result: any = Array.isArray(o) ? [] : {};

            for (const [key, value] of Object.entries(o)) {
                const originalKey = reverseKeyMap[key] || key;

                // Décompression des couleurs hexadécimales courtes (#ABC -> #AABBCC)
                if (typeof value === 'string' && value.startsWith('#') && value.length === 4) {
                    result[originalKey] = '#' + value[1] + value[1] + value[2] + value[2] + value[3] + value[3];
                } else {
                    result[originalKey] = typeof value === 'object' ? decompress(value) : value;
                }
            }

            return result;
        }

        return decompress(d);
    }

    compress(obj: any) {
        // Mapping des clés longues vers des clés courtes
        const keyMap: any = {
            gender: 'g',
            wrapperShape: 'w',
            background: 'b',
            color: 'c',
            borderColor: 'bc',
            widgets: 'wd',
            face: 'f',
            shape: 's',
            fillColor: 'fc',
            zIndex: 'z',
            ear: 'e',
            earrings: 'er',
            eyebrows: 'eb',
            eyes: 'ey',
            nose: 'n',
            glasses: 'gl',
            mouth: 'm',
            beard: 'bd',
            tops: 't',
            clothes: 'cl'
        };

        // Fonction récursive pour parcourir l'objet
        function compressObj(obj: any) {
            if (typeof obj !== 'object' || obj === null) return obj;

            const compressed: any = {};
            for (let key in obj) {
                const newKey = keyMap[key] || key;
                compressed[newKey] = compressObj(obj[key]);
            }
            return compressed;
        }

        // Compression et conversion en string
        return JSON.stringify(compressObj(obj)).replace(/"/g, '');
    }

    superCompress(obj: any) {
        // Mapping des valeurs fréquentes
        const valueMap: any = {
            'linear-gradient(62deg, #8EC5FC, #E0C3FC)': 'lg1',
            'squircle': 'sq',
            'detached': 'dt',
            'surprised': 'sp',
            'eyeshadow': 'es',
            'eyelashesup': 'eu',
            'curve': 'cv',
            'square': 'sq',
            'scruff': 'sc',
            'clean': 'cl',
            'open': 'op',
            'base': 'bs',
            'hoop': 'hp',
            'male': 'm'
        };

        // Format: gender|wrapperShape|bgColor|borderColor|[widget:shape:color:zIndex;]...
        let result = [
            obj.gender,
            obj.wrapperShape,
            obj.background.color,
            obj.background.borderColor
        ].map(v => valueMap[v] || v).join('|');

        // Ajouter les widgets
        const widgets = Object.entries(obj.widgets)
            .map(([key, w]) => {
                const wa: any = w
                const shape = valueMap[wa.shape] || wa.shape;
                const color = wa.fillColor || '';
                return `${key[0]}:${shape}:${color}:${wa.zIndex}`;
            })
            .join(';');

        return result + '>' + widgets;
    }
}
