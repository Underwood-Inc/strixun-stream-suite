/**
 * Audio Player Core - Main entry point
 */

export { AudioEngine } from './core/audio-engine.js';
export { detectPosition, shouldUseFloatingPlayer } from './core/position-detector.js';
export { MusicAPIClient } from './core/music-api-client.js';
export type { AudioTrack, AudioAnalysis, AudioPlayerConfig, AudioPlayerState } from './types.js';
export type { MusicSearchParams, MusicSearchResponse } from './core/music-api-client.js';
export type { PositionInfo } from './core/position-detector.js';
