# Email Tracking Analytics - How to View Data

**Last Updated**: 2025-12-29

## Overview

Email tracking data is stored in Cloudflare KV, not in Cloudflare's built-in analytics dashboard. The data is stored with the following key patterns:

- **Individual tracking records**: `email_tracking_${emailHash}_${timestamp}`
- **Aggregated analytics**: `email_analytics_${customerId}_${date}` (format: YYYY-MM-DD)

## Option 1: Query KV via Wrangler CLI

### View Today's Email Analytics for a Customer
```bash
cd serverless/otp-auth-service
wrangler kv:key get "email_analytics_${CUSTOMER_ID}_$(date +%Y-%m-%d)" --namespace-id=680c9dbe86854c369dd23e278abb41f9
```

### List All Email Analytics Keys
```bash
wrangler kv:key list --namespace-id=680c9dbe86854c369dd23e278abb41f9 --prefix="email_analytics_"
```

### View a Specific Tracking Record
```bash
# Replace EMAIL_HASH and TIMESTAMP with actual values
wrangler kv:key get "email_tracking_${EMAIL_HASH}_${TIMESTAMP}" --namespace-id=680c9dbe86854c369dd23e278abb41f9
```

## Option 2: Use the Admin API (Recommended)

The email tracking data can be accessed via the admin API endpoint (once implemented):

```bash
# Get email analytics for today
curl -H "Authorization: Bearer YOUR_API_KEY" \
  "https://auth.idling.app/admin/analytics/email?date=2024-12-XX"

# Get email analytics for a date range
curl -H "Authorization: Bearer YOUR_API_KEY" \
  "https://auth.idling.app/admin/analytics/email?startDate=2024-12-01&endDate=2024-12-31"
```

## Option 3: View in Dashboard (Future)

The email tracking analytics can be integrated into the existing analytics dashboard at:
- **URL**: `https://auth.idling.app/dashboard` > Analytics tab
- **Status**: Not yet implemented (needs endpoint addition)

## Data Structure

### Aggregated Analytics (`email_analytics_${customerId}_${date}`)
```json
{
  "opens": 42,
  "countries": {
    "US": 25,
    "GB": 10,
    "CA": 7
  }
}
```

### Individual Tracking Record (`email_tracking_${emailHash}_${timestamp}`)
```json
{
  "emailHash": "abc123...",
  "customerId": "customer-123",
  "timestamp": 1703123456789,
  "otpKey": "otp_abc123_1703123456789",
  "openedAt": 1703123500000,
  "ip": "192.168.1.1",
  "userAgent": "Mozilla/5.0...",
  "country": "US",
  "city": "New York",
  "timezone": "America/New_York"
}
```

## Privacy Notes

- No email addresses are stored (only hashes)
- IP addresses are stored for security analysis
- Data expires after 90 days
- All data is customer-isolated


