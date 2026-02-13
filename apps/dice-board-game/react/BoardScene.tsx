// @ts-nocheck - React Three Fiber provides JSX elements at runtime
/**
 * 3D Board Scene Component
 * Renders the hexagonal board in 3D space
 */

import { useMemo, useEffect } from 'react';
import * as THREE from 'three';
import type { BoardTile, BoardConfig, HexCoordinate } from '../src/types/index.js';
import { hexToPixel } from '../src/utils/hex-math.js';

interface BoardSceneProps {
  board: BoardTile[];
  playerPosition: HexCoordinate;
  config: BoardConfig;
  onTileSelect?: (tileId: string) => void;
}

export function BoardScene({
  board,
  playerPosition,
  config,
  onTileSelect,
}: BoardSceneProps) {
  const tileMeshes = useMemo(() => {
    if (!board || board.length === 0) {
      console.warn('[BoardScene] Empty board received!');
      return [];
    }
    
    // Calculate center of all tiles to center the board at origin
    const positions = board.map(tile => hexToPixel(tile, config.tileSize));
    const centerX = positions.reduce((sum, p) => sum + p.x, 0) / positions.length;
    const centerY = positions.reduce((sum, p) => sum + p.y, 0) / positions.length;
    
    console.log('[BoardScene] Calculating tile meshes:', {
      boardLength: board.length,
      centerX,
      centerY,
      tileSize: config.tileSize,
    });
    
    return board.map(tile => {
      const position = hexToPixel(tile, config.tileSize);
      // Center the board at origin
      return {
        tile,
        position: new THREE.Vector3(
          position.x - centerX,
          0,
          position.y - centerY
        ),
      };
    });
  }, [board, config.tileSize]);
  
  // Calculate board center for camera positioning
  const _boardCenter = useMemo(() => {
    if (tileMeshes.length === 0) return new THREE.Vector3(0, 0, 0);
    const positions = tileMeshes.map(m => m.position);
    const center = positions.reduce((acc, pos) => acc.add(pos), new THREE.Vector3(0, 0, 0));
    return center.divideScalar(positions.length);
  }, [tileMeshes]);

  const playerMeshPosition = useMemo(() => {
    const playerTile = board.find(
      t => t.q === playerPosition.q && t.r === playerPosition.r
    );
    if (!playerTile) return new THREE.Vector3(0, 0.5, 0);
    
    // Find the corresponding tile mesh to get centered position
    const tileMesh = tileMeshes.find(m => 
      m.tile.q === playerPosition.q && m.tile.r === playerPosition.r
    );
    if (tileMesh) {
      return new THREE.Vector3(tileMesh.position.x, 0.5, tileMesh.position.z);
    }
    
    // Fallback - shouldn't happen
    return new THREE.Vector3(0, 0.5, 0);
  }, [board, playerPosition, tileMeshes]);

  // Debug logging
  useEffect(() => {
    if (tileMeshes.length > 0) {
      console.log('[BoardScene] Rendering:', {
        tileCount: tileMeshes.length,
        boardLength: board.length,
        playerPosition,
        firstTile: tileMeshes[0]?.tile,
        firstTilePos: tileMeshes[0]?.position,
        samplePositions: tileMeshes.slice(0, 5).map(m => ({
          id: m.tile.id,
          pos: [m.position.x, m.position.y, m.position.z],
        })),
      });
    } else {
      console.warn('[BoardScene] No tiles to render!', { boardLength: board.length });
    }
  }, [tileMeshes, board, playerPosition]);

  // Generate terrain and decorations - use a stable seed to prevent re-renders
  const terrainElements = useMemo(() => {
    if (tileMeshes.length === 0) return [];
    const elements: Array<{ type: 'tree' | 'rock' | 'grass'; position: THREE.Vector3 }> = [];
    
    // Use a simple seed based on tile count to make it deterministic
    const seed = tileMeshes.length;
    
    // Add random decorations around tiles
    tileMeshes.forEach(({ tile, position }, idx) => {
      // Only add decor to normal tiles, not special ones
      if (tile.type === 'normal') {
        // Simple pseudo-random based on index
        const rand = ((idx * 7 + seed) % 100) / 100;
        if (rand < 0.3) {
          const decorRand = ((idx * 11 + seed) % 100) / 100;
          const decorType = decorRand < 0.6 ? 'tree' : decorRand < 0.8 ? 'rock' : 'grass';
          const angleRand = ((idx * 13 + seed) % 100) / 100;
          const angle = angleRand * Math.PI * 2;
          const distance = config.tileSize * 0.4;
          elements.push({
            type: decorType,
            position: new THREE.Vector3(
              position.x + Math.cos(angle) * distance,
              0.2,
              position.z + Math.sin(angle) * distance
            ),
          });
        }
      }
    });
    
    return elements;
  }, [tileMeshes, config.tileSize]);

  // Generate path connections between connected tiles
  const pathConnections = useMemo(() => {
    if (tileMeshes.length === 0) return [];
    const paths: Array<{ start: THREE.Vector3; end: THREE.Vector3 }> = [];
    const processed = new Set<string>();
    
    tileMeshes.forEach(({ tile, position }) => {
      tile.connections?.forEach(connId => {
        // Avoid duplicate paths
        const pathKey = [tile.id, connId].sort().join('-');
        if (processed.has(pathKey)) return;
        processed.add(pathKey);
        
        const connectedTile = tileMeshes.find(m => m.tile.id === connId);
        if (connectedTile) {
          paths.push({
            start: position,
            end: connectedTile.position,
          });
        }
      });
    });
    
    return paths;
  }, [board, tileMeshes]);

  // Debug: Log board state
  useEffect(() => {
    console.log('[BoardScene] Board state:', {
      boardLength: board.length,
      tileMeshesLength: tileMeshes.length,
      playerPosition,
      config,
    });
  }, [board, tileMeshes.length, playerPosition, config]);

  if (tileMeshes.length === 0) {
    console.warn('[BoardScene] No tiles to render!', {
      boardLength: board.length,
      board: board.slice(0, 3),
    });
    // Return a placeholder instead of null so we can see something
    return (
      // @ts-ignore
      <group>
        {/* @ts-ignore */}
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="#ff0000" />
        </mesh>
      </group>
    );
  }

  try {
    return (
      // @ts-ignore - React Three Fiber provides 'group' element
      <group>
        {/* Render terrain/ground foundation */}
        {tileMeshes.length > 0 && <TerrainFoundation tileMeshes={tileMeshes} config={config} />}
        
        {/* Render path connections */}
        {pathConnections.length > 0 && pathConnections.map((path, idx) => (
          <PathConnection key={`path-${idx}`} start={path.start} end={path.end} config={config} />
        ))}
        
        {/* Render board tiles */}
        {tileMeshes.map(({ tile, position }) => (
          <HexTile
            key={tile.id}
            tile={tile}
            position={position}
            config={config}
            isPlayerPosition={tile.q === playerPosition.q && tile.r === playerPosition.r}
            onClick={() => onTileSelect?.(tile.id)}
          />
        ))}

        {/* Render landscape decorations */}
        {terrainElements.length > 0 && terrainElements.map((elem, idx) => (
          <LandscapeDecor key={`decor-${idx}`} type={elem.type} position={elem.position} />
        ))}

        {/* Render player */}
        <PlayerMarker position={playerMeshPosition} />
      </group>
    );
  } catch (error) {
    console.error('[BoardScene] Error rendering board:', error);
    // Fallback: render just the tiles without terrain/decorations
    return (
      // @ts-ignore
      <group>
        {tileMeshes.map(({ tile, position }) => (
          <HexTile
            key={tile.id}
            tile={tile}
            position={position}
            config={config}
            isPlayerPosition={tile.q === playerPosition.q && tile.r === playerPosition.r}
            onClick={() => onTileSelect?.(tile.id)}
          />
        ))}
        <PlayerMarker position={playerMeshPosition} />
      </group>
    );
  }
}

