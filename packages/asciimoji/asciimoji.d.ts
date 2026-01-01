/**
 * ASCIImoji Type Definitions
 */

export interface AsciimojiConfig {
  selector?: string;
  observe?: boolean;
  transformOnInit?: boolean;
  patternRegex?: RegExp;
  excludeSelectors?: string[];
  transformAttributes?: boolean;
  onTransform?: (element: Node, originalText: string, transformedText: string) => void;
}

export declare class AsciimojiTransformer {
  constructor(config?: AsciimojiConfig);
  transform(): void;
  stopObserving(): void;
  destroy(): void;
  static init(config?: AsciimojiConfig): AsciimojiTransformer;
}

export declare function transformText(text: string): string;

export default AsciimojiTransformer;
