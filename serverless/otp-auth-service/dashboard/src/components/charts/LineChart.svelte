<!--
  Line Chart Component
  For time-series data and trends
-->
<script lang="ts">
  import Chart from './Chart.svelte';
  import * as Plot from '@observablehq/plot';
  import type { PlotOptions } from '@observablehq/plot';

  export let data: Array<Record<string, any>> = [];
  export let x: string | ((d: any) => any) = 'date';
  export let y: string | string[] | ((d: any) => any) = 'value';
  export let series: string | ((d: any) => any) | undefined = undefined;
  export let title: string | undefined = undefined;
  export let height: number = 400;
  export let width: number | string = '100%';
  export let colors: string[] | undefined = undefined;

  // Transform data for multi-series if y is an array
  $: transformedData = Array.isArray(y) && typeof y[0] === 'string'
    ? data.flatMap(d => 
        y.map(key => ({
          ...d,
          variable: key,
          value: d[key] || 0
        }))
      )
    : data;

  $: yField = Array.isArray(y) && typeof y[0] === 'string' ? 'value' : y;

  $: options = {
    title,
    height,
    width: typeof width === 'number' ? width : undefined,
    marks: [
      Plot.line(transformedData, {
        x,
        y: yField,
        stroke: Array.isArray(y) && typeof y[0] === 'string' ? 'variable' : series,
        curve: 'linear'
      }),
      Plot.dot(transformedData, {
        x,
        y: yField,
        fill: Array.isArray(y) && typeof y[0] === 'string' ? 'variable' : series
      })
    ],
    x: {
      grid: true,
      label: typeof x === 'string' ? x : 'X'
    },
    y: {
      grid: true,
      label: Array.isArray(y) ? 'Value' : (typeof y === 'string' ? y : 'Y')
    },
    color: {
      legend: true,
      ...(colors && { range: colors })
    }
  } as PlotOptions;
</script>

<Chart {options} {height} {width} />

