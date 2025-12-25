/**
 * Character Customization Types
 * 
 * Pixel editor-based character customization system
 */

// ================================
// Pixel Editor Types
// ================================

export interface PixelEditorConfig {
  canvasWidth: number;
  canvasHeight: number;
  pixelSize: number; // Size of each pixel (for zoom)
  gridEnabled: boolean;
  palette: ColorPalette;
  layers: PixelLayer[];
}

export interface PixelLayer {
  id: string;
  name: string;
  type: 'head' | 'torso' | 'arms' | 'legs' | 'accessory';
  visible: boolean;
  locked: boolean;
  opacity: number;
  pixels: PixelData; // Base64 encoded pixel data
}

export interface PixelData {
  width: number;
  height: number;
  data: string; // Base64 encoded image data
  format: 'png' | 'webp';
}

export interface ColorPalette {
  colors: string[]; // Hex colors
  selectedIndex: number;
  customColors: string[]; // User-defined colors
}

// ================================
// Character Appearance (Enhanced)
// ================================

export interface CharacterAppearance {
  // Base customization
  skinColor: string;
  bodyType: 'default' | 'slim' | 'bulky' | 'petite';
  height: number; // 0.8 - 1.2 scale
  
  // Head
  headShape: 'default' | 'rounded' | 'angular';
  hairStyle: string; // Asset ID or custom
  hairColor: string;
  
  // Face
  eyeStyle: string;
  eyeColor: string;
  mouthStyle: string;
  
  // Custom pixel art textures (subscription feature)
  customTextures?: {
    head?: PixelData;
    torso?: PixelData;
    arms?: PixelData;
    legs?: PixelData;
  };
  
  // Accessories (visual overlays)
  accessories: string[]; // Asset IDs
  
  // Equipment visualization
  equipmentVisualization?: EquipmentVisualization;
}

export interface EquipmentVisualization {
  weapon?: EquipmentSprite;
  armor?: {
    head?: EquipmentSprite;
    chest?: EquipmentSprite;
    legs?: EquipmentSprite;
    feet?: EquipmentSprite;
  };
  accessories?: EquipmentSprite[];
}

export interface EquipmentSprite {
  spriteId: string;
  offsetX: number;
  offsetY: number;
  scale: number;
  tint?: string; // Optional color tint
}

// ================================
// Pixel Editor Access Tiers
// ================================

export type PixelEditorAccess = 'none' | 'basic' | 'standard' | 'advanced' | 'pro';

export interface PixelEditorFeatures {
  access: PixelEditorAccess;
  maxLayers: number;
  maxCanvasSize: { width: number; height: number };
  customTextures: boolean;
  exportFormats: ('png' | 'webp' | 'svg')[];
  importFormats: ('png' | 'webp')[];
  advancedTools: boolean; // Layers, filters, etc.
  unlimitedColors: boolean;
}

export const PIXEL_EDITOR_FEATURES: Record<PixelEditorAccess, PixelEditorFeatures> = {
  none: {
    access: 'none',
    maxLayers: 0,
    maxCanvasSize: { width: 0, height: 0 },
    customTextures: false,
    exportFormats: [],
    importFormats: [],
    advancedTools: false,
    unlimitedColors: false
  },
  basic: {
    access: 'basic',
    maxLayers: 1,
    maxCanvasSize: { width: 32, height: 32 },
    customTextures: false,
    exportFormats: ['png'],
    importFormats: ['png'],
    advancedTools: false,
    unlimitedColors: false
  },
  standard: {
    access: 'standard',
    maxLayers: 2,
    maxCanvasSize: { width: 64, height: 64 },
    customTextures: true,
    exportFormats: ['png', 'webp'],
    importFormats: ['png', 'webp'],
    advancedTools: false,
    unlimitedColors: false
  },
  advanced: {
    access: 'advanced',
    maxLayers: 4,
    maxCanvasSize: { width: 128, height: 128 },
    customTextures: true,
    exportFormats: ['png', 'webp'],
    importFormats: ['png', 'webp'],
    advancedTools: true,
    unlimitedColors: true
  },
  pro: {
    access: 'pro',
    maxLayers: 8,
    maxCanvasSize: { width: 256, height: 256 },
    customTextures: true,
    exportFormats: ['png', 'webp', 'svg'],
    importFormats: ['png', 'webp'],
    advancedTools: true,
    unlimitedColors: true
  }
};

// ================================
// Character Customization Actions
// ================================

export interface SaveCustomizationInput {
  characterId: number;
  appearance: CharacterAppearance;
  customTextures?: {
    head?: PixelData;
    torso?: PixelData;
    arms?: PixelData;
    legs?: PixelData;
  };
}

export interface SaveCustomizationResult {
  success: boolean;
  appearance?: CharacterAppearance;
  error?: string;
}

// ================================
// Pixel Editor Tools
// ================================

export type PixelEditorTool = 
  | 'pencil'
  | 'eraser'
  | 'bucket'
  | 'eyedropper'
  | 'line'
  | 'rectangle'
  | 'circle'
  | 'select'
  | 'move';

export interface PixelEditorState {
  tool: PixelEditorTool;
  brushSize: number;
  selectedColor: string;
  selectedLayer: string | null;
  isDrawing: boolean;
  history: PixelEditorHistory[];
  historyIndex: number;
}

export interface PixelEditorHistory {
  timestamp: Date;
  action: string;
  layerId: string;
  pixels: PixelData;
}

// ================================
// Export/Import
// ================================

export interface ExportCharacterAppearance {
  appearance: CharacterAppearance;
  version: string;
  exportedAt: Date;
}

export interface ImportCharacterAppearance {
  appearance: CharacterAppearance;
  warnings?: string[];
}

