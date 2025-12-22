/**
 * Strixun Stream Suite - UI Utilities Module
 * 
 * Provides reusable UI components and utilities:
 * - SmartSearch: Search/filter functionality with highlighting
 * - CollapsibleCards: Collapsible card sections with state persistence
 * - SplitPanel: Resizable split panel for log area
 * 
 * @version 2.0.0 (TypeScript)
 */

import { storage } from './storage';

// ============ Types ============
interface SearchConfig {
  itemSelector: string;
  textSelector: string;
  minChars: number;
  debounceMs: number;
  onFilter: ((query: string, visible: number, total: number) => void) | null;
  showCount: boolean;
}

interface SearchInstance {
  inputEl: HTMLInputElement;
  containerEl: HTMLElement;
  config: SearchConfig;
  doSearch: () => void;
}

// ============ Smart Search Module ============
const SmartSearch = {
  instances: new Map<string, SearchInstance>(),
  
  /**
   * Create a search instance for a container
   */
  create(id: string, inputEl: HTMLInputElement, containerEl: HTMLElement, options: Partial<SearchConfig> = {}) {
    const config: SearchConfig = {
      itemSelector: options.itemSelector || '.source-item, .config-item, .script-card',
      textSelector: options.textSelector || '.name, .script-name, h3, h4',
      minChars: options.minChars || 1,
      debounceMs: options.debounceMs || 150,
      onFilter: options.onFilter || null,
      showCount: options.showCount !== false
    };
    
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    
    const doSearch = (): void => {
      const query = inputEl.value.toLowerCase().trim();
      const items = containerEl.querySelectorAll(config.itemSelector);
      let visibleCount = 0;
      const totalCount = items.length;
      
      items.forEach(item => {
        // Get text content from multiple possible selectors
        let text = '';
        if (config.textSelector) {
          const textEls = item.querySelectorAll(config.textSelector);
          textEls.forEach(el => text += ' ' + el.textContent);
        }
        text = text || item.textContent || '';
        text = text.toLowerCase();
        
        // Remove old highlights
        item.querySelectorAll('.search-highlight').forEach(h => {
          const parent = h.parentNode;
          if (parent) {
            parent.replaceChild(document.createTextNode(h.textContent || ''), h);
            parent.normalize();
          }
        });
        
        if (!query || query.length < config.minChars) {
          item.classList.remove('search-hidden');
          visibleCount++;
          return;
        }
        
        if (text.includes(query)) {
          item.classList.remove('search-hidden');
          visibleCount++;
          // Add highlights
          SmartSearch.highlightText(item as HTMLElement, query, config.textSelector);
        } else {
          item.classList.add('search-hidden');
        }
      });
      
      // Update count badge if enabled
      if (config.showCount && query.length >= config.minChars) {
        SmartSearch.updateCountBadge(inputEl, visibleCount, totalCount);
      } else {
        SmartSearch.removeCountBadge(inputEl);
      }
      
      // Show/hide no results message
      SmartSearch.updateNoResults(containerEl, visibleCount, query.length >= config.minChars);
      
      if (config.onFilter) config.onFilter(query, visibleCount, totalCount);
    };
    
    // Debounced search
    const onInput = (): void => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(doSearch, config.debounceMs);
    };
    
    inputEl.addEventListener('input', onInput);
    
    // Clear button support
    const clearBtn = inputEl.parentElement?.querySelector('.search-box__clear') as HTMLButtonElement | null;
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        inputEl.value = '';
        doSearch();
        inputEl.focus();
      });
    }
    
    SmartSearch.instances.set(id, { inputEl, containerEl, config, doSearch });
    return { doSearch, clear: () => { inputEl.value = ''; doSearch(); } };
  },
  
  highlightText(element: HTMLElement, query: string, textSelector: string): void {
    const textEls = textSelector ? element.querySelectorAll(textSelector) : [element];
    textEls.forEach(el => {
      if (el.children.length > 0) return; // Skip elements with children
      const text = el.textContent || '';
      const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
      if (regex.test(text)) {
        el.innerHTML = text.replace(regex, '<span class="search-highlight">$1</span>');
      }
    });
  },
  
  updateCountBadge(inputEl: HTMLInputElement, visible: number, total: number): void {
    let badge = inputEl.parentElement?.querySelector('.search-box__count') as HTMLElement | null;
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'search-box__count';
      const nextSibling = inputEl.nextSibling?.nextSibling;
      if (nextSibling && inputEl.parentElement) {
        inputEl.parentElement.insertBefore(badge, nextSibling);
      } else if (inputEl.parentElement) {
        inputEl.parentElement.appendChild(badge);
      }
    }
    badge.textContent = `${visible}/${total}`;
  },
  
  removeCountBadge(inputEl: HTMLInputElement): void {
    inputEl.parentElement?.querySelector('.search-box__count')?.remove();
  },
  
  updateNoResults(container: HTMLElement, count: number, isSearching: boolean): void {
    let msg = container.querySelector('.search-no-results') as HTMLElement | null;
    if (isSearching && count === 0) {
      if (!msg) {
        msg = document.createElement('div');
        msg.className = 'search-no-results';
        msg.textContent = 'No results found';
        container.appendChild(msg);
      }
    } else if (msg) {
      msg.remove();
    }
  },
  
  refresh(id: string): void {
    const instance = SmartSearch.instances.get(id);
    if (instance) instance.doSearch();
  }
};

