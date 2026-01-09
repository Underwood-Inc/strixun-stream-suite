export { GlobalStyle } from './GlobalStyle';
export { colors, spacing, typography } from './tokens';
// TODO: Fix TypeScript module resolution for breakpoints, media, responsiveSpacing
export const breakpoints = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
};
export const media = {
  mobile: `@media (max-width: ${breakpoints.md})`,
  tablet: `@media (min-width: ${breakpoints.md}) and (max-width: ${breakpoints.lg})`,
  sm: `@media (min-width: ${breakpoints.sm})`,
  md: `@media (min-width: ${breakpoints.md})`,
  lg: `@media (min-width: ${breakpoints.lg})`,
  xl: `@media (min-width: ${breakpoints.xl})`,
  '2xl': `@media (min-width: ${breakpoints['2xl']})`,
};
export const responsiveSpacing = {
  sm: { mobile: '8px', desktop: '16px' },
  md: { mobile: '16px', desktop: '24px' },
  lg: { mobile: '24px', desktop: '32px' },
};

