// avatar-config.component.ts
import { Component, Input, Output, EventEmitter } from '@angular/core';
import { AvatarOption, ConfigurationOption } from '../models/types';
import { FaceShape, MaskShape, WidgetType, WrapperShape } from '../models/enums';
import { AvatarService } from '../services/avatar.service';
import { SvgAssetsService } from '../services/svg.service';
import { BeardShape, ClothesShape, EarringsShape, EarShape, EyebrowsShape, EyesShape, GlassesShape, MouthShape, NoseShape, TopsShape } from "../models/enums";
import { BehaviorSubject, Observable, of } from 'rxjs';
import { DomSanitizer } from '@angular/platform-browser';
type ShapeTypeMap = {
  [WidgetType.Tops]: TopsShape;
  [WidgetType.Mask]: MaskShape;
  [WidgetType.Ear]: EarShape;
  [WidgetType.Earrings]: EarringsShape;
  [WidgetType.Glasses]: GlassesShape;
  // Ajoute les autres au besoin
};

@Component({
  selector: 'app-avatar-config',
  templateUrl: './avatar-config.component.html',
  styleUrls: ['./avatar-config.component.scss']
})
export class AvatarConfigComponent {
  @Input() currentAvatar!: AvatarOption;
  @Input() user: any;
  @Output() optionChange = new EventEmitter<AvatarOption>();

  wrapperShapes = Object.values(WrapperShape);
  backgroundColors: string[];
  borderColors: string[];
  configurations: ConfigurationOption[];

  

  private previewCache = new Map<string, BehaviorSubject<string>>();
  public shapePreviewMap$ = new Map<string, Observable<string>>();
  public defaultPreview$ = new BehaviorSubject<string>(this.getLoadingPreview());

  constructor(private avatarService: AvatarService, public svgAssetsService: SvgAssetsService, protected sanitizer: DomSanitizer) {
    const settings = this.avatarService.getSettings();
    this.backgroundColors = settings.backgroundColor;
    this.borderColors = settings.borderColor;

    this.configurations = [
      {
        title: 'Face',
        type: WidgetType.Face,
        options: settings.faceShape,
        colors: settings.skinColors,
      },
     //    {
     //      title: 'Eyes',
     //      type: WidgetType.Eyes,
     //      options: settings.eyesShape,
     //    },
     //    {
      //     title: 'Nose',
      //     type: WidgetType.Nose,
    //       options: settings.noseShape,
     //    },
     //    {
     //      title: 'Eyebrows',
   //        type: WidgetType.Eyebrows,
     //      options: settings.eyebrowsShape,
   //   },
      {
        title: 'Glasses',
        type: WidgetType.Glasses,
        options: settings.glassesShape,
        colors: settings.commonColors,
      },
      {
        title: 'Mask',
        type: WidgetType.Mask,
        options: settings.maskShape,
        colors: settings.commonColors,
      },
      {
        title: 'Hair',
        type: WidgetType.Tops,
        options: settings.topsShape,
        colors: settings.commonColors,
      },
  //    {
 //       title: 'Mouth',
 //       type: WidgetType.Mouth,
 //       options: settings.mouthShape,
 //     },
      {
        title: 'Ear',
        type: WidgetType.Ear,
        options: settings.earShape,
      },
      {
        title: 'Earrings',
        type: WidgetType.Earrings,
        options: settings.earringsShape,
      },
     // {
     //   title: 'Beard',
     //   type: WidgetType.Beard,
     //   options: settings.beardShape,
     //   colors: settings.commonColors,
     // },
      {
        title: 'Clothes',
        type: WidgetType.Clothes,
        options: settings.clothesShape,
        colors: settings.commonColors,
      }
    ];

  }

  ngOnInit() {
    this.configurations.forEach(config => {

      config.options.forEach(shape => {

        const cacheKey = `${config.type}-${shape}`;
        const preview$ = new BehaviorSubject<string>(this.getLoadingPreview());
        this.shapePreviewMap$.set(cacheKey, preview$.asObservable());

        this.generatePreview(config.type, shape).then(svg => {
          preview$.next(svg);
        }).catch(error => {
          preview$.next(this.getErrorPreview());
          console.error(`Error generating preview for ${config.type}:`, error);
        });
      });
    });
  }

