# Analytics Visualization Research & Recommendations

> **Date**: 2025-12-26  
> **Purpose**: Research lightweight, unopinionated charting libraries for OTP Auth Dashboard analytics  
> **Framework**: Svelte 5 + TypeScript  
> **Requirements**: Lightweight, CSS-variable theming, unopinionated styling

---

## ★ Current State Analysis

### Existing Analytics Data Available

The OTP Auth service already tracks comprehensive analytics:

1. **Usage Metrics** (`services/analytics.ts`)
   - OTP requests, verifications, successful logins
   - Failed attempts, emails sent
   - Daily breakdowns with date ranges
   - Success rates, response times (p50, p95, p99)

2. **Real-time Analytics** (`handlers/admin/analytics.ts`)
   - Active users, requests per minute
   - Current hour metrics
   - Last 24 hours aggregation
   - Response time metrics by endpoint
   - Error rates

3. **Error Analytics**
   - Total errors, by category, by endpoint
   - Error timestamps and details

4. **Rate Limiting Stats** (`services/rate-limit.ts`)
   - IP-based and email-based rate limits
   - Usage statistics (requests, failures)
   - Dynamic adjustment tracking

### Current Dashboard Implementation

- **Framework**: Svelte 5 with TypeScript
- **Current State**: Basic metrics display (numbers only, no charts)
- **Styling**: CSS variables for theming (`var(--accent)`, `var(--text)`, etc.)
- **Data Available**: Rich analytics data from backend APIs
- **Missing**: Visual charts, graphs, time-series visualizations

---

## ★ Charting Library Research

### Evaluation Criteria

1. **Lightweight**: Small bundle size (< 50KB gzipped ideal)
2. **Unopinionated Styling**: Full CSS control, CSS variable support
3. **Svelte Compatible**: Works well with Svelte 5
4. **TypeScript Support**: Full type definitions
5. **Feature Rich**: Line, bar, area, pie charts, time-series
6. **Performance**: Smooth animations, efficient rendering
7. **Accessibility**: ARIA labels, keyboard navigation

---

## ★ Library Options Analysis

### Option 1: Observable Plot  **RECOMMENDED**

**Bundle Size**: ~30KB gzipped  
**License**: ISC (MIT-like)  
**GitHub**: https://github.com/observablehq/plot

#### Pros ✓
- **Extremely lightweight** - One of the smallest charting libraries
- **Fully CSS-themeable** - Uses CSS variables and custom properties
- **Unopinionated styling** - No default styles, full control
- **Framework agnostic** - Works with any framework (Svelte, React, Vue)
- **TypeScript native** - Written in TypeScript
- **Powerful** - Built by Observable (D3.js creators)
- **Time-series optimized** - Excellent for analytics dashboards
- **SVG-based** - Scalable, themeable via CSS

#### Cons ✗
- **Learning curve** - Different API than traditional charting libs
- **Documentation** - Good but requires understanding of data structure
- **No built-in animations** - Can add with CSS transitions

#### Theming Example
```typescript
import { Plot } from "@observablehq/plot";

const chart = Plot.plot({
  style: {
    color: "var(--text)",
    background: "var(--card)",
    border: "1px solid var(--border)"
  },
  color: {
    scheme: "custom", // Use CSS variables
    range: ["var(--accent)", "var(--success)", "var(--danger)"]
  }
});
```

#### Bundle Impact
- **npm**: `@observablehq/plot` (~30KB)
- **Tree-shakeable**: Yes, import only what you need
- **Dependencies**: Minimal (uses D3 internals but lightweight)

---

### Option 2: Frappe Charts

**Bundle Size**: ~45KB gzipped  
**License**: MIT  
**GitHub**: https://github.com/frappe/charts

#### Pros ✓
- **Lightweight** - Small bundle size
- **Simple API** - Easy to use
- **Themeable** - CSS variable support
- **Good documentation** - Clear examples
- **Svelte wrapper available** - `svelte-frappe-charts`

#### Cons ✗
- **Less flexible** - More opinionated than Observable Plot
- **Limited chart types** - Fewer options than Plot
- **Maintenance** - Less active development

#### Theming Example
```typescript
import Chart from "frappe-charts";

const chart = new Chart({
  parent: container,
  data: {...},
  colors: [
    "var(--accent)",
    "var(--success)",
    "var(--danger)"
  ]
});
```

