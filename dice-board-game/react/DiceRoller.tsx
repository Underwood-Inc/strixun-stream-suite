// @ts-nocheck - React Three Fiber provides JSX elements at runtime
/**
 * 3D Dice Roller Component
 * Handles 3D dice rolling animation and physics
 */

import { useRef, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { DiceConfig, DiceRoll } from '../src/types/index.js';
import { createDiceGeometry, createDiceMaterial } from '../src/core/dice-engine.js';

interface DiceRollerProps {
  config: DiceConfig;
  onRollComplete?: (roll: DiceRoll) => void;
}

export function DiceRoller({ config, onRollComplete }: DiceRollerProps) {
  const diceRefs = useRef<THREE.Mesh[]>([]);
  const [isRolling, setIsRolling] = useState(true);
  const rollStartTime = useRef(Date.now());

  useEffect(() => {
    // Initialize dice
    diceRefs.current = [];
    for (let i = 0; i < config.count; i++) {
      // Dice will be created in render
    }

    // Roll animation duration
    const duration = 2000;
    const timer = setTimeout(() => {
      setIsRolling(false);
      
      // Calculate final roll values
      const roll: DiceRoll = {
        dice: diceRefs.current.map(() => 
          Math.floor(Math.random() * config.sides) + 1
        ),
        total: 0,
        timestamp: Date.now(),
      };
      roll.total = roll.dice.reduce((sum, val) => sum + val, 0);
      
      onRollComplete?.(roll);
    }, duration);

    return () => clearTimeout(timer);
  }, [config, onRollComplete]);

  useFrame(() => {
    if (!isRolling) return;

    const elapsed = Date.now() - rollStartTime.current;
    const progress = Math.min(elapsed / 2000, 1);
    const eased = 1 - Math.pow(1 - progress, 3);

    diceRefs.current.forEach((dice) => {
      if (!dice) return;

      // Rotate dice
      dice.rotation.x += 0.1 * (1 - eased);
      dice.rotation.y += 0.1 * (1 - eased);
      dice.rotation.z += 0.1 * (1 - eased);

      // Bounce effect
      const bounce = Math.sin(progress * Math.PI * 4) * (1 - eased) * 0.5;
      dice.position.y = bounce;
    });
  });

  return (
    // @ts-ignore - React Three Fiber provides 'group' element
    <group position={[0, 2, 0]}>
      {Array.from({ length: config.count }).map((_unused, index) => {
        const geometry = createDiceGeometry(config.sides, config.size ?? 0.5);
        const material = createDiceMaterial(config);
        const spacing = (index - (config.count - 1) / 2) * 1.5;

        return (
          // @ts-ignore - React Three Fiber provides 'mesh' element
          <mesh
            key={index}
            ref={(el: THREE.Mesh | null) => {
              if (el && index < diceRefs.current.length) {
                diceRefs.current[index] = el;
              } else if (el) {
                diceRefs.current.push(el);
              }
            }}
            geometry={geometry}
            material={material}
            position={[spacing, 0, 0]}
          />
        );
      })}
    {/* @ts-ignore - React Three Fiber provides 'group' element */}
    </group>
  );
}