  updateWrapperShape(shape: WrapperShape) {
    this.emitChange({
      ...this.currentAvatar,
      wrapperShape: shape
    });
  }

  updateBackgroundColor(color: string) {
    this.emitChange({
      ...this.currentAvatar,
      background: {
        ...this.currentAvatar.background,
        color
      }
    });
  }

  updateBorderColor(color: string) {
    this.emitChange({
      ...this.currentAvatar,
      background: {
        ...this.currentAvatar.background,
        borderColor: color
      }
    });
  }

  updateWidgetColor(type: WidgetType, color: string) {
    if (!this.currentAvatar.widgets[type]) return;

    this.emitChange({
      ...this.currentAvatar,
      widgets: {
        ...this.currentAvatar.widgets,
        [type]: {
          ...this.currentAvatar.widgets[type]!,
          fillColor: color
        }
      }
    });
  }
  
  clearWidgetShape<T extends keyof ShapeTypeMap>(
    widgets: Partial<Record<WidgetType, any>>,
    type: T,
    shape: ShapeTypeMap[T]
  ) {
    const current = widgets[type];
    return {
      ...current,
      shape
    };
  }

  safeUpdateShape(type: WidgetType, shape: string) {
    if (this.isShapeTypeKey(type)) {
      this.updateWidgetShape(type, shape as ShapeTypeMap[typeof type]);
    } else {
      this.updateGenericWidgetShape(type, shape);
    }
  }
  
  isShapeTypeKey(type: WidgetType): type is keyof ShapeTypeMap {
    return [
      WidgetType.Tops,
      WidgetType.Mask,
      WidgetType.Ear,
      WidgetType.Earrings,
      WidgetType.Glasses
    ].includes(type);
  }
  
  
  
  // Fallback générique pour les autres widgets (pas besoin de typage complexe)
  updateGenericWidgetShape(type: WidgetType, shape: string) {
    this.emitChange({
      ...this.currentAvatar,
      widgets: {
        ...this.currentAvatar.widgets,
        [type]: {
          ...this.currentAvatar.widgets[type]!,
          shape
        }
      }
    });
  }
  
  
  updateWidgetShape<T extends keyof ShapeTypeMap>(
    type: T,
    shape: ShapeTypeMap[T]
  ) {
  
    const updatedWidgets = {
      ...this.currentAvatar.widgets,
      [type]: {
        ...this.currentAvatar.widgets[type]!,
        shape
      }
    };
  
    // 1. mask ≠ none -> tops = none, glasses = none
    if (type === WidgetType.Mask && shape !== MaskShape.None) {
      updatedWidgets[WidgetType.Tops] = this.clearWidgetShape(
        updatedWidgets,
        WidgetType.Tops,
        TopsShape.None
      );
      updatedWidgets[WidgetType.Glasses] = this.clearWidgetShape(
        updatedWidgets,
        WidgetType.Glasses,
        GlassesShape.None
      );
    }
  
    // 2. tops ≠ none -> mask = none
    else if (type === WidgetType.Tops && shape !== TopsShape.None) {
      updatedWidgets[WidgetType.Mask] = this.clearWidgetShape(
        updatedWidgets,
        WidgetType.Mask,
        MaskShape.None
      );
    }
  
    // 3. glasses ≠ none -> mask = none
    else if (type === WidgetType.Glasses && shape !== GlassesShape.None) {
      updatedWidgets[WidgetType.Mask] = this.clearWidgetShape(
        updatedWidgets,
        WidgetType.Mask,
        MaskShape.None
      );
    }
  
    // 4. ear === none -> earrings = none
    if (type === WidgetType.Ear && shape === EarShape.None) {
      updatedWidgets[WidgetType.Earrings] = this.clearWidgetShape(
        updatedWidgets,
        WidgetType.Earrings,
        EarringsShape.None
      );
    }

    // 5. earrings ≠ none -> ear = attached
    if (type === WidgetType.Earrings && shape !== EarringsShape.None) {
      updatedWidgets[WidgetType.Ear] = this.clearWidgetShape(
        updatedWidgets,
        WidgetType.Ear,
        EarShape.Attached
      );
    }
  
    this.emitChange({
      ...this.currentAvatar,
      widgets: updatedWidgets
    });
  }
  
  
  
  
  
  

