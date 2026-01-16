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
    <div 
      className={`room-list ${className}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        padding: '16px',
      }}
    >
      <div 
        className="room-list__header"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '16px',
        }}
      >
        <h3 
          style={{
            margin: 0,
            fontSize: '1.125rem',
            fontWeight: 600,
            color: 'var(--text, #f9f9f9)',
          }}
        >
          Active Rooms
        </h3>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={loadRooms}
            disabled={loading}
            style={{
              padding: '6px 12px',
              background: 'var(--bg-tertiary, #2d2d2d)',
              border: '1px solid var(--border, #3a3a3a)',
              borderRadius: '4px',
              color: 'var(--text, #f9f9f9)',
              fontSize: '0.75rem',
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Loading...' : 'Refresh'}
          </button>
          {showCreateButton && onCreateRoom && (
            <button
              onClick={onCreateRoom}
              style={{
                padding: '6px 12px',
                background: 'var(--accent, #d4af37)',
                border: 'none',
                borderRadius: '4px',
                color: 'var(--bg, #1a1a1a)',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Create Room
            </button>
          )}
        </div>
      </div>

      {error && (
        <div 
          style={{
            padding: '12px',
            background: 'rgba(244, 67, 54, 0.1)',
            color: 'var(--danger, #f44336)',
            borderRadius: '4px',
            marginBottom: '16px',
            fontSize: '0.875rem',
          }}
        >
          {error}
        </div>
      )}

      <div 
        className="room-list__rooms"
        style={{
          flex: 1,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        {loading && rooms.length === 0 ? (
          <div 
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: 'var(--text-muted, #808080)',
            }}
          >
            Loading rooms...
          </div>
        ) : rooms.length === 0 ? (
          <div 
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              gap: '12px',
              color: 'var(--text-muted, #808080)',
            }}
          >
            <span>No active rooms</span>
            {showCreateButton && onCreateRoom && (
              <button
                onClick={onCreateRoom}
                style={{
                  padding: '8px 16px',
                  background: 'var(--accent, #d4af37)',
                  border: 'none',
                  borderRadius: '4px',
                  color: 'var(--bg, #1a1a1a)',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Create First Room
              </button>
            )}
          </div>
        ) : (
          rooms.map((room) => (
            <div
              key={room.roomId}
              className="room-list__room"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                background: 'var(--bg-secondary, #252525)',
                border: '1px solid var(--border, #3a3a3a)',
                borderRadius: '4px',
              }}
            >
              <div>
                <div 
                  style={{
                    fontWeight: 600,
                    color: 'var(--text, #f9f9f9)',
                    marginBottom: '4px',
                  }}
                >
                  {room.customName || room.broadcasterName}
                </div>
                <div 
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--text-muted, #808080)',
                  }}
                >
                  {room.participantCount} participant{room.participantCount !== 1 ? 's' : ''}
                </div>
              </div>
              <button
                onClick={() => onJoinRoom(room.roomId)}
                style={{
                  padding: '6px 16px',
                  background: 'var(--accent, #d4af37)',
                  border: 'none',
                  borderRadius: '4px',
                  color: 'var(--bg, #1a1a1a)',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
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
