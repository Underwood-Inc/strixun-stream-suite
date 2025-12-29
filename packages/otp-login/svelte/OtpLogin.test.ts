/**
 * Comprehensive Test Suite for OtpLogin Svelte Component
 * 
 * Tests the Svelte wrapper component for OTP login functionality
 */

import { render, screen, waitFor, fireEvent } from '@testing-library/svelte/svelte5';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { tick } from 'svelte';
import type { LoginSuccessData } from '../core';

// Use hoisted to ensure mocks are set up before imports
const { mockOtpLoginCore, getMockCoreInstance, mockGetOtpEncryptionKey } = vi.hoisted(() => {
  let currentMockInstance: any = null;
  
  const mockCore = vi.fn((config: any) => {
    // Create a fresh mock instance each time OtpLoginCore is called
    currentMockInstance = {
      subscribe: vi.fn((callback: any) => {
        // Store callback for manual triggering
        (currentMockInstance as any)._callback = callback;
        return () => {}; // Unsubscribe function
      }),
      setEmail: vi.fn(),
      setOtp: vi.fn(),
      requestOtp: vi.fn(),
      verifyOtp: vi.fn(),
      goBack: vi.fn(),
      reset: vi.fn(),
      getState: vi.fn(() => ({
        step: 'email',
        email: '',
        otp: '',
        loading: false,
        error: null,
        countdown: 0,
        rateLimitResetAt: null,
        rateLimitCountdown: 0,
      })),
      destroy: vi.fn(),
    };
    return currentMockInstance;
  });
  
  const mockGetKey = vi.fn(() => 'a'.repeat(32));
  
  return {
    mockOtpLoginCore: mockCore,
    getMockCoreInstance: () => currentMockInstance,
    mockGetOtpEncryptionKey: mockGetKey,
  };
});

vi.mock('../core', () => {
  return {
    OtpLoginCore: mockOtpLoginCore,
  };
});

// Mock getOtpEncryptionKey
vi.mock('../../../shared-config/otp-encryption', () => ({
  getOtpEncryptionKey: mockGetOtpEncryptionKey,
}));

// Import component AFTER mocks are set up
import OtpLogin from './OtpLogin.svelte';

