/**
 * Strixun Stream Suite - UI Utilities Module
 * 
 * Provides reusable UI components and utilities:
 * - SmartSearch: Search/filter functionality with highlighting
 * - CollapsibleCards: Collapsible card sections with state persistence
 * - SplitPanel: Resizable split panel for log area
 * 
 * @version 1.0.0
 */

// ============ Smart Search Module ============
const SmartSearch = {
    instances: new Map(),
    
    /**
     * Create a search instance for a container
     * @param {string} id - Unique identifier for this search
     * @param {HTMLElement} inputEl - The search input element
     * @param {HTMLElement} containerEl - The container with searchable items
     * @param {Object} options - Configuration options
     */
    create(id, inputEl, containerEl, options = {}) {
        const config = {
            itemSelector: options.itemSelector || '.source-item, .config-item, .script-card',
            textSelector: options.textSelector || '.name, .script-name, h3, h4',
            minChars: options.minChars || 1,
            debounceMs: options.debounceMs || 150,
            onFilter: options.onFilter || null,
            showCount: options.showCount !== false
        };
        
        let debounceTimer = null;
        
        const doSearch = () => {
            const query = inputEl.value.toLowerCase().trim();
            const items = containerEl.querySelectorAll(config.itemSelector);
            let visibleCount = 0;
            let totalCount = items.length;
            
            items.forEach(item => {
                // Get text content from multiple possible selectors
                let text = '';
                if (config.textSelector) {
                    const textEls = item.querySelectorAll(config.textSelector);
                    textEls.forEach(el => text += ' ' + el.textContent);
                }
                text = text || item.textContent;
                text = text.toLowerCase();
                
                // Remove old highlights
                item.querySelectorAll('.search-highlight').forEach(h => {
                    h.replaceWith(h.textContent);
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
                    SmartSearch.highlightText(item, query, config.textSelector);
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
        const onInput = () => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(doSearch, config.debounceMs);
        };
        
        inputEl.addEventListener('input', onInput);
        
        // Clear button support
        const clearBtn = inputEl.parentElement?.querySelector('.search-box__clear');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                inputEl.value = '';
                doSearch();
                inputEl.focus();
            });
        }
        
        this.instances.set(id, { inputEl, containerEl, config, doSearch });
        return { doSearch, clear: () => { inputEl.value = ''; doSearch(); } };
    },
    
    highlightText(element, query, textSelector) {
        const textEls = textSelector ? element.querySelectorAll(textSelector) : [element];
        textEls.forEach(el => {
            if (el.children.length > 0) return; // Skip elements with children
            const text = el.textContent;
            const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
            if (regex.test(text)) {
                el.innerHTML = text.replace(regex, '<span class="search-highlight">$1</span>');
            }
        });
    },
    
    updateCountBadge(inputEl, visible, total) {
        let badge = inputEl.parentElement?.querySelector('.search-box__count');
        if (!badge) {
            badge = document.createElement('span');
            badge.className = 'search-box__count';
            inputEl.parentElement?.insertBefore(badge, inputEl.nextSibling?.nextSibling);
        }
        badge.textContent = `${visible}/${total}`;
    },
    
    removeCountBadge(inputEl) {
        inputEl.parentElement?.querySelector('.search-box__count')?.remove();
    },
    
    updateNoResults(container, count, isSearching) {
        let msg = container.querySelector('.search-no-results');
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
    
    refresh(id) {
        const instance = this.instances.get(id);
        if (instance) instance.doSearch();
    }
};

/**
 * Helper to initialize search for a list container
 * Always initializes, but hides search box when < 3 items
 */
function initSearchForList(id, inputId, containerEl, itemCount) {
    const searchInput = document.getElementById(inputId);
    if (!searchInput) return;
    
    const searchBox = searchInput.closest('.search-box');
    
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
    
    init() {
        // Get saved state
        const savedState = storage.get(this.storageKey) || {};
        
        // Find all cards with h3 and make them collapsible
        document.querySelectorAll('.card > h3').forEach((h3, index) => {
            const card = h3.parentElement;
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
                if (e.target.tagName === 'BUTTON') return;
                
                card.classList.toggle('collapsed');
                this.saveState();
            });
        });
    },
    
    saveState() {
        const state = {};
        document.querySelectorAll('.card.collapsible').forEach(card => {
            if (card.classList.contains('collapsed')) {
                state[card.dataset.cardId] = true;
            }
        });
        storage.set(this.storageKey, state);
    },
    
    expandAll() {
        document.querySelectorAll('.card.collapsible.collapsed').forEach(card => {
            card.classList.remove('collapsed');
        });
        this.saveState();
    },
    
    collapseAll() {
        document.querySelectorAll('.card.collapsible').forEach(card => {
            card.classList.add('collapsed');
        });
        this.saveState();
    }
};

