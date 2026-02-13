/**
 * Type declarations for React Three Fiber JSX elements
 */

import '@react-three/fiber';

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
