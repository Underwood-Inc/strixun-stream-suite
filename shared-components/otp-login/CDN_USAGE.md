# OTP Login Library - CDN Usage Guide

This library can be used directly from a CDN without any build step. Simply include the script tag and start using it.

## Quick Start

### 1. Include the Library

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>OTP Login Example</title>
  <!-- Include the OTP Login library -->
  <script src="https://cdn.example.com/otp-login-svelte.min.js"></script>
  <!-- Or use the core library only -->
  <script src="https://cdn.example.com/otp-core.min.js"></script>
</head>
<body>
  <div id="login-container"></div>

  <script>
    // Mount the login component
    const component = OtpLoginSvelte.mountOtpLogin({
      target: document.getElementById('login-container'),
      apiUrl: 'https://auth.idling.app',
      otpEncryptionKey: 'YOUR_ENCRYPTION_KEY_HERE', // Required: 32+ characters
      onSuccess: (data) => {
        console.log('Login successful!', data);
        // Store the token
        localStorage.setItem('auth_token', data.token);
        // Redirect or update UI
        window.location.href = '/dashboard';
      },
      onError: (error) => {
        console.error('Login failed:', error);
        alert('Login failed: ' + error);
      },
      title: 'Sign In',
      subtitle: 'Enter your email to receive a verification code',
      showAsModal: false, // Set to true for modal overlay
    });
  </script>
</body>
</html>
```

## API Reference

### OtpLoginSvelte.mountOtpLogin(options)

Mounts the OTP login component to a DOM element.

#### Parameters

- `target` (HTMLElement, required) - The DOM element to mount the component to
- `apiUrl` (string, required) - Base URL of the OTP auth API
- `otpEncryptionKey` (string, required) - Encryption key for OTP requests (must be 32+ characters)
- `onSuccess` (function, required) - Callback when login succeeds
  - Receives: `{ token: string, email: string, userId?: string, displayName?: string, expiresAt?: number }`
- `onError` (function, optional) - Callback when login fails
  - Receives: `error: string`
- `endpoints` (object, optional) - Custom API endpoints
  - `requestOtp?: string` - Custom request OTP endpoint (default: `/auth/request-otp`)
  - `verifyOtp?: string` - Custom verify OTP endpoint (default: `/auth/verify-otp`)
- `customHeaders` (object, optional) - Custom headers to include in requests
- `title` (string, optional) - Login form title (default: "Sign In")
- `subtitle` (string, optional) - Login form subtitle (default: "Enter your email to receive a verification code")
- `showAsModal` (boolean, optional) - Show as modal overlay (default: false)
- `onClose` (function, optional) - Callback when modal is closed (only used when `showAsModal: true`)

#### Returns

Returns the Svelte component instance. You can call `.$destroy()` on it to unmount:

```javascript
const component = OtpLoginSvelte.mountOtpLogin({ ... });
// Later, to unmount:
component.$destroy();
```

## Using the Core Library Only

If you want to build your own UI and only use the core logic:

```html
<script src="https://cdn.example.com/otp-core.min.js"></script>
<script>
  const login = new OtpLoginCore({
    apiUrl: 'https://auth.idling.app',
    otpEncryptionKey: 'YOUR_ENCRYPTION_KEY_HERE',
    onSuccess: (data) => {
      console.log('Login successful!', data);
      localStorage.setItem('auth_token', data.token);
    },
    onError: (error) => {
      console.error('Login failed:', error);
    },
  });

  // Subscribe to state changes
  login.subscribe((state) => {
    console.log('State changed:', state);
    // Update your UI based on state
    if (state.step === 'email') {
      // Show email input
    } else if (state.step === 'otp') {
      // Show OTP input
    }
  });

  // User actions
  login.setEmail('user@example.com');
  await login.requestOtp();
  
  login.setOtp('123456789');
  await login.verifyOtp();
</script>
```

## Modal Example

```html
<script>
  let loginComponent = null;

  function showLogin() {
    const container = document.getElementById('login-modal-container');
    loginComponent = OtpLoginSvelte.mountOtpLogin({
      target: container,
      apiUrl: 'https://auth.idling.app',
      otpEncryptionKey: 'YOUR_ENCRYPTION_KEY_HERE',
      onSuccess: (data) => {
        console.log('Login successful!', data);
        hideLogin();
      },
      onError: (error) => {
        console.error('Login failed:', error);
      },
      showAsModal: true,
      onClose: () => {
        hideLogin();
      },
    });
  }

  function hideLogin() {
    if (loginComponent) {
      loginComponent.$destroy();
      loginComponent = null;
    }
  }
</script>

<button onclick="showLogin()">Sign In</button>
<div id="login-modal-container"></div>
```

## Styling

The component uses CSS variables for theming. Include these in your CSS:

```css
:root {
  --accent: #your-accent-color;
  --accent-dark: #your-accent-dark-color;
  --text: #your-text-color;
  --text-secondary: #your-secondary-text-color;
  --card: #your-card-background;
  --bg-dark: #your-dark-background;
  --border: #your-border-color;
  --danger: #your-danger-color;
  --warning: #your-warning-color;
  --spacing-xs: 0.25rem;
  --spacing-sm: 0.5rem;
  --spacing-md: 1rem;
  --spacing-lg: 1.5rem;
  --spacing-xl: 2rem;
  --spacing-2xl: 3rem;
}
```

## Security Notes

1. **Encryption Key**: The `otpEncryptionKey` must be at least 32 characters long and should match your server's `SERVICE_ENCRYPTION_KEY`.

2. **HTTPS Only**: Always serve the library over HTTPS in production.

3. **Key Management**: Never hardcode the encryption key in client-side code. Consider:
   - Using environment variables at build time
   - Injecting the key via a secure server-side endpoint
   - Using a key management service

4. **CORS**: Ensure your API server allows requests from your domain.

## Browser Support

- Modern browsers with ES2020 support
- Web Crypto API support (required for encryption)
- Fetch API support

## Versioning

The library follows semantic versioning. Include a version in your CDN URL:

```
https://cdn.example.com/otp-login-svelte@1.0.0.min.js
```

## Troubleshooting

### "OTP encryption key is required" Error

Make sure you're providing the `otpEncryptionKey` parameter and it's at least 32 characters long.

### "Network error" or CORS Errors

1. Check that your API URL is correct
2. Ensure your API server allows CORS from your domain
3. Verify the API endpoints are accessible

### Component Not Rendering

1. Make sure the target element exists in the DOM
2. Check browser console for errors
3. Verify the script loaded successfully

## Examples

See the `examples/` directory for complete working examples:
- `basic.html` - Basic usage
- `modal.html` - Modal overlay example
- `custom-styling.html` - Custom CSS variables
- `core-only.html` - Using core library without UI

