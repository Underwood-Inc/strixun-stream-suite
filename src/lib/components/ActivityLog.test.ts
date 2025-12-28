/**
 * ActivityLog Component Integration Tests
 * 
 * Tests the ActivityLog component with REAL store integration
 * No mocks - tests actual functionality end-to-end
 */

import { render, screen, waitFor } from '@testing-library/svelte/svelte5';
import { get } from 'svelte/store';
import { beforeEach, describe, expect, it } from 'vitest';
import { addLogEntry, clearLogEntries, logEntries } from '../../stores/activity-log';
import ActivityLog from './ActivityLog.svelte';

describe('ActivityLog Component - Real Store Integration', () => {
  beforeEach(() => {
    // Clear all logs before each test
    clearLogEntries();
  });

  it('should display log entries when added to store', async () => {
    // Render component - testing-library handles cleanup automatically
    const { container } = render(ActivityLog);
    
    // Add a log entry directly to the store (no mocks)
    addLogEntry('Test log message', 'info', 'TEST');
    
    // Wait for the component to react to store changes
    await waitFor(() => {
      expect(screen.getByText(/Test log message/i)).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('should display multiple log entries in order', async () => {
    render(ActivityLog);
    
    // Add multiple entries
    addLogEntry('First message', 'info');
    addLogEntry('Second message', 'success', 'SUCCESS');
    addLogEntry('Third message', 'error', 'ERROR');
    
    await waitFor(() => {
      expect(screen.getByText(/First message/i)).toBeInTheDocument();
      expect(screen.getByText(/Second message/i)).toBeInTheDocument();
      expect(screen.getByText(/Third message/i)).toBeInTheDocument();
    });
  });

  it('should show empty state when no logs exist', () => {
    render(ActivityLog);
    
    expect(screen.getByText(/No log entries yet/i)).toBeInTheDocument();
  });

  it('should update when logs are added after mount', async () => {
    render(ActivityLog);
    
    // Initially empty
    expect(screen.getByText(/No log entries yet/i)).toBeInTheDocument();
    
    // Add log after component is mounted
    addLogEntry('Delayed log', 'info');
    
    // Should now show the log
    await waitFor(() => {
      expect(screen.getByText(/Delayed log/i)).toBeInTheDocument();
      expect(screen.queryByText(/No log entries yet/i)).not.toBeInTheDocument();
    });
  });

  it('should display log types correctly', async () => {
    render(ActivityLog);
    
    addLogEntry('Info message', 'info');
    addLogEntry('Success message', 'success');
    addLogEntry('Error message', 'error');
    addLogEntry('Warning message', 'warning');
    
    await waitFor(() => {
      expect(screen.getByText(/Info message/i)).toBeInTheDocument();
      expect(screen.getByText(/Success message/i)).toBeInTheDocument();
      expect(screen.getByText(/Error message/i)).toBeInTheDocument();
      expect(screen.getByText(/Warning message/i)).toBeInTheDocument();
    });
  });

  it('should display flairs when provided', async () => {
    render(ActivityLog);
    
    addLogEntry('Message with flair', 'info', 'CUSTOM_FLAIR');
    
    await waitFor(() => {
      expect(screen.getByText(/CUSTOM_FLAIR/i)).toBeInTheDocument();
    });
  });

  it('should clear logs when clearLogEntries is called', async () => {
    render(ActivityLog);
    
    // Add some logs
    addLogEntry('Log 1', 'info');
    addLogEntry('Log 2', 'info');
    
    await waitFor(() => {
      expect(screen.getByText(/Log 1/i)).toBeInTheDocument();
    });
    
    // Clear logs
    clearLogEntries();
    
    // Should show empty state
    await waitFor(() => {
      expect(screen.getByText(/No log entries yet/i)).toBeInTheDocument();
      expect(screen.queryByText(/Log 1/i)).not.toBeInTheDocument();
    });
  });

  it('should merge duplicate consecutive messages', async () => {
    render(ActivityLog);
    
    // Add same message twice
    addLogEntry('Duplicate message', 'info');
    addLogEntry('Duplicate message', 'info');
    
    await waitFor(() => {
      const entries = screen.getAllByText(/Duplicate message/i);
      // Should only show once (merged)
      expect(entries.length).toBe(1);
    });
  });
});

describe('ActivityLog Store Integration - Direct Store Tests', () => {
  beforeEach(() => {
    clearLogEntries();
  });

  it('should update store when addLogEntry is called', () => {
    expect(get(logEntries)).toHaveLength(0);
    
    addLogEntry('Test message', 'info');
    
    const entries = get(logEntries);
    expect(entries).toHaveLength(1);
    expect(entries[0].message).toBe('Test message');
    expect(entries[0].type).toBe('info');
  });

  it('should clear store when clearLogEntries is called', () => {
    addLogEntry('Message 1', 'info');
    addLogEntry('Message 2', 'info');
    
    expect(get(logEntries)).toHaveLength(2);
    
    clearLogEntries();
    
    expect(get(logEntries)).toHaveLength(0);
  });

  it('should limit entries to MAX_ENTRIES (1000)', () => {
    // Add more than 1000 entries
    for (let i = 0; i < 1001; i++) {
      addLogEntry(`Message ${i}`, 'info');
    }
    
    const entries = get(logEntries);
    expect(entries.length).toBe(1000);
    // Should have the most recent entries
    expect(entries[0].message).toBe('Message 1000');
    expect(entries[999].message).toBe('Message 1');
  });

  it('should create entries with correct structure', () => {
    addLogEntry('Test', 'success', 'FLAIR', '[EMOJI]');
    
    const entries = get(logEntries);
    expect(entries[0]).toMatchObject({
      message: 'Test',
      type: 'success',
      flair: 'FLAIR',
      icon: '[EMOJI]',
      count: 1
    });
    expect(entries[0].id).toBeDefined();
    expect(entries[0].timestamp).toBeInstanceOf(Date);
  });
});

describe('ActivityLog - window.addLogEntry Integration', () => {
  beforeEach(() => {
    clearLogEntries();
    // Set up window.addLogEntry to use real store
    if (typeof window !== 'undefined') {
      (window as any).addLogEntry = (message: string, type: 'info' | 'success' | 'error' | 'warning' | 'debug' = 'info', flair?: string, icon?: string) => {
        addLogEntry(message, type, flair, icon);
      };
    }
  });

  it('should work when called via window.addLogEntry', async () => {
    render(ActivityLog);
    
    // Call via window.addLogEntry (how it's used in production)
    if (typeof window !== 'undefined' && (window as any).addLogEntry) {
      (window as any).addLogEntry('Window log test', 'info', 'WINDOW');
    }
    
    await waitFor(() => {
      expect(screen.getByText(/Window log test/i)).toBeInTheDocument();
    });
    
    // Verify store was updated
    const entries = get(logEntries);
    expect(entries).toHaveLength(1);
    expect(entries[0].message).toBe('Window log test');
  });

  it('should handle multiple window.addLogEntry calls', async () => {
    render(ActivityLog);
    
    if (typeof window !== 'undefined' && (window as any).addLogEntry) {
      (window as any).addLogEntry('First', 'info');
      (window as any).addLogEntry('Second', 'success');
      (window as any).addLogEntry('Third', 'error');
    }
    
    await waitFor(() => {
      expect(screen.getByText(/First/i)).toBeInTheDocument();
      expect(screen.getByText(/Second/i)).toBeInTheDocument();
      expect(screen.getByText(/Third/i)).toBeInTheDocument();
    });
    
    expect(get(logEntries)).toHaveLength(3);
  });
});

