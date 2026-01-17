/**
 * Storage Picker Component
 * 
 * Allows users to select their preferred storage backend.
 */

import { useState } from 'react';
import type { StorageLocation, StorageConfig } from '../core/types.js';

export interface StoragePickerProps {
  /** Current storage configuration */
  currentConfig?: StorageConfig;
  /** Called when storage is changed */
  onStorageChange: (config: StorageConfig) => void;
  /** Available storage options (defaults to all) */
  availableOptions?: StorageLocation[];
  /** Additional CSS class */
  className?: string;
  /** Disabled state */
  disabled?: boolean;
}

interface StorageOption {
  type: StorageLocation;
  name: string;
  description: string;
  available: boolean;
}

/**
 * Check if File System Access API is available
 */
function isFileSystemAvailable(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

/**
 * Get all storage options with availability
 */
function getStorageOptions(): StorageOption[] {
  return [
    {
      type: 'indexeddb',
      name: 'Browser Storage',
      description: 'Stored in your browser (default)',
      available: true,
    },
    {
      type: 'filesystem',
      name: 'Local Folder',
      description: 'Choose a folder on your computer',
      available: isFileSystemAvailable(),
    },
    {
      type: 'custom',
      name: 'Custom',
      description: 'Configure custom storage',
      available: true,
    },
  ];
}

/**
 * Storage picker component
 */
export function StoragePicker({
  currentConfig,
  onStorageChange,
  availableOptions,
  className = '',
  disabled = false,
}: StoragePickerProps) {
  const [selectedType, setSelectedType] = useState<StorageLocation>(
    currentConfig?.location || 'indexeddb'
  );
  const [customPath, setCustomPath] = useState(currentConfig?.customPath || '');
  
  const options = getStorageOptions().filter(
    opt => !availableOptions || availableOptions.includes(opt.type)
  );
  
  const handleSelect = async (type: StorageLocation) => {
    setSelectedType(type);
    
    if (type === 'filesystem' && isFileSystemAvailable()) {
      try {
        // Request directory access
        const dirHandle = await (window as unknown as { showDirectoryPicker: () => Promise<{ name: string }> }).showDirectoryPicker();
        const path = dirHandle.name;
        setCustomPath(path);
        onStorageChange({ location: type, customPath: path });
      } catch {
        // User cancelled or error
        setSelectedType(currentConfig?.location || 'indexeddb');
      }
    } else {
      onStorageChange({ location: type, customPath: type === 'custom' ? customPath : undefined });
    }
  };
  
  return (
    <div className={`p2p-storage-picker ${className}`}>
      <div className="p2p-storage-picker__header">
        <span className="p2p-storage-picker__title">Storage Location</span>
      </div>
      
      <div className="p2p-storage-picker__options">
        {options.map(option => (
          <button
            key={option.type}
            className={`p2p-storage-picker__option ${
              selectedType === option.type ? 'p2p-storage-picker__option--selected' : ''
            } ${!option.available ? 'p2p-storage-picker__option--disabled' : ''}`}
            onClick={() => handleSelect(option.type)}
            disabled={disabled || !option.available}
          >
            <span className="p2p-storage-picker__option-name">
              {option.name}
            </span>
            <span className="p2p-storage-picker__option-desc">
              {option.description}
            </span>
            {!option.available && (
              <span className="p2p-storage-picker__option-unavailable">
                Not available in this browser
              </span>
            )}
          </button>
        ))}
      </div>
      
      {selectedType === 'filesystem' && customPath && (
        <div className="p2p-storage-picker__path">
          <span className="p2p-storage-picker__path-label">Selected folder:</span>
          <span className="p2p-storage-picker__path-value">{customPath}</span>
        </div>
      )}
    </div>
  );
}
