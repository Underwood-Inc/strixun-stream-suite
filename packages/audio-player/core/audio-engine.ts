/**
 * Audio Engine - Core audio processing using Howler.js and Web Audio API
 */

import { Howl } from 'howler';
import type { AudioTrack, AudioAnalysis, AudioPlayerConfig } from '../types.js';

export class AudioEngine {
  private howl: Howl | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private sourceNode: MediaElementAudioSourceNode | null = null;
  private animationFrameId: number | null = null;
  private frequencyData: Uint8Array | null = null;
  private timeDomainData: Uint8Array | null = null;
  
  private config: AudioPlayerConfig;
  private onAnalysis?: (analysis: AudioAnalysis) => void;
  
  constructor(config: AudioPlayerConfig) {
    this.config = config;
    this.onAnalysis = config.onAnalysis;
  }
  
  /**
   * Initialize audio context and analyser
   */
  private initAudioContext(): void {
    if (this.audioContext) return;
    
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.8;
      
      this.frequencyData = new Uint8Array(this.analyser.frequencyBinCount);
      this.timeDomainData = new Uint8Array(this.analyser.frequencyBinCount);
    } catch (error) {
      console.error('Failed to initialize AudioContext:', error);
      this.config.onError?.(error as Error);
    }
  }
  
  /**
   * Load and play a track
   */
  async loadTrack(track: AudioTrack): Promise<void> {
    this.stop();
    
    return new Promise((resolve, reject) => {
      this.howl = new Howl({
        src: [track.url],
        html5: true,
        autoplay: this.config.autoPlay || false,
        loop: this.config.loop || false,
        volume: this.config.volume ?? 1.0,
        onload: () => {
          this.initAudioContext();
          this.connectToAnalyser();
          this.startAnalysis();
          resolve();
        },
        onloaderror: (id, error) => {
          const err = new Error(`Failed to load audio: ${error}`);
          this.config.onError?.(err);
          reject(err);
        },
        onplay: () => {
          this.config.onPlay?.();
        },
        onpause: () => {
          this.config.onPause?.();
        },
        onend: () => {
          this.config.onEnd?.();
        },
        onerror: (id, error) => {
          const err = new Error(`Audio playback error: ${error}`);
          this.config.onError?.(err);
        },
      });
    });
  }
  
  /**
   * Connect Howler to Web Audio API analyser
   */
  private connectToAnalyser(): void {
    if (!this.howl || !this.audioContext || !this.analyser) return;
    
    try {
      // Get the HTML5 audio element from Howler
      const sound = (this.howl as any)._sounds?.[0];
      if (!sound || !sound._node) return;
      
      // Create source node from HTML5 audio element
      const audioElement = sound._node;
      if (this.sourceNode) {
        this.sourceNode.disconnect();
      }
      
      this.sourceNode = this.audioContext.createMediaElementSource(audioElement);
      this.sourceNode.connect(this.analyser);
      this.analyser.connect(this.audioContext.destination);
    } catch (error) {
      console.error('Failed to connect to analyser:', error);
      // Some browsers may not allow multiple connections, try alternative approach
      this.initAudioContext();
    }
  }
  
  /**
   * Start audio analysis loop
   */
  private startAnalysis(): void {
    if (this.animationFrameId !== null) return;
    
    const analyze = () => {
      if (!this.analyser || !this.frequencyData || !this.timeDomainData) {
        this.animationFrameId = requestAnimationFrame(analyze);
        return;
      }
      
      this.analyser.getByteFrequencyData(this.frequencyData);
      this.analyser.getByteTimeDomainData(this.timeDomainData);
      
      // Calculate frequency bands
      const bass = this.calculateBand(this.frequencyData, 0, 20);
      const mid = this.calculateBand(this.frequencyData, 20, 60);
      const treble = this.calculateBand(this.frequencyData, 60, 128);
      const volume = this.calculateVolume(this.frequencyData);
      
      const analysis: AudioAnalysis = {
        frequencyData: this.frequencyData.slice(),
        timeDomainData: this.timeDomainData.slice(),
        bass,
        mid,
        treble,
        volume,
      };
      
      this.onAnalysis?.(analysis);
      this.animationFrameId = requestAnimationFrame(analyze);
    };
    
    this.animationFrameId = requestAnimationFrame(analyze);
  }
  
  /**
   * Stop analysis loop
   */
  private stopAnalysis(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }
  
  /**
   * Calculate average value for a frequency band
   */
  private calculateBand(data: Uint8Array, start: number, end: number): number {
    let sum = 0;
    let count = 0;
    for (let i = start; i < end && i < data.length; i++) {
      sum += data[i];
      count++;
    }
    return count > 0 ? sum / count : 0;
  }
  
  /**
   * Calculate overall volume
   */
  private calculateVolume(data: Uint8Array): number {
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      sum += data[i];
    }
    return sum / data.length / 255;
  }
  
  /**
   * Play audio
   */
  play(): void {
    if (this.howl && !this.howl.playing()) {
      this.howl.play();
    }
  }
  
  /**
   * Pause audio
   */
  pause(): void {
    if (this.howl && this.howl.playing()) {
      this.howl.pause();
    }
  }
  
  /**
   * Stop audio
   */
  stop(): void {
    this.stopAnalysis();
    if (this.howl) {
      this.howl.stop();
      this.howl.unload();
      this.howl = null;
    }
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
  }
  
  /**
   * Set volume (0.0 to 1.0)
   */
  setVolume(volume: number): void {
    if (this.howl) {
      this.howl.volume(volume);
    }
  }
  
  /**
   * Get current time
   */
  getCurrentTime(): number {
    return this.howl?.seek() as number || 0;
  }
  
  /**
   * Set current time
   */
  seek(time: number): void {
    if (this.howl) {
      this.howl.seek(time);
    }
  }
  
  /**
   * Get duration
   */
  getDuration(): number {
    return this.howl?.duration() || 0;
  }
  
  /**
   * Check if playing
   */
  isPlaying(): boolean {
    return this.howl?.playing() || false;
  }
  
  /**
   * Cleanup
   */
  destroy(): void {
    this.stop();
    if (this.audioContext) {
      this.audioContext.close().catch(console.error);
      this.audioContext = null;
    }
    this.analyser = null;
    this.frequencyData = null;
    this.timeDomainData = null;
  }
}