interface HexTileProps {
  tile: BoardTile;
  position: THREE.Vector3;
  config: BoardConfig;
  isPlayerPosition: boolean;
  onClick?: () => void;
}

function HexTile({ tile, position, config, isPlayerPosition, onClick }: HexTileProps) {
  // Create the hexagon shape
  const hexShape = useMemo(() => {
    const shape = new THREE.Shape();
    // For proper edge-to-edge connection in a hex grid:
    // hexToPixel uses size as the distance between hex centers
    // For flat-top hexagons: circumradius = size
    // This ensures tiles connect perfectly edge-to-edge
    const circumradius = config.tileSize;
    
    // Create flat-top hexagon (point up)
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i - Math.PI / 6; // Rotate to point up
      const x = circumradius * Math.cos(angle);
      const y = circumradius * Math.sin(angle);
      if (i === 0) {
        shape.moveTo(x, y);
      } else {
        shape.lineTo(x, y);
      }
    }
    shape.closePath();

    return shape;
  }, [config.tileSize]);

  const material = useMemo(() => {
    const color = getTileColor(tile.type, isPlayerPosition);
    return new THREE.MeshStandardMaterial({
      color,
      metalness: 0.3,
      roughness: 0.7,
    });
  }, [tile.type, isPlayerPosition]);

  // Add slight thickness to make tiles look like proper board pieces
  const extrudeSettings = useMemo(() => ({
    depth: 0.1,
    bevelEnabled: true,
    bevelThickness: 0.02,
    bevelSize: 0.02,
    bevelSegments: 2,
  }), []);

  // Create extruded geometry from the shape
  const extrudeGeometry = useMemo(() => {
    return new THREE.ExtrudeGeometry(hexShape, extrudeSettings);
  }, [hexShape, extrudeSettings]);

  // @ts-ignore - React Three Fiber provides 'mesh' element
  return (
    <group position={[position.x, position.y, position.z]}>
      {/* Main tile */}
      <mesh
        geometry={extrudeGeometry}
        material={material}
        rotation={[-Math.PI / 2, 0, 0]}
        onClick={onClick}
        onPointerOver={(e: { stopPropagation: () => void }) => {
          e.stopPropagation();
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          document.body.style.cursor = 'default';
        }}
        castShadow
        receiveShadow
      />
      
      {/* Tile label/icon */}
      {tile.type !== 'normal' && (
        // @ts-ignore - React Three Fiber provides these elements
        <mesh position={[0, 0.11, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[config.tileSize * 0.6, config.tileSize * 0.6]} />
          <meshBasicMaterial color="white" transparent opacity={0.9} />
        </mesh>
      )}
    </group>
  );
}

