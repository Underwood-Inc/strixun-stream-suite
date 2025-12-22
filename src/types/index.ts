/**
 * Type definitions for Strixun Stream Suite
 */

// ============ Storage Types ============
export interface StorageBackup {
  version: number;
  timestamp: string;
  exportedCategories: string[];
  swapConfigs?: SwapConfig[];
  layoutPresets?: LayoutPreset[];
  textCyclerConfigs?: TextCyclerConfig[];
  ui_state?: Record<string, any>;
  connectionSettings?: {
    host?: string;
    port?: string;
  };
}

// ============ Swap Config Types ============
export interface SwapConfig {
  name: string;
  sourceA: string;
  sourceB: string;
  style?: string;
  duration?: number;
  easing?: string;
  preserveAspect?: boolean;
}

// ============ Layout Types ============
export interface LayoutPreset {
  id: string;
  name: string;
  scene: string;
  sources: LayoutSource[];
  timestamp: string;
}

export interface LayoutSource {
  sourceName: string;
  sceneItemId: number;
  positionX: number;
  positionY: number;
  width: number;
  height: number;
  rotation: number;
  visible: boolean;
}

// ============ Text Cycler Types ============
export interface TextCyclerConfig {
  id: string;
  name: string;
  mode: 'browser' | 'legacy';
  configId?: string;
  textSource?: string;
  textLines: string[];
  transition?: string;
  transDuration?: number;
  cycleDuration?: number;
  styles?: TextCyclerStyles;
  isRunning?: boolean;
  cycleIndex?: number;
}

export interface TextCyclerStyles {
  fontFamily?: string;
  fontSize?: string;
  fontWeight?: string;
  color?: string;
  textAlign?: string;
  letterSpacing?: string;
  lineHeight?: string;
  textTransform?: string;
  fontStyle?: string;
  shadow?: string;
  strokeWidth?: string;
  strokeColor?: string;
}

// ============ Source Types ============
export interface Source {
  sourceName: string;
  sceneItemId: number;
  inputKind?: string;
  sceneItemEnabled: boolean;
  transform?: SourceTransform;
}

export interface SourceTransform {
  positionX: number;
  positionY: number;
  width: number;
  height: number;
  rotation: number;
  sourceWidth?: number;
  sourceHeight?: number;
}

// ============ Connection Types ============
export interface ConnectionState {
  connected: boolean;
  currentScene: string;
  sources: Source[];
  textSources: Source[];
}

// ============ UI State Types ============
export interface UIState {
  swapStyle?: string;
  swapDuration?: number;
  swapEasing?: string;
  swapTempOverride?: string;
  textSource?: string;
  textLines?: string;
  textDuration?: number;
  textTransition?: string;
  transDuration?: number;
  swapSourceA?: string;
  swapSourceB?: string;
  swapNewSourceA?: string;
  swapNewSourceB?: string;
  visAnimType?: string;
  visAnimDuration?: number;
  visAnimEasing?: string;
  layoutDuration?: number;
  layoutEasing?: string;
  layoutStagger?: number;
  swapPreserveAspect?: boolean;
  swapDebugLogging?: boolean;
  layoutApplyVisibility?: boolean;
}

// ============ Module Dependencies ============
export interface ModuleDependencies {
  storage: any;
  log: (msg: string, type?: string) => void;
  connected: boolean;
  currentScene: string;
  sources: Source[];
  request?: (method: string, params?: any) => Promise<any>;
  isOBSDock?: () => boolean;
  showPage?: (id: string, save?: boolean) => void;
  initSearchForList?: (id: string, inputId: string, container: HTMLElement, count: number) => void;
}

