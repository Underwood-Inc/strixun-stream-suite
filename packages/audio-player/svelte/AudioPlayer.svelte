<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { AudioEngine } from '../core/audio-engine.js';
  import { shouldUseFloatingPlayer } from '../core/position-detector.js';
  import type { AudioTrack, AudioAnalysis, AudioPlayerConfig } from '../types.js';
  
  interface Props {
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
  
  let {
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
  }: Props = $props();
  
  let containerElement: HTMLDivElement;
  let isPlaying = $state(false);
  let isLoading = $state(false);
  let currentTime = $state(0);
  let duration = $state(0);
  let currentVolume = $state(volume);
  let analysis: AudioAnalysis | null = $state(null);
  let error: Error | null = $state(null);
  let useFloating = $state(false);
  
  let engine: AudioEngine | null = null;
  let timeUpdateInterval: number | null = null;
  
  $effect(() => {
    if (containerElement) {
      useFloating = shouldUseFloatingPlayer(containerElement, floating);
    }
  });
  
  $effect(() => {
    if (track) {
      loadTrack(track);
    }
  });
  
  $effect(() => {
    if (engine) {
      engine.setVolume(currentVolume);
    }
  });
  
  onMount(() => {
    if (containerElement) {
      useFloating = shouldUseFloatingPlayer(containerElement, floating);
    }
  });
  
  onDestroy(() => {
    if (engine) {
      engine.destroy();
    }
    if (timeUpdateInterval !== null) {
      clearInterval(timeUpdateInterval);
    }
  });
  
  async function loadTrack(newTrack: AudioTrack) {
    if (engine) {
      engine.destroy();
    }
    
    isLoading = true;
    error = null;
    
    try {
      engine = new AudioEngine({
        track: newTrack,
        autoPlay,
        loop,
        volume: currentVolume,
        onAnalysis: (anal) => {
          analysis = anal;
          onAnalysis?.(anal);
        },
        onPlay: () => {
          isPlaying = true;
          onPlay?.();
          startTimeUpdate();
        },
        onPause: () => {
          isPlaying = false;
          onPause?.();
          stopTimeUpdate();
        },
        onEnd: () => {
          isPlaying = false;
          onEnd?.();
          stopTimeUpdate();
        },
        onError: (err) => {
          error = err;
          isLoading = false;
          onError?.(err);
        },
      });
      
      await engine.loadTrack(newTrack);
      duration = engine.getDuration();
      isLoading = false;
    } catch (err) {
      error = err as Error;
      isLoading = false;
      onError?.(err as Error);
    }
  }
  
  function togglePlay() {
    if (!engine) return;
    
    if (isPlaying) {
      engine.pause();
    } else {
      engine.play();
    }
  }
  
  function startTimeUpdate() {
    if (timeUpdateInterval !== null) return;
    
    timeUpdateInterval = setInterval(() => {
      if (engine) {
        currentTime = engine.getCurrentTime();
        duration = engine.getDuration();
      }
    }, 100) as unknown as number;
  }
  
  function stopTimeUpdate() {
    if (timeUpdateInterval !== null) {
      clearInterval(timeUpdateInterval);
      timeUpdateInterval = null;
    }
  }
  
  function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
  
  function handleVolumeChange(e: Event) {
    const target = e.target as HTMLInputElement;
    currentVolume = parseFloat(target.value);
  }
</script>

<div
  bind:this={containerElement}
  class="audio-player"
  class:audio-player--floating={useFloating}
  class:audio-player--top-left={useFloating && position === 'top-left'}
  class:audio-player--top-right={useFloating && position === 'top-right'}
  class:audio-player--bottom-left={useFloating && position === 'bottom-left'}
  class:audio-player--bottom-right={useFloating && position === 'bottom-right'}
>
  {#if error}
    <div class="audio-player__error">
      Error: {error.message}
    </div>
  {/if}
  
  {#if track}
    <div class="audio-player__content">
      <div class="audio-player__info">
        <div class="audio-player__title">{track.title}</div>
        <div class="audio-player__artist">{track.artist}</div>
      </div>
      
      <div class="audio-player__controls">
        <button
          class="audio-player__play-button"
          onclick={togglePlay}
          disabled={isLoading}
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {#if isLoading}
            <span class="audio-player__spinner">Loading...</span>
          {:else if isPlaying}
            <span>Pause</span>
          {:else}
            <span>Play</span>
          {/if}
        </button>
        
        <div class="audio-player__time">
          <span>{formatTime(currentTime)}</span>
          <span>/</span>
          <span>{formatTime(duration)}</span>
        </div>
        
        <div class="audio-player__volume">
          <label for="volume">Volume</label>
          <input
            id="volume"
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={currentVolume}
            oninput={handleVolumeChange}
          />
        </div>
      </div>
      
      {#if analysis}
        <div class="audio-player__visualization">
          <div class="audio-player__bars">
            {#each Array(32) as _, i}
              {@const value = analysis.frequencyData[i] || 0}
              <div
                class="audio-player__bar"
                style="height: {value}%"
              ></div>
            {/each}
          </div>
        </div>
      {/if}
    </div>
  {:else}
    <div class="audio-player__empty">
      No track loaded
    </div>
  {/if}
</div>

<style>
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
</style>