describe('OtpLogin Svelte Component', () => {
  const mockOnSuccess = vi.fn();
  const mockOnError = vi.fn();
  const mockOnClose = vi.fn();
  
  const defaultProps = {
    apiUrl: 'https://auth.example.com',
    otpEncryptionKey: 'a'.repeat(32),
    onSuccess: mockOnSuccess,
    onError: mockOnError,
    title: 'Test Sign In',
    subtitle: 'Test subtitle',
  };

  let mockCoreInstance: any;

  beforeEach(() => {
    vi.clearAllMocks();
    // Get the current mock instance (will be created when OtpLoginCore is called)
    mockCoreInstance = getMockCoreInstance();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Component Mounting', () => {
    it('should mount successfully with required props', async () => {
      render(OtpLogin, { props: defaultProps });
      
      // Wait for onMount to complete - use tick() to ensure Svelte has processed
      await tick();
      await waitFor(() => {
        expect(mockOtpLoginCore).toHaveBeenCalledWith(
          expect.objectContaining({
            apiUrl: 'https://auth.example.com',
            onSuccess: mockOnSuccess,
            otpEncryptionKey: 'a'.repeat(32),
          })
        );
      }, { timeout: 2000 });
    });

    it('should subscribe to core state changes', async () => {
      render(OtpLogin, { props: defaultProps });
      
      // Wait for onMount to complete - use tick() to ensure Svelte has processed
      await tick();
      await waitFor(() => {
        const instance = getMockCoreInstance();
        expect(instance).toBeTruthy();
        expect(instance?.subscribe).toHaveBeenCalled();
      }, { timeout: 2000 });
    });

    it('should use encryption key from prop', async () => {
      const customKey = 'b'.repeat(32);
      render(OtpLogin, { props: { ...defaultProps, otpEncryptionKey: customKey } });
      
      // Wait for onMount to complete - use tick() to ensure Svelte has processed
      await tick();
      await waitFor(() => {
        expect(mockOtpLoginCore).toHaveBeenCalledWith(
          expect.objectContaining({
            otpEncryptionKey: customKey,
          })
        );
      }, { timeout: 2000 });
    });

    it('should call onError if encryption key is missing', async () => {
      render(OtpLogin, { 
        props: { 
          ...defaultProps, 
          otpEncryptionKey: undefined,
        } 
      });
      
      // Wait for onMount to complete - use tick() to ensure Svelte has processed
      await tick();
      await waitFor(() => {
        expect(mockOnError).toHaveBeenCalledWith(
          expect.stringContaining('OTP encryption key is required')
        );
      }, { timeout: 2000 });
    });

    it('should call onError if encryption key is too short', async () => {
      render(OtpLogin, { 
        props: { 
          ...defaultProps, 
          otpEncryptionKey: 'short',
        } 
      });
      
      // Wait for onMount to complete - use tick() to ensure Svelte has processed
      await tick();
      await waitFor(() => {
        expect(mockOnError).toHaveBeenCalledWith(
          expect.stringContaining('at least 32 characters')
        );
      }, { timeout: 2000 });
    });
  });

  describe('Props Handling', () => {
    it('should use default title and subtitle', () => {
      render(OtpLogin, { 
        props: { 
          apiUrl: defaultProps.apiUrl,
          otpEncryptionKey: defaultProps.otpEncryptionKey,
          onSuccess: defaultProps.onSuccess,
        } 
      });
      
      expect(screen.getByText('Sign In')).toBeInTheDocument();
      expect(screen.getByText('Enter your email to receive a verification code')).toBeInTheDocument();
    });

    it('should use custom title and subtitle', () => {
      render(OtpLogin, { props: defaultProps });
      
      expect(screen.getByText('Test Sign In')).toBeInTheDocument();
      expect(screen.getByText('Test subtitle')).toBeInTheDocument();
    });

    it('should pass custom endpoints to core', async () => {
      const endpoints = {
        requestOtp: '/custom/request',
        verifyOtp: '/custom/verify',
      };
      
      render(OtpLogin, { 
        props: { ...defaultProps, endpoints } 
      });
      
      // Wait for onMount to complete - use tick() to ensure Svelte has processed
      await tick();
      await waitFor(() => {
        expect(mockOtpLoginCore).toHaveBeenCalledWith(
          expect.objectContaining({ endpoints })
        );
      }, { timeout: 2000 });
    });

    it('should pass custom headers to core', async () => {
      const customHeaders = {
        'X-Custom-Header': 'custom-value',
      };
      
      render(OtpLogin, { 
        props: { ...defaultProps, customHeaders } 
      });
      
      // Wait for onMount to complete - use tick() to ensure Svelte has processed
      await tick();
      await waitFor(() => {
        expect(mockOtpLoginCore).toHaveBeenCalledWith(
          expect.objectContaining({ customHeaders })
        );
      }, { timeout: 2000 });
    });
  });

  describe('State Display', () => {
    it('should display email form when step is email', async () => {
      // Create instance first by rendering
      render(OtpLogin, { props: defaultProps });
      await tick();
      await waitFor(() => {
        expect(getMockCoreInstance()).toBeTruthy();
      }, { timeout: 2000 });
      
      const instance = getMockCoreInstance();
      instance.getState.mockReturnValue({
        step: 'email',
        email: '',
        otp: '',
        loading: false,
        error: null,
        countdown: 0,
        rateLimitResetAt: null,
        rateLimitCountdown: 0,
      });
      
      // Wait for onMount to complete - use tick() to ensure Svelte has processed
      await tick();
      await waitFor(() => {
        const instance = getMockCoreInstance();
        expect(instance).toBeTruthy();
        expect(instance?.subscribe).toHaveBeenCalled();
      }, { timeout: 2000 });
      
      // Trigger state update
      if ((mockCoreInstance as any)._callback) {
        (mockCoreInstance as any)._callback(mockCoreInstance.getState());
      }
      
      await tick();

      // Should show email input
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    });

    it('should display OTP form when step is otp', async () => {
      render(OtpLogin, { props: defaultProps });
      await tick();
      await waitFor(() => {
        expect(getMockCoreInstance()).toBeTruthy();
      }, { timeout: 2000 });
      
      const instance = getMockCoreInstance();
      instance.getState.mockReturnValue({
        step: 'otp',
        email: 'test@example.com',
        otp: '',
        loading: false,
        error: null,
        countdown: 600,
        rateLimitResetAt: null,
        rateLimitCountdown: 0,
      });
      
      // Trigger state update
      if (mockCoreInstance._callback) {
        mockCoreInstance._callback(mockCoreInstance.getState());
      }

      await waitFor(() => {
        expect(screen.getByLabelText(/otp/i)).toBeInTheDocument();
      });
    });

    it('should display loading state', async () => {
      render(OtpLogin, { props: defaultProps });
      await tick();
      await waitFor(() => {
        expect(getMockCoreInstance()).toBeTruthy();
      }, { timeout: 2000 });
      
      const instance = getMockCoreInstance();
      instance.getState.mockReturnValue({
        step: 'email',
        email: '',
        otp: '',
        loading: true,
        error: null,
        countdown: 0,
        rateLimitResetAt: null,
        rateLimitCountdown: 0,
      });
      
      // Wait for onMount to complete - use tick() to ensure Svelte has processed
      await tick();
      await waitFor(() => {
        const instance = getMockCoreInstance();
        expect(instance).toBeTruthy();
        expect(instance?.subscribe).toHaveBeenCalled();
      }, { timeout: 2000 });
      
      if ((mockCoreInstance as any)._callback) {
        (mockCoreInstance as any)._callback(mockCoreInstance.getState());
      }
      
      await tick();

      // Should show loading indicator (button disabled or loading text)
      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
    });

    it('should display error message', async () => {
      const errorMessage = 'Test error message';
      render(OtpLogin, { props: defaultProps });
      await tick();
      await waitFor(() => {
        expect(getMockCoreInstance()).toBeTruthy();
      }, { timeout: 2000 });
      
      const instance = getMockCoreInstance();
      instance.getState.mockReturnValue({
        step: 'email',
        email: '',
        otp: '',
        loading: false,
        error: errorMessage,
        countdown: 0,
        rateLimitResetAt: null,
        rateLimitCountdown: 0,
      });
      
      // Wait for onMount to complete - use tick() to ensure Svelte has processed
      await tick();
      await waitFor(() => {
        const instance = getMockCoreInstance();
        expect(instance).toBeTruthy();
        expect(instance?.subscribe).toHaveBeenCalled();
      }, { timeout: 2000 });
      
      if ((mockCoreInstance as any)._callback) {
        (mockCoreInstance as any)._callback(mockCoreInstance.getState());
      }
      
      await tick();

      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });
  });

  describe('User Interactions', () => {
    it('should call setEmail when email input changes', async () => {
      render(OtpLogin, { props: defaultProps });
      await tick();
      await waitFor(() => {
        expect(getMockCoreInstance()).toBeTruthy();
      }, { timeout: 2000 });
      
      const instance = getMockCoreInstance();
      instance.getState.mockReturnValue({
        step: 'email',
        email: '',
        otp: '',
        loading: false,
        error: null,
        countdown: 0,
        rateLimitResetAt: null,
        rateLimitCountdown: 0,
      });
      
      // Wait for onMount to complete - use tick() to ensure Svelte has processed
      await tick();
      await waitFor(() => {
        const coreInstance = getMockCoreInstance();
        expect(coreInstance).toBeTruthy();
        expect(coreInstance?.subscribe).toHaveBeenCalled();
      }, { timeout: 2000 });
      
      if ((mockCoreInstance as any)._callback) {
        (mockCoreInstance as any)._callback(mockCoreInstance.getState());
      }
      
      await tick();

      const emailInput = screen.getByLabelText(/email/i);
      await fireEvent.input(emailInput, { target: { value: 'test@example.com' } });

      const finalInstance = getMockCoreInstance();
      expect(finalInstance?.setEmail).toHaveBeenCalledWith('test@example.com');
    });

    it('should call requestOtp when submit button is clicked', async () => {
      render(OtpLogin, { props: defaultProps });
      await tick();
      await waitFor(() => {
        expect(getMockCoreInstance()).toBeTruthy();
      }, { timeout: 2000 });
      
      const instance = getMockCoreInstance();
      instance.getState.mockReturnValue({
        step: 'email',
        email: 'test@example.com',
        otp: '',
        loading: false,
        error: null,
        countdown: 0,
        rateLimitResetAt: null,
        rateLimitCountdown: 0,
      });
      
      // Wait for onMount to complete - use tick() to ensure Svelte has processed
      await tick();
      await waitFor(() => {
        const coreInstance = getMockCoreInstance();
        expect(coreInstance).toBeTruthy();
        expect(coreInstance?.subscribe).toHaveBeenCalled();
      }, { timeout: 2000 });
      
      if ((mockCoreInstance as any)._callback) {
        (mockCoreInstance as any)._callback(mockCoreInstance.getState());
      }
      
      await tick();

      const submitButton = screen.getByRole('button', { name: /request|send/i });
      await fireEvent.click(submitButton);

      const finalInstance = getMockCoreInstance();
      expect(finalInstance?.requestOtp).toHaveBeenCalled();
    });

    it('should call setOtp when OTP input changes', async () => {
      render(OtpLogin, { props: defaultProps });
      await tick();
      await waitFor(() => {
        expect(getMockCoreInstance()).toBeTruthy();
      }, { timeout: 2000 });
      
      const instance = getMockCoreInstance();
      instance.getState.mockReturnValue({
        step: 'otp',
        email: 'test@example.com',
        otp: '',
        loading: false,
        error: null,
        countdown: 600,
        rateLimitResetAt: null,
        rateLimitCountdown: 0,
      });
      
      // Wait for onMount to complete - use tick() to ensure Svelte has processed
      await tick();
      await waitFor(() => {
        const coreInstance = getMockCoreInstance();
        expect(coreInstance).toBeTruthy();
        expect(coreInstance?.subscribe).toHaveBeenCalled();
      }, { timeout: 2000 });
      
      if ((mockCoreInstance as any)._callback) {
        (mockCoreInstance as any)._callback(mockCoreInstance.getState());
      }
      
      await tick();

      await waitFor(() => {
        const otpInput = screen.getByLabelText(/otp/i);
        fireEvent.input(otpInput, { target: { value: '123456789' } });
      });

      const finalInstance = getMockCoreInstance();
      expect(finalInstance?.setOtp).toHaveBeenCalledWith('123456789');
    });

    it('should call verifyOtp when OTP form is submitted', async () => {
      render(OtpLogin, { props: defaultProps });
      await tick();
      await waitFor(() => {
        expect(getMockCoreInstance()).toBeTruthy();
      }, { timeout: 2000 });
      
      const instance = getMockCoreInstance();
      instance.getState.mockReturnValue({
        step: 'otp',
        email: 'test@example.com',
        otp: '123456789',
        loading: false,
        error: null,
        countdown: 600,
        rateLimitResetAt: null,
        rateLimitCountdown: 0,
      });
      
      // Wait for onMount to complete - use tick() to ensure Svelte has processed
      await tick();
      await waitFor(() => {
        const coreInstance = getMockCoreInstance();
        expect(coreInstance).toBeTruthy();
        expect(coreInstance?.subscribe).toHaveBeenCalled();
      }, { timeout: 2000 });
      
      if ((mockCoreInstance as any)._callback) {
        (mockCoreInstance as any)._callback(mockCoreInstance.getState());
      }
      
      await tick();

      await waitFor(() => {
        const submitButton = screen.getByRole('button', { name: /verify|submit/i });
        fireEvent.click(submitButton);
      });

      const finalInstance = getMockCoreInstance();
      expect(finalInstance?.verifyOtp).toHaveBeenCalled();
    });

    it('should call goBack when back button is clicked', async () => {
      render(OtpLogin, { props: defaultProps });
      await tick();
      await waitFor(() => {
        expect(getMockCoreInstance()).toBeTruthy();
      }, { timeout: 2000 });
      
      const instance = getMockCoreInstance();
      instance.getState.mockReturnValue({
        step: 'otp',
        email: 'test@example.com',
        otp: '',
        loading: false,
        error: null,
        countdown: 600,
        rateLimitResetAt: null,
        rateLimitCountdown: 0,
      });
      
      // Wait for onMount to complete - use tick() to ensure Svelte has processed
      await tick();
      await waitFor(() => {
        const coreInstance = getMockCoreInstance();
        expect(coreInstance).toBeTruthy();
        expect(coreInstance?.subscribe).toHaveBeenCalled();
      }, { timeout: 2000 });
      
      if ((mockCoreInstance as any)._callback) {
        (mockCoreInstance as any)._callback(mockCoreInstance.getState());
      }
      
      await tick();

      await waitFor(() => {
        const backButton = screen.getByRole('button', { name: /back/i });
        fireEvent.click(backButton);
      });

      const finalInstance = getMockCoreInstance();
      expect(finalInstance?.goBack).toHaveBeenCalled();
    });
  });

  describe('Modal Variant', () => {
    it('should render as modal when showAsModal is true', () => {
      render(OtpLogin, { 
        props: { ...defaultProps, showAsModal: true } 
      });
      
      // Should have modal overlay
      const modal = document.querySelector('.otp-login-modal-overlay');
      expect(modal).toBeInTheDocument();
    });

    it('should call onClose when close button is clicked in modal', async () => {
      render(OtpLogin, { 
        props: { 
          ...defaultProps, 
          showAsModal: true,
          onClose: mockOnClose,
        } 
      });
      
      const closeButton = screen.getByRole('button', { name: /close/i });
      await fireEvent.click(closeButton);

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should not render as modal when showAsModal is false', () => {
      render(OtpLogin, { 
        props: { ...defaultProps, showAsModal: false } 
      });
      
      const modal = document.querySelector('.otp-login-modal-overlay');
      expect(modal).not.toBeInTheDocument();
    });
  });

  describe('Cleanup', () => {
    it('should unsubscribe and destroy core on unmount', async () => {
      render(OtpLogin, { props: defaultProps });
      await tick();
      await waitFor(() => {
        expect(getMockCoreInstance()).toBeTruthy();
      }, { timeout: 2000 });
      
      const instance = getMockCoreInstance();
      const unsubscribe = vi.fn();
      instance.subscribe.mockReturnValue(unsubscribe);

      const { unmount } = render(OtpLogin, { props: defaultProps });
      await tick();
      await waitFor(() => {
        expect(getMockCoreInstance()).toBeTruthy();
      }, { timeout: 2000 });
      
      // Wait for onMount to complete
      await waitFor(() => {
        expect(mockCoreInstance.subscribe).toHaveBeenCalled();
      });
      
      unmount();
      
      await tick();

      const finalInstance = getMockCoreInstance();
      expect(unsubscribe).toHaveBeenCalled();
      expect(finalInstance?.destroy).toHaveBeenCalled();
    });
  });

  describe('Success Callback', () => {
    it('should call onSuccess when login succeeds', async () => {
      const successData: LoginSuccessData = {
        token: 'test-token',
        email: 'test@example.com',
        userId: 'user123',
      };

      render(OtpLogin, { props: defaultProps });
      
      // Wait for onMount to complete - use tick() to ensure Svelte has processed
      await tick();
      await waitFor(() => {
        expect(mockOtpLoginCore).toHaveBeenCalled();
      }, { timeout: 2000 });
      
      // Simulate success by calling the onSuccess passed to core
      const coreCall = mockOtpLoginCore.mock.calls[0][0];
      coreCall.onSuccess(successData);

      expect(mockOnSuccess).toHaveBeenCalledWith(successData);
    });
  });

  describe('Error Callback', () => {
    it('should call onError when login fails', async () => {
      const errorMessage = 'Login failed';

      render(OtpLogin, { props: defaultProps });
      
      // Wait for onMount to complete - use tick() to ensure Svelte has processed
      await tick();
      await waitFor(() => {
        expect(mockOtpLoginCore).toHaveBeenCalled();
      }, { timeout: 2000 });
      
      // Simulate error by calling the onError passed to core
      const coreCall = (OtpLoginCore as any).mock.calls[0][0];
      if (coreCall.onError) {
        coreCall.onError(errorMessage);
      }

      expect(mockOnError).toHaveBeenCalledWith(errorMessage);
    });
  });
});

