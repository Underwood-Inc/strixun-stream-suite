import React from 'react';
import { OtpLogin } from '@strixun/otp-login/dist/react';
import type { LoginSuccessData } from '@strixun/otp-login/dist/react';
import { apiClient } from '../lib/api-client';
import { getOtpEncryptionKey } from '@shared-config/otp-encryption';

// Get API URL - dashboard uses relative URLs via Vite proxy
const apiUrl = typeof window !== 'undefined' ? window.location.origin : '';

async function handleLoginSuccess(data: LoginSuccessData) {
  console.log('[Login] Login successful:', data);
  
  // Store token in apiClient
  apiClient.setToken(data.token);
  
  // Try to load customer data to check if they have an account
  try {
    const customer = await apiClient.getCustomer();
    if (customer) {
      // Customer exists, proceed with login
      window.dispatchEvent(new CustomEvent('auth:login', {
        detail: { 
          user: {
            userId: data.userId,
            email: data.email,
            token: data.token,
          }
        }
      }));
      return;
    }
  } catch (error: any) {
    // Check if error is "no customer account"
    const errorMessage = error?.message || error?.toString() || '';
    const errorCode = error?.code || '';
    
    if (errorCode === 'AUTHENTICATION_REQUIRED' || 
        errorMessage.includes('No customer account') || 
        errorMessage.includes('customer account found')) {
      // No customer account - prompt to sign up
      console.log('[Login] No customer account found, prompting signup');
      window.dispatchEvent(new CustomEvent('auth:no-customer-account', {
        detail: { 
          email: data.email,
          message: 'You need to create a customer account first. Would you like to sign up?'
        }
      }));
      return;
    }
    
    // Other error - still try to proceed (might be temporary)
    console.warn('[Login] Customer lookup failed, but proceeding:', error);
  }
  
  // Default: proceed with login even if customer lookup failed
  window.dispatchEvent(new CustomEvent('auth:login', {
    detail: { 
      user: {
        userId: data.userId,
        email: data.email,
        token: data.token,
      }
    }
  }));
}

function handleLoginError(error: string) {
  // Error is already displayed by the component
  console.error('[Login] Login error:', error);
  
  // Check if error indicates no customer account
  if (error.includes('No customer account') || 
      error.includes('customer account found') ||
      error.includes('Please sign up')) {
    // Prompt to sign up
    window.dispatchEvent(new CustomEvent('auth:no-customer-account', {
      detail: { 
        message: error
      }
    }));
  }
}

console.log('[Login] Initialized with API URL:', apiUrl);

export default function Login() {
  return (
    <div className="login-wrapper">
      <OtpLogin
        apiUrl={apiUrl}
        onSuccess={handleLoginSuccess}
        onError={handleLoginError}
        otpEncryptionKey={getOtpEncryptionKey()}
        customHeaders={{ 'X-Dashboard-Request': 'true' }}
        title="Developer Dashboard"
        subtitle="Sign in with your email to access your dashboard"
      />
      <p className="login-footer">
        Don't have an account? 
        <button 
          type="button" 
          className="login-link" 
          onClick={() => window.dispatchEvent(new CustomEvent('auth:show-signup'))}
        >
          Sign up
        </button>
      </p>
    </div>
  );
}

