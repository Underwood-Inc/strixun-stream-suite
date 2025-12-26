/**
 * Code examples for different frameworks
 * Extracted to separate file for maintainability
 */

export const vanillaJsExample = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>OTP Login</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
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
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      width: 100%;
      max-width: 400px;
    }
    h1 { margin-bottom: 1.5rem; color: #333; }
    .form-group { margin-bottom: 1rem; }
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
      box-shadow: 0 0 0 3px rgba(0,123,255,0.1);
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
    button:hover:not(:disabled) { background: #0056b3; }
    button:disabled {
      background: #ccc;
      cursor: not-allowed;
    }
    .back-button {
      background: #6c757d;
      margin-top: 0.5rem;
    }
    .back-button:hover:not(:disabled) { background: #5a6268; }
    .error {
      color: #dc3545;
      font-size: 0.875rem;
      margin-top: 0.5rem;
    }
    .success {
      color: #28a745;
      font-size: 0.875rem;
      margin-top: 0.5rem;
    }
    .welcome {
      text-align: center;
      padding: 2rem;
    }
  </style>
</head>
<body>
  <div class="login-container">
    <div id="login-form">
      <h1>Login</h1>
      <div id="email-step">
        <div class="form-group">
          <label for="email">Email Address</label>
          <input type="email" id="email" placeholder="your@email.com" required>
        </div>
        <button id="send-otp-btn" onclick="handleRequestOTP()">Send OTP</button>
        <div id="email-error" class="error"></div>
      </div>
      
      <div id="otp-step" style="display: none;">
        <div class="form-group">
          <label for="otp">Enter 6-digit OTP</label>
          <input type="text" id="otp" placeholder="123456" maxlength="6" pattern="[0-9]{6}">
        </div>
        <button id="verify-otp-btn" onclick="handleVerifyOTP()">Verify OTP</button>
        <button class="back-button" onclick="goBack()">Back to Email</button>
        <div id="otp-error" class="error"></div>
      </div>
    </div>
    
    <div id="welcome" style="display: none;" class="welcome">
      <h1>Welcome!</h1>
      <p>You're successfully logged in.</p>
      <p id="user-email"></p>
      <button onclick="logout()" style="margin-top: 1rem;">Logout</button>
    </div>
  </div>

  <script>
    const API_URL = 'https://auth.idling.app';
    let currentEmail = '';

    async function requestOTP(email) {
      const response = await fetch(\`\${API_URL}/auth/request-otp\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to request OTP');
      }
      
      return await response.json();
    }

    async function verifyOTP(email, otp) {
      const response = await fetch(\`\${API_URL}/auth/verify-otp\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Invalid OTP');
      }
      
      const data = await response.json();
      localStorage.setItem('auth_token', data.token);
      return data;
    }

    async function getCurrentUser() {
      const token = localStorage.getItem('auth_token');
      if (!token) return null;
      
      const response = await fetch(\`\${API_URL}/auth/me\`, {
        headers: { 'Authorization': \`Bearer \${token}\` }
      });
      
      if (!response.ok) return null;
      return await response.json();
    }

    async function handleRequestOTP() {
      const emailInput = document.getElementById('email');
      const errorDiv = document.getElementById('email-error');
      const button = document.getElementById('send-otp-btn');
      
      const email = emailInput.value.trim();
      if (!email) {
        errorDiv.textContent = 'Please enter your email address';
        return;
      }
      
      button.disabled = true;
      button.textContent = 'Sending...';
      errorDiv.textContent = '';
      
      try {
        await requestOTP(email);
        currentEmail = email;
        document.getElementById('email-step').style.display = 'none';
        document.getElementById('otp-step').style.display = 'block';
        document.getElementById('otp').focus();
      } catch (error) {
        errorDiv.textContent = error.message;
      } finally {
        button.disabled = false;
        button.textContent = 'Send OTP';
      }
    }

    async function handleVerifyOTP() {
      const otpInput = document.getElementById('otp');
      const errorDiv = document.getElementById('otp-error');
      const button = document.getElementById('verify-otp-btn');
      
      const otp = otpInput.value.trim();
      if (otp.length !== 6) {
        errorDiv.textContent = 'Please enter a 6-digit OTP';
        return;
      }
      
      button.disabled = true;
      button.textContent = 'Verifying...';
      errorDiv.textContent = '';
      
      try {
        const user = await verifyOTP(currentEmail, otp);
        document.getElementById('login-form').style.display = 'none';
        document.getElementById('welcome').style.display = 'block';
        document.getElementById('user-email').textContent = user.email;
      } catch (error) {
        errorDiv.textContent = error.message;
      } finally {
        button.disabled = false;
        button.textContent = 'Verify OTP';
      }
    }

    function goBack() {
      document.getElementById('email-step').style.display = 'block';
      document.getElementById('otp-step').style.display = 'none';
      document.getElementById('otp').value = '';
      document.getElementById('otp-error').textContent = '';
    }

    function logout() {
      localStorage.removeItem('auth_token');
      document.getElementById('login-form').style.display = 'block';
      document.getElementById('welcome').style.display = 'none';
      document.getElementById('email').value = '';
      document.getElementById('otp').value = '';
      goBack();
    }

    // Allow Enter key to submit
    document.getElementById('email').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') handleRequestOTP();
    });
    document.getElementById('otp').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') handleVerifyOTP();
    });

    // Check if already logged in
    window.addEventListener('DOMContentLoaded', async () => {
      const user = await getCurrentUser();
      if (user) {
        document.getElementById('login-form').style.display = 'none';
        document.getElementById('welcome').style.display = 'block';
        document.getElementById('user-email').textContent = user.email;
      }
    });
  </script>
</body>
</html>`;

export const reactExample = `import React, { useState, useEffect } from 'react';

const API_URL = 'https://auth.idling.app';

function LoginForm() {
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState('email');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Check if already logged in
    const token = localStorage.getItem('auth_token');
    if (token) {
      getCurrentUser();
    }
  }, []);

  async function getCurrentUser() {
    const token = localStorage.getItem('auth_token');
    if (!token) return;
    
    try {
      const response = await fetch(\`\${API_URL}/auth/me\`, {
        headers: { 'Authorization': \`Bearer \${token}\` }
      });
      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
      } else {
        localStorage.removeItem('auth_token');
      }
    } catch (err) {
      localStorage.removeItem('auth_token');
    }
  }

  const requestOTP = async (e) => {
    e?.preventDefault();
    if (!email.trim()) {
      setError('Please enter your email address');
      return;
    }
    
    setLoading(true);
    setError('');
    try {
      const response = await fetch(\`\${API_URL}/auth/request-otp\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() })
      });
      
      const data = await response.json();
      if (response.ok) {
        setStep('otp');
        setError('');
      } else {
        setError(data.detail || 'Failed to send OTP');
      }
    } catch (err) {
      setError('Failed to send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const verifyOTP = async (e) => {
    e?.preventDefault();
    if (otp.length !== 6) {
      setError('Please enter a 6-digit OTP');
      return;
    }
    
    setLoading(true);
    setError('');
    try {
      const response = await fetch(\`\${API_URL}/auth/verify-otp\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp })
      });
      
      const data = await response.json();
      if (response.ok) {
        localStorage.setItem('auth_token', data.token);
        setUser(data);
        setError('');
      } else {
        setError(data.detail || 'Invalid OTP');
      }
    } catch (err) {
      setError('Failed to verify OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('auth_token');
    setUser(null);
    setEmail('');
    setOtp('');
    setStep('email');
    setError('');
  };

  if (user) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <h1 style={styles.title}>Welcome!</h1>
          <p style={styles.text}>You're successfully logged in.</p>
          <p style={styles.email}>{user.email}</p>
          <button onClick={logout} style={styles.button}>
            Logout
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>Login</h1>
        
        {step === 'email' ? (
          <form onSubmit={requestOTP}>
            <div style={styles.formGroup}>
              <label style={styles.label}>Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                style={styles.input}
                disabled={loading}
                required
              />
            </div>
            {error && <div style={styles.error}>{error}</div>}
            <button 
              type="submit" 
              disabled={loading || !email.trim()} 
              style={styles.button}
            >
              {loading ? 'Sending...' : 'Send OTP'}
            </button>
          </form>
        ) : (
          <form onSubmit={verifyOTP}>
            <div style={styles.formGroup}>
              <label style={styles.label}>Enter 6-digit OTP</label>
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\\D/g, ''))}
                placeholder="123456"
                maxLength={6}
                style={styles.input}
                disabled={loading}
                required
              />
            </div>
            {error && <div style={styles.error}>{error}</div>}
            <button 
              type="submit" 
              disabled={loading || otp.length !== 6} 
              style={styles.button}
            >
              {loading ? 'Verifying...' : 'Verify OTP'}
            </button>
            <button 
              type="button"
              onClick={() => {
                setStep('email');
                setOtp('');
                setError('');
              }} 
              style={{...styles.button, ...styles.backButton}}
            >
              Back to Email
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    background: '#f5f5f5',
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
  },
  card: {
    background: 'white',
    padding: '2rem',
    borderRadius: '8px',
    boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
    width: '100%',
    maxWidth: '400px'
  },
  title: {
    marginBottom: '1.5rem',
    color: '#333',
    fontSize: '1.5rem'
  },
  formGroup: {
    marginBottom: '1rem'
  },
  label: {
    display: 'block',
    marginBottom: '0.5rem',
    color: '#555',
    fontSize: '0.875rem',
    fontWeight: 500
  },
  input: {
    width: '100%',
    padding: '0.75rem',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '1rem',
    boxSizing: 'border-box'
  },
  button: {
    width: '100%',
    padding: '0.75rem',
    background: '#007bff',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    fontSize: '1rem',
    fontWeight: 500,
    cursor: 'pointer',
    marginTop: '0.5rem'
  },
  backButton: {
    background: '#6c757d'
  },
  error: {
    color: '#dc3545',
    fontSize: '0.875rem',
    marginTop: '0.5rem'
  },
  text: {
    color: '#555',
    marginBottom: '0.5rem'
  },
  email: {
    color: '#007bff',
    fontWeight: 500,
    marginBottom: '1rem'
  }
};

export default LoginForm;`;

export const svelteExample = `<!-- LoginForm.svelte -->
<script>
  import { onMount } from 'svelte';

  let email = '';
  let otp = '';
  let step = 'email';
  let loading = false;
  let error = '';
  let user = null;

  const API_URL = 'https://auth.idling.app';

  onMount(async () => {
    // Check if already logged in
    const token = localStorage.getItem('auth_token');
    if (token) {
      await getCurrentUser();
    }
  });

  async function getCurrentUser() {
    const token = localStorage.getItem('auth_token');
    if (!token) return;
    
    try {
      const response = await fetch(\`\${API_URL}/auth/me\`, {
        headers: { 'Authorization': \`Bearer \${token}\` }
      });
      if (response.ok) {
        user = await response.json();
      } else {
        localStorage.removeItem('auth_token');
      }
    } catch (err) {
      localStorage.removeItem('auth_token');
    }
  }

  async function requestOTP() {
    if (!email.trim()) {
      error = 'Please enter your email address';
      return;
    }
    
    loading = true;
    error = '';
    try {
      const response = await fetch(\`\${API_URL}/auth/request-otp\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() })
      });
      
      const data = await response.json();
      if (response.ok) {
        step = 'otp';
        error = '';
      } else {
        error = data.detail || 'Failed to send OTP';
      }
    } catch (err) {
      error = 'Failed to send OTP. Please try again.';
    } finally {
      loading = false;
    }
  }

  async function verifyOTP() {
    if (otp.length !== 6) {
      error = 'Please enter a 6-digit OTP';
      return;
    }
    
    loading = true;
    error = '';
    try {
      const response = await fetch(\`\${API_URL}/auth/verify-otp\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp })
      });
      
      const data = await response.json();
      if (response.ok) {
        localStorage.setItem('auth_token', data.token);
        user = data;
        error = '';
      } else {
        error = data.detail || 'Invalid OTP';
      }
    } catch (err) {
      error = 'Failed to verify OTP. Please try again.';
    } finally {
      loading = false;
    }
  }

  function logout() {
    localStorage.removeItem('auth_token');
    user = null;
    email = '';
    otp = '';
    step = 'email';
    error = '';
  }

  function goBack() {
    step = 'email';
    otp = '';
    error = '';
  }

  function handleOtpInput(e) {
    otp = e.target.value.replace(/\\D/g, '').slice(0, 6);
  }
</script>

<div class="container">
  <div class="card">
    {#if user}
      <h1>Welcome!</h1>
      <p class="text">You're successfully logged in.</p>
      <p class="email">{user.email}</p>
      <button on:click={logout} class="button">Logout</button>
    {:else if step === 'email'}
      <h1>Login</h1>
      <form on:submit|preventDefault={requestOTP}>
        <div class="form-group">
          <label for="email">Email Address</label>
          <input
            id="email"
            type="email"
            bind:value={email}
            placeholder="your@email.com"
            disabled={loading}
            required
          />
        </div>
        {#if error}
          <div class="error">{error}</div>
        {/if}
        <button type="submit" disabled={loading || !email.trim()} class="button">
          {loading ? 'Sending...' : 'Send OTP'}
        </button>
      </form>
    {:else}
      <h1>Enter OTP</h1>
      <form on:submit|preventDefault={verifyOTP}>
        <div class="form-group">
          <label for="otp">Enter 6-digit OTP</label>
          <input
            id="otp"
            type="text"
            value={otp}
            on:input={handleOtpInput}
            placeholder="123456"
            maxlength="6"
            disabled={loading}
            required
          />
        </div>
        {#if error}
          <div class="error">{error}</div>
        {/if}
        <button type="submit" disabled={loading || otp.length !== 6} class="button">
          {loading ? 'Verifying...' : 'Verify OTP'}
        </button>
        <button type="button" on:click={goBack} class="button back-button">
          Back to Email
        </button>
      </form>
    {/if}
  </div>
</div>

<style>
  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  .container {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    background: #f5f5f5;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }

  .card {
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
    font-size: 1.5rem;
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

  input:disabled {
    background: #f5f5f5;
    cursor: not-allowed;
  }

  .button {
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
    margin-top: 0.5rem;
  }

  .button:hover:not(:disabled) {
    background: #0056b3;
  }

  .button:disabled {
    background: #ccc;
    cursor: not-allowed;
  }

  .back-button {
    background: #6c757d;
  }

  .back-button:hover:not(:disabled) {
    background: #5a6268;
  }

  .error {
    color: #dc3545;
    font-size: 0.875rem;
    margin-top: 0.5rem;
  }

  .text {
    color: #555;
    margin-bottom: 0.5rem;
  }

  .email {
    color: #007bff;
    font-weight: 500;
    margin-bottom: 1rem;
  }
</style>`;

