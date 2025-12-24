/**
 * Code examples for different frameworks
 * Extracted to separate file for maintainability
 */
export const vanillaJsExample = `// Vanilla JavaScript/TypeScript Example
const API_URL = 'https://auth.idling.app';

// Step 1: Request OTP
async function requestOTP(email) {
  const response = await fetch(\`\${API_URL}/auth/request-otp\`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email })
  });
  
  if (!response.ok) {
    throw new Error('Failed to request OTP');
  }
  
  return await response.json();
}

// Step 2: Verify OTP
async function verifyOTP(email, otp) {
  const response = await fetch(\`\${API_URL}/auth/verify-otp\`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, otp })
  });
  
  if (!response.ok) {
    throw new Error('Invalid OTP');
  }
  
  const data = await response.json();
  // Store token securely
  localStorage.setItem('auth_token', data.token);
  return data;
}

// Step 3: Use token for authenticated requests
async function getCurrentUser() {
  const token = localStorage.getItem('auth_token');
  
  const response = await fetch(\`\${API_URL}/auth/me\`, {
    headers: {
      'Authorization': \`Bearer \${token}\`
    }
  });
  
  return await response.json();
}

// Usage
async function login() {
  const email = document.getElementById('email').value;
  
  // Request OTP
  await requestOTP(email);
  alert('Check your email for the OTP code!');
  
  // User enters OTP
  const otp = prompt('Enter 6-digit OTP:');
  
  // Verify OTP
  const user = await verifyOTP(email, otp);
  console.log('Logged in as:', user.email);
}`;
export const reactExample = `// React Example
import React, { useState } from 'react';

const API_URL = 'https://auth.idling.app';

function LoginForm() {
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState('email');
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState(null);

  const requestOTP = async () => {
    setLoading(true);
    try {
      const response = await fetch(\`\${API_URL}/auth/request-otp\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      
      if (response.ok) {
        setStep('otp');
        alert('OTP sent to your email!');
      }
    } catch (error) {
      alert('Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const verifyOTP = async () => {
    setLoading(true);
    try {
      const response = await fetch(\`\${API_URL}/auth/verify-otp\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp })
      });
      
      const data = await response.json();
      if (response.ok) {
        setToken(data.token);
        localStorage.setItem('auth_token', data.token);
      }
    } catch (error) {
      alert('Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  if (token) {
    return <div>Welcome! You're logged in.</div>;
  }

  return (
    <div>
      {step === 'email' ? (
        <div>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
          />
          <button onClick={requestOTP} disabled={loading}>
            {loading ? 'Sending...' : 'Send OTP'}
          </button>
        </div>
      ) : (
        <div>
          <input
            type="text"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            placeholder="123456"
            maxLength={6}
          />
          <button onClick={verifyOTP} disabled={loading || otp.length !== 6}>
            {loading ? 'Verifying...' : 'Verify OTP'}
          </button>
          <button onClick={() => setStep('email')}>Back</button>
        </div>
      )}
    </div>
  );
}

export default LoginForm;`;
export const svelteExample = `<!-- Svelte Example -->
<script>
  let email = '';
  let otp = '';
  let step = 'email';
  let loading = false;
  let token = null;

  const API_URL = 'https://auth.idling.app';

  async function requestOTP() {
    loading = true;
    try {
      const response = await fetch(\`\${API_URL}/auth/request-otp\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      
      if (response.ok) {
        step = 'otp';
        alert('OTP sent to your email!');
      }
    } catch (error) {
      alert('Failed to send OTP');
    } finally {
      loading = false;
    }
  }

  async function verifyOTP() {
    loading = true;
    try {
      const response = await fetch(\`\${API_URL}/auth/verify-otp\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp })
      });
      
      const data = await response.json();
      if (response.ok) {
        token = data.token;
        localStorage.setItem('auth_token', data.token);
      }
    } catch (error) {
      alert('Invalid OTP');
    } finally {
      loading = false;
    }
  }
</script>

{#if token}
  <div>Welcome! You're logged in.</div>
{:else if step === 'email'}
  <div>
    <input
      type="email"
      bind:value={email}
      placeholder="your@email.com"
      disabled={loading}
    />
    <button on:click={requestOTP} disabled={loading || !email}>
      {loading ? 'Sending...' : 'Send OTP'}
    </button>
  </div>
{:else}
  <div>
    <input
      type="text"
      bind:value={otp}
      placeholder="123456"
      maxlength="6"
      disabled={loading}
    />
    <button on:click={verifyOTP} disabled={loading || otp.length !== 6}>
      {loading ? 'Verifying...' : 'Verify OTP'}
    </button>
    <button on:click={() => step = 'email'}>Back</button>
  </div>
{/if}`;
//# sourceMappingURL=code-examples.js.map