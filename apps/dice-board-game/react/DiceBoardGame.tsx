// @ts-nocheck - React Three Fiber provides JSX elements at runtime
/**
 * Dice Board Game - Main React Component
 * 3D dice rolling board game with hexagonal board
 */

import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import type { DiceBoardGameProps } from './types.js';
import { BoardScene } from './BoardScene.jsx';
import { DiceRoller } from './DiceRoller.jsx';
import { GameUI } from './GameUI.jsx';
import { generateBoard } from '../src/core/board-generator.js';
import { createGameState, movePlayer, applyEventOutcome } from '../src/core/game-state.js';
import type { BoardConfig, DiceConfig, GameState, DiceRoll } from '../src/types/index.js';

export function DiceBoardGame({
  config,
  diceConfig,
  onStateChange,
  onEventTriggered,
  gameApiUrl,
  authToken,
}: DiceBoardGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [isRolling, setIsRolling] = useState(false);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);

  // Memoize configs to prevent unnecessary re-renders
  const defaultConfig = useMemo<BoardConfig>(() => ({
    width: 20,
    height: 20,
    tileSize: 1,
    wrapEdges: true,
    forkProbability: 0.3,
    minForkChainLength: 5,
    ...config,
  }), [config]);

  const defaultDiceConfig = useMemo<DiceConfig>(() => ({
    sides: 6,
    count: 2,
    size: 0.5,
    material: 'standard',
    ...diceConfig,
  }), [diceConfig]);

  // Track if we've initialized to prevent re-initialization
  const initializedRef = useRef(false);
  const gameSeedRef = useRef<string | null>(null);

  // Initialize game - only once when component mounts
  useEffect(() => {
    if (initializedRef.current) {
      // Already initialized, don't re-initialize
      return;
    }

    try {
      initializedRef.current = true;
      const seed = gameSeedRef.current || `game_${Date.now()}`;
      gameSeedRef.current = seed;
      
      const board = generateBoard({
        config: defaultConfig,
        seed,
      });

      console.log('[DiceBoardGame] Generated board:', { 
        tileCount: board.length, 
        tiles: board.slice(0, 5),
        config: defaultConfig 
      });

      const initialState = createGameState(board, seed);
      console.log('[DiceBoardGame] Created game state:', {
        boardLength: initialState.board.length,
        playerPos: initialState.player.position,
      });
      
      setGameState(initialState);
      onStateChange?.(initialState);
    } catch (error) {
      console.error('[DiceBoardGame] Error initializing game:', error);
      initializedRef.current = false; // Allow retry on error
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount - ignore config changes after initial mount

  // Handle dice roll
  const handleRoll = useCallback(async () => {
    if (isRolling || !gameState) return;

    setIsRolling(true);

    // Simulate dice roll (in real implementation, this would use physics)
    const roll: DiceRoll = {
      dice: Array.from({ length: defaultDiceConfig.count }, () =>
        Math.floor(Math.random() * defaultDiceConfig.sides) + 1
      ),
      total: 0,
      timestamp: Date.now(),
    };
    roll.total = roll.dice.reduce((sum, val) => sum + val, 0);

    // Wait for animation
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Move player
    const newState = movePlayer(gameState, roll, selectedPath || undefined);
    setGameState(newState);
    onStateChange?.(newState);

    // Check for events
    const currentTile = newState.board.find(
      t => t.id === `${newState.player.position.q},${newState.player.position.r},${newState.player.position.s}`
    );

    if (currentTile && currentTile.type !== 'normal' && currentTile.type !== 'start') {
      const event = newState.activeEvents[newState.activeEvents.length - 1];
      if (event) {
        onEventTriggered?.(event);
      }
    }

    setSelectedPath(null);
    setIsRolling(false);
  }, [gameState, isRolling, selectedPath, defaultDiceConfig, onStateChange, onEventTriggered]);

  // Handle event outcome selection
  const handleEventOutcome = useCallback((eventId: string, outcomeIndex: number) => {
    if (!gameState) return;

    const event = gameState.activeEvents.find(e => e.id === eventId);
    if (!event) return;

    const newState = applyEventOutcome(gameState, event, outcomeIndex);
    setGameState(newState);
    onStateChange?.(newState);
  }, [gameState, onStateChange]);

  // Save game state
  const handleSave = useCallback(async () => {
    if (!gameState || !gameApiUrl || !authToken) return;

    try {
      await fetch(`${gameApiUrl}/game/save-state`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          characterId: gameState.player.id,
          saveData: gameState,
          version: '1.0.0',
        }),
      });
    } catch (error) {
      console.error('Failed to save game:', error);
    }
  }, [gameState, gameApiUrl, authToken]);

  // Debug: Log game state (must be before early return to follow Rules of Hooks)
  useEffect(() => {
    if (gameState) {
      console.log('[DiceBoardGame] Game state:', {
        hasGameState: !!gameState,
        boardLength: gameState.board.length,
        playerPos: gameState.player.position,
      });
    }
  }, [gameState]);

  if (!gameState) {
    console.log('[DiceBoardGame] No game state, showing loading...');
    return <div>Loading game...</div>;
  }

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: '#1a1a1a' }}>
      <Canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block' }}
        gl={{ antialias: true, alpha: false, preserveDrawingBuffer: true }}
        camera={{ position: [0, 25, 25], fov: 60 }}
        onCreated={({ camera, scene, gl }) => {
          camera.lookAt(0, 0, 0);
          console.log('[DiceBoardGame] Canvas created:', {
            cameraPos: camera.position,
            sceneChildren: scene.children.length,
            canvasWidth: gl.domElement.width,
            canvasHeight: gl.domElement.height,
          });
        }}
      >
        <OrbitControls
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          minDistance={5}
          maxDistance={100}
          target={[0, 0, 0]}
        />
        {/* @ts-ignore - React Three Fiber provides these light elements */}
        <ambientLight intensity={0.6} />
        {/* @ts-ignore */}
        <directionalLight position={[10, 10, 5]} intensity={1.2} castShadow />
        {/* @ts-ignore */}
        <pointLight position={[-10, 10, -5]} intensity={0.4} />
        
        {/* Ground plane for reference */}
        {/* @ts-ignore */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]} receiveShadow>
          <planeGeometry args={[100, 100]} />
          <meshStandardMaterial color="#2a2a2a" />
        </mesh>
        
        <Environment preset="sunset" />

        {gameState.board && gameState.board.length > 0 ? (
          <BoardScene
            board={gameState.board}
            playerPosition={gameState.player.position}
            config={defaultConfig}
            onTileSelect={setSelectedPath}
          />
        ) : (
          // @ts-ignore
          <mesh position={[0, 0, 0]}>
            <boxGeometry args={[2, 2, 2]} />
            <meshStandardMaterial color="#00ff00" />
          </mesh>
        )}

        {isRolling ? (
          <DiceRoller
            config={defaultDiceConfig}
            onRollComplete={() => {
              // Roll is handled in handleRoll
            }}
          />
        ) : null}
      </Canvas>

      <GameUI
        gameState={gameState}
        isRolling={isRolling}
        onRoll={handleRoll}
        onEventOutcome={handleEventOutcome}
        onSave={handleSave}
        diceConfig={defaultDiceConfig}
      />
    </div>
  );
}
