# Rate Limit Info Card Component

A reusable card component that explains how dynamic rate limiting works in the OTP authentication system. Can be used standalone or embedded in tooltips.

## Features

- **Standalone Card**: Use as a full card component in any page or modal
- **Compact Mode**: Smaller version perfect for tooltips
- **Visual Examples**: Shows real scenarios with calculations
- **Adjustment Factors**: Explains bonuses and penalties
- **Responsive**: Works on mobile and desktop

## Usage

### Standalone Card

```svelte
<script>
  import { RateLimitInfoCard } from '@shared-components/rate-limit-info';
</script>

<RateLimitInfoCard />
```

### Compact Version (for Tooltips)

```svelte
<script>
  import { RateLimitInfoCard } from '@shared-components/rate-limit-info';
  import Tooltip from '@shared-components/tooltip/Tooltip.svelte';
</script>

<Tooltip>
  <RateLimitInfoCard compact={true} />
</Tooltip>
```

### With Custom Styling

```svelte
<RateLimitInfoCard className="my-custom-class" />
```

### With Dynamic User Data (Personalized Recommendations)

```svelte
<script>
  import { RateLimitInfoCard } from '@shared-components/rate-limit-info';
  
  // From rate limit error response
  const rateLimitDetails = {
    emailLimit: {
      current: 1,
      max: 1,
      resetAt: '2024-01-01T12:00:00Z'
    },
    failedAttempts: 3
  };
</script>

<RateLimitInfoCard 
  emailLimit={rateLimitDetails.emailLimit}
  failedAttempts={rateLimitDetails.failedAttempts}
  baseLimit={3}
/>
```

When dynamic data is provided, the component will:
- Show the user's current scenario (e.g., "Suspicious Activity - 1/hour limit")
- Display personalized recommendations for improving their limit
- Highlight which example scenario matches their current status
- Show actionable steps like "Successfully complete a login" to increase their limit

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `compact` | `boolean` | `false` | Use compact version for tooltips |
| `className` | `string` | `''` | Additional CSS classes |
| `emailLimit` | `{ current: number; max: number; resetAt?: string } \| null` | `null` | User's current email rate limit status (enables dynamic content) |
| `failedAttempts` | `number \| null` | `null` | Number of failed OTP attempts (used for recommendations) |
| `baseLimit` | `number` | `3` | Base rate limit for the tier (defaults to free tier) |

## Examples Shown

The component displays 5 scenarios:

1. **New User**: 3 + 2 = 5/hour (first time using email)
2. **Trusted User**: 3 + 1 = 4/hour (recent successful login)
3. **Normal User**: 3 + 0 = 3/hour (standard usage)
4. **Frequent Requester**: 3 - 1 = 2/hour (many requests recently)
5. **Suspicious Activity**: 3 - 2 = 1/hour (high failure rate)

When dynamic data is provided, the matching scenario is highlighted with a "(You)" badge.

## Dynamic Recommendations

When `emailLimit` and/or `failedAttempts` are provided, the component generates personalized recommendations:

- **High Priority**: Actions that can immediately improve a restricted limit
- **Medium Priority**: Actions that provide moderate improvements
- **Low Priority**: Long-term optimization suggestions

Example recommendations:
- "Successfully complete a login"  Reduces failure rate, could increase limit from 1 to 2-3/hour
- "Wait 24 hours"  Resets request count, could increase limit from 2 to 3/hour
- "Successfully log in"  Gets verified email bonus, adds +1 to limit (up to 4/hour)

## Integration with Error Tooltips

You can integrate this into the existing error tooltip system:

```svelte
<script>
  import { RateLimitInfoCard } from '@shared-components/rate-limit-info';
  import { generateRateLimitTooltip } from '@shared-components/error-mapping/error-legend';
</script>

<!-- In your error display -->
{#if errorCode === 'email_rate_limit_exceeded'}
  <div class="error-tooltip">
    <!-- Existing error message -->
    <RateLimitInfoCard compact={true} />
  </div>
{/if}
```

## Styling

The component uses CSS variables from the shared styles system:
- `--card`: Card background
- `--bg-dark`: Dark background gradient
- `--border`: Border color
- `--text`: Primary text color
- `--text-secondary`: Secondary text color
- `--success`: Positive adjustments (green)
- `--warning`: Negative adjustments (yellow)
- `--info`: Info color (blue)

## Accessibility

- Semantic HTML structure
- Proper heading hierarchy
- Color contrast meets WCAG standards
- Screen reader friendly