// ============ Split Panel Module ============
const SplitPanel = {
    storageKey: 'ui_split_panel',
    minLogHeight: 40,
    maxLogHeight: 500,
    defaultLogHeight: 150,
    
    init() {
        const divider = document.getElementById('splitDivider');
        const logPanel = document.getElementById('splitLog');
        const logToggle = document.getElementById('logToggle');
        const logContent = document.getElementById('log');
        const mainContent = document.querySelector('.split-main');
        
        if (!divider || !logPanel) return;
        
        // Restore saved state
        const savedState = storage.get(this.storageKey) || {};
        let logHeight = savedState.height || this.defaultLogHeight;
        let isCollapsed = savedState.collapsed || false;
        
        // Apply initial state
        if (isCollapsed) {
            logPanel.classList.add('collapsed');
            logToggle.textContent = '▲';
            logPanel.style.height = ''; // Let CSS handle collapsed height
        } else {
            logPanel.style.height = logHeight + 'px';
        }
        
        // Toggle collapse
        logToggle.addEventListener('click', () => {
            isCollapsed = !isCollapsed;
            logPanel.classList.toggle('collapsed', isCollapsed);
            logToggle.textContent = isCollapsed ? '▲' : '▼';
            if (isCollapsed) {
                // Clear inline height so CSS auto-height takes over
                logPanel.style.height = '';
            } else {
                logPanel.style.height = logHeight + 'px';
            }
            this.saveState(logHeight, isCollapsed);
        });
        
        // Draggable divider
        let isDragging = false;
        let startY = 0;
        let startHeight = 0;
        
        divider.addEventListener('mousedown', (e) => {
            if (isCollapsed) return;
            isDragging = true;
            startY = e.clientY;
            startHeight = logPanel.offsetHeight;
            divider.classList.add('dragging');
            document.body.style.cursor = 'ns-resize';
            document.body.style.userSelect = 'none';
            e.preventDefault();
        });
        
        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            const deltaY = startY - e.clientY;
            logHeight = Math.max(this.minLogHeight, Math.min(this.maxLogHeight, startHeight + deltaY));
            logPanel.style.height = logHeight + 'px';
        });
        
        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                divider.classList.remove('dragging');
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
                this.saveState(logHeight, isCollapsed);
            }
        });
        
        // Touch support for mobile
        divider.addEventListener('touchstart', (e) => {
            if (isCollapsed) return;
            isDragging = true;
            startY = e.touches[0].clientY;
            startHeight = logPanel.offsetHeight;
            divider.classList.add('dragging');
        }, { passive: true });
        
        document.addEventListener('touchmove', (e) => {
            if (!isDragging) return;
            const deltaY = startY - e.touches[0].clientY;
            logHeight = Math.max(this.minLogHeight, Math.min(this.maxLogHeight, startHeight + deltaY));
            logPanel.style.height = logHeight + 'px';
        }, { passive: true });
        
        document.addEventListener('touchend', () => {
            if (isDragging) {
                isDragging = false;
                divider.classList.remove('dragging');
                this.saveState(logHeight, isCollapsed);
            }
        });
        
        // Initialize log search
        const logSearchInput = document.getElementById('logSearchInput');
        if (logSearchInput && logContent) {
            logSearchInput.addEventListener('input', () => {
                this.filterLog(logSearchInput.value);
            });
            document.getElementById('logSearchClear')?.addEventListener('click', () => {
                logSearchInput.value = '';
                this.filterLog('');
                logSearchInput.focus();
            });
        }
    },
    
    filterLog(query) {
        const logEl = document.getElementById('log');
        if (!logEl) return;
        
        const entries = logEl.querySelectorAll('.log-entry');
        const q = query.toLowerCase().trim();
        
        entries.forEach(entry => {
            // Remove old highlights
            entry.querySelectorAll('.search-highlight').forEach(h => {
                h.replaceWith(h.textContent);
            });
            
            if (!q) {
                entry.classList.remove('search-hidden');
                return;
            }
            
            const text = entry.textContent.toLowerCase();
            if (text.includes(q)) {
                entry.classList.remove('search-hidden');
                // Highlight matching text
                const textEl = entry.querySelector('.log-entry__text');
                if (textEl) {
                    const regex = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
                    textEl.innerHTML = textEl.textContent.replace(regex, '<span class="search-highlight">$1</span>');
                }
            } else {
                entry.classList.add('search-hidden');
            }
        });
    },
    
    saveState(height, collapsed) {
        storage.set(this.storageKey, { height, collapsed });
    }
};

// ============ Exports (for non-module usage) ============
// All objects are already global, but we expose them via window.UIUtils for clarity
if (typeof window !== 'undefined') {
    window.UIUtils = {
        SmartSearch,
        CollapsibleCards,
        SplitPanel,
        initSearchForList
    };
}

