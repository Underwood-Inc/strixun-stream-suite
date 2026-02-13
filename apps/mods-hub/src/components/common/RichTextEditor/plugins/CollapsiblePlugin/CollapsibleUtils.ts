/**
 * Collapsible Plugin Utilities
 * Based on Lexical Playground CollapsiblePlugin
 */

export function setDomHiddenUntilFound(dom: HTMLElement): void {
  // hidden='until-found' is a valid value for hidden attribute
  (dom as unknown as { hidden: string }).hidden = 'until-found';
}

export function domOnBeforeMatch(dom: HTMLElement, callback: () => void): void {
  // onbeforematch is a valid event handler for 'until-found' elements
  (dom as unknown as { onbeforematch: () => void }).onbeforematch = callback;
}
