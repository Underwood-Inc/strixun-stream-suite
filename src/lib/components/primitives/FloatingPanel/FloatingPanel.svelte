<script lang="ts">
  /**
   * FloatingPanel Component
   * 
   * A floating panel that overlays content (doesn't shift it).
   * Supports expand/collapse and horizontal resizing.
   * Renders at body level via portal for proper z-index stacking.
   * 
   * @example
   * ```svelte
   * <FloatingPanel
   *   position="left"
   *   collapsedWidth={40}
   *   expandedWidth={320}
   *   minWidth={200}
   *   maxWidth={600}
   *   storageKey="ui_my-panel"
   * >
   *   <div slot="content">Panel content</div>
   * </FloatingPanel>
   * ```
   */

  import { onMount, onDestroy, tick } from 'svelte';
  import { storage } from '../../../../modules/storage';
  import { ResizableZoneController, type ResizableZoneConfig } from '../ResizableZone/ResizableZone';

  export let position: 'left' | 'right' = 'left';
  export let collapsedWidth: number = 40;
  export let expandedWidth: number = 320;
  export let minWidth: number = 200;
  export let maxWidth: number = 600;
  export let defaultExpanded: boolean = true;
  export let storageKey: string | undefined = undefined;
  export let className: string = '';

  let panel: HTMLDivElement;
  let resizeHandle: HTMLDivElement;
  let portalContainer: HTMLDivElement | null = null;
  
  let isExpanded = defaultExpanded;
  let currentWidth = expandedWidth;
  let isResizing = false;
  let startX = 0;
  let startWidth = 0;
  
  // Store bounds during panel resize to prevent disappearing
  let savedTop = 0;
  let savedHeight = 0;
  
  // Synchronous flag to prevent any bounds updates during resize
  let boundsLocked = false;
  
  // Store bounds during activity log resize to prevent snapshot/overlap
  let savedBoundsDuringLogResize: { top: number; height: number } | null = null;
  let logResizeLockRaf: number | null = null;
  
  // Track activity log position during its resize to update panel bounds in real-time
  let activityLogResizeRaf: number | null = null;
  
  // Track if activity log is being resized to prevent bounds updates during drag
  let boundsUpdateRaf: number | null = null;
  let lastBoundsUpdate = 0;
  let mutationObserver: MutationObserver | null = null;
  let activityLogResizeObserver: ResizeObserver | null = null;
  let panelStyleObserver: MutationObserver | null = null;
  const BOUNDS_UPDATE_THROTTLE = 16; // ~60fps

  // Load persisted state
  $: if (storageKey) {
    const savedState = storage.get(storageKey);
    if (savedState && typeof savedState === 'object') {
      const state = savedState as { expanded?: boolean; width?: number };
      if (state.expanded !== undefined) {
        isExpanded = state.expanded;
      }
      if (state.width !== undefined) {
        currentWidth = Math.max(minWidth, Math.min(maxWidth, state.width));
      }
    }
  }

  // Calculate panel bounds (below nav, above activity log)
  let panelTop = 0;
  let panelBottom = 0;

  function updatePanelBounds(): void {
    if (!panel) return;
    
    // Skip updates when this panel itself is being resized or bounds are locked
    // Check both the flag and the attribute for maximum safety
    if (isResizing || boundsLocked || panel.getAttribute('data-bounds-locked') === 'true') {
      // Preserve existing bounds during resize
      if (savedTop > 0 && savedHeight > 0) {
        panel.style.top = `${savedTop}px`;
        panel.style.height = `${savedHeight}px`;
        // Ensure panel is visible
        panel.style.display = '';
        panel.style.visibility = '';
        panel.style.opacity = '';
      }
      return;
    }
    
    const navigation = document.querySelector('nav.tabs');
    const activityLog = document.querySelector('.split-log');
    const divider = document.getElementById('logDivider');
    
    // Check if activity log is currently being resized (same way activity log does it)
    const isLogResizing = activityLog?.classList.contains('resizing') || 
                          divider?.classList.contains('dragging') || false;
    
    // During activity log resize, the ResizeObserver will handle real-time updates
    // Just return early here to prevent normal bounds calculation
    if (isLogResizing) {
      return;
    }
    
    // Activity log resize just completed - restore normal bounds calculation
    if (savedBoundsDuringLogResize) {
      savedBoundsDuringLogResize = null;
      if (logResizeLockRaf !== null) {
        cancelAnimationFrame(logResizeLockRaf);
        logResizeLockRaf = null;
      }
      if (activityLogResizeRaf !== null) {
        cancelAnimationFrame(activityLogResizeRaf);
        activityLogResizeRaf = null;
      }
    }
    
    const navRect = navigation?.getBoundingClientRect();
    const logRect = activityLog?.getBoundingClientRect();
    const dividerRect = divider?.getBoundingClientRect();
    
    // Top bound: below navigation
    panelTop = navRect ? navRect.bottom : 0;
    
    // Bottom bound: above divider (which is above activity log)
    // Use divider if available, otherwise use activity log top
    if (dividerRect && dividerRect.top < window.innerHeight && dividerRect.top > panelTop) {
      panelBottom = dividerRect.top;
    } else if (logRect && logRect.top < window.innerHeight && logRect.top > panelTop) {
      panelBottom = logRect.top;
    } else {
      panelBottom = window.innerHeight;
    }
    
    // Ensure panelTop is always less than panelBottom
    if (panelTop >= panelBottom) {
      // Fallback: use viewport height if calculation is invalid
      panelTop = navRect ? navRect.bottom : 0;
      panelBottom = window.innerHeight;
    }
    
    // Ensure minimum height to prevent panel from disappearing
    const minHeight = 100; // Minimum visible height
    const calculatedHeight = panelBottom - panelTop;
    
    // CRITICAL: If calculated height is invalid, use saved bounds or minimum
    let finalHeight = calculatedHeight;
    if (calculatedHeight <= 0 || isNaN(calculatedHeight) || !isFinite(calculatedHeight)) {
      if (savedHeight > 0) {
        finalHeight = savedHeight;
      } else {
        finalHeight = minHeight;
      }
    } else {
      finalHeight = Math.max(minHeight, calculatedHeight);
    }
    
    // Ensure final height doesn't exceed viewport
    const maxHeight = window.innerHeight - panelTop;
    const clampedHeight = Math.max(minHeight, Math.min(finalHeight, maxHeight));
    
    // CRITICAL: Never set height to 0 or invalid values
    if (clampedHeight <= 0 || isNaN(clampedHeight) || !isFinite(clampedHeight)) {
      console.warn('FloatingPanel: Invalid height calculated, using fallback', { clampedHeight, panelTop, panelBottom });
      // Use saved bounds if available, otherwise use minimum
      if (savedHeight > 0) {
        panel.style.top = `${savedTop > 0 ? savedTop : panelTop}px`;
        panel.style.height = `${savedHeight}px`;
        return;
      }
      panel.style.height = `${minHeight}px`;
    }
    
    // CRITICAL: Never set top to invalid values
    if (panelTop < 0 || isNaN(panelTop) || !isFinite(panelTop)) {
      console.warn('FloatingPanel: Invalid top calculated, using fallback', { panelTop });
      if (savedTop > 0) {
        panel.style.top = `${savedTop}px`;
      } else {
        const nav = document.querySelector('nav.tabs');
        const navRect = nav?.getBoundingClientRect();
        panel.style.top = `${navRect ? navRect.bottom : 0}px`;
      }
    } else {
      panel.style.top = `${panelTop}px`;
    }
    
    panel.style.height = `${clampedHeight}px`;
    
    // FINAL SAFEGUARD: Ensure panel is always visible
    panel.style.display = '';
    panel.style.visibility = '';
    panel.style.opacity = '';
    
    // Verify the panel is actually visible after setting styles
    requestAnimationFrame(() => {
      if (panel && !isResizing && !boundsLocked) {
        const finalRect = panel.getBoundingClientRect();
        if (finalRect.height <= 0 || finalRect.width <= 0) {
          console.error('FloatingPanel: Panel became invisible!', {
            height: finalRect.height,
            width: finalRect.width,
            top: finalRect.top,
            clampedHeight,
            panelTop,
            panelBottom
          });
          // Emergency restore - use saved bounds or minimum
          if (savedTop > 0 && savedHeight > 0) {
            panel.style.top = `${savedTop}px`;
            panel.style.height = `${savedHeight}px`;
          } else {
            panel.style.height = `${minHeight}px`;
          }
        }
      }
    });
  }
  
  // Throttled bounds update for ResizeObserver (same pattern as activity log resize)
  function throttledUpdateBounds(): void {
    // Skip ALL updates when panel is being resized or bounds are locked
    if (isResizing || boundsLocked || (panel && panel.getAttribute('data-bounds-locked') === 'true')) {
      return;
    }
    
    const now = performance.now();
    
    // Throttle to ~60fps during rapid changes
    if (now - lastBoundsUpdate < BOUNDS_UPDATE_THROTTLE) {
      if (boundsUpdateRaf === null) {
        boundsUpdateRaf = requestAnimationFrame(() => {
          // Double-check isResizing and lock haven't changed
          if (!isResizing && !boundsLocked && panel && panel.getAttribute('data-bounds-locked') !== 'true') {
            updatePanelBounds();
            lastBoundsUpdate = performance.now();
          }
          boundsUpdateRaf = null;
        });
      }
      return;
    }
    
    // Update immediately if enough time has passed (only if not locked)
    if (!boundsLocked) {
      updatePanelBounds();
      lastBoundsUpdate = now;
    }
  }

  function toggleExpanded(): void {
    isExpanded = !isExpanded;
    if (!isExpanded) {
      currentWidth = collapsedWidth;
    } else {
      currentWidth = expandedWidth;
    }
    saveState();
  }

  function saveState(): void {
    if (storageKey) {
      storage.set(storageKey, {
        expanded: isExpanded,
        width: currentWidth
      });
    }
  }

  function startResize(e: MouseEvent | TouchEvent): void {
    if (!isExpanded) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    // Cancel any pending bounds updates
    if (boundsUpdateRaf !== null) {
      cancelAnimationFrame(boundsUpdateRaf);
      boundsUpdateRaf = null;
    }
    
    // Set flags synchronously to prevent any race conditions
    isResizing = true;
    boundsLocked = true;
    
    // Save current bounds before resize starts (use computed styles for accuracy)
    if (panel) {
      const rect = panel.getBoundingClientRect();
      
      // Use getBoundingClientRect for accurate current position
      savedTop = rect.top;
      savedHeight = rect.height;
      
      // Ensure we have valid values
      if (savedTop <= 0 || savedHeight <= 0) {
        // Fallback: use stored panelTop/panelBottom if available
        if (panelTop > 0 && panelBottom > panelTop) {
          savedTop = panelTop;
          savedHeight = panelBottom - panelTop;
        } else {
          // Last resort: use viewport defaults
          const nav = document.querySelector('nav.tabs');
          const navRect = nav?.getBoundingClientRect();
          savedTop = navRect ? navRect.bottom : 0;
          savedHeight = Math.max(100, window.innerHeight - savedTop);
        }
      }
      
      // Lock the bounds during resize
      panel.style.top = `${savedTop}px`;
      panel.style.height = `${savedHeight}px`;
      // Ensure panel is visible
      panel.style.display = '';
      panel.style.visibility = '';
      panel.style.opacity = '';
      // Mark panel as locked to prevent bounds updates
      panel.setAttribute('data-bounds-locked', 'true');
      
      // Watch for style changes during resize and restore if cleared
      panelStyleObserver = new MutationObserver((mutations) => {
        if (!isResizing || !panel) return;
        
        for (const mutation of mutations) {
          if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
            const currentTop = panel.style.top;
            const currentHeight = panel.style.height;
            
            // If bounds were cleared or set to invalid values, restore them
            if (!currentTop || !currentHeight || 
                parseFloat(currentHeight) <= 0 || 
                parseFloat(currentTop) < 0) {
              panel.style.top = `${savedTop}px`;
              panel.style.height = `${savedHeight}px`;
              panel.style.display = '';
              panel.style.visibility = '';
              panel.style.opacity = '';
            }
          }
        }
      });
      
      panelStyleObserver.observe(panel, {
        attributes: true,
        attributeFilter: ['style']
      });
    }
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    startX = clientX;
    startWidth = currentWidth;
    
    document.addEventListener('mousemove', handleResize);
    document.addEventListener('mouseup', stopResize);
    document.addEventListener('touchmove', handleResize);
    document.addEventListener('touchend', stopResize);
  }

  let boundsRestoreRaf: number | null = null;
  
  function handleResize(e: MouseEvent | TouchEvent): void {
    if (!isResizing || !panel) return;
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const deltaX = position === 'left' 
      ? clientX - startX 
      : startX - clientX;
    
    const newWidth = Math.max(minWidth, Math.min(maxWidth, startWidth + deltaX));
    currentWidth = newWidth;
    
    // CRITICAL: Continuously lock bounds during resize to prevent any clearing
    // Apply immediately on every mousemove to override any other updates
    if (savedTop > 0 && savedHeight > 0) {
      panel.style.top = `${savedTop}px`;
      panel.style.height = `${savedHeight}px`;
      // Ensure lock is still set
      if (panel.getAttribute('data-bounds-locked') !== 'true') {
        panel.setAttribute('data-bounds-locked', 'true');
      }
      // Ensure panel is never hidden
      panel.style.display = '';
      panel.style.visibility = '';
      panel.style.opacity = '';
      
      // Continuously restore bounds in a loop during resize
      if (boundsRestoreRaf === null) {
        const restoreBounds = () => {
          if (isResizing && panel && savedTop > 0 && savedHeight > 0) {
            const currentTop = panel.style.top;
            const currentHeight = panel.style.height;
            
            // If bounds are missing or invalid, restore them
            if (!currentTop || !currentHeight || 
                parseFloat(currentHeight) <= 0 || 
                parseFloat(currentTop) < 0) {
              panel.style.top = `${savedTop}px`;
              panel.style.height = `${savedHeight}px`;
              panel.style.display = '';
              panel.style.visibility = '';
              panel.style.opacity = '';
            }
            
            boundsRestoreRaf = requestAnimationFrame(restoreBounds);
          } else {
            boundsRestoreRaf = null;
          }
        };
        boundsRestoreRaf = requestAnimationFrame(restoreBounds);
      }
    }
  }

  function stopResize(): void {
    if (isResizing) {
      // Stop continuous bounds restoration loop
      if (boundsRestoreRaf !== null) {
        cancelAnimationFrame(boundsRestoreRaf);
        boundsRestoreRaf = null;
      }
      
      // Stop watching style changes
      if (panelStyleObserver) {
        panelStyleObserver.disconnect();
        panelStyleObserver = null;
      }
      
      // Unlock synchronously
      isResizing = false;
      boundsLocked = false;
      
      // Unlock bounds
      if (panel) {
        panel.removeAttribute('data-bounds-locked');
        // Ensure bounds are still valid before unlocking
        if (savedTop > 0 && savedHeight > 0) {
          panel.style.top = `${savedTop}px`;
          panel.style.height = `${savedHeight}px`;
        }
      }
      
      saveState();
      
      // Clear saved bounds
      savedTop = 0;
      savedHeight = 0;
      
      // Update bounds after panel resize completes
      requestAnimationFrame(() => {
        if (!isResizing && !boundsLocked) {
          updatePanelBounds();
        }
      });
    }
    
    document.removeEventListener('mousemove', handleResize);
    document.removeEventListener('mouseup', stopResize);
    document.removeEventListener('touchmove', handleResize);
    document.removeEventListener('touchend', stopResize);
  }

  function handleResizeWindow(): void {
    // Skip window resize updates during panel resize or when locked
    if (!isResizing && !boundsLocked && panel && panel.getAttribute('data-bounds-locked') !== 'true') {
      updatePanelBounds();
    }
  }

  onMount(async () => {
    // Create portal container at body level
    portalContainer = document.createElement('div');
    portalContainer.id = `floating-panel-portal-${position}`;
    portalContainer.style.cssText = 'position: fixed; z-index: 100; pointer-events: none;';
    document.body.appendChild(portalContainer);
    
    // Move panel to portal
    if (panel && portalContainer) {
      portalContainer.appendChild(panel);
      panel.style.pointerEvents = 'auto';
    }
    
    // Wait for DOM to settle, then calculate initial bounds
    await tick();
    requestAnimationFrame(() => {
      if (!boundsLocked) {
        updatePanelBounds();
      }
    });
    
    // Update bounds on resize and scroll
    window.addEventListener('resize', handleResizeWindow);
    window.addEventListener('scroll', handleResizeWindow, true);
    
    // Use ResizeObserver to watch for layout changes (throttled like activity log resize)
    // Only observe navigation - activity log changes are handled via MutationObserver
    const resizeObserver = new ResizeObserver(() => {
      throttledUpdateBounds();
    });
    
    const navigation = document.querySelector('nav.tabs');
    
    if (navigation) resizeObserver.observe(navigation);
    // Don't observe activity log directly - it causes conflicts during resize
    // Instead, we use MutationObserver to detect when resize completes
    
    // Watch for activity log changes and update bounds accordingly
    // Use both MutationObserver (for class changes) and a separate ResizeObserver for the log
    const activityLogResizeObserver = new ResizeObserver(() => {
      const activityLog = document.querySelector('.split-log');
      const divider = document.getElementById('logDivider');
      const isLogResizing = activityLog?.classList.contains('resizing') || 
                            divider?.classList.contains('dragging') || false;
      
      if (isLogResizing) {
        // Activity log is resizing - start real-time panel bounds update
        if (!savedBoundsDuringLogResize && panel) {
          const rect = panel.getBoundingClientRect();
          savedBoundsDuringLogResize = {
            top: rect.top,
            height: rect.height
          };
        }
        
        // Start continuous update loop if not already running
        if (activityLogResizeRaf === null && panel && savedBoundsDuringLogResize) {
          const updateDuringResize = () => {
            const activityLog = document.querySelector('.split-log');
            const divider = document.getElementById('logDivider');
            const stillResizing = activityLog?.classList.contains('resizing') || 
                                  divider?.classList.contains('dragging') || false;
            
            if (stillResizing && panel && savedBoundsDuringLogResize) {
              const logRect = activityLog?.getBoundingClientRect();
              const dividerRect = divider?.getBoundingClientRect();
              
              // Calculate new bottom bound based on divider's current position (above activity log)
              let newBottom: number;
              if (dividerRect && dividerRect.top < window.innerHeight && dividerRect.top > savedBoundsDuringLogResize.top) {
                newBottom = dividerRect.top;
              } else if (logRect && logRect.top < window.innerHeight && logRect.top > savedBoundsDuringLogResize.top) {
                newBottom = logRect.top;
              } else {
                newBottom = window.innerHeight;
              }
              
              // Calculate new height
              const newHeight = Math.max(100, newBottom - savedBoundsDuringLogResize.top);
              const maxHeight = window.innerHeight - savedBoundsDuringLogResize.top;
              const clampedHeight = Math.min(newHeight, maxHeight);
              
              // Update panel height in real-time
              panel.style.top = `${savedBoundsDuringLogResize.top}px`;
              panel.style.height = `${clampedHeight}px`;
              
              activityLogResizeRaf = requestAnimationFrame(updateDuringResize);
            } else {
              // Activity log resize completed
              savedBoundsDuringLogResize = null;
              activityLogResizeRaf = null;
            }
          };
          activityLogResizeRaf = requestAnimationFrame(updateDuringResize);
        }
      } else {
        // Activity log is NOT resizing - use normal update mechanism
        if (!isResizing && !boundsLocked) {
          // Small delay to ensure activity log has settled
          requestAnimationFrame(() => {
            if (!isResizing && !boundsLocked) {
              throttledUpdateBounds();
            }
          });
        }
      }
    });
    
    // Also watch for when activity log resize starts and completes (class changes)
    // This ensures bounds update immediately when drag starts and ends
    mutationObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
          const target = mutation.target as HTMLElement;
          
          // If resizing class was ADDED, start real-time updates immediately
          if (target.classList.contains('split-log') && target.classList.contains('resizing')) {
            if (!savedBoundsDuringLogResize && panel) {
              const rect = panel.getBoundingClientRect();
              savedBoundsDuringLogResize = {
                top: rect.top,
                height: rect.height
              };
            }
            
            // Start continuous update loop if not already running
            if (activityLogResizeRaf === null && panel && savedBoundsDuringLogResize) {
              const updateDuringResize = () => {
                const activityLog = document.querySelector('.split-log');
                const divider = document.getElementById('logDivider');
                const stillResizing = activityLog?.classList.contains('resizing') || 
                                      divider?.classList.contains('dragging') || false;
                
                if (stillResizing && panel && savedBoundsDuringLogResize) {
                  const logRect = activityLog?.getBoundingClientRect();
                  const dividerRect = divider?.getBoundingClientRect();
                  
                  // Calculate new bottom bound based on divider's current position (above activity log)
                  let newBottom: number;
                  if (dividerRect && dividerRect.top < window.innerHeight && dividerRect.top > savedBoundsDuringLogResize.top) {
                    newBottom = dividerRect.top;
                  } else if (logRect && logRect.top < window.innerHeight && logRect.top > savedBoundsDuringLogResize.top) {
                    newBottom = logRect.top;
                  } else {
                    newBottom = window.innerHeight;
                  }
                  
                  // Calculate new height
                  const newHeight = Math.max(100, newBottom - savedBoundsDuringLogResize.top);
                  const maxHeight = window.innerHeight - savedBoundsDuringLogResize.top;
                  const clampedHeight = Math.min(newHeight, maxHeight);
                  
                  // Update panel height in real-time
                  panel.style.top = `${savedBoundsDuringLogResize.top}px`;
                  panel.style.height = `${clampedHeight}px`;
                  
                  activityLogResizeRaf = requestAnimationFrame(updateDuringResize);
                } else {
                  // Activity log resize completed
                  savedBoundsDuringLogResize = null;
                  activityLogResizeRaf = null;
                }
              };
              activityLogResizeRaf = requestAnimationFrame(updateDuringResize);
            }
          }
          
          // If resizing class was REMOVED, update bounds after a short delay to ensure layout has settled
          if (target.classList.contains('split-log') && !target.classList.contains('resizing')) {
            // Stop continuous update loops
            if (logResizeLockRaf !== null) {
              cancelAnimationFrame(logResizeLockRaf);
              logResizeLockRaf = null;
            }
            if (activityLogResizeRaf !== null) {
              cancelAnimationFrame(activityLogResizeRaf);
              activityLogResizeRaf = null;
            }
            // Clear saved bounds from activity log resize
            savedBoundsDuringLogResize = null;
            // Wait for layout to settle before updating
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                if (!isResizing && !boundsLocked) {
                  updatePanelBounds();
                }
              });
            });
          }
          
          // If dragging class was ADDED to divider, start real-time updates
          if (target.id === 'logDivider' && target.classList.contains('dragging')) {
            if (!savedBoundsDuringLogResize && panel) {
              const rect = panel.getBoundingClientRect();
              savedBoundsDuringLogResize = {
                top: rect.top,
                height: rect.height
              };
            }
            
            // Start continuous update loop if not already running
            if (activityLogResizeRaf === null && panel && savedBoundsDuringLogResize) {
              const updateDuringResize = () => {
                const activityLog = document.querySelector('.split-log');
                const divider = document.getElementById('logDivider');
                const stillResizing = activityLog?.classList.contains('resizing') || 
                                      divider?.classList.contains('dragging') || false;
                
                if (stillResizing && panel && savedBoundsDuringLogResize) {
                  const logRect = activityLog?.getBoundingClientRect();
                  const dividerRect = divider?.getBoundingClientRect();
                  
                  // Calculate new bottom bound based on divider's current position (above activity log)
                  let newBottom: number;
                  if (dividerRect && dividerRect.top < window.innerHeight && dividerRect.top > savedBoundsDuringLogResize.top) {
                    newBottom = dividerRect.top;
                  } else if (logRect && logRect.top < window.innerHeight && logRect.top > savedBoundsDuringLogResize.top) {
                    newBottom = logRect.top;
                  } else {
                    newBottom = window.innerHeight;
                  }
                  
                  // Calculate new height
                  const newHeight = Math.max(100, newBottom - savedBoundsDuringLogResize.top);
                  const maxHeight = window.innerHeight - savedBoundsDuringLogResize.top;
                  const clampedHeight = Math.min(newHeight, maxHeight);
                  
                  // Update panel height in real-time
                  panel.style.top = `${savedBoundsDuringLogResize.top}px`;
                  panel.style.height = `${clampedHeight}px`;
                  
                  activityLogResizeRaf = requestAnimationFrame(updateDuringResize);
                } else {
                  // Activity log resize completed
                  savedBoundsDuringLogResize = null;
                  activityLogResizeRaf = null;
                }
              };
              activityLogResizeRaf = requestAnimationFrame(updateDuringResize);
            }
          }
          
          // If dragging class was REMOVED from divider, update bounds
          if (target.id === 'logDivider' && !target.classList.contains('dragging')) {
            // Stop continuous update loops
            if (logResizeLockRaf !== null) {
              cancelAnimationFrame(logResizeLockRaf);
              logResizeLockRaf = null;
            }
            if (activityLogResizeRaf !== null) {
              cancelAnimationFrame(activityLogResizeRaf);
              activityLogResizeRaf = null;
            }
            // Clear saved bounds from activity log resize
            savedBoundsDuringLogResize = null;
            // Wait for layout to settle before updating
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                if (!isResizing && !boundsLocked) {
                  updatePanelBounds();
                }
              });
            });
          }
        }
      }
    });
    
    const activityLog = document.querySelector('.split-log');
    if (activityLog) {
      // Watch for class changes (resize start/end)
      mutationObserver.observe(activityLog, {
        attributes: true,
        attributeFilter: ['class']
      });
      
      // Watch for size changes (but only update when not resizing)
      activityLogResizeObserver.observe(activityLog);
    }
    
    const divider = document.getElementById('logDivider');
    if (divider) {
      mutationObserver.observe(divider, {
        attributes: true,
        attributeFilter: ['class']
      });
    }
    
    return () => {
      resizeObserver.disconnect();
      if (mutationObserver) {
        mutationObserver.disconnect();
      }
      if (boundsUpdateRaf !== null) {
        cancelAnimationFrame(boundsUpdateRaf);
      }
    };
  });

  onDestroy(() => {
    window.removeEventListener('resize', handleResizeWindow);
    window.removeEventListener('scroll', handleResizeWindow, true);
    stopResize();
    
    // Clean up observers
    if (mutationObserver) {
      mutationObserver.disconnect();
      mutationObserver = null;
    }
    
    if (panelStyleObserver) {
      panelStyleObserver.disconnect();
      panelStyleObserver = null;
    }
    
    if (activityLogResizeObserver) {
      activityLogResizeObserver.disconnect();
      activityLogResizeObserver = null;
    }
    
    if (boundsUpdateRaf !== null) {
      cancelAnimationFrame(boundsUpdateRaf);
      boundsUpdateRaf = null;
    }
    
    if (logResizeLockRaf !== null) {
      cancelAnimationFrame(logResizeLockRaf);
      logResizeLockRaf = null;
    }
    
    if (activityLogResizeRaf !== null) {
      cancelAnimationFrame(activityLogResizeRaf);
      activityLogResizeRaf = null;
    }
    
    // Clean up portal container
    if (portalContainer && portalContainer.parentNode) {
      portalContainer.parentNode.removeChild(portalContainer);
    }
  });

  // Update width when expanded state changes
  $: if (!isExpanded) {
    currentWidth = collapsedWidth;
    // Update bounds after width change to ensure panel stays visible (only if not resizing or locked)
    if (panel && !isResizing && panel.getAttribute('data-bounds-locked') !== 'true') {
      requestAnimationFrame(() => {
        if (!isResizing && panel && panel.getAttribute('data-bounds-locked') !== 'true') {
          updatePanelBounds();
        }
      });
    }
  } else if (isExpanded && currentWidth === collapsedWidth) {
    currentWidth = expandedWidth;
    // Update bounds after width change to ensure panel stays visible (only if not resizing or locked)
    if (panel && !isResizing && panel.getAttribute('data-bounds-locked') !== 'true') {
      requestAnimationFrame(() => {
        if (!isResizing && panel && panel.getAttribute('data-bounds-locked') !== 'true') {
          updatePanelBounds();
        }
      });
    }
  }