  getWidgetColor(type: WidgetType): string {
    return this.currentAvatar.widgets[type]?.fillColor || '';
  }

  isShapeSelected(type: WidgetType, shape: string): boolean {
    return this.currentAvatar.widgets[type]?.shape === shape;
  }


  getShapePreview(type: WidgetType, shape: string): Observable<string> {
    const cacheKey = `${type}-${shape}`;

    if (!this.previewCache.has(cacheKey)) {
      const subject = new BehaviorSubject<string>(this.getLoadingPreview());
      this.previewCache.set(cacheKey, subject);

      this.generatePreview(type, shape).then(svg => {
        if (this.previewCache.has(cacheKey)) {
          this.previewCache.get(cacheKey)?.next(svg);
        }
      }).catch(error => {
        if (this.previewCache.has(cacheKey)) {
          this.previewCache.get(cacheKey)?.next(this.getErrorPreview());
        }
        console.error(`Error generating preview for ${type}:`, error);
      });
    }
    //@ts-ignore
    return this.previewCache.get(cacheKey)?.asObservable() || of(this.getLoadingPreview());
  }


  private async generatePreview(type: WidgetType, shape: string): Promise<any> {
    const previewSize = 60;
    const viewBox = "0 0 300 300"; // Retour au viewBox original
    const color = this.getPreviewColor(type);

    // SVG de base avec attributs de centrage
    const svgBase = `
    <svg 
      width="${previewSize}" 
      height="${previewSize}" 
      viewBox="${viewBox}"
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      style="background: transparent; display: block; margin: auto;">
    `;

    try {
        // Si shape est "none", retourner une croix SVG centrée
        if (shape === 'none') {
            const crossSVG = `
              <path transform="translate(10, -15) scale(1.5)"
                d="M90 90 L110 110 M90 110 L110 90"
                stroke="currentColor"
                stroke-width="6"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            `;
            const content = this.createSvgContent(crossSVG, color || '#9CA3AF', '');
            return this.sanitizer.bypassSecurityTrustHtml(`${svgBase}${content}</svg>`);
        }

        let path = '';
        switch (type) {
            case WidgetType.Face:
                path = await this.svgAssetsService.getFacePath(shape as FaceShape, true).toPromise();
                break;
            case WidgetType.Tops:
                path = await this.svgAssetsService.getTopsPath(shape as TopsShape, true).toPromise();
                break;
            case WidgetType.Eyes:
                path = await this.svgAssetsService.getEyesPath(shape as EyesShape, true).toPromise();
                break;
            case WidgetType.Eyebrows:
                path = await this.svgAssetsService.getEyebrowsPath(shape as EyebrowsShape, true).toPromise();
                break;
            case WidgetType.Nose:
                path = await this.svgAssetsService.getNosePath(shape as NoseShape, true).toPromise();
                break;
            case WidgetType.Mouth:
                path = await this.svgAssetsService.getMouthPath(shape as MouthShape, true).toPromise();
                break;
            case WidgetType.Ear:
                path = await this.svgAssetsService.getEarPath(shape as EarShape, true).toPromise();
                break;
            case WidgetType.Clothes:
                path = await this.svgAssetsService.getClothesPath(shape as ClothesShape, true).toPromise();
                break;
            case WidgetType.Glasses:
                path = await this.svgAssetsService.getGlassesPath(shape as GlassesShape, true).toPromise();
                break;
            case WidgetType.Earrings:
                path = await this.svgAssetsService.getEarringsPath(shape as EarringsShape, true).toPromise();
                break;
            case WidgetType.Beard:
                path = await this.svgAssetsService.getBeardPath(shape as BeardShape, true).toPromise();
                break;
            case WidgetType.Mask:
                  path = await this.svgAssetsService.getMaskPath(shape as MaskShape, true).toPromise();
                break;
            default:
                path = '';
        }

        const transform = this.getTransformForType(type);
        const content = this.createSvgContent(path, color, transform);

        return this.sanitizer.bypassSecurityTrustHtml(`${svgBase}${content}</svg>`);
    } catch (error) {
        throw error;
    }
}

private getTransformForType(type: WidgetType): string {
  const transformations = {
      [WidgetType.Face]: 'translate(10, 10) scale(1)',  // Ajusté vers le bas
      [WidgetType.Mask]: 'translate(10, 10) scale(1)',  // Ajusté vers le bas
      [WidgetType.Tops]: 'translate(30, 15) scale(0.5)',  // Ajusté vers le haut
      [WidgetType.Eyes]: 'translate(40, 85) scale(1.3)',  // Plus bas pour aligner avec le visage
      [WidgetType.Eyebrows]: 'translate(-20, 70) scale(1.7)', // Ajusté en relation avec les yeux
      [WidgetType.Nose]: 'translate(80, 60) scale(2)', // Centré
      [WidgetType.Mouth]: 'translate(45, 60) scale(1.7)', // Centré
      [WidgetType.Ear]: 'translate(60, 60) scale(1.7)',  // Aligné avec les yeux
      [WidgetType.Clothes]: 'translate(10, 80) scale(0.7)', // Légèrement plus haut
      [WidgetType.Glasses]: 'translate(5, -20) scale(1.3)', // Aligné avec les yeux
      [WidgetType.Earrings]: 'translate(100, 70) scale(1.7)', // Aligné avec les oreilles
      [WidgetType.Beard]: 'translate(-50, -100) scale(2)', // Ajusté pour le menton
  };

  return transformations[type] || 'translate(40, 40) scale(0.6)';
}


private getPreviewColor(type: WidgetType): string {
    const previewColors = {
        [WidgetType.Face]: '#F8D9CE',
        [WidgetType.Tops]: '#506AF4',
        [WidgetType.Eyes]: '#2C1810',
        [WidgetType.Eyebrows]: '#2C1810',
        [WidgetType.Nose]: '#2C1810',
        [WidgetType.Mouth]: '#2C1810',
        [WidgetType.Clothes]: '#F4D150',
        [WidgetType.Glasses]: '#2C1810',
        [WidgetType.Earrings]: '#FFD700',
        [WidgetType.Beard]: '#506AF4',
        [WidgetType.Mask]: '#506AF4',
    };

    //@ts-ignore
    return previewColors[type] || '#000000';
}

private createSvgContent(path: string, color: string, transform: string): string {
    if (!path) return '';

    if (path.includes('<path') || path.includes('<circle') || path.includes('<ellipse')) {
        return `
            <g transform="${transform}">
                ${path}
            </g>
        `;
    } else {
        return `
            <g transform="${transform}">
                <path 
                    d="${path}" 
                    fill="${color}"
                    stroke="none"
                />
            </g>
        `;
    }
}




  private getLoadingPreview(): string {
    return `
    <svg width="60" height="60" viewBox="0 0 200 200">
      <rect width="100%" height="100%" fill="#f0f0f0"/>
      <text x="50%" y="50%" text-anchor="middle">Loading...</text>
    </svg>
  `;
  }

  private getErrorPreview(): string {
    return `
    <svg width="60" height="60" viewBox="0 0 200 200">
      <rect width="100%" height="100%" fill="#fee"/>
      <text x="50%" y="50%" text-anchor="middle" fill="red">Error</text>
    </svg>
  `;
  }


  private emitChange(newOption: AvatarOption) {
    this.optionChange.emit(newOption);
  }

  ngOnDestroy() {
    this.previewCache.forEach(subject => subject.complete());
    this.previewCache.clear();
    this.defaultPreview$.complete();
  }
}
