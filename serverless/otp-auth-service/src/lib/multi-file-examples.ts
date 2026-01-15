/**
 * Multi-file code examples for IDE-like viewer
 */

export const reactMultiFileExample = [
  {
    name: 'OTPLogin.tsx',
    path: 'src/components/OTPLogin.tsx',
    language: 'tsx',
    description: '<strong>Main Component:</strong> Handles OTP authentication flow with email input and OTP verification.',
    content: `import { useState } from 'react';
import { requestOTP, verifyOTP } from '../services/otpService';
import { EmailStep } from './EmailStep';
import { OTPStep } from './OTPStep';
import { Welcome } from './Welcome';

export function OTPLogin() {
  const [step, setStep] = useState<'email' | 'otp' | 'welcome'>('email');
  const [email, setEmail] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState('');

  const handleRequestOTP = async (email: string) => {
    try {
      setError('');
      await requestOTP(email);
      setEmail(email);
      setStep('otp');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send OTP');
    }
  };

  const handleVerifyOTP = async (otp: string) => {
    try {
      setError('');
      const result = await verifyOTP(email, otp);
      setToken(result.access_token);
      localStorage.setItem('auth_token', result.access_token);
      setStep('welcome');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid OTP');
    }
  };

  const handleBack = () => {
    setStep('email');
    setEmail('');
    setError('');
  };

  return (
    <div className="login-container">
      {step === 'email' && (
        <EmailStep 
          onSubmit={handleRequestOTP} 
          error={error}
        />
      )}
      
      {step === 'otp' && (
        <OTPStep 
          email={email}
          onSubmit={handleVerifyOTP}
          onBack={handleBack}
          error={error}
        />
      )}
      
      {step === 'welcome' && token && (
        <Welcome email={email} />
      )}
    </div>
  );
}`
  },
  {
    name: 'otpService.ts',
    path: 'src/services/otpService.ts',
    language: 'typescript',
    description: '<strong>API Service:</strong> Handles all API calls to the OTP Auth service with TypeScript types.',
    content: `const API_BASE_URL = 'https://auth.idling.app';
const API_KEY = import.meta.env.VITE_OTP_API_KEY;

interface OTPRequestResponse {
  success: boolean;
  message: string;
  expiresIn: number;
  remaining: number;
}

interface OTPVerifyResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
  sub: string;
  email: string;
  email_verified: boolean;
}

export async function requestOTP(email: string): Promise<OTPRequestResponse> {
  const response = await fetch(\`\${API_BASE_URL}/auth/request-otp\`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-OTP-API-Key': API_KEY,
    },
    body: JSON.stringify({ email }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to request OTP');
  }

  return response.json();
}

export async function verifyOTP(
  email: string,
  otp: string
): Promise<OTPVerifyResponse> {
  const response = await fetch(\`\${API_BASE_URL}/auth/verify-otp\`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-OTP-API-Key': API_KEY,
    },
    body: JSON.stringify({ email, otp }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to verify OTP');
  }

  return response.json();
}`
  },
  {
    name: 'EmailStep.tsx',
    path: 'src/components/EmailStep.tsx',
    language: 'tsx',
    description: '<strong>Email Input Component:</strong> Reusable form for email entry with validation.',
    content: `import { useState, FormEvent } from 'react';

interface EmailStepProps {
  onSubmit: (email: string) => Promise<void>;
  error: string;
}

export function EmailStep({ onSubmit, error }: EmailStepProps) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSubmit(email);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <h1>Login</h1>
      
      <div className="form-group">
        <label htmlFor="email">Email Address</label>
        <input
          type="email"
          id="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your@email.com"
          required
          disabled={loading}
        />
      </div>

      <button type="submit" disabled={loading}>
        {loading ? 'Sending...' : 'Send OTP'}
      </button>

      {error && <div className="error">{error}</div>}
    </form>
  );
}`
  },
  {
    name: 'OTPStep.tsx',
    path: 'src/components/OTPStep.tsx',
    language: 'tsx',
    description: '<strong>OTP Verification Component:</strong> Handles 9-digit OTP code entry with auto-format.',
    content: `import { useState, FormEvent } from 'react';

interface OTPStepProps {
  email: string;
  onSubmit: (otp: string) => Promise<void>;
  onBack: () => void;
  error: string;
}

export function OTPStep({ email, onSubmit, onBack, error }: OTPStepProps) {
  const [otp, setOTP] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (otp.length !== 9) return;
    
    setLoading(true);
    try {
      await onSubmit(otp);
    } finally {
      setLoading(false);
    }
  };

  const handleOTPChange = (value: string) => {
    const digits = value.replace(/\\D/g, '').slice(0, 9);
    setOTP(digits);
  };

  return (
    <form onSubmit={handleSubmit}>
      <h1>Verify OTP</h1>
      
      <p className="info">
        Enter the 9-digit code sent to <strong>{email}</strong>
      </p>

      <div className="form-group">
        <label htmlFor="otp">OTP Code</label>
        <input
          type="text"
          id="otp"
          value={otp}
          onChange={(e) => handleOTPChange(e.target.value)}
          placeholder="123456789"
          required
          pattern="[0-9]{9}"
          disabled={loading}
          autoFocus
        />
      </div>

      <button type="submit" disabled={loading || otp.length !== 9}>
        {loading ? 'Verifying...' : 'Verify'}
      </button>

      <button 
        type="button" 
        className="back-button" 
        onClick={onBack}
        disabled={loading}
      >
        Back
      </button>

      {error && <div className="error">{error}</div>}
    </form>
  );
}`
  },
  {
    name: '.env',
    path: '.env',
    language: 'bash',
    description: '<strong>Environment Variables:</strong> Store your API key securely. Get your key from the dashboard.',
    content: `# OTP Auth API Configuration
VITE_OTP_API_KEY=otp_live_sk_your_api_key_here

# API Base URL
VITE_API_BASE_URL=https://auth.idling.app`
  },
  {
    name: 'package.json',
    path: 'package.json',
    language: 'json',
    description: '<strong>Dependencies:</strong> Minimal setup with React and TypeScript. No additional auth libraries needed!',
    content: `{
  "name": "otp-auth-example",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "@vitejs/plugin-react": "^4.2.0",
    "typescript": "^5.3.0",
    "vite": "^5.0.0"
  }
}`
  }
];

