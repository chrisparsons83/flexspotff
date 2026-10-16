import { Tabs, TabsContent, TabsList, TabsTrigger } from './tabs';
import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof Tabs> = {
  title: 'Primitives/Tabs',
  component: Tabs,
};
export default meta;

type Story = StoryObj<typeof Tabs>;

export const Default: Story = {
  render: () => (
    <Tabs defaultValue='winners'>
      <TabsList>
        <TabsTrigger value='winners'>Winners bracket</TabsTrigger>
        <TabsTrigger value='sacko'>Sacko bracket</TabsTrigger>
        <TabsTrigger value='seeds' disabled>
          Seeds
        </TabsTrigger>
      </TabsList>
      <TabsContent value='winners'>
        The top six teams play for the title.
      </TabsContent>
      <TabsContent value='sacko'>
        The bottom four play to stay out of last.
      </TabsContent>
    </Tabs>
  ),
};