/**
 * Helper to initialize search for a list container
 * Always initializes, but hides search box when < 3 items
 */
export function initSearchForList(id: string, inputId: string, containerEl: HTMLElement, itemCount: number): void {
  const searchInput = document.getElementById(inputId) as HTMLInputElement | null;
  if (!searchInput) return;
  
  const searchBox = searchInput.closest('.search-box') as HTMLElement | null;
  
  // Show/hide search box based on item count
  if (searchBox) {
    searchBox.style.display = itemCount >= 3 ? '' : 'none';
  }
  
  // Always initialize if not already done
  if (!SmartSearch.instances.has(id)) {
    SmartSearch.create(id, searchInput, containerEl, { 
      itemSelector: '.source-item, .config-item, .script-card' 
    });
    console.log(`[Search] Initialized search for: ${id}`);
  } else {
    // Refresh to re-scan items
    SmartSearch.refresh(id);
  }
}

// ============ Collapsible Cards Module ============
const CollapsibleCards = {
  storageKey: 'ui_collapsed_cards',
  
  init(): void {
    // Get saved state
    const savedState = (storage.get(this.storageKey) as Record<string, boolean>) || {};
    
    // Find all cards with h3 and make them collapsible
    document.querySelectorAll('.card > h3').forEach((h3, index) => {
      const card = h3.parentElement as HTMLElement;
      if (!card) return;
      
      const cardId = card.id || `card-${index}`;
      card.dataset.cardId = cardId;
      
      // Wrap content after h3 in card-body div
      const cardBody = document.createElement('div');
      cardBody.className = 'card-body';
      while (h3.nextSibling) {
        cardBody.appendChild(h3.nextSibling);
      }
      card.appendChild(cardBody);
      
      // Add collapsible class
      card.classList.add('collapsible');
      
      // Restore saved state
      if (savedState[cardId]) {
        card.classList.add('collapsed');
      }
      
      // Add click handler
      h3.addEventListener('click', (e) => {
        // Don't toggle if clicking a button inside h3
        if ((e.target as HTMLElement).tagName === 'BUTTON') return;
        
        card.classList.toggle('collapsed');
        CollapsibleCards.saveState();
      });
    });
  },
  
  saveState(): void {
    const state: Record<string, boolean> = {};
    document.querySelectorAll('.card.collapsible').forEach(card => {
      const cardEl = card as HTMLElement;
      if (cardEl.classList.contains('collapsed') && cardEl.dataset.cardId) {
        state[cardEl.dataset.cardId] = true;
      }
    });
    storage.set(this.storageKey, state);
  },
  
  expandAll(): void {
    document.querySelectorAll('.card.collapsible.collapsed').forEach(card => {
      card.classList.remove('collapsed');
    });
    CollapsibleCards.saveState();
  },
  
  collapseAll(): void {
    document.querySelectorAll('.card.collapsible').forEach(card => {
      card.classList.add('collapsed');
    });
    CollapsibleCards.saveState();
  }
};

