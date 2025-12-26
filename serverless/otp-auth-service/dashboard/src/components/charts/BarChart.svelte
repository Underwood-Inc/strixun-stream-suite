<!--
  Bar Chart Component
  For categorical data and comparisons
-->
<script lang="ts">
  import Chart from './Chart.svelte';
  import * as Plot from '@observablehq/plot';
  import type { PlotOptions } from '@observablehq/plot';

  export let data: Array<Record<string, any>> = [];
  export let x: string | ((d: any) => any) = 'category';
  export let y: string | ((d: any) => any) = 'value';
  export let fill: string | ((d: any) => any) | undefined = undefined;
  export let title: string | undefined = undefined;
  export let height: number = 400;
  export let width: number | string = '100%';
  export let horizontal: boolean = false;
  export let colors: string[] | undefined = undefined;

  $: options = {
    title,
    height,
    width: typeof width === 'number' ? width : undefined,
    marks: [
      horizontal
        ? Plot.barX(data, {
            y,
            x,
            fill: fill
          })
        : Plot.barY(data, {
            x,
            y,
            fill: fill
          })
    ],
    [horizontal ? 'y' : 'x']: {
      grid: true,
      label: horizontal 
        ? (typeof y === 'string' ? y : 'Y')
        : (typeof x === 'string' ? x : 'X')
    },
    [horizontal ? 'x' : 'y']: {
      grid: true,
      label: horizontal
        ? (typeof x === 'string' ? x : 'X')
        : (typeof y === 'string' ? y : 'Y')
    },
    ...(colors && {
      color: {
        range: colors
      }
    })
  } as PlotOptions;
</script>

<Chart {options} {height} {width} />

