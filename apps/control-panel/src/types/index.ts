/**
 * Core TypeScript types for the Control Panel
 */

// ============ OBS Types ============

export interface OBSSource {
  sourceName: string;
  sceneItemId: number;
  sceneItemEnabled: boolean;
  inputKind?: string;
}

export interface OBSScene {
  sceneName: string;
  sceneIndex: number;
}

export interface OBSConnectionState {
  connected: boolean;
  connecting: boolean;
  host: string;
  port: string;
}

// ============ Config Types ============

export interface SwapConfig {
  id: string;
  name: string;
  sourceA: string;
  sourceB: string;
  preserveAspect: boolean;
  style: 'slide' | 'teleport' | 'scale' | 'bounce' | 'elastic' | 'arc';
  duration: number;
  easing: string;
}

export interface TextCyclerConfig {
  id: string;
  name: string;
  mode: 'browser' | 'legacy';
  configId?: string;
  lines: string[];
  transition: string;
  transitionDuration: number;
  cycleDuration: number;
  style: TextCyclerStyle;
}

export interface TextCyclerStyle {
  fontFamily: string;
  fontSize: string;
  fontWeight: string;
  color: string;
  textAlign: 'left' | 'center' | 'right';
  textShadow: string;
  letterSpacing: string;
  lineHeight: string;
  textTransform: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
  fontStyle: 'normal' | 'italic';
  strokeWidth: string;
  strokeColor: string;
}

export interface ClipsConfig {
  id: string;
  name: string;
  mainChannel: string;
  channels: string[];
  showFollowing: boolean;
  excludeChannels: string[];
  limit: number;
  dateRange: number;
  preferFeatured: boolean;
  showText: boolean;
  customText: string;
  showDetails: boolean;
  detailsText: string;
  theme: number;
  command: string;
  accessToken: string;
}

export interface OpacityConfig {
  [sourceName: string]: number;
}

// ============ UI State Types ============

export interface UIState {
  activePage: PageId;
  visAnimType: string;
  visAnimDuration: number;
  visAnimEasing: string;
}

export type PageId = 
  | 'dashboard' 
  | 'sources' 
  | 'text' 
  | 'clips' 
  | 'swaps' 
  | 'scripts' 
  | 'install' 
  | 'setup';

export interface LogEntry {
  id: string;
  message: string;
  type: 'info' | 'success' | 'error' | 'warning';
  timestamp: Date;
}

// ============ Component Props Types ============

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'success' | 'warning';
export type ButtonSize = 'sm' | 'md' | 'lg';

export type LoadingState = 'idle' | 'loading' | 'success' | 'error';

