/**
 * Pixel Editor Core
 * 
 * Canvas-based pixel art editor for character customization
 */

// ================================
// Pixel Editor Types
// ================================

export interface PixelEditorState {
  canvas: HTMLCanvasElement | null;
  context: CanvasRenderingContext2D | null;
  width: number;
  height: number;
  pixelSize: number; // Zoom level
  gridEnabled: boolean;
  currentTool: PixelEditorTool;
  currentColor: string;
  palette: string[];
  layers: PixelLayer[];
  activeLayerIndex: number;
  history: PixelEditorHistory[];
  historyIndex: number;
}

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

export interface PixelLayer {
  id: string;
  name: string;
  type: 'head' | 'torso' | 'arms' | 'legs' | 'accessory';
  visible: boolean;
  locked: boolean;
  opacity: number;
  pixels: ImageData | null;
}

export interface PixelEditorHistory {
  timestamp: Date;
  action: string;
  layerId: string;
  pixels: ImageData;
}

// ================================
// Pixel Editor Class
// ================================

export class PixelEditor {
  private state: PixelEditorState;
  private isDrawing: boolean = false;
  private lastPoint: { x: number; y: number } | null = null;

  constructor(
    canvas: HTMLCanvasElement,
    width: number = 64,
    height: number = 64,
    pixelSize: number = 8
  ) {
    this.state = {
      canvas,
      context: canvas.getContext('2d', { willReadFrequently: true }),
      width,
      height,
      pixelSize,
      gridEnabled: true,
      currentTool: 'pencil',
      currentColor: '#000000',
      palette: this.getDefaultPalette(),
      layers: [this.createLayer('base', 'head')],
      activeLayerIndex: 0,
      history: [],
      historyIndex: -1
    };

    this.initializeCanvas();
    this.setupEventListeners();
  }

  /**
   * Initialize canvas
   */
  private initializeCanvas(): void {
    const { canvas, context, width, height, pixelSize } = this.state;
    if (!canvas || !context) return;

    canvas.width = width;
    canvas.height = height;
    canvas.style.width = `${width * pixelSize}px`;
    canvas.style.height = `${height * pixelSize}px`;
    canvas.style.imageRendering = 'pixelated';

    // Set up context for pixel art
    context.imageSmoothingEnabled = false;
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);

    this.drawGrid();
    this.render();
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    const { canvas } = this.state;
    if (!canvas) return;

    canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
    canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
    canvas.addEventListener('mouseup', this.handleMouseUp.bind(this));
    canvas.addEventListener('mouseleave', this.handleMouseLeave.bind(this));
  }

  /**
   * Handle mouse down
   */
  private handleMouseDown(e: MouseEvent): void {
    this.isDrawing = true;
    const point = this.getCanvasPoint(e);
    if (!point) return;

    this.lastPoint = point;
    this.applyTool(point);
  }

  /**
   * Handle mouse move
   */
  private handleMouseMove(e: MouseEvent): void {
    if (!this.isDrawing) return;

    const point = this.getCanvasPoint(e);
    if (!point || !this.lastPoint) return;

    switch (this.state.currentTool) {
      case 'pencil':
      case 'eraser':
        this.drawLine(this.lastPoint, point);
        break;
      case 'line':
      case 'rectangle':
      case 'circle':
        // Preview mode - will draw on mouse up
        break;
    }

    this.lastPoint = point;
  }

  /**
   * Handle mouse up
   */
  private handleMouseUp(e: MouseEvent): void {
    if (!this.isDrawing) return;

    const point = this.getCanvasPoint(e);
    if (!point || !this.lastPoint) return;

    switch (this.state.currentTool) {
      case 'line':
        this.drawLine(this.lastPoint, point);
        break;
      case 'rectangle':
        this.drawRectangle(this.lastPoint, point);
        break;
      case 'circle':
        this.drawCircle(this.lastPoint, point);
        break;
    }

    this.saveHistory();
    this.isDrawing = false;
    this.lastPoint = null;
  }

  /**
   * Handle mouse leave
   */
  private handleMouseLeave(): void {
    this.isDrawing = false;
    this.lastPoint = null;
  }

  /**
   * Get canvas coordinates from mouse event
   */
  private getCanvasPoint(e: MouseEvent): { x: number; y: number } | null {
    const { canvas, pixelSize } = this.state;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / pixelSize);
    const y = Math.floor((e.clientY - rect.top) / pixelSize);

    if (x < 0 || x >= this.state.width || y < 0 || y >= this.state.height) {
      return null;
    }

    return { x, y };
  }

  /**
   * Apply current tool at point
   */
  private applyTool(point: { x: number; y: number }): void {
    const { context, currentTool, currentColor } = this.state;
    if (!context) return;

    const activeLayer = this.getActiveLayer();
    if (!activeLayer || activeLayer.locked) return;

    switch (currentTool) {
      case 'pencil':
        this.setPixel(point.x, point.y, currentColor);
        break;
      case 'eraser':
        this.setPixel(point.x, point.y, '#ffffff');
        break;
      case 'bucket':
        this.fillArea(point.x, point.y, currentColor);
        break;
      case 'eyedropper':
        this.pickColor(point.x, point.y);
        break;
    }

    this.render();
  }

  /**
   * Set pixel at coordinates
   */
  private setPixel(x: number, y: number, color: string): void {
    const { context } = this.state;
    if (!context) return;

    context.fillStyle = color;
    context.fillRect(x, y, 1, 1);
    this.updateLayerPixels();
  }

  /**
   * Draw line between two points
   */
  private drawLine(start: { x: number; y: number }, end: { x: number; y: number }): void {
    const { currentTool, currentColor } = this.state;
    const color = currentTool === 'eraser' ? '#ffffff' : currentColor;

    const dx = Math.abs(end.x - start.x);
    const dy = Math.abs(end.y - start.y);
    const sx = start.x < end.x ? 1 : -1;
    const sy = start.y < end.y ? 1 : -1;
    let err = dx - dy;

    let x = start.x;
    let y = start.y;

    while (true) {
      this.setPixel(x, y, color);

      if (x === end.x && y === end.y) break;

      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        x += sx;
      }
      if (e2 < dx) {
        err += dx;
        y += sy;
      }
    }
  }

  /**
   * Draw rectangle
   */
  private drawRectangle(start: { x: number; y: number }, end: { x: number; y: number }): void {
    const { currentColor } = this.state;
    const minX = Math.min(start.x, end.x);
    const maxX = Math.max(start.x, end.x);
    const minY = Math.min(start.y, end.y);
    const maxY = Math.max(start.y, end.y);

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        this.setPixel(x, y, currentColor);
      }
    }
  }

  /**
   * Draw circle
   */
  private drawCircle(center: { x: number; y: number }, point: { x: number; y: number }): void {
    const { currentColor } = this.state;
    const radius = Math.sqrt(
      Math.pow(point.x - center.x, 2) + Math.pow(point.y - center.y, 2)
    );

    for (let x = 0; x < this.state.width; x++) {
      for (let y = 0; y < this.state.height; y++) {
        const dist = Math.sqrt(
          Math.pow(x - center.x, 2) + Math.pow(y - center.y, 2)
        );
        if (Math.abs(dist - radius) < 0.5) {
          this.setPixel(x, y, currentColor);
        }
      }
    }
  }

  /**
   * Fill area (bucket tool)
   */
  private fillArea(x: number, y: number, fillColor: string): void {
    const { context, width, height } = this.state;
    if (!context) return;

    const imageData = context.getImageData(0, 0, width, height);
    const targetColor = this.getPixelColor(imageData, x, y);

    if (targetColor === fillColor) return;

    const stack: Array<{ x: number; y: number }> = [{ x, y }];
    const visited = new Set<string>();

    while (stack.length > 0) {
      const point = stack.pop()!;
      const key = `${point.x},${point.y}`;

      if (visited.has(key)) continue;
      visited.add(key);

      if (point.x < 0 || point.x >= width || point.y < 0 || point.y >= height) continue;
      if (this.getPixelColor(imageData, point.x, point.y) !== targetColor) continue;

      this.setPixel(point.x, point.y, fillColor);

      stack.push(
        { x: point.x + 1, y: point.y },
        { x: point.x - 1, y: point.y },
        { x: point.x, y: point.y + 1 },
        { x: point.x, y: point.y - 1 }
      );
    }

    this.render();
  }

  /**
   * Pick color at point (eyedropper)
   */
  private pickColor(x: number, y: number): void {
    const { context } = this.state;
    if (!context) return;

    const imageData = context.getImageData(x, y, 1, 1);
    const r = imageData.data[0];
    const g = imageData.data[1];
    const b = imageData.data[2];
    const color = `#${[r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')}`;

    this.state.currentColor = color;
  }

  /**
   * Get pixel color from image data
   */
  private getPixelColor(imageData: ImageData, x: number, y: number): string {
    const index = (y * imageData.width + x) * 4;
    const r = imageData.data[index];
    const g = imageData.data[index + 1];
    const b = imageData.data[index + 2];
    return `#${[r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')}`;
  }

  /**
   * Draw grid
   */
  private drawGrid(): void {
    const { context, width, height, gridEnabled } = this.state;
    if (!context || !gridEnabled) return;

    context.strokeStyle = 'rgba(0, 0, 0, 0.1)';
    context.lineWidth = 0.5;

    for (let x = 0; x <= width; x++) {
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, height);
      context.stroke();
    }

    for (let y = 0; y <= height; y++) {
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(width, y);
      context.stroke();
    }
  }

  /**
   * Render all layers
   */
  private render(): void {
    const { context, width, height } = this.state;
    if (!context) return;

    // Clear canvas
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);

    // Draw all visible layers
    this.state.layers.forEach(layer => {
      if (!layer.visible || !layer.pixels) return;

      context.globalAlpha = layer.opacity;
      context.putImageData(layer.pixels, 0, 0);
    });

    context.globalAlpha = 1.0;
    this.drawGrid();
  }

  /**
   * Update layer pixels from canvas
   */
  private updateLayerPixels(): void {
    const { context, width, height } = this.state;
    if (!context) return;

    const activeLayer = this.getActiveLayer();
    if (!activeLayer) return;

    activeLayer.pixels = context.getImageData(0, 0, width, height);
  }

  /**
   * Get active layer
   */
  private getActiveLayer(): PixelLayer | null {
    return this.state.layers[this.state.activeLayerIndex] || null;
  }

  /**
   * Create new layer
   */
  createLayer(name: string, type: PixelLayer['type']): PixelLayer {
    return {
      id: `layer-${Date.now()}`,
      name,
      type,
      visible: true,
      locked: false,
      opacity: 1.0,
      pixels: null
    };
  }

  /**
   * Save to history
   */
  private saveHistory(): void {
    const activeLayer = this.getActiveLayer();
    if (!activeLayer || !activeLayer.pixels) return;

    // Remove any history after current index (for undo/redo)
    this.state.history = this.state.history.slice(0, this.state.historyIndex + 1);

    this.state.history.push({
      timestamp: new Date(),
      action: this.state.currentTool,
      layerId: activeLayer.id,
      pixels: new ImageData(
        new Uint8ClampedArray(activeLayer.pixels.data),
        activeLayer.pixels.width,
        activeLayer.pixels.height
      )
    });

    this.state.historyIndex = this.state.history.length - 1;
  }

  /**
   * Export as base64
   */
  exportAsBase64(format: 'png' | 'webp' = 'png'): string {
    const { canvas } = this.state;
    if (!canvas) return '';

    return canvas.toDataURL(`image/${format}`);
  }

  /**
   * Get default palette
   */
  private getDefaultPalette(): string[] {
    return [
      '#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff',
      '#ffff00', '#ff00ff', '#00ffff', '#808080', '#800000',
      '#008000', '#000080', '#808000', '#800080', '#008080',
      '#c0c0c0'
    ];
  }

  /**
   * Set tool
   */
  setTool(tool: PixelEditorTool): void {
    this.state.currentTool = tool;
  }

  /**
   * Set color
   */
  setColor(color: string): void {
    this.state.currentColor = color;
  }

  /**
   * Set pixel size (zoom)
   */
  setPixelSize(size: number): void {
    this.state.pixelSize = size;
    this.initializeCanvas();
  }

  /**
   * Toggle grid
   */
  toggleGrid(): void {
    this.state.gridEnabled = !this.state.gridEnabled;
    this.render();
  }

  /**
   * Undo
   */
  undo(): boolean {
    if (this.state.historyIndex <= 0) return false;

    this.state.historyIndex--;
    const history = this.state.history[this.state.historyIndex];
    const layer = this.state.layers.find(l => l.id === history.layerId);
    
    if (layer && this.state.context) {
      layer.pixels = new ImageData(
        new Uint8ClampedArray(history.pixels.data),
        history.pixels.width,
        history.pixels.height
      );
      this.render();
    }

    return true;
  }

  /**
   * Redo
   */
  redo(): boolean {
    if (this.state.historyIndex >= this.state.history.length - 1) return false;

    this.state.historyIndex++;
    const history = this.state.history[this.state.historyIndex];
    const layer = this.state.layers.find(l => l.id === history.layerId);
    
    if (layer && this.state.context) {
      layer.pixels = new ImageData(
        new Uint8ClampedArray(history.pixels.data),
        history.pixels.width,
        history.pixels.height
      );
      this.render();
    }

    return true;
  }
}

