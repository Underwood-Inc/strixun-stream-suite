/**
 * Audio Player React Component
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { AudioEngine } from '../core/audio-engine.js';
import { shouldUseFloatingPlayer } from '../core/position-detector.js';
import type { AudioTrack, AudioAnalysis, AudioPlayerConfig } from '../types.js';

export interface AudioPlayerProps {
  track?: AudioTrack;
  autoPlay?: boolean;
  loop?: boolean;
  volume?: number;
  floating?: boolean;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  apiUrl?: string;
  onAnalysis?: (analysis: AudioAnalysis) => void;
  onPlay?: () => void;
  onPause?: () => void;
  onEnd?: () => void;
  onError?: (error: Error) => void;
}

export function AudioPlayer({
  track,
  autoPlay = false,
  loop = false,
  volume = 1.0,
  floating,
  position = 'bottom-right',
  apiUrl,
  onAnalysis,
  onPlay,
  onPause,
  onEnd,
  onError,
}: AudioPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<AudioEngine | null>(null);
  const timeUpdateIntervalRef = useRef<number | null>(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentVolume, setCurrentVolume] = useState(volume);
  const [analysis, setAnalysis] = useState<AudioAnalysis | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [useFloating, setUseFloating] = useState(false);
  
  // Detect position on mount and when container changes
  useEffect(() => {
    if (containerRef.current) {
      setUseFloating(shouldUseFloatingPlayer(containerRef.current, floating));
    }
  }, [floating]);
  
  // Load track when it changes
  useEffect(() => {
    if (track) {
      loadTrack(track);
    }
    
    return () => {
      if (engineRef.current) {
        engineRef.current.destroy();
        engineRef.current = null;
      }
      if (timeUpdateIntervalRef.current !== null) {
        clearInterval(timeUpdateIntervalRef.current);
        timeUpdateIntervalRef.current = null;
      }
    };
  }, [track]);
  
  // Update volume when it changes
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.setVolume(currentVolume);
    }
  }, [currentVolume]);
  
  const loadTrack = useCallback(async (newTrack: AudioTrack) => {
    if (engineRef.current) {
      engineRef.current.destroy();
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const engine = new AudioEngine({
        track: newTrack,
        autoPlay,
        loop,
        volume: currentVolume,
        onAnalysis: (anal) => {
          setAnalysis(anal);
          onAnalysis?.(anal);
        },
        onPlay: () => {
          setIsPlaying(true);
          onPlay?.();
          startTimeUpdate();
        },
        onPause: () => {
          setIsPlaying(false);
          onPause?.();
          stopTimeUpdate();
        },
        onEnd: () => {
          setIsPlaying(false);
          onEnd?.();
          stopTimeUpdate();
        },
        onError: (err) => {
          setError(err);
          setIsLoading(false);
          onError?.(err);
        },
      });
      
      engineRef.current = engine;
      await engine.loadTrack(newTrack);
      setDuration(engine.getDuration());
      setIsLoading(false);
    } catch (err) {
      setError(err as Error);
      setIsLoading(false);
      onError?.(err as Error);
    }
  }, [autoPlay, loop, currentVolume, onAnalysis, onPlay, onPause, onEnd, onError]);
  
  const togglePlay = useCallback(() => {
    if (!engineRef.current) return;
    
    if (isPlaying) {
      engineRef.current.pause();
    } else {
      engineRef.current.play();
    }
  }, [isPlaying]);
  
  const startTimeUpdate = useCallback(() => {
    if (timeUpdateIntervalRef.current !== null) return;
    
    timeUpdateIntervalRef.current = setInterval(() => {
      if (engineRef.current) {
        setCurrentTime(engineRef.current.getCurrentTime());
        setDuration(engineRef.current.getDuration());
      }
    }, 100) as unknown as number;
  }, []);
  
  const stopTimeUpdate = useCallback(() => {
    if (timeUpdateIntervalRef.current !== null) {
      clearInterval(timeUpdateIntervalRef.current);
      timeUpdateIntervalRef.current = null;
    }
  }, []);
  
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCurrentVolume(parseFloat(e.target.value));
  };
  
  const positionClass = useFloating ? `audio-player--floating audio-player--${position}` : '';
  
  return (
    <div
      ref={containerRef}
      className={`audio-player ${positionClass}`}
    >
      {error && (
        <div className="audio-player__error">
          Error: {error.message}
        </div>
      )}
      
      {track ? (
        <div className="audio-player__content">
          <div className="audio-player__info">
            <div className="audio-player__title">{track.title}</div>
            <div className="audio-player__artist">{track.artist}</div>
          </div>
          
          <div className="audio-player__controls">
            <button
              className="audio-player__play-button"
              onClick={togglePlay}
              disabled={isLoading}
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isLoading ? (
                <span className="audio-player__spinner">Loading...</span>
              ) : isPlaying ? (
                'Pause'
              ) : (
                'Play'
              )}
            </button>
            
            <div className="audio-player__time">
              <span>{formatTime(currentTime)}</span>
              <span>/</span>
              <span>{formatTime(duration)}</span>
            </div>
            
            <div className="audio-player__volume">
              <label htmlFor="volume">Volume</label>
              <input
                id="volume"
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={currentVolume}
                onChange={handleVolumeChange}
              />
            </div>
          </div>
          
          {analysis && (
            <div className="audio-player__visualization">
              <div className="audio-player__bars">
                {Array.from({ length: 32 }).map((_, i) => {
                  const value = analysis.frequencyData[i] || 0;
                  return (
                    <div
                      key={i}
                      className="audio-player__bar"
                      style={{ height: `${value}%` }}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="audio-player__empty">
          No track loaded
        </div>
      )}
      
      <style>{`
        .audio-player {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          padding: 1rem;
          background: var(--card, #1a1a1a);
          border-radius: 8px;
          color: var(--text, #f9f9f9);
          min-width: 300px;
          max-width: 400px;
        }
        
        .audio-player--floating {
          position: fixed;
          z-index: 99999;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        }
        
        .audio-player--top-left {
          top: 1rem;
          left: 1rem;
        }
        
        .audio-player--top-right {
          top: 1rem;
          right: 1rem;
        }
        
        .audio-player--bottom-left {
          bottom: 1rem;
          left: 1rem;
        }
        
        .audio-player--bottom-right {
          bottom: 1rem;
          right: 1rem;
        }
        
        .audio-player__error {
          color: var(--error, #ff4444);
          padding: 0.5rem;
          background: rgba(255, 68, 68, 0.1);
          border-radius: 4px;
        }
        
        .audio-player__content {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        
        .audio-player__info {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }
        
        .audio-player__title {
          font-weight: bold;
          font-size: 1.1rem;
        }
        
        .audio-player__artist {
          font-size: 0.9rem;
          opacity: 0.8;
        }
        
        .audio-player__controls {
          display: flex;
          align-items: center;
          gap: 1rem;
        }
        
        .audio-player__play-button {
          padding: 0.5rem 1rem;
          background: var(--primary, #4a9eff);
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 0.9rem;
          transition: background 0.2s;
        }
        
        .audio-player__play-button:hover:not(:disabled) {
          background: var(--primary-hover, #3a8eef);
        }
        
        .audio-player__play-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        
        .audio-player__time {
          display: flex;
          gap: 0.25rem;
          font-size: 0.9rem;
          opacity: 0.8;
        }
        
        .audio-player__volume {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          flex: 1;
        }
        
        .audio-player__volume label {
          font-size: 0.8rem;
          opacity: 0.8;
        }
        
        .audio-player__volume input[type="range"] {
          flex: 1;
        }
        
        .audio-player__visualization {
          height: 60px;
          display: flex;
          align-items: flex-end;
          gap: 2px;
          padding: 0.5rem;
          background: rgba(0, 0, 0, 0.2);
          border-radius: 4px;
        }
        
        .audio-player__bars {
          display: flex;
          align-items: flex-end;
          gap: 2px;
          width: 100%;
          height: 100%;
        }
        
        .audio-player__bar {
          flex: 1;
          background: var(--primary, #4a9eff);
          min-height: 2px;
          transition: height 0.1s;
        }
        
        .audio-player__empty {
          padding: 1rem;
          text-align: center;
          opacity: 0.6;
        }
        
        .audio-player__spinner {
          display: inline-block;
          animation: spin 1s linear infinite;
        }
        
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}