---

### Option 3: Chart.js

**Bundle Size**: ~60KB gzipped (with plugins)  
**License**: MIT  
**GitHub**: https://github.com/chartjs/Chart.js

#### Pros ✓
- **Very popular** - Large community, extensive docs
- **Feature rich** - Many chart types and plugins
- **Themeable** - Can use CSS variables
- **Svelte wrapper** - `svelte-chartjs` available
- **Animations** - Built-in smooth animations

#### Cons ✗
- **Larger bundle** - Heavier than alternatives
- **More opinionated** - Default styles need overriding
- **Plugin system** - Can bloat bundle if not careful

---

### Option 4: D3.js (Direct)

**Bundle Size**: ~80KB+ gzipped  
**License**: BSD-3-Clause  
**GitHub**: https://github.com/d3/d3

#### Pros ✓
- **Ultimate flexibility** - Complete control
- **Powerful** - Industry standard for data visualization
- **Unopinionated** - No default styles

#### Cons ✗
- **Heavy** - Large bundle size
- **Steep learning curve** - Complex API
- **Time-consuming** - Requires more code
- **Overkill** - Too powerful for simple charts

---

### Option 5: Recharts

**Bundle Size**: ~70KB gzipped  
**License**: MIT

#### Cons ✗
- **React-only** - Not suitable for Svelte
- **Heavy** - Large bundle size
- **Not recommended** - Wrong framework

---

## ★ Recommendation: Observable Plot

### Why Observable Plot?

1. **Lightweight** ✓ - Smallest bundle size (~30KB)
2. **Unopinionated** ✓ - Full CSS control, no default styles
3. **CSS Variables** ✓ - Native support for CSS custom properties
4. **Svelte Compatible** ✓ - Framework agnostic, works perfectly
5. **TypeScript** ✓ - Written in TypeScript, full type support
6. **Time-Series** ✓ - Optimized for analytics dashboards
7. **Maintained** ✓ - Active development by Observable team

### Implementation Approach

#### 1. Install Package
```bash
cd serverless/otp-auth-service/dashboard
pnpm add @observablehq/plot
```

#### 2. Create Svelte Wrapper Component
```typescript
// src/components/Chart.svelte
<script lang="ts">
  import { Plot } from "@observablehq/plot";
  import { onMount, onDestroy } from "svelte";
  
  export let data: any;
  export let options: any = {};
  
  let container: HTMLDivElement;
  let plot: any;
  
  onMount(() => {
    if (container && data) {
      plot = Plot.plot({
        ...options,
        style: {
          color: "var(--text)",
          background: "var(--card)",
          ...options.style
        }
      });
      container.appendChild(plot);
    }
  });
  
  onDestroy(() => {
    if (plot) plot.remove();
  });
</script>

<div bind:this={container} class="chart-container"></div>

<style>
  .chart-container {
    width: 100%;
    height: 100%;
  }
</style>
```

#### 3. Chart Types Needed

Based on analytics data available:

1. **Line Chart** - Daily breakdown (OTP requests over time)
2. **Bar Chart** - Error categories, endpoint metrics
3. **Area Chart** - Success rate trends
4. **Pie/Donut Chart** - Error distribution
5. **Time-Series** - Real-time metrics, response times
6. **Sparklines** - Mini charts for metric cards

---

## ★ Recommended Visualizations

### 1. Overview Dashboard
- **Line Chart**: OTP Requests & Verifications (30-day trend)
- **Area Chart**: Success Rate Over Time
- **Bar Chart**: Today's Metrics (requests, verifications, logins)
- **Sparklines**: Mini trend indicators in metric cards

### 2. Real-Time Analytics
- **Time-Series Line**: Requests per Minute (last hour)
- **Gauge/Donut**: Current Success Rate
- **Bar Chart**: Active Users by Hour

### 3. Error Analytics
- **Pie Chart**: Errors by Category
- **Bar Chart**: Errors by Endpoint
- **Line Chart**: Error Rate Trend

### 4. Performance Metrics
- **Line Chart**: Response Time Percentiles (p50, p95, p99)
- **Bar Chart**: Average Response Time by Endpoint
- **Area Chart**: Response Time Distribution

