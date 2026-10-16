import '../app/styles/tailwind.css';
import { createRemixStub } from '@remix-run/testing';
import type { Decorator, Preview } from '@storybook/react-vite';
import { type ComponentType, type ReactNode, useEffect, useState } from 'react';

type Theme = 'both' | 'dark' | 'light';

/** The same class the site sets on <html>: `dark`, or nothing for light. */
function PageTheme({
  theme,
  children,
}: {
  theme: 'dark' | 'light';
  children: ReactNode;
}) {
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);
  return <>{children}</>;
}

/**
 * The theme switch. `both` sets the story twice, dark beside light, using the
 * theme classes the tokens put on any element. <html> stays dark, so dialogs
 * and menus, which open outside the story, are dark too; switch to light to
 * review those.
 */
const withTheme: Decorator = (Story, { globals }) => {
  const theme: Theme = globals.theme ?? 'both';

  if (theme !== 'both') {
    return (
      <PageTheme theme={theme}>
        <Story />
      </PageTheme>
    );
  }

  return (
    <PageTheme theme='dark'>
      <div className='grid gap-px lg:grid-cols-2'>
        {(['dark', 'light'] as const).map(pane => (
          <div
            key={pane}
            data-theme-pane={pane}
            className={`${pane} min-w-0 bg-background p-6 text-foreground`}
          >
            <Story />
          </div>
        ))}
      </div>
    </PageTheme>
  );
};

/**
 * Components use Remix's Link, Form and location, which need a router. Each
 * story renders at `parameters.remix.path` (`/` by default), with
 * `parameters.remix.rootData` as the root loader's data for components that
 * read it.
 */
const withRemix: Decorator = (Story, { parameters }) => {
  const { path = '/', rootData } = parameters.remix ?? {};
  return <RemixStory story={Story} path={path} rootData={rootData} />;
};

/**
 * The stub is made once per story: a new one would be a new router, which
 * starts over with nothing rendered.
 */
function RemixStory({
  story: Story,
  path,
  rootData,
}: {
  story: ComponentType;
  path: string;
  rootData?: unknown;
}) {
  const [RemixStub] = useState(() =>
    createRemixStub([
      {
        // One route for every path, under the id the app's root loader has.
        id: 'root',
        path: '*',
        Component: () => <Story />,
        // Without a loader the first render is synchronous, which keeps
        // stories that do not need root data from flashing empty.
        loader: rootData === undefined ? undefined : () => rootData,
      },
    ]),
  );
  return <RemixStub initialEntries={[path]} />;
}

const preview: Preview = {
  // Outermost last: the router wraps each themed pane's story.
  decorators: [withRemix, withTheme],
  globalTypes: {
    theme: {
      description: 'Theme',
      toolbar: {
        title: 'Theme',
        icon: 'mirror',
        items: [
          { value: 'both', title: 'Both' },
          { value: 'dark', title: 'Dark' },
          { value: 'light', title: 'Light' },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { theme: 'both' },
  parameters: {
    layout: 'padded',
    // The page ground comes from the tokens, not Storybook's backgrounds.
    backgrounds: { disable: true },
    a11y: { test: 'error' },
    options: {
      storySort: {
        order: ['Foundations', 'Primitives', 'Layout', 'Data display'],
      },
    },
  },
};

export default preview;
