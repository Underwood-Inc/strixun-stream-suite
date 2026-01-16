/**
 * Room Creator Component
 * 
 * Form for creating a new chat room
 */

import { useState, useCallback } from 'react';

export interface RoomCreatorProps {
  /** Called when user creates a room */
  onCreateRoom: (customName?: string) => void;
  /** Called when user cancels */
  onCancel?: () => void;
  /** Loading state */
  loading?: boolean;
  /** Custom class name */
  className?: string;
}

export function RoomCreator({ 
  onCreateRoom, 
  onCancel,
  loading = false,
  className = ''
}: RoomCreatorProps) {
  const [roomName, setRoomName] = useState('');

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    onCreateRoom(roomName.trim() || undefined);
  }, [roomName, onCreateRoom]);

  return (
    <div 
      className={`room-creator ${className}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        padding: '16px',
      }}
    >
      <h3 
        style={{
          margin: '0 0 16px 0',
          fontSize: '1.125rem',
          fontWeight: 600,
          color: 'var(--text, #f9f9f9)',
        }}
      >
        Create New Room
      </h3>

      <form 
        onSubmit={handleSubmit}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          flex: 1,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label 
            htmlFor="room-name"
            style={{
              fontSize: '0.875rem',
              fontWeight: 500,
              color: 'var(--text-secondary, #b0b0b0)',
            }}
          >
            Room Name (optional)
          </label>
          <input
            id="room-name"
            type="text"
            value={roomName}
            onChange={(e) => setRoomName(e.target.value)}
            placeholder="Enter a custom room name..."
            disabled={loading}
            style={{
              padding: '10px 12px',
              background: 'var(--bg, #1a1a1a)',
              border: '1px solid var(--border, #3a3a3a)',
              borderRadius: '4px',
              color: 'var(--text, #f9f9f9)',
              fontSize: '0.875rem',
              outline: 'none',
            }}
          />
          <p 
            style={{
              margin: 0,
              fontSize: '0.75rem',
              color: 'var(--text-muted, #808080)',
            }}
          >
            If left empty, your display name will be used as the room name.
          </p>
        </div>

        <div 
          style={{
            display: 'flex',
            gap: '12px',
            marginTop: 'auto',
          }}
        >
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              style={{
                flex: 1,
                padding: '12px',
                background: 'var(--bg-tertiary, #2d2d2d)',
                border: '1px solid var(--border, #3a3a3a)',
                borderRadius: '4px',
                color: 'var(--text, #f9f9f9)',
                fontSize: '0.875rem',
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={loading}
            style={{
              flex: 1,
              padding: '12px',
              background: loading ? 'var(--bg-tertiary, #2d2d2d)' : 'var(--accent, #d4af37)',
              border: 'none',
              borderRadius: '4px',
              color: loading ? 'var(--text-muted, #808080)' : 'var(--bg, #1a1a1a)',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Creating...' : 'Create Room'}
          </button>
        </div>
      </form>
    </div>
  );
}
