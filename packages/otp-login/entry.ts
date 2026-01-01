/**
 * Entry point for bundling OtpLogin Svelte component
 * 
 * This file exports a function that can be used to mount the OtpLogin component
 * in vanilla HTML environments.
 */

import OtpLogin from './svelte/OtpLogin.svelte';
import type { LoginSuccessData } from './core';

export interface OtpLoginMountOptions {
  target: HTMLElement;
  apiUrl: string;
  onSuccess: (data: LoginSuccessData) => void;
  onError?: (error: string) => void;
  endpoints?: {
    requestOtp?: string;
    verifyOtp?: string;
  };
  customHeaders?: Record<string, string>;
  title?: string;
  subtitle?: string;
  showAsModal?: boolean;
  onClose?: () => void;
}

/**
 * Mount OtpLogin component to a DOM element
 * Returns the Svelte component instance for cleanup
 */
export function mountOtpLogin(options: OtpLoginMountOptions) {
  const component = new OtpLogin({
    target: options.target,
    props: {
      apiUrl: options.apiUrl,
      onSuccess: options.onSuccess,
      onError: options.onError,
      endpoints: options.endpoints,
      customHeaders: options.customHeaders,
      title: options.title,
      subtitle: options.subtitle,
      showAsModal: options.showAsModal,
      onClose: options.onClose,
    },
  });

  return component;
}

// Export the component class for advanced usage
export { OtpLogin };
export type { LoginSuccessData } from './core';

