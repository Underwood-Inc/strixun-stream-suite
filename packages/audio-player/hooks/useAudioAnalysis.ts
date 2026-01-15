/**
 * React hook for audio analysis data
 */

import { useState, useEffect } from 'react';
import type { AudioAnalysis } from '../types.js';

export interface UseAudioAnalysisOptions {
  onAnalysis?: (analysis: AudioAnalysis) => void;
}

export function useAudioAnalysis(
  analysis: AudioAnalysis | null,
  options: UseAudioAnalysisOptions = {}
): {
  frequencyData: Uint8Array | null;
  timeDomainData: Uint8Array | null;
  bass: number;
  mid: number;
  treble: number;
  volume: number;
  beat: boolean;
} {
  const [beat, setBeat] = useState(false);
  const [lastBeatTime, setLastBeatTime] = useState(0);
  
  useEffect(() => {
    if (!analysis) return;
    
    options.onAnalysis?.(analysis);
    
    // Simple beat detection based on bass energy
    const threshold = 0.7;
    const now = Date.now();
    const timeSinceLastBeat = now - lastBeatTime;
    const minBeatInterval = 200; // Minimum 200ms between beats
    
    if (analysis.bass > threshold && timeSinceLastBeat > minBeatInterval) {
      setBeat(true);
      setLastBeatTime(now);
      
      // Reset beat flag after a short time
      setTimeout(() => setBeat(false), 100);
    }
  }, [analysis, lastBeatTime, options]);
  
  return {
    frequencyData: analysis?.frequencyData || null,
    timeDomainData: analysis?.timeDomainData || null,
    bass: analysis?.bass || 0,
    mid: analysis?.mid || 0,
    treble: analysis?.treble || 0,
    volume: analysis?.volume || 0,
    beat,
  };
}
