import '../app/styles/tailwind.css';
import { withThemeByClassName } from '@storybook/addon-themes';
import type { Preview } from '@storybook/react-vite';

const preview: Preview = {
  decorators: [
    // The same class the site sets on <html>: `dark`, or nothing for light.
    withThemeByClassName({
      themes: { dark: 'dark', light: '' },
      defaultTheme: 'dark',
    }),
  ],
  parameters: {
    layout: 'padded',
    // The page ground comes from the tokens, not Storybook's backgrounds.
    backgrounds: { disable: true },
    options: {
      storySort: { order: ['Foundations'] },
    },
  },
};

export default preview;
