#  VOIP Architecture Design

**Status:** Post-MVP Feature  
**Design Date:** December 2024

## Overview

Composable, agnostic, strongly-typed architecture for peer-to-peer voice communication using WebRTC Audio Streams with SRTP encryption.

---

## Architecture Principles

### ✓ Composable
- **Independent Service**: `VOIPService` can be used standalone or with chat
- **No Dependencies**: Doesn't require chat system to function
- **Modular**: Can be combined with other services (chat, video, etc.)

### ✓ Agnostic
- **Signaling Agnostic**: Works with any signaling server
- **Storage Agnostic**: No server-side storage required
- **Framework Agnostic**: Pure TypeScript, no framework dependencies

### ✓ Strongly Typed
- **Full TypeScript**: Complete type coverage
- **Interface-Based**: All configs and states are interfaces
- **Type Safety**: Compile-time error checking

---

## Core Components

### 1. VOIPService (`src/services/chat/voip.ts`)

**Purpose**: Main service for peer-to-peer voice communication

**Features**:
- Microphone access and management
- Audio stream handling
- Connection state monitoring
- Input level monitoring
- Connection quality tracking
- Mute/unmute controls

**Key Methods**:
```typescript
// Enable/disable microphone
enableMicrophone(): Promise<MediaStream>
disableMicrophone(): void

// Connection management
createConnection(roomId: string, userId: string): Promise<void>
createOffer(): Promise<RTCSessionDescriptionInit>
createAnswer(): Promise<RTCSessionDescriptionInit>

// Controls
setMicrophoneMuted(muted: boolean): void
setSpeakerMuted(muted: boolean): void

// State
getState(): Readonly<VOIPState>
getConnectionState(): RTCPeerConnectionState | null
```

---

## Security Architecture

### Transport Layer (Built-in)
- **SRTP**: Secure Real-time Transport Protocol (built into WebRTC)
- **DTLS**: Datagram Transport Layer Security for signaling
- **Automatic**: No configuration needed, always enabled

### Application Layer (Optional)
- **Encryption Token**: JWT token used for key derivation
- **Additional Security**: Encrypt audio data before transmission (if enabled)
- **Configurable**: Can be enabled/disabled via `enableAppLayerEncryption`

---

## Integration with Existing Chat System

### Shared Infrastructure
- **WebRTC Connection**: Can share peer connection with chat (data channel + audio)
- **Signaling Server**: Uses same signaling server as chat
- **Room Management**: Integrates with existing room system

### Separate Service
- **Independent**: VOIP can work without chat
- **Composable**: Can be added to existing chat rooms
- **Optional**: Users can enable/disable VOIP per room

---

## Implementation Example

```typescript
import { VOIPService } from './services/chat/voip';
import { RoomManager } from './services/chat/roomManager';

// Initialize VOIP service
const voipService = new VOIPService({
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    // Add TURN servers for difficult networks
  ],
  audioConstraints: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  },
  onAudioStream: (stream, userId) => {
    // Handle incoming audio stream
    const audio = new Audio();
    audio.srcObject = stream;
    audio.play();
  },
  onConnectionStateChange: (state) => {
    console.log('VOIP connection state:', state);
  },
  onError: (error) => {
    console.error('VOIP error:', error);
  },
});

// Enable microphone
await voipService.enableMicrophone();

// Create connection (uses same room as chat)
await voipService.createConnection(roomId, userId);

// Create offer (if room creator)
const offer = await voipService.createOffer();
// Send offer via signaling server...

// Set remote answer
await voipService.setRemoteAnswer(answer);
```

---

## NAT Traversal

### STUN Servers
- **Default**: Google STUN servers (free)
- **Purpose**: Discover public IP and port
- **Works For**: Most home networks

### TURN Servers (Future)
- **Purpose**: Relay traffic when P2P fails
- **When Needed**: Corporate firewalls, symmetric NATs
- **Implementation**: Add TURN server URLs to `iceServers`

---

## Quality Monitoring

### Connection Quality
- **Based On**: ICE connection state
- **Values**: 0-100 (0 = disconnected, 100 = connected)
- **Updates**: Real-time as connection state changes

### Input Level
- **Purpose**: Show microphone activity
- **Method**: AudioContext + AnalyserNode
- **Updates**: RequestAnimationFrame loop
- **Values**: 0-100 (0 = silent, 100 = max)

---

## Error Handling

### Microphone Access
- **Permission Denied**: User must grant microphone permission
- **Device Unavailable**: No microphone found
- **Error Handling**: Throws descriptive errors

### Connection Failures
- **NAT Traversal Failed**: May need TURN server
- **Network Issues**: Automatic retry with exponential backoff
- **Peer Disconnection**: Handled by connection state monitoring

---

## Performance Considerations

### Audio Processing
- **Echo Cancellation**: Enabled by default
- **Noise Suppression**: Enabled by default
- **Auto Gain Control**: Enabled by default
- **Low Latency**: Direct P2P connection

### Resource Usage
- **CPU**: Minimal (WebRTC handles encoding/decoding)
- **Bandwidth**: ~50-100 kbps per call (depends on codec)
- **Memory**: Minimal (streams are handled by browser)

---

## Browser Compatibility

### Supported Browsers
- ✓ Chrome/Edge (Chromium)
- ✓ Firefox
- ✓ Safari 11+
- ✓ Opera

### Requirements
- **getUserMedia**: Required for microphone access
- **WebRTC**: Required for peer connections
- **HTTPS**: Required (except localhost)

---

## Future Enhancements

### Video Support
- Extend `VOIPService` to `MediaService`
- Add video tracks alongside audio
- Screen sharing support

### Group Calls
- Multi-peer connections
- Audio mixing
- Selective muting

### Recording
- Local recording
- Encrypted storage
- Playback support

---

## Testing Strategy

### Unit Tests
- Service initialization
- State management
- Error handling

### Integration Tests
- Microphone access
- Connection establishment
- Audio stream handling

### E2E Tests
- Full call flow
- NAT traversal
- Error recovery

---

**Status**: Architecture designed, ready for implementation post-MVP

