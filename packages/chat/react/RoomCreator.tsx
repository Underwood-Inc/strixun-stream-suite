/**
 * Room Creator Component
 * 
 * Form for creating a new chat room
 */

import { useState, useCallback } from 'react';

export interface RoomCreatorProps {
  onCreateRoom: (customName?: string) => void;
  onCancel: () => void;
  loading?: boolean;
}

export function RoomCreator({ onCreateRoom, onCancel, loading = false }: RoomCreatorProps) {
  const [customName, setCustomName] = useState('');

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    onCreateRoom(customName.trim() || undefined);
  }, [customName, onCreateRoom]);

  return (
    <div className="room-creator">
      <div className="room-creator__header">
        <h3 className="room-creator__title">Create New Room</h3>
        <p className="room-creator__subtitle">
          Start a new chat room for others to join
        </p>
      </div>

      <form className="room-creator__form" onSubmit={handleSubmit}>
        <div className="room-creator__field">
          <label className="room-creator__label" htmlFor="room-name">
            Room Name (optional)
          </label>
          <input
            id="room-name"
            type="text"
            className="room-creator__input"
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            placeholder="Enter room name..."
            maxLength={100}
            disabled={loading}
          />
        </div>

        <div className="room-creator__actions">
          <button
            type="button"
            className="chat-btn chat-btn--secondary"
            onClick={onCancel}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="chat-btn"
            disabled={loading}
          >
            {loading ? 'Creating...' : 'Create Room'}
          </button>
        </div>
      </form>
    </div>
  );
}