export const svelteMultiFileExample = [
  {
    name: 'OTPLogin.svelte',
    path: 'src/components/OTPLogin.svelte',
    language: 'svelte',
    description: '<strong>Main Component:</strong> Svelte implementation with reactive state management.',
    content: `<script lang="ts">
  import { requestOTP, verifyOTP } from '../services/otpService';
  import EmailStep from './EmailStep.svelte';
  import OTPStep from './OTPStep.svelte';
  import Welcome from './Welcome.svelte';

  let step: 'email' | 'otp' | 'welcome' = 'email';
  let email = '';
  let token: string | null = null;
  let error = '';

  async function handleRequestOTP(e: CustomEvent<string>) {
    try {
      error = '';
      await requestOTP(e.detail);
      email = e.detail;
      step = 'otp';
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to send OTP';
    }
  }

  async function handleVerifyOTP(e: CustomEvent<string>) {
    try {
      error = '';
      const result = await verifyOTP(email, e.detail);
      token = result.access_token;
      localStorage.setItem('auth_token', result.access_token);
      step = 'welcome';
    } catch (err) {
      error = err instanceof Error ? err.message : 'Invalid OTP';
    }
  }

  function handleBack() {
    step = 'email';
    email = '';
    error = '';
  }
</script>

<div class="login-container">
  {#if step === 'email'}
    <EmailStep on:submit={handleRequestOTP} {error} />
  {:else if step === 'otp'}
    <OTPStep {email} on:submit={handleVerifyOTP} on:back={handleBack} {error} />
  {:else if step === 'welcome' && token}
    <Welcome {email} />
  {/if}
</div>

<style>
  .login-container {
    background: white;
    padding: 2rem;
    border-radius: 8px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
    width: 100%;
    max-width: 400px;
  }
</style>`
  },
  {
    name: 'otpService.ts',
    path: 'src/services/otpService.ts',
    language: 'typescript',
    description: '<strong>API Service:</strong> Type-safe API calls with Svelte-compatible error handling.',
    content: `import { env } from '$env/dynamic/public';

const API_BASE_URL = 'https://auth.idling.app';
const API_KEY = env.PUBLIC_OTP_API_KEY;

interface OTPRequestResponse {
  success: boolean;
  message: string;
  expiresIn: number;
  remaining: number;
}

interface OTPVerifyResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
  sub: string;
  email: string;
  email_verified: boolean;
}

export async function requestOTP(email: string): Promise<OTPRequestResponse> {
  const response = await fetch(\`\${API_BASE_URL}/auth/request-otp\`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-OTP-API-Key': API_KEY,
    },
    body: JSON.stringify({ email }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to request OTP');
  }

  return response.json();
}

export async function verifyOTP(
  email: string,
  otp: string
): Promise<OTPVerifyResponse> {
  const response = await fetch(\`\${API_BASE_URL}/auth/verify-otp\`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-OTP-API-Key': API_KEY,
    },
    body: JSON.stringify({ email, otp }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to verify OTP');
  }

  return response.json();
}`
  },
  {
    name: 'EmailStep.svelte',
    path: 'src/components/EmailStep.svelte',
    language: 'svelte',
    description: '<strong>Email Input Component:</strong> Reactive form with Svelte event dispatchers.',
    content: `<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let error = '';
  
  const dispatch = createEventDispatcher<{ submit: string }>();
  
  let email = '';
  let loading = false;

  async function handleSubmit(e: Event) {
    e.preventDefault();
    loading = true;
    try {
      dispatch('submit', email);
    } finally {
      loading = false;
    }
  }
</script>

<form on:submit={handleSubmit}>
  <h1>Login</h1>
  
  <div class="form-group">
    <label for="email">Email Address</label>
    <input
      type="email"
      id="email"
      bind:value={email}
      placeholder="your@email.com"
      required
      disabled={loading}
    />
  </div>

  <button type="submit" disabled={loading}>
    {loading ? 'Sending...' : 'Send OTP'}
  </button>

  {#if error}
    <div class="error">{error}</div>
  {/if}
</form>

<style>
  .form-group {
    margin-bottom: 1rem;
  }

  label {
    display: block;
    margin-bottom: 0.5rem;
    color: #555;
    font-size: 0.875rem;
    font-weight: 500;
  }

  input {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 1rem;
  }

  button {
    width: 100%;
    padding: 0.75rem;
    background: #007bff;
    color: white;
    border: none;
    border-radius: 4px;
    font-size: 1rem;
    font-weight: 500;
    cursor: pointer;
  }

  button:disabled {
    background: #ccc;
    cursor: not-allowed;
  }

  .error {
    color: #dc3545;
    font-size: 0.875rem;
    margin-top: 0.5rem;
  }
</style>`
  },
  {
    name: '.env',
    path: '.env',
    language: 'bash',
    description: '<strong>Environment Variables:</strong> SvelteKit environment configuration.',
    content: `# OTP Auth API Configuration
PUBLIC_OTP_API_KEY=otp_live_sk_your_api_key_here

# API Base URL
PUBLIC_API_BASE_URL=https://auth.idling.app`
  },
  {
    name: 'package.json',
    path: 'package.json',
    language: 'json',
    description: '<strong>Dependencies:</strong> SvelteKit with TypeScript - minimal and fast!',
    content: `{
  "name": "otp-auth-svelte-example",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite dev",
    "build": "vite build"
  },
  "dependencies": {
    "@sveltejs/kit": "^2.0.0"
  },
  "devDependencies": {
    "@sveltejs/vite-plugin-svelte": "^3.0.0",
    "svelte": "^4.2.0",
    "typescript": "^5.3.0",
    "vite": "^5.0.0"
  }
}`
  }
];