### 5. Rate Limiting Insights
- **Line Chart**: Rate Limit Usage Over Time
- **Bar Chart**: IP vs Email Rate Limits
- **Heatmap**: Rate Limit Violations by Hour

---

## ★ Theming Strategy

### CSS Variables Integration

Observable Plot fully supports CSS variables:

```scss
// Use existing CSS variables from your theme
.chart {
  --plot-color: var(--accent);
  --plot-background: var(--card);
  --plot-border: var(--border);
  --plot-text: var(--text);
  --plot-text-secondary: var(--text-secondary);
  
  // Chart-specific colors
  --plot-success: var(--success);
  --plot-danger: var(--danger);
  --plot-warning: var(--warning);
  --plot-info: var(--info);
}
```

### Example Theme Configuration

```typescript
const chartTheme = {
  style: {
    color: "var(--text)",
    background: "var(--card)",
    border: "1px solid var(--border)",
    fontSize: "var(--font-size-sm)",
    fontFamily: "var(--font-family)"
  },
  color: {
    scheme: "custom",
    range: [
      "var(--accent)",
      "var(--success)",
      "var(--danger)",
      "var(--warning)",
      "var(--info)"
    ]
  },
  grid: {
    stroke: "var(--border)",
    strokeOpacity: 0.3
  }
};
```

---

## ★ Bundle Size Comparison

| Library | Bundle Size (gzipped) | Tree-shakeable | Dependencies |
|---------|---------------------|----------------|--------------|
| **Observable Plot** | ~30KB | ✓ Yes | Minimal |
| Frappe Charts | ~45KB | ⚠ Partial | Low |
| Chart.js | ~60KB | ⚠ Partial | Medium |
| D3.js | ~80KB+ | ✓ Yes | High |

---

## ★ Implementation Plan

### Phase 1: Setup & Basic Charts
1. Install `@observablehq/plot`
2. Create reusable `Chart.svelte` component
3. Implement line chart for daily breakdown
4. Add bar chart for error analytics

### Phase 2: Enhanced Visualizations
1. Time-series charts for real-time metrics
2. Pie/donut charts for distributions
3. Sparklines for metric cards
4. Response time visualizations

### Phase 3: Advanced Features
1. Interactive tooltips
2. Zoom/pan for time-series
3. Export functionality (PNG/SVG)
4. Responsive chart sizing

---

## ★ Alternative: Custom SVG Charts

If bundle size is critical, consider lightweight custom SVG components:

**Pros**:
- Zero dependencies
- Full control
- Perfect theming

**Cons**:
- More development time
- Need to implement chart logic
- Less feature-rich

**Recommendation**: Use Observable Plot unless bundle size is extremely critical.

---

## ✓ Final Recommendation

**Use Observable Plot** for the following reasons:

1. ✓ **Lightweight** - Smallest bundle size
2. ✓ **Unopinionated** - Full CSS control
3. ✓ **CSS Variables** - Native support
4. ✓ **Svelte Compatible** - Framework agnostic
5. ✓ **TypeScript** - Full type support
6. ✓ **Maintained** - Active development
7. ✓ **Powerful** - Handles all chart types needed

### Next Steps

1. **Review this research** - Confirm approach
2. **Install Observable Plot** - Add to dashboard
3. **Create chart components** - Build reusable Svelte components
4. **Implement visualizations** - Add charts to Analytics page
5. **Theme integration** - Connect to existing CSS variables

---

## ★ Resources

- **Observable Plot Docs**: https://observablehq.com/plot/
- **Observable Plot GitHub**: https://github.com/observablehq/plot
- **Svelte Integration Guide**: https://observablehq.com/plot/api/plots
- **CSS Variables Guide**: https://observablehq.com/plot/features/styling

---

## ★ Questions to Consider

1. **Bundle Size Priority**: Is 30KB acceptable, or do we need smaller?
2. **Chart Complexity**: Do we need advanced features (zoom, pan, brush)?
3. **Animation Requirements**: Do charts need smooth animations?
4. **Export Needs**: Do users need to export charts (PNG/SVG/PDF)?
5. **Mobile Support**: Do charts need to be mobile-optimized?

---

**Status**:  **AWAITING APPROVAL** - Ready for implementation once approved
