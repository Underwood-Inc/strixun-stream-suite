<!--
  Pie Chart Component
  For proportional data and distributions
-->
<script lang="ts">
  import Chart from './Chart.svelte';
  import * as Plot from '@observablehq/plot';
  import type { PlotOptions } from '@observablehq/plot';

  export let data: Array<Record<string, any>> = [];
  export let value: string | ((d: any) => any) = 'value';
  export let label: string | ((d: any) => any) = 'label';
  export let title: string | undefined = undefined;
  export let height: number = 400;
  export let width: number | string = '100%';
  export let colors: string[] | undefined = undefined;

  $: chartSize = Math.min(height, width === '100%' ? 400 : typeof width === 'number' ? width : 400);
  $: outerRadius = (chartSize / 2) - 20;
  $: innerRadius = outerRadius * 0.4;

  $: options = {
    title,
    height,
    width: typeof width === 'number' ? width : undefined,
    marks: [
      Plot.arc(data, {
        innerRadius,
        outerRadius,
        fill: label
      })
    ],
    color: {
      legend: true,
      ...(colors && {
        range: colors
      })
    }
  } as PlotOptions;
</script>

<Chart {options} {height} {width} />

