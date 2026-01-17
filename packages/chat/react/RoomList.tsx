/**
 * Room List Component
 * 
 * Displays list of available chat rooms
 */

import { useEffect, useState, useCallback } from 'react';
import type { RoomMetadata } from '../core/types.js';

export interface RoomListProps {
  /** Function to fetch active rooms */
  fetchRooms: () => Promise<RoomMetadata[]>;
  /** Called when user wants to join a room */
  onJoinRoom: (roomId: string) => void;
  /** Called when user wants to create a room */
  onCreateRoom?: () => void;
  /** Show create room button */
  showCreateButton?: boolean;
  /** Custom class name */
  className?: string;
}

export function RoomList({ 
  fetchRooms,
  onJoinRoom, 
  onCreateRoom,
  showCreateButton = true,
  className = ''
}: RoomListProps) {
  const [rooms, setRooms] = useState<RoomMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadRooms = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const activeRooms = await fetchRooms();
      setRooms(activeRooms);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load rooms');
    } finally {
      setLoading(false);
    }
  }, [fetchRooms]);

  useEffect(() => {
    loadRooms();
    
    // Refresh rooms every 30 seconds
    const interval = setInterval(loadRooms, 30000);
    return () => clearInterval(interval);
  }, [loadRooms]);

  return (
    <div className={`room-list ${className}`}>
      <div className="room-list__header">
        <h3 className="room-list__title">Active Rooms</h3>
        <div className="room-list__actions">
          <button
            className="chat-btn chat-btn--secondary"
            onClick={loadRooms}
            disabled={loading}
          >
            {loading ? 'Loading...' : 'Refresh'}
          </button>
          {showCreateButton && onCreateRoom && (
            <button
              className="chat-btn"
              onClick={onCreateRoom}
            >
              Create Room
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="room-list__error">
          {error}
        </div>
      )}

      <div className="room-list__rooms">
        {loading && rooms.length === 0 ? (
          <div className="room-list__loading">
            Loading rooms...
          </div>
        ) : rooms.length === 0 ? (
          <div className="room-list__empty">
            <span>No active rooms</span>
            {showCreateButton && onCreateRoom && (
              <button
                className="chat-btn"
                onClick={onCreateRoom}
              >
                Create First Room
              </button>
            )}
          </div>
        ) : (
          rooms.map((room) => (
            <div key={room.roomId} className="room-item">
              <div className="room-item__info">
                <div className="room-item__name">
                  {room.customName || room.broadcasterName}
                </div>
                <div className="room-item__participants">
                  {room.participantCount} participant{room.participantCount !== 1 ? 's' : ''}
                </div>
              </div>
              <button
                className="chat-btn"
                onClick={() => onJoinRoom(room.roomId)}
              >
                Join
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