export const vanillaMultiFileExample = [
  {
    name: 'index.html',
    path: 'index.html',
    language: 'html',
    description: '<strong>Main HTML:</strong> Minimal HTML structure with inline styles and scripts.',
    content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>OTP Login</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <div class="login-container">
    <div id="login-form"></div>
  </div>
  
  <script type="module" src="main.js"></script>
</body>
</html>`
  },
  {
    name: 'main.js',
    path: 'main.js',
    language: 'javascript',
    description: '<strong>Main Script:</strong> Vanilla JS with no framework dependencies - just fetch API!',
    content: `import { requestOTP, verifyOTP } from './otpService.js';

let currentStep = 'email';
let userEmail = '';

function render() {
  const container = document.getElementById('login-form');
  
  if (currentStep === 'email') {
    container.innerHTML = \`
      <h1>Login</h1>
      <form id="email-form">
        <div class="form-group">
          <label for="email">Email Address</label>
          <input type="email" id="email" placeholder="your@email.com" required>
        </div>
        <button type="submit">Send OTP</button>
        <div id="error" class="error"></div>
      </form>
    \`;
    
    document.getElementById('email-form').addEventListener('submit', handleEmailSubmit);
  } 
  else if (currentStep === 'otp') {
    container.innerHTML = \`
      <h1>Verify OTP</h1>
      <p class="info">Enter the 9-digit code sent to <strong>\${userEmail}</strong></p>
      <form id="otp-form">
        <div class="form-group">
          <label for="otp">OTP Code</label>
          <input type="text" id="otp" placeholder="123456789" pattern="[0-9]{9}" required>
        </div>
        <button type="submit">Verify</button>
        <button type="button" class="back-button" id="back-btn">Back</button>
        <div id="error" class="error"></div>
      </form>
    \`;
    
    document.getElementById('otp-form').addEventListener('submit', handleOTPSubmit);
    document.getElementById('back-btn').addEventListener('click', () => {
      currentStep = 'email';
      render();
    });
  }
  else if (currentStep === 'welcome') {
    container.innerHTML = \`
      <div class="welcome">
        <h1>Welcome!</h1>
        <p>You're logged in as <strong>\${userEmail}</strong></p>
      </div>
    \`;
  }
}

async function handleEmailSubmit(e) {
  e.preventDefault();
  const email = document.getElementById('email').value;
  const errorEl = document.getElementById('error');
  
  try {
    errorEl.textContent = '';
    await requestOTP(email);
    userEmail = email;
    currentStep = 'otp';
    render();
  } catch (err) {
    errorEl.textContent = err.message;
  }
}

async function handleOTPSubmit(e) {
  e.preventDefault();
  const otp = document.getElementById('otp').value;
  const errorEl = document.getElementById('error');
  
  try {
    errorEl.textContent = '';
    const result = await verifyOTP(userEmail, otp);
    localStorage.setItem('auth_token', result.access_token);
    currentStep = 'welcome';
    render();
  } catch (err) {
    errorEl.textContent = err.message;
  }
}

// Initial render
render();`
  },
  {
    name: 'otpService.js',
    path: 'otpService.js',
    language: 'javascript',
    description: '<strong>API Service:</strong> Simple fetch-based API calls. No dependencies required!',
    content: `const API_BASE_URL = 'https://auth.idling.app';
const API_KEY = 'YOUR_API_KEY_HERE'; // Replace with your API key

export async function requestOTP(email) {
  const response = await fetch(\`\${API_BASE_URL}/auth/request-otp\`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-OTP-API-Key': API_KEY,
    },
    body: JSON.stringify({ email }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to request OTP');
  }

  return response.json();
}

export async function verifyOTP(email, otp) {
  const response = await fetch(\`\${API_BASE_URL}/auth/verify-otp\`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-OTP-API-Key': API_KEY,
    },
    body: JSON.stringify({ email, otp }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to verify OTP');
  }

  return response.json();
}`
  },
  {
    name: 'styles.css',
    path: 'styles.css',
    language: 'css',
    description: '<strong>Styles:</strong> Clean, modern CSS with no preprocessors needed.',
    content: `* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: #f5f5f5;
}

.login-container {
  background: white;
  padding: 2rem;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  width: 100%;
  max-width: 400px;
}

h1 {
  margin-bottom: 1.5rem;
  color: #333;
}

.form-group {
  margin-bottom: 1rem;
}

label {
  display: block;
  margin-bottom: 0.5rem;
  color: #555;
  font-size: 0.875rem;
  font-weight: 500;
}

input {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1rem;
}

input:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);
}

button {
  width: 100%;
  padding: 0.75rem;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
}

button:hover:not(:disabled) {
  background: #0056b3;
}

button:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.back-button {
  background: #6c757d;
  margin-top: 0.5rem;
}

.back-button:hover:not(:disabled) {
  background: #5a6268;
}

.error {
  color: #dc3545;
  font-size: 0.875rem;
  margin-top: 0.5rem;
}

.welcome {
  text-align: center;
  padding: 2rem;
}`
  }
];
