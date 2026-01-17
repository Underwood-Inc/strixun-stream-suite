/**
 * Storage Location Picker
 * 
 * Allows users to choose where their chat history is stored locally.
 */

import { useState, useCallback } from 'react';
import type { StorageLocation, StorageConfig } from '@strixun/p2p-storage';

// Re-export for convenience
export type { StorageLocation, StorageConfig };

export interface StoragePickerProps {
  currentConfig: StorageConfig;
  onChange: (config: StorageConfig) => void;
  className?: string;
}

interface StorageOption {
  value: StorageLocation;
  title: string;
  description: string;
  available: boolean;
}

const storageOptions: StorageOption[] = [
  {
    value: 'indexeddb',
    title: 'Browser Storage (IndexedDB)',
    description: 'Store messages in your browser. Data persists across sessions but is tied to this browser.',
    available: true,
  },
  {
    value: 'filesystem',
    title: 'Local File System',
    description: 'Store messages in a folder on your device. Portable and accessible outside the browser.',
    available: typeof window !== 'undefined' && 'showDirectoryPicker' in window,
  },
  {
    value: 'custom',
    title: 'Custom Location',
    description: 'Specify a custom storage path or use an external storage provider.',
    available: false, // Coming soon
  },
];

export function StoragePicker({ 
  currentConfig, 
  onChange,
  className = '' 
}: StoragePickerProps) {
  const [selectedPath, setSelectedPath] = useState(currentConfig.customPath || '');
  
  const handleSelect = useCallback(async (location: StorageLocation) => {
    let customPath = '';
    
    if (location === 'filesystem') {
      try {
        // Request directory access
        const dirHandle = await (window as unknown as {
          showDirectoryPicker: () => Promise<{ name: string }>;
        }).showDirectoryPicker();
        customPath = dirHandle.name;
      } catch (error) {
        console.error('[StoragePicker] Failed to select directory:', error);
        return;
      }
    }
    
    onChange({
      ...currentConfig,
      location,
      customPath,
    });
    setSelectedPath(customPath);
  }, [currentConfig, onChange]);
  
  return (
    <div className={`chat-storage-picker ${className}`}>
      <h3 className="chat-storage-picker__title">
        Storage Location
      </h3>
      <p className="chat-storage-picker__description">
        Choose where to store your encrypted chat history. 
        Your data is always encrypted with your room key.
      </p>
      
      <div className="chat-storage-picker__options">
        {storageOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`chat-storage-picker__option ${
              currentConfig.location === option.value 
                ? 'chat-storage-picker__option--selected' 
                : ''
            }`}
            onClick={() => handleSelect(option.value)}
            disabled={!option.available}
          >
            <div className="chat-storage-picker__option-radio" />
            <div className="chat-storage-picker__option-content">
              <p className="chat-storage-picker__option-title">
                {option.title}
                {!option.available && ' (Coming Soon)'}
              </p>
              <p className="chat-storage-picker__option-desc">
                {option.description}
              </p>
              {option.value === 'filesystem' && selectedPath && currentConfig.location === 'filesystem' && (
                <p className="chat-storage-picker__option-path">
                  Selected: {selectedPath}
                </p>
              )}
            </div>
          </button>
        ))}
      </div>
      
      {/* Storage Settings */}
      <div className="chat-storage-picker__settings">
        <label className="chat-storage-picker__setting">
          <input
            type="checkbox"
            checked={currentConfig.autoCleanup ?? false}
            onChange={(e) => onChange({
              ...currentConfig,
              autoCleanup: e.target.checked,
            })}
          />
          <span>Auto-cleanup old messages after {currentConfig.cleanupAfterDays || 90} days</span>
        </label>
      </div>
    </div>
  );
}
