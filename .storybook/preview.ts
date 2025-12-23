import '../src/styles/main.scss';
import './preview.scss';

/**
 * Storybook Preview Configuration
 * 
 * Styled to match the Strixun Stream Suite application theme.
 * Uses the same color palette, typography, and design tokens.
 */
const preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    docs: {
      toc: true,
    },
    backgrounds: {
      default: 'dark',
      values: [
        {
          name: 'dark',
          value: '#1a1611', // --bg
        },
        {
          name: 'card',
          value: '#252017', // --card
        },
        {
          name: 'bg-dark',
          value: '#0f0e0b', // --bg-dark
        },
      ],
    },
    // Custom viewport sizes matching breakpoints
    viewport: {
      viewports: {
        mobile: {
          name: 'Mobile',
          styles: {
            width: '375px',
            height: '667px',
          },
        },
        tablet: {
          name: 'Tablet',
          styles: {
            width: '768px',
            height: '1024px',
          },
        },
        desktop: {
          name: 'Desktop',
          styles: {
            width: '1024px',
            height: '768px',
          },
        },
        large: {
          name: 'Large Desktop',
          styles: {
            width: '1280px',
            height: '800px',
          },
        },
      },
    },
  },
  tags: ['autodocs'],
  // Apply app theme to Storybook UI
  decorators: [
    (story) => {
      return {
        Component: story,
        props: story.props || {},
      };
    },
  ],
};

export default preview;
