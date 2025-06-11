// services/avatar.service.ts
import { Injectable } from '@angular/core';
import { 
  AvatarOption, 
  AvatarSettings, 
  WidgetMap,
  AvatarLayer
} from '../models/types';
import { 
  Gender, 
  WidgetType, 
  WrapperShape,
  FaceShape,
  TopsShape,
  EarShape,
  EyesShape,
  NoseShape,
  MouthShape,
  ClothesShape,
  BeardShape,
  GlassesShape,
  EarringsShape,
  EyebrowsShape
} from '../models/enums';

@Injectable({
  providedIn: 'root'
})
export class AvatarService {
  private readonly AVATAR_LAYER: any = {
    [WidgetType.Face]: { zIndex: 10 },
    [WidgetType.Ear]: { zIndex: 102 },
    [WidgetType.Earrings]: { zIndex: 103 },
    [WidgetType.Eyebrows]: { zIndex: 70 },
    [WidgetType.Eyes]: { zIndex: 50 },
    [WidgetType.Nose]: { zIndex: 60 },
    [WidgetType.Glasses]: { zIndex: 90 },
    [WidgetType.Mouth]: { zIndex: 105 },
    [WidgetType.Beard]: { zIndex: 100 },
    [WidgetType.Tops]: { zIndex: 100 },
    [WidgetType.Clothes]: { zIndex: 110 }
  };

  private readonly SETTINGS: AvatarSettings = {
    gender: [Gender.Male, Gender.Female],
    wrapperShape: Object.values(WrapperShape),
    faceShape: Object.values(FaceShape),
    topsShape: Object.values(TopsShape),
    earShape: Object.values(EarShape),
    earringsShape: Object.values(EarringsShape),
    eyebrowsShape: Object.values(EyebrowsShape),
    eyesShape: Object.values(EyesShape),
    noseShape: Object.values(NoseShape),
    glassesShape: Object.values(GlassesShape),
    mouthShape: Object.values(MouthShape),
    beardShape: Object.values(BeardShape),
    clothesShape: Object.values(ClothesShape),
    commonColors: [
      '#FF6B6B', // rouge corail pop
      '#FEC260', // orange chaud moderne
      '#9DF9EF', // menthe néon
      '#A66DD4', // violet vibrant
      '#00D26A', // vert crypto style succès
      '#FFD6E8', // rose pastel vaporwave
      '#92E3A9', // vert doux fun
      '#FF9CEE', // rose fluo acidulé
      '#6C5CE7', // indigo tech
      '#FFB86C', // pêche néon
      '#18A0FB', // bleu UI moderne
      '#FCE38A'  // jaune soft soleil
    ],    
    skinColors: [
      '#b7e3f9', '#e9f9ff',
      '#F8D9CE', '#F9C9B6', '#DEB3A3',
      '#C89583', '#9C6458'
    ],
    backgroundColor: [
      '#FF9CEE', '#9DF9EF', '#FFD6E8',
      'linear-gradient(45deg, #FF6B6B, #FEC260)',
      'linear-gradient(60deg, #8EC5FC, #E0C3FC)', // déjà existant
      'transparent'
    ],
    borderColor: [
      '#FF6B6B', '#FEC260', '#9DF9EF', 'transparent'
    ]    
  };

  getRandomValue<T>(array: T[], avoid: T[] = []): T {
    const filteredArray = array.filter(item => !avoid.includes(item));
    return filteredArray[Math.floor(Math.random() * filteredArray.length)];
  }

  getRandomColor(colors = this.SETTINGS.commonColors): string {
    return this.getRandomValue(colors);
  }

  generateRandomAvatar(): AvatarOption {
    const gender = this.getRandomValue(this.SETTINGS.gender);
    const wrapperShape = this.getRandomValue(this.SETTINGS.wrapperShape);
    const backgroundColor = this.getRandomValue(this.SETTINGS.backgroundColor);
    const borderColor = this.getRandomValue(this.SETTINGS.borderColor);
    const skinColor = this.getRandomValue(this.SETTINGS.skinColors);
  
    const widgets: Partial<WidgetMap> = {
      [WidgetType.Face]: {
        shape: FaceShape.Base,
        fillColor: skinColor,
        zIndex: 10
      },
      [WidgetType.Ear]: {
        shape: this.getRandomValue(this.SETTINGS.earShape),
        zIndex: 102
      },
      [WidgetType.Earrings]: {
        shape: this.getRandomValue(this.SETTINGS.earringsShape),
        zIndex: 103
      },
      [WidgetType.Eyebrows]: {
        shape: this.getRandomValue(this.SETTINGS.eyebrowsShape),
        zIndex: 70
      },
      [WidgetType.Eyes]: {
        shape: this.getRandomValue(this.SETTINGS.eyesShape),
        zIndex: 50
      },
      [WidgetType.Nose]: {
        shape: this.getRandomValue(this.SETTINGS.noseShape),
        zIndex: 60
      },
      [WidgetType.Glasses]: {
        shape: this.getRandomValue(this.SETTINGS.glassesShape),
        zIndex: 90
      },
      [WidgetType.Mouth]: {
        shape: this.getRandomValue(this.SETTINGS.mouthShape),
        zIndex: 105
      },
      [WidgetType.Beard]: {
        shape: BeardShape.Scruff,
        fillColor: this.getRandomColor(),
        zIndex: 100
      },
      [WidgetType.Tops]: {
        shape: gender === Gender.Male ? 
          this.getRandomValue([TopsShape.Clean, TopsShape.Funny]) : 
          this.getRandomValue([TopsShape.Danny, TopsShape.Caplogo]),
        fillColor: this.getRandomColor(),
        zIndex: 100
      },
      [WidgetType.Clothes]: {
        shape: this.getRandomValue(this.SETTINGS.clothesShape),
        fillColor: this.getRandomColor(),
        zIndex: 110
      }
    };
  
    // Gestion conditionnelle des widgets optionnels
    if (Math.random() > 0.7) {
      widgets[WidgetType.Glasses] = {
        shape: this.getRandomValue(this.SETTINGS.glassesShape.filter(shape => shape !== 'none')),
        zIndex: 90
      };
    }
  
    if (Math.random() > 0.7) {
      widgets[WidgetType.Earrings] = {
        shape: this.getRandomValue(this.SETTINGS.earringsShape.filter(shape => shape !== 'none')),
        zIndex: 103
      };
    }
  
    if (gender === Gender.Male && Math.random() > 0.7) {
      widgets[WidgetType.Beard] = {
        shape: BeardShape.Scruff,
        fillColor: widgets[WidgetType.Tops]?.fillColor,
        zIndex: 105
      };
    }
  
    return {
      gender,
      wrapperShape,
      background: {
        color: backgroundColor,
        borderColor: borderColor
      },
      widgets
    };
  }
  
