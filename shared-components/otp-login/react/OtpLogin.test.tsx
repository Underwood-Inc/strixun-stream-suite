/**
 * Comprehensive Test Suite for OtpLogin React Component
 * 
 * Tests the React wrapper component for OTP login functionality
 */

import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { OtpLogin } from './OtpLogin';
import type { OtpLoginState, LoginSuccessData } from '../core';
import { OtpLoginCore } from '../core';

// Mock the core
vi.mock('../core', () => {
  const mockCore = {
    subscribe: vi.fn(() => () => {}), // Returns unsubscribe function
    setEmail: vi.fn(),
    setOtp: vi.fn(),
    requestOtp: vi.fn(),
    verifyOtp: vi.fn(),
    goBack: vi.fn(),
    reset: vi.fn(),
    getState: vi.fn(),
    destroy: vi.fn(),
  };

  return {
    OtpLoginCore: vi.fn(() => mockCore),
  };
});

// Mock getOtpEncryptionKey
vi.mock('../../../shared-config/otp-encryption', () => ({
  getOtpEncryptionKey: vi.fn(() => 'a'.repeat(32)),
}));

describe('OtpLogin React Component', () => {
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
    
    // Create a fresh mock instance for each test
    mockCoreInstance = {
      subscribe: vi.fn((callback) => {
        // Store callback for manual triggering
        (mockCoreInstance as any)._callback = callback;
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

    (OtpLoginCore as any).mockImplementation(() => mockCoreInstance);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Component Mounting', () => {
    it('should mount successfully with required props', () => {
      render(<OtpLogin {...defaultProps} />);
      
      expect(OtpLoginCore).toHaveBeenCalledWith(
        expect.objectContaining({
          apiUrl: 'https://auth.example.com',
          onSuccess: mockOnSuccess,
          otpEncryptionKey: 'a'.repeat(32),
        })
      );
    });

    it('should subscribe to core state changes', () => {
      render(<OtpLogin {...defaultProps} />);
      
      expect(mockCoreInstance.subscribe).toHaveBeenCalled();
    });

    it('should use encryption key from prop', () => {
      const customKey = 'b'.repeat(32);
      render(<OtpLogin {...defaultProps} otpEncryptionKey={customKey} />);
      
      expect(OtpLoginCore).toHaveBeenCalledWith(
        expect.objectContaining({
          otpEncryptionKey: customKey,
        })
      );
    });

    it('should call onError if encryption key is missing', () => {
      render(<OtpLogin {...defaultProps} otpEncryptionKey={undefined} />);
      
      // Should call onError with encryption key error
      expect(mockOnError).toHaveBeenCalledWith(
        expect.stringContaining('OTP encryption key is required')
      );
    });

    it('should call onError if encryption key is too short', () => {
      render(<OtpLogin {...defaultProps} otpEncryptionKey="short" />);
      
      expect(mockOnError).toHaveBeenCalledWith(
        expect.stringContaining('at least 32 characters')
      );
    });
  });

  describe('Props Handling', () => {
    it('should use default title and subtitle', () => {
      render(<OtpLogin 
        apiUrl={defaultProps.apiUrl}
        otpEncryptionKey={defaultProps.otpEncryptionKey}
        onSuccess={defaultProps.onSuccess}
      />);
      
      expect(screen.getByText('Sign In')).toBeInTheDocument();
      expect(screen.getByText('Enter your email to receive a verification code')).toBeInTheDocument();
    });

    it('should use custom title and subtitle', () => {
      render(<OtpLogin {...defaultProps} />);
      
      expect(screen.getByText('Test Sign In')).toBeInTheDocument();
      expect(screen.getByText('Test subtitle')).toBeInTheDocument();
    });

    it('should pass custom endpoints to core', () => {
      const endpoints = {
        requestOtp: '/custom/request',
        verifyOtp: '/custom/verify',
      };
      
      render(<OtpLogin {...defaultProps} endpoints={endpoints} />);
      
      expect(OtpLoginCore).toHaveBeenCalledWith(
        expect.objectContaining({ endpoints })
      );
    });

    it('should pass custom headers to core', () => {
      const customHeaders = {
        'X-Custom-Header': 'custom-value',
      };
      
      render(<OtpLogin {...defaultProps} customHeaders={customHeaders} />);
      
      expect(OtpLoginCore).toHaveBeenCalledWith(
        expect.objectContaining({ customHeaders })
      );
    });
  });

  describe('State Display', () => {
    it('should display email form when step is email', () => {
      mockCoreInstance.getState.mockReturnValue({
        step: 'email',
        email: '',
        otp: '',
        loading: false,
        error: null,
        countdown: 0,
        rateLimitResetAt: null,
        rateLimitCountdown: 0,
      });

      render(<OtpLogin {...defaultProps} />);
      
      // Trigger state update
      if (mockCoreInstance._callback) {
        mockCoreInstance._callback(mockCoreInstance.getState());
      }

      // Should show email input
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    });

    it('should display OTP form when step is otp', async () => {
      mockCoreInstance.getState.mockReturnValue({
        step: 'otp',
        email: 'test@example.com',
        otp: '',
        loading: false,
        error: null,
        countdown: 600,
        rateLimitResetAt: null,
        rateLimitCountdown: 0,
      });

      render(<OtpLogin {...defaultProps} />);
      
      // Trigger state update
      if (mockCoreInstance._callback) {
        mockCoreInstance._callback(mockCoreInstance.getState());
      }

      await waitFor(() => {
        expect(screen.getByLabelText(/otp/i)).toBeInTheDocument();
      });
    });

    it('should display loading state', () => {
      mockCoreInstance.getState.mockReturnValue({
        step: 'email',
        email: '',
        otp: '',
        loading: true,
        error: null,
        countdown: 0,
        rateLimitResetAt: null,
        rateLimitCountdown: 0,
      });

      render(<OtpLogin {...defaultProps} />);
      
      if (mockCoreInstance._callback) {
        mockCoreInstance._callback(mockCoreInstance.getState());
      }

      // Should show loading indicator (button disabled or loading text)
      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
    });

    it('should display error message', () => {
      const errorMessage = 'Test error message';
      mockCoreInstance.getState.mockReturnValue({
        step: 'email',
        email: '',
        otp: '',
        loading: false,
        error: errorMessage,
        countdown: 0,
        rateLimitResetAt: null,
        rateLimitCountdown: 0,
      });

      render(<OtpLogin {...defaultProps} />);
      
      if (mockCoreInstance._callback) {
        mockCoreInstance._callback(mockCoreInstance.getState());
      }

      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });
  });

  describe('User Interactions', () => {
    it('should call setEmail when email input changes', async () => {
      mockCoreInstance.getState.mockReturnValue({
        step: 'email',
        email: '',
        otp: '',
        loading: false,
        error: null,
        countdown: 0,
        rateLimitResetAt: null,
        rateLimitCountdown: 0,
      });

      render(<OtpLogin {...defaultProps} />);
      
      if (mockCoreInstance._callback) {
        mockCoreInstance._callback(mockCoreInstance.getState());
      }

      const emailInput = screen.getByLabelText(/email/i);
      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });

      expect(mockCoreInstance.setEmail).toHaveBeenCalledWith('test@example.com');
    });

    it('should call requestOtp when submit button is clicked', async () => {
      mockCoreInstance.getState.mockReturnValue({
        step: 'email',
        email: 'test@example.com',
        otp: '',
        loading: false,
        error: null,
        countdown: 0,
        rateLimitResetAt: null,
        rateLimitCountdown: 0,
      });

      render(<OtpLogin {...defaultProps} />);
      
      if (mockCoreInstance._callback) {
        mockCoreInstance._callback(mockCoreInstance.getState());
      }

      const submitButton = screen.getByRole('button', { name: /request|send/i });
      fireEvent.click(submitButton);

      expect(mockCoreInstance.requestOtp).toHaveBeenCalled();
    });

    it('should call setOtp when OTP input changes', async () => {
      mockCoreInstance.getState.mockReturnValue({
        step: 'otp',
        email: 'test@example.com',
        otp: '',
        loading: false,
        error: null,
        countdown: 600,
        rateLimitResetAt: null,
        rateLimitCountdown: 0,
      });

      render(<OtpLogin {...defaultProps} />);
      
      if (mockCoreInstance._callback) {
        mockCoreInstance._callback(mockCoreInstance.getState());
      }

      await waitFor(() => {
        const otpInput = screen.getByLabelText(/otp/i);
        fireEvent.change(otpInput, { target: { value: '123456789' } });
      });

      expect(mockCoreInstance.setOtp).toHaveBeenCalledWith('123456789');
    });

    it('should call verifyOtp when OTP form is submitted', async () => {
      mockCoreInstance.getState.mockReturnValue({
        step: 'otp',
        email: 'test@example.com',
        otp: '123456789',
        loading: false,
        error: null,
        countdown: 600,
        rateLimitResetAt: null,
        rateLimitCountdown: 0,
      });

      render(<OtpLogin {...defaultProps} />);
      
      if (mockCoreInstance._callback) {
        mockCoreInstance._callback(mockCoreInstance.getState());
      }

      await waitFor(() => {
        const submitButton = screen.getByRole('button', { name: /verify|submit/i });
        fireEvent.click(submitButton);
      });

      expect(mockCoreInstance.verifyOtp).toHaveBeenCalled();
    });

    it('should call goBack when back button is clicked', async () => {
      mockCoreInstance.getState.mockReturnValue({
        step: 'otp',
        email: 'test@example.com',
        otp: '',
        loading: false,
        error: null,
        countdown: 600,
        rateLimitResetAt: null,
        rateLimitCountdown: 0,
      });

      render(<OtpLogin {...defaultProps} />);
      
      if (mockCoreInstance._callback) {
        mockCoreInstance._callback(mockCoreInstance.getState());
      }

      await waitFor(() => {
        const backButton = screen.getByRole('button', { name: /back/i });
        fireEvent.click(backButton);
      });

      expect(mockCoreInstance.goBack).toHaveBeenCalled();
    });
  });

  describe('Modal Variant', () => {
    it('should render as modal when showAsModal is true', () => {
      render(<OtpLogin {...defaultProps} showAsModal={true} />);
      
      // Should have modal overlay
      const modal = document.querySelector('.otp-login-modal-overlay');
      expect(modal).toBeInTheDocument();
    });

    it('should call onClose when close button is clicked in modal', async () => {
      render(<OtpLogin 
        {...defaultProps} 
        showAsModal={true}
        onClose={mockOnClose}
      />);
      
      const closeButton = screen.getByRole('button', { name: /close/i });
      fireEvent.click(closeButton);

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should not render as modal when showAsModal is false', () => {
      render(<OtpLogin {...defaultProps} showAsModal={false} />);
      
      const modal = document.querySelector('.otp-login-modal-overlay');
      expect(modal).not.toBeInTheDocument();
    });
  });

  describe('Cleanup', () => {
    it('should unsubscribe and destroy core on unmount', () => {
      const unsubscribe = vi.fn();
      mockCoreInstance.subscribe.mockReturnValue(unsubscribe);

      const { unmount } = render(<OtpLogin {...defaultProps} />);
      
      unmount();

      expect(unsubscribe).toHaveBeenCalled();
      expect(mockCoreInstance.destroy).toHaveBeenCalled();
    });
  });

  describe('Success Callback', () => {
    it('should call onSuccess when login succeeds', () => {
      const successData: LoginSuccessData = {
        token: 'test-token',
        email: 'test@example.com',
        userId: 'user123',
      };

      render(<OtpLogin {...defaultProps} />);
      
      // Simulate success by calling the onSuccess passed to core
      const coreCall = (OtpLoginCore as any).mock.calls[0][0];
      coreCall.onSuccess(successData);

      expect(mockOnSuccess).toHaveBeenCalledWith(successData);
    });
  });

  describe('Error Callback', () => {
    it('should call onError when login fails', () => {
      const errorMessage = 'Login failed';

      render(<OtpLogin {...defaultProps} />);
      
      // Simulate error by calling the onError passed to core
      const coreCall = (OtpLoginCore as any).mock.calls[0][0];
      if (coreCall.onError) {
        coreCall.onError(errorMessage);
      }

      expect(mockOnError).toHaveBeenCalledWith(errorMessage);
    });
  });
});

