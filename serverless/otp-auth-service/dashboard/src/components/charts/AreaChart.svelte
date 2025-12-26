<!--
  Area Chart Component
  For cumulative data and trends over time
-->
<script lang="ts">
  import Chart from './Chart.svelte';
  import * as Plot from '@observablehq/plot';
  import type { PlotOptions } from '@observablehq/plot';

  export let data: Array<Record<string, any>> = [];
  export let x: string | ((d: any) => any) = 'date';
  export let y: string | ((d: any) => any) = 'value';
  export let series: string | ((d: any) => any) | undefined = undefined;
  export let title: string | undefined = undefined;
  export let height: number = 400;
  export let width: number | string = '100%';
  export let colors: string[] | undefined = undefined;

  $: options = {
    title,
    height,
    width: typeof width === 'number' ? width : undefined,
    marks: [
      Plot.areaY(data, {
        x,
        y,
        fill: series,
        fillOpacity: 0.6,
        curve: 'linear',
        ...(colors && { fill: colors })
      }),
      Plot.line(data, {
        x,
        y,
        stroke: series,
        ...(colors && { stroke: colors })
      })
    ],
    x: {
      grid: true,
      label: typeof x === 'string' ? x : 'X'
    },
    y: {
      grid: true,
      label: typeof y === 'string' ? y : 'Y'
    },
    ...(series && {
      color: {
        legend: true
      }
    })
  } as PlotOptions;
</script>

<Chart {options} {height} {width} />

