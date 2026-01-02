/**
 * Type declarations for React Three Fiber JSX elements
 * These are provided by @react-three/fiber but TypeScript needs explicit declarations
 */

/// <reference types="@react-three/fiber" />

declare global {
  namespace JSX {
    interface IntrinsicElements {
      group: any;
      mesh: any;
      ambientLight: any;
      directionalLight: any;
      pointLight: any;
      planeGeometry: any;
      meshBasicMaterial: any;
      meshStandardMaterial: any;
      cylinderGeometry: any;
    }
  }
}

export {};