</script>

<div
  bind:this={panel}
  class="floating-panel floating-panel--{position} {className}"
  class:floating-panel--expanded={isExpanded}
  class:floating-panel--resizing={isResizing}
  style="--panel-width: {currentWidth}px; {isResizing && savedTop > 0 && savedHeight > 0 ? `top: ${savedTop}px; height: ${savedHeight}px; display: block; visibility: visible; opacity: 1;` : ''}"
>
  <div class="floating-panel__header">
    <button
      class="floating-panel__toggle"
      on:click={toggleExpanded}
      aria-label={isExpanded ? 'Collapse panel' : 'Expand panel'}
      type="button"
    >
      {#if position === 'left'}
        {isExpanded ? '‹' : '›'}
      {:else}
        {isExpanded ? '›' : '‹'}
      {/if}
    </button>
  </div>
  
  {#if isExpanded}
    <div class="floating-panel__content">
      <slot />
    </div>
    
    <div
      class="floating-panel__resize-handle"
      bind:this={resizeHandle}
      on:mousedown={startResize}
      on:touchstart={startResize}
      role="separator"
      aria-orientation="horizontal"
      aria-label="Resize panel"
      tabindex="0"
    />
  {/if}
</div>

<style lang="scss">
  @use '@styles/animations' as *;
  @use '@styles/mixins' as *;

  .floating-panel {
    position: fixed;
    background: var(--card);
    border-top: 1px solid var(--border);
    border-left: 1px solid var(--border);
    border-right: 1px solid var(--border);
    border-bottom: none;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    pointer-events: auto;
    display: flex;
    flex-direction: column;
    transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    overflow: hidden;
    z-index: 100;
    @include gpu-accelerated;
  }

  .floating-panel--left {
    left: 0;
    border-right: 2px solid var(--border);
  }

  .floating-panel--right {
    right: 0;
    border-left: 2px solid var(--border);
  }

  .floating-panel {
    width: var(--panel-width);
  }

  .floating-panel__header {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    padding: 8px;
    border-bottom: 1px solid var(--border);
    background: var(--bg-dark);
    flex-shrink: 0;
  }

  .floating-panel:not(.floating-panel--expanded) .floating-panel__header {
    padding: 4px;
  }

  .floating-panel__toggle {
    width: 32px;
    height: 32px;
    background: var(--border);
    border: none;
    border-radius: 4px;
    color: var(--text);
    font-size: 20px;
    font-weight: bold;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    @include gpu-accelerated;
    flex-shrink: 0;

    &:hover {
      background: var(--accent);
      color: #000;
      transform: scale(1.1);
    }

    &:active {
      transform: scale(0.95);
    }

    &:focus-visible {
      outline: 2px solid var(--accent);
      outline-offset: 2px;
    }
  }

  .floating-panel:not(.floating-panel--expanded) .floating-panel__toggle {
    width: 28px;
    height: 28px;
    font-size: 18px;
  }

  .floating-panel__content {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 16px;
    min-height: 0;
    contain: layout style paint;
    @include scrollbar(6px);
  }

  .floating-panel__resize-handle {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 4px;
    cursor: ew-resize;
    background: var(--border);
    z-index: 10;
    transition: background 0.2s ease;
    user-select: none;
    -webkit-user-select: none;
  }

  .floating-panel--left .floating-panel__resize-handle {
    right: 0;
  }

  .floating-panel--right .floating-panel__resize-handle {
    left: 0;
  }

  .floating-panel__resize-handle:hover {
    background: var(--border-light);
  }

  .floating-panel--resizing .floating-panel__resize-handle {
    background: var(--accent);
  }

  .floating-panel--resizing {
    transition: none;
    overflow: hidden;
    contain: layout style paint;
    isolation: isolate;
  }

  .floating-panel--resizing .floating-panel__content {
    transition: none;
    contain: layout style paint;
    /* Keep overflow-y: auto for scrolling, but ensure content doesn't escape */
    overflow-x: hidden;
    max-width: 100%;
  }
</style>

