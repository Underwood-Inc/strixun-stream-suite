<!--
  Base Chart Component
  Wrapper for Observable Plot with CSS variable theming
-->
<script lang="ts">
  import * as Plot from '@observablehq/plot';
  import { onMount, onDestroy, afterUpdate } from 'svelte';
  import type { PlotOptions } from '@observablehq/plot';

  export let options: PlotOptions = {};
  export let height: number = 400;
  export let width: number | string = '100%';

  let container: HTMLDivElement;
  let plotElement: HTMLElement | null = null;

  // Get CSS variable values for theming
  function getThemeColors(): {
    text: string;
    background: string;
    border: string;
    accent: string;
    success: string;
    danger: string;
    warning: string;
    info: string;
    muted: string;
  } {
    if (typeof window === 'undefined' || !container) {
      return {
        text: '#ffffff',
        background: '#1a1a1a',
        border: '#333333',
        accent: '#3b82f6',
        success: '#10b981',
        danger: '#ef4444',
        warning: '#f59e0b',
        info: '#06b6d4',
        muted: '#6b7280'
      };
    }

    const styles = window.getComputedStyle(container);
    return {
      text: styles.getPropertyValue('--text') || '#ffffff',
      background: styles.getPropertyValue('--card') || styles.getPropertyValue('--bg') || '#1a1a1a',
      border: styles.getPropertyValue('--border') || '#333333',
      accent: styles.getPropertyValue('--accent') || '#3b82f6',
      success: styles.getPropertyValue('--success') || '#10b981',
      danger: styles.getPropertyValue('--danger') || '#ef4444',
      warning: styles.getPropertyValue('--warning') || '#f59e0b',
      info: styles.getPropertyValue('--info') || '#06b6d4',
      muted: styles.getPropertyValue('--text-secondary') || '#6b7280'
    };
  }

  function renderChart() {
    if (!container || !options.marks || options.marks.length === 0) return;

    // Get theme colors
    const theme = getThemeColors();

    // Merge theme into options
    const themedOptions: PlotOptions = {
      ...options,
      style: {
        color: theme.text,
        background: theme.background,
        fontSize: 'var(--font-size-sm, 0.875rem)',
        fontFamily: 'var(--font-family, system-ui, sans-serif)',
        ...options.style
      },
      color: options.color || {
        range: [theme.accent, theme.success, theme.danger, theme.warning, theme.info]
      },
      ...(options.x && typeof options.x === 'object' ? {
        x: {
          ...options.x,
          grid: options.x.grid !== false,
          ...(options.x.grid === undefined && {
            grid: true,
            stroke: theme.border,
            strokeOpacity: 0.3
          })
        }
      } : {}),
      ...(options.y && typeof options.y === 'object' ? {
        y: {
          ...options.y,
          grid: options.y.grid !== false,
          ...(options.y.grid === undefined && {
            grid: true,
            stroke: theme.border,
            strokeOpacity: 0.3
          })
        }
      } : {})
    };

    // Create plot
    try {
      const newPlotElement = Plot.plot(themedOptions);
      
      // Clear previous plot
      if (plotElement) {
        plotElement.remove();
      }
      
      // Append new plot (plot() returns an SVG element)
      container.appendChild(newPlotElement);
      plotElement = newPlotElement;
    } catch (error) {
      console.error('Chart rendering error:', error);
      if (container) {
        container.innerHTML = `<div style="padding: 1rem; color: var(--danger);">Chart rendering error: ${error instanceof Error ? error.message : 'Unknown error'}</div>`;
      }
    }
  }

  onMount(() => {
    renderChart();
  });

  afterUpdate(() => {
    renderChart();
  });

  onDestroy(() => {
    if (plotElement) {
      plotElement.remove();
    }
  });
</script>

<div bind:this={container} class="chart-container" style="height: {height}px; width: {typeof width === 'number' ? width + 'px' : width};">
  {#if !container}
    <div class="chart-loading">Loading chart...</div>
  {/if}
</div>

<style>
  .chart-container {
    position: relative;
    width: 100%;
    overflow: hidden;
  }

  .chart-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--text-secondary);
    font-size: var(--font-size-sm, 0.875rem);
  }

  /* Ensure SVG inherits theme colors */
  .chart-container :global(svg) {
    width: 100%;
    height: 100%;
  }
</style>

