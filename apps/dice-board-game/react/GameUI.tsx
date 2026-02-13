/**
 * Game UI Component
 * Handles UI overlay for game controls and information
 */

import type { GameState, DiceConfig } from '../src/types/index.js';

interface GameUIProps {
  gameState: GameState;
  isRolling: boolean;
  onRoll: () => void;
  onEventOutcome: (eventId: string, outcomeIndex: number) => void;
  onSave: () => void;
  diceConfig: DiceConfig;
}

export function GameUI({
  gameState,
  isRolling,
  onRoll,
  onEventOutcome,
  onSave,
  diceConfig,
}: GameUIProps) {
  const lastRoll = gameState.diceRolls[gameState.diceRolls.length - 1];
  const activeEvent = gameState.activeEvents[gameState.activeEvents.length - 1];

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        pointerEvents: 'none',
        zIndex: 10,
      }}
    >
      {/* Top HUD */}
      <div
        style={{
          position: 'absolute',
          top: '20px',
          left: '20px',
          right: '20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          pointerEvents: 'auto',
        }}
      >
        <div
          style={{
            background: 'rgba(0, 0, 0, 0.7)',
            padding: '15px',
            borderRadius: '8px',
            color: 'white',
          }}
        >
          <div>Turn: {gameState.currentTurn}</div>
          <div>Health: {gameState.player.health} / {gameState.player.maxHealth}</div>
          {lastRoll && (
            <div>
              Last Roll: {lastRoll.dice.join(' + ')} = {lastRoll.total}
            </div>
          )}
        </div>

        <button
          onClick={onSave}
          style={{
            padding: '10px 20px',
            background: '#4c6ef5',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px',
          }}
        >
          Save Game
        </button>
      </div>

      {/* Bottom Controls */}
      <div
        style={{
          position: 'absolute',
          bottom: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          pointerEvents: 'auto',
        }}
      >
        <button
          onClick={onRoll}
          disabled={isRolling}
          style={{
            padding: '15px 30px',
            background: isRolling ? '#868e96' : '#51cf66',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: isRolling ? 'not-allowed' : 'pointer',
            fontSize: '16px',
            fontWeight: 'bold',
          }}
        >
          {isRolling ? 'Rolling...' : `Roll ${diceConfig.count}d${diceConfig.sides}`}
        </button>
      </div>

      {/* Event Modal */}
      {activeEvent && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'rgba(0, 0, 0, 0.9)',
            padding: '30px',
            borderRadius: '12px',
            color: 'white',
            maxWidth: '500px',
            pointerEvents: 'auto',
            zIndex: 100,
          }}
        >
          <h2 style={{ marginTop: 0 }}>{activeEvent.name}</h2>
          <p>{activeEvent.description}</p>
          
          <div style={{ marginTop: '20px' }}>
            <h3>Outcomes:</h3>
            {activeEvent.outcomes.map((outcome, index) => (
              <button
                key={index}
                onClick={() => onEventOutcome(activeEvent.id, index)}
                style={{
                  display: 'block',
                  width: '100%',
                  marginTop: '10px',
                  padding: '10px',
                  background: '#4c6ef5',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                {outcome.description} ({Math.round(outcome.probability * 100)}%)
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