  generateMultipleAvatars(count: number): AvatarOption[] {
    const avatars = new Set<string>();
    const results: AvatarOption[] = [];

    while (results.length < count) {
      const avatar = this.generateRandomAvatar();
      const avatarKey = JSON.stringify(avatar);
      
      if (!avatars.has(avatarKey)) {
        avatars.add(avatarKey);
        results.push(avatar);
      }
    }

    return results;
  }

  getWidgetZIndex(widgetType: WidgetType): number {
    return this.AVATAR_LAYER[widgetType]?.zIndex || 0;
  }

  // Dans AvatarService, ajoutez cette méthode
getSettings(): AvatarSettings {
  // Créer une copie profonde des paramètres pour éviter les modifications accidentelles
  return {
    gender: [...this.SETTINGS.gender],
    wrapperShape: [...this.SETTINGS.wrapperShape],
    faceShape: [...this.SETTINGS.faceShape],
    topsShape: [...this.SETTINGS.topsShape],
    earShape: [...this.SETTINGS.earShape],
    earringsShape: [...this.SETTINGS.earringsShape],
    eyebrowsShape: [...this.SETTINGS.eyebrowsShape],
    eyesShape: [...this.SETTINGS.eyesShape],
    noseShape: [...this.SETTINGS.noseShape],
    glassesShape: [...this.SETTINGS.glassesShape],
    mouthShape: [...this.SETTINGS.mouthShape],
    beardShape: [...this.SETTINGS.beardShape],
    clothesShape: [...this.SETTINGS.clothesShape],
    commonColors: [...this.SETTINGS.commonColors],
    skinColors: [...this.SETTINGS.skinColors],
    backgroundColor: [...this.SETTINGS.backgroundColor],
    borderColor: [...this.SETTINGS.borderColor]
  };
}

// Vous pouvez également ajouter ces méthodes utilitaires
getWidgetShapes(type: WidgetType): string[] {
  switch (type) {
    case WidgetType.Face:
      return this.SETTINGS.faceShape;
    case WidgetType.Ear:
      return this.SETTINGS.earShape;
    case WidgetType.Earrings:
      return this.SETTINGS.earringsShape;
    case WidgetType.Eyebrows:
      return this.SETTINGS.eyebrowsShape;
    case WidgetType.Eyes:
      return this.SETTINGS.eyesShape;
    case WidgetType.Nose:
      return this.SETTINGS.noseShape;
    case WidgetType.Glasses:
      return this.SETTINGS.glassesShape;
    case WidgetType.Tops:
      return this.SETTINGS.topsShape;
    case WidgetType.Mouth:
      return this.SETTINGS.mouthShape;
    case WidgetType.Beard:
      return this.SETTINGS.beardShape;
    case WidgetType.Clothes:
      return this.SETTINGS.clothesShape;
    default:
      return [];
  }
}

getColorsForWidget(type: WidgetType): string[] {
  switch (type) {
    case WidgetType.Face:
      return this.SETTINGS.skinColors;
    case WidgetType.Tops:
    case WidgetType.Clothes:
    case WidgetType.Beard:
      return this.SETTINGS.commonColors;
    default:
      return [];
  }
}

isColorableWidget(type: WidgetType): boolean {
  return [
    WidgetType.Face,
    WidgetType.Tops,
    WidgetType.Clothes,
    WidgetType.Beard
  ].includes(type);
}

getDefaultColor(type: WidgetType): string {
  switch (type) {
    case WidgetType.Face:
      return this.SETTINGS.skinColors[0];
    case WidgetType.Tops:
    case WidgetType.Clothes:
      return this.SETTINGS.commonColors[0];
    default:
      return '';
  }
}

// Méthode pour vérifier si un widget est optionnel
isOptionalWidget(type: WidgetType): boolean {
  return [
    WidgetType.Glasses,
    WidgetType.Earrings,
    WidgetType.Beard
  ].includes(type);
}

// Méthode pour obtenir les widgets disponibles par genre
getWidgetsByGender(gender: Gender): WidgetType[] {
  const commonWidgets = [
    WidgetType.Face,
    WidgetType.Tops,
    WidgetType.Ear,
    WidgetType.Eyes,
    WidgetType.Eyebrows,
    WidgetType.Nose,
    WidgetType.Mouth,
    WidgetType.Clothes,
    WidgetType.Glasses,
    WidgetType.Earrings
  ];

  if (gender === Gender.Male) {
    return [...commonWidgets, WidgetType.Beard];
  }

  return commonWidgets;
}

}