// ============ Split Panel Module ============
const SplitPanel = {
  storageKey: 'ui_split_panel',
  minLogHeight: 40,
  maxLogHeight: 500,
  defaultLogHeight: 150,
  
  init(): void {
    const divider = document.getElementById('splitDivider');
    const logPanel = document.getElementById('splitLog');
    const logToggle = document.getElementById('logToggle');
    const logContent = document.getElementById('log');
    const mainContent = document.querySelector('.split-main');
    
    if (!divider || !logPanel) return;
    
    // Restore saved state
    const savedState = (storage.get(this.storageKey) as { height?: number; collapsed?: boolean }) || {};
    let logHeight = savedState.height || this.defaultLogHeight;
    let isCollapsed = savedState.collapsed || false;
    
    // Apply initial state
    if (isCollapsed) {
      logPanel.classList.add('collapsed');
      if (logToggle) logToggle.textContent = '▲';
      (logPanel as HTMLElement).style.height = ''; // Let CSS handle collapsed height
    } else {
      (logPanel as HTMLElement).style.height = logHeight + 'px';
    }
    
    // Toggle collapse
    if (logToggle) {
      logToggle.addEventListener('click', () => {
        isCollapsed = !isCollapsed;
        logPanel.classList.toggle('collapsed', isCollapsed);
        logToggle.textContent = isCollapsed ? '▲' : '▼';
        if (isCollapsed) {
          // Clear inline height so CSS auto-height takes over
          (logPanel as HTMLElement).style.height = '';
        } else {
          (logPanel as HTMLElement).style.height = logHeight + 'px';
        }
        SplitPanel.saveState(logHeight, isCollapsed);
      });
    }
    
    // Draggable divider
    let isDragging = false;
    let startY = 0;
    let startHeight = 0;
    
    divider.addEventListener('mousedown', (e) => {
      if (isCollapsed) return;
      isDragging = true;
      startY = e.clientY;
      startHeight = (logPanel as HTMLElement).offsetHeight;
      divider.classList.add('dragging');
      document.body.style.cursor = 'ns-resize';
      document.body.style.userSelect = 'none';
      e.preventDefault();
    });
    
    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const deltaY = startY - e.clientY;
      logHeight = Math.max(this.minLogHeight, Math.min(this.maxLogHeight, startHeight + deltaY));
      (logPanel as HTMLElement).style.height = logHeight + 'px';
    });
    
    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        divider.classList.remove('dragging');
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        SplitPanel.saveState(logHeight, isCollapsed);
      }
    });
    
    // Touch support for mobile
    divider.addEventListener('touchstart', (e) => {
      if (isCollapsed) return;
      isDragging = true;
      startY = e.touches[0].clientY;
      startHeight = (logPanel as HTMLElement).offsetHeight;
      divider.classList.add('dragging');
    }, { passive: true });
    
    document.addEventListener('touchmove', (e) => {
      if (!isDragging) return;
      const deltaY = startY - e.touches[0].clientY;
      logHeight = Math.max(this.minLogHeight, Math.min(this.maxLogHeight, startHeight + deltaY));
      (logPanel as HTMLElement).style.height = logHeight + 'px';
    }, { passive: true });
    
    document.addEventListener('touchend', () => {
      if (isDragging) {
        isDragging = false;
        divider.classList.remove('dragging');
        SplitPanel.saveState(logHeight, isCollapsed);
      }
    });
    
    // Initialize log search
    const logSearchInput = document.getElementById('logSearchInput') as HTMLInputElement | null;
    if (logSearchInput && logContent) {
      logSearchInput.addEventListener('input', () => {
        SplitPanel.filterLog(logSearchInput.value);
      });
      const logSearchClear = document.getElementById('logSearchClear');
      if (logSearchClear) {
        logSearchClear.addEventListener('click', () => {
          logSearchInput.value = '';
          SplitPanel.filterLog('');
          logSearchInput.focus();
        });
      }
    }
  },
  
  filterLog(query: string): void {
    const logEl = document.getElementById('log');
    if (!logEl) return;
    
    const entries = logEl.querySelectorAll('.log-entry');
    const q = query.toLowerCase().trim();
    
    entries.forEach(entry => {
      // Remove old highlights
      entry.querySelectorAll('.search-highlight').forEach(h => {
        const parent = h.parentNode;
        if (parent) {
          parent.replaceChild(document.createTextNode(h.textContent || ''), h);
          parent.normalize();
        }
      });
      
      if (!q) {
        entry.classList.remove('search-hidden');
        return;
      }
      
      const text = entry.textContent?.toLowerCase() || '';
      if (text.includes(q)) {
        entry.classList.remove('search-hidden');
        // Highlight matching text
        const textEl = entry.querySelector('.log-entry__text') as HTMLElement | null;
        if (textEl) {
          const regex = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
          textEl.innerHTML = textEl.textContent?.replace(regex, '<span class="search-highlight">$1</span>') || '';
        }
      } else {
        entry.classList.add('search-hidden');
      }
    });
  },
  
  saveState(height: number, collapsed: boolean): void {
    storage.set(this.storageKey, { height, collapsed });
  }
};

// ============ Exports ============
export const UIUtils = {
  SmartSearch,
  CollapsibleCards,
  SplitPanel,
  initSearchForList
};

// Expose to window for legacy compatibility
if (typeof window !== 'undefined') {
  (window as any).UIUtils = UIUtils;
}

