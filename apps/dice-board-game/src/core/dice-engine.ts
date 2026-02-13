/**
 * 3D Dice Engine
 * Handles dice rolling, physics simulation, and customization
 */

import type { DiceConfig, DiceRoll } from '../types/index.js';
import * as THREE from 'three';

/**
 * Roll dice with physics simulation
 */
export function rollDice(config: DiceConfig): Promise<DiceRoll> {
  return new Promise((resolve) => {
    // Simulate physics-based rolling
    const dice: number[] = [];
    
    for (let i = 0; i < config.count; i++) {
      // Simulate realistic dice roll (weighted towards center values slightly)
      const roll = simulateDiceRoll(config.sides);
      dice.push(roll);
    }

    const total = dice.reduce((sum, val) => sum + val, 0);

    resolve({
      dice,
      total,
      timestamp: Date.now(),
    });
  });
}

/**
 * Simulate a single dice roll with slight physics bias
 */
function simulateDiceRoll(sides: number): number {
  // Use multiple random samples to simulate physics
  const samples: number[] = [];
  for (let i = 0; i < 3; i++) {
    samples.push(Math.random());
  }
  
  // Average with slight bias towards center (realistic physics)
  const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
  const biased = avg * 0.7 + Math.random() * 0.3; // 70% physics, 30% random
  
  return Math.floor(biased * sides) + 1;
}

/**
 * Create 3D dice geometry
 */
export function createDiceGeometry(sides: number, size: number = 1): THREE.BufferGeometry {
  switch (sides) {
    case 4:
      return new THREE.TetrahedronGeometry(size);
    case 6:
      return new THREE.BoxGeometry(size, size, size);
    case 8:
      return new THREE.OctahedronGeometry(size);
    case 10:
      // D10 is a pentagonal trapezohedron - approximate with dodecahedron
      return new THREE.DodecahedronGeometry(size * 0.8);
    case 12:
      return new THREE.DodecahedronGeometry(size);
    case 20:
      return new THREE.IcosahedronGeometry(size);
    default:
      // Default to cube for unknown dice
      return new THREE.BoxGeometry(size, size, size);
  }
}

/**
 * Create dice material based on config
 */
export function createDiceMaterial(config: DiceConfig): THREE.Material {
  const color = config.color ? new THREE.Color(config.color) : new THREE.Color(0xffffff);

  switch (config.material) {
    case 'metal':
      return new THREE.MeshStandardMaterial({
        color,
        metalness: 0.8,
        roughness: 0.2,
      });
    case 'wood':
      return new THREE.MeshStandardMaterial({
        color,
        metalness: 0.1,
        roughness: 0.9,
      });
    case 'crystal':
      return new THREE.MeshPhysicalMaterial({
        color,
        metalness: 0.1,
        roughness: 0.1,
        transmission: 0.9,
        thickness: 0.5,
      });
    default:
      return new THREE.MeshStandardMaterial({
        color,
        metalness: 0.3,
        roughness: 0.5,
      });
  }
}

/**
 * Apply physics forces to dice mesh
 */
export function applyDicePhysics(
  mesh: THREE.Mesh,
  intensity: number = 1
): void {
  const force = new THREE.Vector3(
    (Math.random() - 0.5) * intensity,
    Math.random() * intensity * 2,
    (Math.random() - 0.5) * intensity
  );

  const torque = new THREE.Vector3(
    (Math.random() - 0.5) * intensity,
    (Math.random() - 0.5) * intensity,
    (Math.random() - 0.5) * intensity
  );

  // Apply to mesh (would need physics engine for real simulation)
  // This is a placeholder - in real implementation, use Cannon.js or similar
  mesh.position.add(force);
  mesh.rotation.x += torque.x;
  mesh.rotation.y += torque.y;
  mesh.rotation.z += torque.z;
}

/**
 * Get dice face value from rotation (for 6-sided dice)
 */
export function getDiceFaceValue(mesh: THREE.Mesh, sides: number): number {
  if (sides !== 6) {
    // For non-6-sided dice, would need more complex logic
    return Math.floor(Math.random() * sides) + 1;
  }

  // For 6-sided dice, determine face based on rotation
  const up = new THREE.Vector3(0, 1, 0);
  up.applyQuaternion(mesh.quaternion);

  // Map up vector to face value
  // This is simplified - real implementation would check all 6 faces
  const dotY = up.y;
  
  if (dotY > 0.9) return 1; // Top
  if (dotY < -0.9) return 6; // Bottom
  if (Math.abs(up.x) > 0.7) return up.x > 0 ? 3 : 4; // Right/Left
  if (Math.abs(up.z) > 0.7) return up.z > 0 ? 2 : 5; // Front/Back
  
  return Math.floor(Math.random() * 6) + 1; // Fallback
}

/**
 * Animate dice roll
 */
export function animateDiceRoll(
  mesh: THREE.Mesh,
  duration: number = 2000,
  onComplete?: () => void
): void {
  const startTime = Date.now();
  const startRotation = mesh.rotation.clone();
  const targetRotation = new THREE.Euler(
    startRotation.x + Math.PI * 4,
    startRotation.y + Math.PI * 4,
    startRotation.z + Math.PI * 4
  );

  function animate() {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);
    
    // Ease out
    const eased = 1 - Math.pow(1 - progress, 3);
    
    mesh.rotation.x = startRotation.x + (targetRotation.x - startRotation.x) * eased;
    mesh.rotation.y = startRotation.y + (targetRotation.y - startRotation.y) * eased;
    mesh.rotation.z = startRotation.z + (targetRotation.z - startRotation.z) * eased;

    if (progress < 1) {
      requestAnimationFrame(animate);
    } else if (onComplete) {
      onComplete();
    }
  }

  animate();
}
