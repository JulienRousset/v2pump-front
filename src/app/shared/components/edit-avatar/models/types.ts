// models/types.ts
import {
    Gender,
    WidgetType,
    WrapperShape,
    FaceShape,
    TopsShape,
    EarShape,
    EarringsShape,
    EyebrowsShape,
    EyesShape,
    NoseShape,
    GlassesShape,
    MouthShape,
    BeardShape,
    ClothesShape,
    ActionType,
    MaskShape
  } from './enums';
  
  export type None = 'none';
  
  // Widget Shapes Union Type
  export type WidgetShape =
    | FaceShape
    | TopsShape
    | EarShape
    | EarringsShape
    | EyebrowsShape
    | EyesShape
    | NoseShape
    | GlassesShape
    | MouthShape
    | BeardShape
    | ClothesShape
    | MaskShape
    | None;
  
  // Base Widget Interface
  export interface Widget {
    shape: WidgetShape;
    fillColor?: string;
    zIndex?: number;
  }
  
  // Specific Widget Interfaces
  export interface FaceWidget extends Widget {
    shape: FaceShape;
    fillColor: string;
  }
  
  export interface TopsWidget extends Widget {
    shape: TopsShape;
    fillColor: string;
  }
  
  export interface EarWidget extends Widget {
    shape: EarShape;
  }
  
  export interface EarringsWidget extends Widget {
    shape: EarringsShape;
  }
  
  export interface EyebrowsWidget extends Widget {
    shape: EyebrowsShape;
  }
  
  export interface EyesWidget extends Widget {
    shape: EyesShape;
  }
  
  export interface NoseWidget extends Widget {
    shape: NoseShape;
  }
  
  export interface GlassesWidget extends Widget {
    shape: GlassesShape;
  }
  
  export interface MouthWidget extends Widget {
    shape: MouthShape;
  }
  
  export interface BeardWidget extends Widget {
    shape: BeardShape;
    fillColor?: string;
  }
  
  export interface ClothesWidget extends Widget {
    shape: ClothesShape;
    fillColor: string;
  }
  
  export interface MaskWidget extends Widget {
    shape: MaskShape;
    fillColor: string;
  }

  // Widget Map Type
  export type WidgetMap = {
    [WidgetType.Face]: FaceWidget;
    [WidgetType.Mask]: MaskWidget;
    [WidgetType.Tops]: TopsWidget;
    [WidgetType.Ear]: EarWidget;
    [WidgetType.Earrings]: EarringsWidget;
    [WidgetType.Eyebrows]: EyebrowsWidget;
    [WidgetType.Eyes]: EyesWidget;
    [WidgetType.Nose]: NoseWidget;
    [WidgetType.Glasses]: GlassesWidget;
    [WidgetType.Mouth]: MouthWidget;
    [WidgetType.Beard]: BeardWidget;
    [WidgetType.Clothes]: ClothesWidget;
  };
  
  // Background Interface
  export interface AvatarBackground {
    color: string;
    borderColor: string;
  }
  
  // Main Avatar Option Interface
  export interface AvatarOption {
    gender?: Gender;
    wrapperShape: WrapperShape;
    background: AvatarBackground;
    widgets: Partial<WidgetMap>;
  }
  
  // Settings Interface
  export interface AvatarSettings {
    gender: Gender[];
    wrapperShape: WrapperShape[];
    commonColors: string[];
    skinColors: string[];
    backgroundColor: string[];
    borderColor: string[];
    faceShape: FaceShape[];
    maskShape: MaskShape[];
    topsShape: TopsShape[];
    earShape: EarShape[];
    earringsShape: EarringsShape[];
    eyebrowsShape: EyebrowsShape[];
    eyesShape: EyesShape[];
    noseShape: NoseShape[];
    glassesShape: GlassesShape[];
    mouthShape: MouthShape[];
    beardShape: BeardShape[];
    clothesShape: ClothesShape[];
  }
  
  // Layer Configuration
  export interface AvatarLayer {
    //@ts-ignore
    [key in WidgetType]: {
      zIndex: number;
    };
  }
  
  // History State Interface
  export interface HistoryState {
    past: AvatarOption[];
    present: AvatarOption;
    future: AvatarOption[];
  }
  
  // Action Interfaces
  export interface Action {
    type: ActionType;
    payload?: any;
  }
  
  export interface UndoableAction extends Action {
    meta?: {
      undoable?: boolean;
      timestamp?: number;
    };
  }
  
  // Configuration Options
  export interface ConfigurationOption {
    title: string;
    type: WidgetType;
    options: WidgetShape[];
    colors?: string[];
  }
  
  // SVG Asset Interface
  export interface SVGAsset {
    id: string;
    content: string;
  }
  
  // Widget Preview Interface
  export interface WidgetPreview {
    widgetType: WidgetType;
    widgetShape: WidgetShape;
    svgRaw: string;
  }
  
  // Error Types
  export type AvatarError = {
    code: string;
    message: string;
    details?: any;
  };
  
  // Event Types
  export type AvatarEvent = {
    type: string;
    data?: any;
    timestamp: number;
  };
  
  // Utility Types
  export type DeepPartial<T> = {
    [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
  };
  
  export type WidgetTypeKey = keyof typeof WidgetType;
  export type ShapeType = keyof typeof WrapperShape;
  
  // State Management Types
  export type AvatarState = {
    currentAvatar: AvatarOption;
    history: HistoryState;
    config: {
      showPanel: boolean;
      activeSection: WidgetType | null;
    };
  };
  
  export type AvatarDispatch = {
    type: string;
    payload?: any;
  };
  
  // Component Props Types
  export interface AvatarComponentProps {
    initialOption?: AvatarOption;
    size?: number;
    showConfig?: boolean;
    onGenerate?: (option: AvatarOption) => void;
    onDownload?: (dataUrl: string) => void;
  }
  
  export interface ConfigPanelProps {
    currentAvatar: AvatarOption;
    onOptionChange: (option: AvatarOption) => void;
  }
  
  // Constants Types
  export type AvatarConstants = {
    readonly NONE: 'none';
    readonly TRIGGER_PROBABILITY: number;
    readonly DOWNLOAD_DELAY: number;
    readonly NOT_COMPATIBLE_AGENTS: readonly string[];
  };
  