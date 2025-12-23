/**
 * Mermaid Node for Lexical
 * 
 * Custom Lexical node for rendering Mermaid diagrams
 */

import { DecoratorNode } from 'lexical';
import type { LexicalNode } from 'lexical';
import mermaid from 'mermaid';

// Type definitions for Lexical 0.38.x compatibility
type NodeKey = string;
type SerializedLexicalNode = {
  type: string;
  version: number;
};

export type SerializedMermaidNode = {
  diagram: string;
  type: 'mermaid';
  version: 1;
} & SerializedLexicalNode;

export class MermaidNode extends DecoratorNode<HTMLElement> {
  __diagram: string;

  static getType(): string {
    return 'mermaid';
  }

  static clone(node: MermaidNode): MermaidNode {
    return new MermaidNode(node.__diagram, node.__key);
  }

  constructor(diagram: string, key?: NodeKey) {
    super(key);
    this.__diagram = diagram;
  }

  createDOM(): HTMLElement {
    const div = document.createElement('div');
    div.className = 'mermaid-diagram';
    div.setAttribute('data-diagram', this.__diagram);
    return div;
  }

  updateDOM(prevNode: MermaidNode, dom: HTMLElement): boolean {
    if (prevNode.__diagram !== this.__diagram) {
      dom.setAttribute('data-diagram', this.__diagram);
      this.renderMermaid(dom);
    }
    return false;
  }

  static importJSON(serializedNode: SerializedMermaidNode): MermaidNode {
    const { diagram } = serializedNode;
    const node = $createMermaidNode(diagram);
    return node;
  }

  exportJSON(): SerializedMermaidNode {
    return {
      diagram: this.__diagram,
      type: 'mermaid',
      version: 1,
    };
  }

  getDiagram(): string {
    return this.__diagram;
  }

  setDiagram(diagram: string): void {
    const writable = this.getWritable();
    writable.__diagram = diagram;
  }

  decorate(): HTMLElement {
    const div = document.createElement('div');
    div.className = 'mermaid-diagram-container';
    
    // Render Mermaid asynchronously
    this.renderMermaid(div).catch(error => {
      console.error('[MermaidNode] Failed to render diagram:', error);
    });
    
    return div;
  }

  private async renderMermaid(container: HTMLElement): Promise<void> {
    try {
      // Clear container
      container.innerHTML = '';
      
      // Create a unique ID for this diagram
      const diagramId = `mermaid-${this.__key.replace(/[^a-zA-Z0-9]/g, '-')}-${Date.now()}`;
      
      // Create wrapper div
      const wrapper = document.createElement('div');
      wrapper.id = diagramId;
      wrapper.className = 'mermaid';
      wrapper.textContent = this.__diagram;
      container.appendChild(wrapper);
      
      // Initialize Mermaid if not already done
      if (!(window as any).mermaidInitialized) {
        mermaid.initialize({
          startOnLoad: true,
          theme: 'dark',
          securityLevel: 'loose',
        });
        (window as any).mermaidInitialized = true;
      }
      
      // Render the diagram
      await mermaid.run({
        nodes: [wrapper],
      });
    } catch (error) {
      console.error('[MermaidNode] Failed to render diagram:', error);
      container.innerHTML = `<div class="mermaid-error">Error rendering diagram: ${error}</div>`;
    }
  }
}

export function $createMermaidNode(diagram: string): MermaidNode {
  return new MermaidNode(diagram);
}

export function $isMermaidNode(node: LexicalNode | null | undefined): node is MermaidNode {
  return node instanceof MermaidNode;
}

