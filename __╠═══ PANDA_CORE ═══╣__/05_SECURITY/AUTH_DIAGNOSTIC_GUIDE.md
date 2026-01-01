# Auth Diagnostic Guide - 401 Errors

## The Problem

You're getting 401 Unauthorized errors when `otp-auth-service` tries to call `customer-api`. 

## How to Diagnose the Issue

### Step 1: Check Cloudflare Worker Logs

1. Go to Cloudflare Dashboard ★ Workers & Pages
2. Select `otp-auth-service` worker
3. Go to Logs tab
4. Make a request (try to log in)
5. Look for these log messages:

**From otp-auth-service (sending request):**
```
[Customer API Service Client] Making request
  url: <customer-api-url>
  method: GET/POST/etc
```

**From customer-api (receiving request):**
```
[Customer API] Processing internal call
  origin: <request-origin>
  authenticated: false (internal calls don't require auth)
```

### Step 2: Check for Network Errors

If you see network errors (404, 500, etc.):
- Check that `CUSTOMER_API_URL` is correct
- Verify customer-api worker is deployed and running
- Check network connectivity

## How to Fix

### Option 1: Verify Configuration

Internal calls to customer-api don't require authentication. Verify:
1. `CUSTOMER_API_URL` is set correctly in otp-auth-service
2. Customer-api worker is deployed and accessible
3. Network connectivity is working

### Option 2: Check Logs

If you're seeing errors, check the logs for:
- Network connectivity issues
- Incorrect CUSTOMER_API_URL
- Customer-api worker not responding

## Frontend Encryption Key Issue

The browser logs show:
```
[DEPRECATED] getOtpEncryptionKey() - Service key encryption removed. HTTPS provides transport security.
```

This is expected - service key encryption has been removed. HTTPS provides transport security.

## Summary

Internal service-to-service calls don't require authentication. If you're seeing 401 errors:
1. Check that `CUSTOMER_API_URL` is correct
2. Verify customer-api worker is deployed
3. Check network connectivity
4. Review Cloudflare Worker logs for specific error messages
