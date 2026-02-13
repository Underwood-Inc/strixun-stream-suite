/**
 * Vitest setup file
 * Configures test environment and mocks
 */

import { vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom';

// Mock window.URL.createObjectURL and revokeObjectURL for download tests
global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
global.URL.revokeObjectURL = vi.fn();

// Mock document.createElement for download link creation
const mockLink = {
  href: '',
  download: '',
  click: vi.fn(),
  remove: vi.fn(),
};

document.createElement = vi.fn((tagName: string) => {
  if (tagName === 'a') {
    return mockLink as any;
  }
  return document.createElement(tagName);
});

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock window.dispatchEvent
window.dispatchEvent = vi.fn();

// Reset mocks before each test
beforeEach(() => {
  vi.clearAllMocks();
  mockLink.href = '';
  mockLink.download = '';
});

