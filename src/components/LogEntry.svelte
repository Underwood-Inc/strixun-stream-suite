<script lang="ts">
  /**
   * Log Entry Component
   * 
   * Individual log entry with color coding, flairs, and animations
   */
  
  import type { LogEntry } from '../stores/activity-log';
  import { logFilters } from '../stores/activity-log';
  
  export let entry: LogEntry;
  export let index: number = 0;
  
  let isHovered = false;
  
  // Function to highlight search matches in text
  // Supports advanced syntax: quotes for exact, space for AND, | for OR, * for wildcard
  function highlightSearch(text: string, query: string): string {
    if (!query || !query.trim()) {
      return text;
    }
    
    // Extract quoted phrases
    const quotedPhrases: string[] = [];
    let processedQuery = query.replace(/"([^"]+)"/g, (match, phrase) => {
      quotedPhrases.push(phrase);
      return '';
    });
    
    // Combine quoted phrases and remaining terms for highlighting
    const allTerms: string[] = [...quotedPhrases];
    
    // Split remaining query by | for OR, then by space for AND
    if (processedQuery.trim()) {
      const orGroups = processedQuery.split('|').map(g => g.trim()).filter(g => g);
      orGroups.forEach(group => {
        const terms = group.split(/\s+/).filter(t => t);
        terms.forEach(term => {
          // Remove wildcard * for highlighting
          const cleanTerm = term.endsWith('*') ? term.slice(0, -1) : term;
          if (cleanTerm) {
            allTerms.push(cleanTerm);
          }
        });
      });
    }
    
    // Highlight all terms
    let highlighted = text;
    allTerms.forEach(term => {
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(${escaped})`, 'gi');
      highlighted = highlighted.replace(regex, '<span class="search-highlight">$1</span>');
    });
    
    return highlighted;
  }
  
  // Get highlighted message
  $: highlightedMessage = highlightSearch(entry.message, $logFilters.searchQuery);
  $: highlightedFlair = entry.flair ? highlightSearch(entry.flair, $logFilters.searchQuery) : '';
  
  function formatTime(date: Date): string {
    return date.toLocaleTimeString('en-US', { 
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }
  
  function copyMessage(): void {
    navigator.clipboard.writeText(entry.message).then(() => {
      // Visual feedback could be added here
    });
  }
  
  function getTypeIcon(type: string): string {
    switch (type) {
      case 'success': return '✅';
      case 'error': return '❌';
      case 'warning': return '⚠️';
      case 'debug': return '🔍';
      default: return 'ℹ️';
    }
  }
</script>

<div 
  class="log-entry log-entry--{entry.type}" 
  class:hovered={isHovered}
  style="--index: {index}"
  on:mouseenter={() => isHovered = true}
  on:mouseleave={() => isHovered = false}
  role="log"
>
  <div class="log-entry__icon">
    {entry.icon || getTypeIcon(entry.type)}
  </div>
  
  <div class="log-entry__content">
    <span class="log-entry__time" title={entry.timestamp.toISOString()}>
      {formatTime(entry.timestamp)}
    </span>
    {#if entry.flair}
      <span class="log-entry__flair log-entry__flair--{entry.type}">
        {@html highlightedFlair}
      </span>
    {/if}
    <span class="log-entry__text">
      {@html highlightedMessage}
    </span>
    {#if entry.count && entry.count > 1}
      <span class="log-entry__count" title="This message appeared {entry.count} times">
        x{entry.count}
      </span>
    {/if}
    <button 
      class="log-entry__copy"
      on:click={copyMessage}
      title="Copy message"
      aria-label="Copy message"
    >
      📋
    </button>
  </div>
</div>

<style lang="scss">
  .log-entry {
    display: flex;
    gap: 8px;
    padding: 4px 8px;
    margin-bottom: 2px;
    border-radius: 4px;
    border-left: 2px solid transparent;
    background: var(--bg-dark);
    transition: all 0.2s ease;
    animation: slide-in 0.3s ease;
    animation-delay: calc(var(--index) * 0.02s);
    animation-fill-mode: both;
  }
  
  .log-entry:hover {
    background: var(--border);
    transform: translateX(2px);
  }
  
  .log-entry:hover .log-entry__text {
    color: var(--text);
  }
  
  .log-entry:hover .log-entry__copy {
    opacity: 1;
  }
  
  .log-entry .log-entry__icon {
    font-size: 0.95em;
    flex-shrink: 0;
    width: 18px;
    text-align: center;
    opacity: 0.8;
  }
  
  .log-entry .log-entry__content {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 6px;
    overflow: hidden;
  }
  
  .log-entry .log-entry__time {
    font-family: 'Courier New', monospace;
    font-size: 0.7em;
    color: var(--muted);
    white-space: nowrap;
    flex-shrink: 0;
  }
  
  .log-entry .log-entry__flair {
    display: inline-block;
    padding: 1px 4px;
    border-radius: 3px;
    font-size: 0.65em;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    white-space: nowrap;
    flex-shrink: 0;
  }
  
  .log-entry .log-entry__text {
    font-size: 0.85em;
    color: var(--text);
    line-height: 1.3;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
    min-width: 0;
  }
  
  .log-entry .log-entry__count {
    display: inline-block;
    padding: 1px 4px;
    border-radius: 3px;
    font-size: 0.65em;
    font-weight: 600;
    color: var(--muted);
    background: rgba(128, 128, 128, 0.15);
    border: 1px solid var(--border);
    white-space: nowrap;
    flex-shrink: 0;
  }
  
  .log-entry .log-entry__copy {
    background: transparent;
    border: none;
    color: var(--muted);
    cursor: pointer;
    padding: 2px 4px;
    font-size: 0.85em;
    opacity: 0;
    transition: opacity 0.2s, color 0.2s;
    flex-shrink: 0;
  }
  
  .log-entry .log-entry__copy:hover {
    color: var(--text);
  }
  
  .log-entry.log-entry--success {
    border-left-color: var(--success);
    background: rgba(40, 167, 69, 0.05);
  }
  
  .log-entry.log-entry--success .log-entry__text {
    color: var(--success);
  }
  
  .log-entry.log-entry--error {
    border-left-color: var(--danger);
    background: rgba(234, 43, 31, 0.05);
  }
  
  .log-entry.log-entry--error .log-entry__text {
    color: var(--danger);
  }
  
  .log-entry.log-entry--warning {
    border-left-color: #ffc107;
    background: rgba(255, 193, 7, 0.05);
  }
  
  .log-entry.log-entry--warning .log-entry__text {
    color: #ffc107;
  }
  
  .log-entry.log-entry--info {
    border-left-color: var(--info);
    background: rgba(100, 149, 237, 0.05);
  }
  
  .log-entry.log-entry--info .log-entry__text {
    color: var(--info);
  }
  
  .log-entry.log-entry--debug {
    border-left-color: var(--muted);
    background: rgba(128, 128, 128, 0.05);
  }
  
  .log-entry.log-entry--debug .log-entry__text {
    color: var(--muted);
  }
  
  @keyframes slide-in {
    from {
      opacity: 0;
      transform: translateX(-10px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }
</style>

