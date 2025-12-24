<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import VirtualList from './VirtualList.svelte';

  const { Story } = defineMeta({
    title: 'Components/VirtualList',
    component: VirtualList,
    tags: ['autodocs'],
    argTypes: {
      itemHeight: {
        control: { type: 'number', min: 20, max: 100, step: 5 },
        description: 'Height of each item in pixels',
      },
      containerHeight: {
        control: { type: 'number', min: 200, max: 800, step: 50 },
        description: 'Height of the container in pixels',
      },
      overscan: {
        control: { type: 'number', min: 0, max: 10, step: 1 },
        description: 'Number of extra items to render above/below viewport',
      },
    },
  });

  // Generate sample items
  const generateItems = (count: number) => {
    return Array.from({ length: count }, (_, i) => ({
      id: i + 1,
      text: `Item ${i + 1}`,
      description: `This is item number ${i + 1} in the list`
    }));
  };

  const sampleItems = generateItems(1000);
</script>

<Story 
  name="Default" 
  args={{ 
    itemHeight: 40,
    containerHeight: 400,
    overscan: 5
  }}
>
  <div style="border: 1px solid var(--border); border-radius: 8px; overflow: hidden;">
    <VirtualList 
      items={sampleItems}
      itemHeight={40}
      containerHeight={400}
      overscan={5}
    >
      {#each visibleItems as { item, index } (item.id)}
        <div style="padding: 10px; border-bottom: 1px solid var(--border);">
          <strong>{item.text}</strong>
          <div style="font-size: 12px; color: var(--text-secondary);">{item.description}</div>
        </div>
      {/each}
    </VirtualList>
  </div>
</Story>

<Story 
  name="Large Items" 
  args={{ 
    itemHeight: 80,
    containerHeight: 400,
    overscan: 3
  }}
>
  <div style="border: 1px solid var(--border); border-radius: 8px; overflow: hidden;">
    <VirtualList 
      items={sampleItems}
      itemHeight={80}
      containerHeight={400}
      overscan={3}
    >
      {#each visibleItems as { item, index } (item.id)}
        <div style="padding: 20px; border-bottom: 1px solid var(--border);">
          <strong style="font-size: 18px;">{item.text}</strong>
          <div style="font-size: 14px; color: var(--text-secondary); margin-top: 8px;">{item.description}</div>
        </div>
      {/each}
    </VirtualList>
  </div>
</Story>

<Story 
  name="Small Container" 
  args={{ 
    itemHeight: 40,
    containerHeight: 200,
    overscan: 2
  }}
>
  <div style="border: 1px solid var(--border); border-radius: 8px; overflow: hidden;">
    <VirtualList 
      items={sampleItems}
      itemHeight={40}
      containerHeight={200}
      overscan={2}
    >
      {#each visibleItems as { item, index } (item.id)}
        <div style="padding: 10px; border-bottom: 1px solid var(--border);">
          <strong>{item.text}</strong>
        </div>
      {/each}
    </VirtualList>
  </div>
</Story>