function PlayerMarker({ position }: { position: THREE.Vector3 }) {
  // @ts-ignore - React Three Fiber provides these elements
  return (
    <mesh position={[position.x, position.y, position.z]}>
      <cylinderGeometry args={[0.3, 0.3, 0.6, 8]} />
      <meshStandardMaterial color="#ff6b6b" metalness={0.8} roughness={0.2} />
    </mesh>
  );
}

function getTileColor(type: BoardTile['type'], isPlayerPosition: boolean): string {
  if (isPlayerPosition) return '#ff6b6b';
  
  switch (type) {
    case 'start':
      return '#51cf66';
    case 'finish':
      return '#ffd43b';
    case 'event':
      return '#74c0fc';
    case 'combat':
      return '#ff8787';
    case 'treasure':
      return '#ffd43b';
    case 'shop':
      return '#845ef7';
    case 'rest':
      return '#51cf66';
    case 'boss':
      return '#c92a2a';
    default:
      return '#868e96';
  }
}

// Terrain foundation that connects all tiles
function TerrainFoundation({ 
  tileMeshes, 
  config 
}: { 
  tileMeshes: Array<{ tile: BoardTile; position: THREE.Vector3 }>; 
  config: BoardConfig;
}) {
  if (tileMeshes.length === 0) return null;

  // Calculate bounding box for terrain
  const positions = tileMeshes.map(m => m.position);
  const minX = Math.min(...positions.map(p => p.x)) - config.tileSize;
  const maxX = Math.max(...positions.map(p => p.x)) + config.tileSize;
  const minZ = Math.min(...positions.map(p => p.z)) - config.tileSize;
  const maxZ = Math.max(...positions.map(p => p.z)) + config.tileSize;
  
  const width = maxX - minX;
  const depth = maxZ - minZ;
  const centerX = (minX + maxX) / 2;
  const centerZ = (minZ + maxZ) / 2;

  return (
    // @ts-ignore
    <mesh 
      position={[centerX, -0.05, centerZ]} 
      rotation={[-Math.PI / 2, 0, 0]}
      receiveShadow
    >
      <planeGeometry args={[width, depth]} />
      <meshStandardMaterial 
        color="#3a5f3a" 
        roughness={0.8}
        metalness={0.1}
      />
    </mesh>
  );
}

// Path connection between tiles
function PathConnection({ 
  start, 
  end, 
  config 
}: { 
  start: THREE.Vector3; 
  end: THREE.Vector3; 
  config: BoardConfig;
}) {
  const distance = start.distanceTo(end);
  const midpoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
  const direction = new THREE.Vector3().subVectors(end, start).normalize();
  const angle = Math.atan2(direction.z, direction.x);

  return (
    // @ts-ignore
    <mesh
      position={[midpoint.x, 0.05, midpoint.z]}
      rotation={[0, angle, 0]}
    >
      <boxGeometry args={[distance, 0.08, config.tileSize * 0.3]} />
      <meshStandardMaterial color="#8b7355" roughness={0.7} />
    </mesh>
  );
}

// Landscape decorations
function LandscapeDecor({ 
  type, 
  position 
}: { 
  type: 'tree' | 'rock' | 'grass'; 
  position: THREE.Vector3;
}) {
  if (type === 'tree') {
    return (
      // @ts-ignore
      <group position={[position.x, position.y, position.z]}>
        {/* Trunk */}
        <mesh position={[0, 0.3, 0]} castShadow>
          <cylinderGeometry args={[0.1, 0.1, 0.6, 8]} />
          <meshStandardMaterial color="#654321" />
        </mesh>
        {/* Foliage */}
        <mesh position={[0, 0.7, 0]} castShadow>
          <coneGeometry args={[0.4, 0.6, 8]} />
          <meshStandardMaterial color="#228b22" />
        </mesh>
      </group>
    );
  }
  
  if (type === 'rock') {
    return (
      // @ts-ignore
      <mesh position={[position.x, position.y, position.z]} castShadow>
        <dodecahedronGeometry args={[0.15, 0]} />
        <meshStandardMaterial color="#696969" roughness={0.9} />
      </mesh>
    );
  }
  
  // Grass
  return (
    // @ts-ignore
    <group position={[position.x, position.y, position.z]}>
      {[0, 1, 2].map(i => (
        <mesh key={i} position={[0, 0.1 + i * 0.05, 0]} rotation={[0, (i * Math.PI * 2) / 3, 0]}>
          <planeGeometry args={[0.1, 0.2]} />
          <meshStandardMaterial color="#7cb342" side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  );
}
