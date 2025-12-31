# Strixun Stream Suite - Architectural Overview

> **Succinct technical architecture documentation with mermaid diagrams and code examples**

**Document Version:** 1.0.0  
**Last Updated:** 2025-01-01

---

## System Architecture

### High-Level Overview

```mermaid
graph TB
    subgraph Client["Client Environment"]
        OBS[OBS Studio<br/>Lua Runtime]
        Browser[Browser CEF<br/>Chromium]
        Panel[Control Panel<br/>Svelte 5 + TS]
    end
    
    subgraph Storage["Storage Layer"]
        IDB[(IndexedDB<br/>Primary)]
        LS[(localStorage<br/>Backup)]
        Recovery[(Recovery<br/>Snapshot)]
    end
    
    subgraph Network["Network"]
        WS[OBS WebSocket<br/>localhost:4455]
        HTTP[HTTPS<br/>Cloudflare Edge]
    end
    
    subgraph Cloud["Cloudflare Workers"]
        Auth[OTP Auth]
        Chat[Chat Signaling]
        API[Twitch API Proxy]
        Storage[Cloud Storage]
        URL[URL Shortener]
        Notes[Notes Storage]
    end
    
    subgraph KV["Cloudflare KV"]
        AuthKV[(Auth Data)]
        ChatKV[(Chat Metadata)]
        StorageKV[(Cloud Saves)]
        URLKV[(URL Mappings)]
        NotesKV[(Notebooks)]
    end
    
    OBS --> Browser
    Browser --> Panel
    Panel --> IDB
    Panel --> LS
    Panel --> Recovery
    Panel --> WS
    Panel --> HTTP
    HTTP --> Auth
    HTTP --> Chat
    HTTP --> API
    HTTP --> Storage
    HTTP --> URL
    HTTP --> Notes
    Auth --> AuthKV
    Chat --> ChatKV
    API --> StorageKV
    Storage --> StorageKV
    URL --> URLKV
    Notes --> NotesKV
    
    style Client fill:#1a1611,stroke:#edae49,stroke-width:2px
    style Storage fill:#4caf50,stroke:#2e7d32,stroke-width:2px
    style Network fill:#2196f3,stroke:#1976d2,stroke-width:2px
    style Cloud fill:#ff9800,stroke:#f57c00,stroke-width:2px
    style KV fill:#9c27b0,stroke:#7b1fa2,stroke-width:2px
```

---

## Component Architecture

### Client-Side Components

```mermaid
classDiagram
    class ControlPanel {
        -storage: StorageService
        -websocket: WebSocketClient
        -modules: ModuleRegistry
        +init()
        +handleTabSwitch()
    }
    
    class StorageService {
        -idb: IDBDatabase
        -cache: Map
        +get(key): Promise
        +set(key, value): Promise
        +remove(key): Promise
    }
    
    class WebSocketClient {
        -ws: WebSocket
        -connected: boolean
        -queue: Array
        +connect(): Promise
        +send(request): Promise
        +onMessage(handler): void
    }
    
    class ModuleRegistry {
        -modules: Map
        +register(name, module): void
        +get(name): Module
    }
    
    class SourceAnimations {
        -configs: Map
        +animate(source, type): void
        +configure(source, config): void
    }
    
    class SourceSwaps {
        -configs: Array
        +executeSwap(config): void
        +saveConfig(config): void
    }
    
    class Layouts {
        -presets: Array
        +captureLayout(name): void
        +applyLayout(name): void
    }
    
    ControlPanel --> StorageService
    ControlPanel --> WebSocketClient
    ControlPanel --> ModuleRegistry
    ModuleRegistry --> SourceAnimations
    ModuleRegistry --> SourceSwaps
    ModuleRegistry --> Layouts
```

### Serverless Services

```mermaid
graph LR
    subgraph Workers["Cloudflare Workers"]
        Auth[OTP Auth Service<br/>TypeScript]
        Chat[Chat Signaling<br/>TypeScript]
        API[Twitch API Proxy<br/>JavaScript]
        URL[URL Shortener<br/>TypeScript]
        Notes[Notes Storage<br/>JavaScript]
    end
    
    subgraph KV["Cloudflare KV"]
        AuthKV[(OTP Codes<br/>Sessions<br/>Users)]
        ChatKV[(Room Metadata<br/>Signaling Data)]
        APIKV[(Tokens<br/>Cache)]
        URLKV[(URL Mappings<br/>Analytics)]
        NotesKV[(Notebooks)]
    end
    
    Auth --> AuthKV
    Chat --> ChatKV
    API --> APIKV
    URL --> URLKV
    Notes --> NotesKV
    
    style Workers fill:#ff9800,stroke:#f57c00
    style KV fill:#9c27b0,stroke:#7b1fa2
```

---

## Data Flow Diagrams

### Source Animation Flow

```mermaid
sequenceDiagram
    participant User
    participant Panel as Control Panel
    participant WS as WebSocket
    participant OBS as OBS Studio
    participant Lua as source_animations.lua
    participant Source as OBS Source
    
    User->>Panel: Toggle Source Visibility
    Panel->>WS: Send Toggle Request
    WS->>OBS: WebSocket Message
    OBS->>Lua: Broadcast Event
    
    alt First Toggle (Cache State)
        Lua->>Lua: Cache Current State
        Lua->>Source: No Animation
    else Second Toggle (Animate)
        Lua->>Lua: Calculate Animation Plan
        loop Animation Frames (~60fps)
            Lua->>Source: Update Transform
            Source-->>User: Visual Update
        end
        Lua->>Lua: Restore Canonical Transform
    end
    
    Lua-->>OBS: Success
    OBS-->>WS: Response
    WS-->>Panel: Update UI
```

### Cloud Storage Flow

```mermaid
sequenceDiagram
    participant User
    participant Panel as Control Panel
    participant Storage as Local Storage
    participant API as Cloudflare Worker
    participant KV as Cloudflare KV
    
    User->>Panel: Click "Save to Cloud"
    Panel->>Storage: Get All Configs
    Storage-->>Panel: Config Data
    Panel->>Panel: Serialize to JSON
    Panel->>API: POST /cloud/save
    API->>API: Validate Device ID
    API->>API: Validate Payload Size
    API->>KV: Store Save Data
    KV-->>API: Success
    API->>KV: Update Slot List
    KV-->>API: Success
    API-->>Panel: 200 OK
    Panel-->>User: Success Message
```

### Authentication Flow

```mermaid
sequenceDiagram
    participant User
    participant Client as Client App
    participant Auth as OTP Auth Service
    participant KV as Cloudflare KV
    participant Email as Resend Email
    
    User->>Client: Enter Email
    Client->>Auth: POST /auth/request-otp
    Auth->>Auth: Validate Email
    Auth->>Auth: Generate 9-Digit OTP
    Auth->>KV: Store OTP (10min TTL)
    Auth->>Email: Send OTP Email
    Email-->>User: OTP Code
    User->>Client: Enter OTP
    Client->>Auth: POST /auth/verify-otp
    Auth->>KV: Get OTP
    Auth->>Auth: Validate OTP
    Auth->>KV: Delete OTP
    Auth->>Auth: Generate JWT Token
    Auth->>KV: Store Session
    Auth-->>Client: JWT Token
    Client->>Client: Store Token
    Client-->>User: Authenticated
```

### Chat Message Flow

```mermaid
sequenceDiagram
    participant UserA
    participant ClientA as Client A
    participant Signaling as Signaling Server
    participant ClientB as Client B
    participant UserB
    
    UserA->>ClientA: Type Message
    ClientA->>ClientA: Encrypt Message (AES-GCM-256)
    ClientA->>Signaling: Send Encrypted Message
    Signaling->>ClientB: Forward Encrypted Message
    ClientB->>ClientB: Decrypt Message
    ClientB->>ClientB: Store in IndexedDB
    ClientB-->>UserB: Display Message
    
    Note over ClientA,ClientB: WebRTC P2P Connection<br/>Established via Signaling
```

---

## Storage Architecture

### Multi-Layer Storage System

```mermaid
flowchart TB
    subgraph Write["Write Operation"]
        A[storage.set key, value]
        B[Update Memory Cache]
        C[Write to IndexedDB<br/>Async, Fire-and-Forget]
        D[Write to localStorage<br/>Sync, Immediate]
        E{Is Config Key?}
        F[Schedule Recovery Snapshot<br/>Debounced 60s]
    end
    
    subgraph Read["Read Operation"]
        G[storage.get key]
        H[Read from Memory Cache]
        I{Value Found?}
        J[Return Value]
        K[Try IndexedDB]
        L[Try localStorage]
        M[Try Recovery Snapshot]
        N[Return null]
    end
    
    A --> B
    B --> C
    B --> D
    D --> E
    E -->|Yes| F
    E -->|No| End1[End]
    
    G --> H
    H --> I
    I -->|Yes| J
    I -->|No| K
    K --> L
    L --> M
    M --> N
    
    style Write fill:#e8f5e9,stroke:#4caf50
    style Read fill:#fff3e0,stroke:#ff9800
```

### Cloud Storage Schema

```mermaid
erDiagram
    CLOUD_SAVE ||--o{ SAVE_SLOT : contains
    SAVE_SLOT ||--o{ CONFIG : stores
    
    CLOUD_SAVE {
        string deviceId "sss_timestamp_random"
        string slot "default, backup1, etc."
        timestamp createdAt "ISO 8601"
        int version "Schema version"
    }
    
    SAVE_SLOT {
        string name "Slot identifier"
        timestamp timestamp "Last modified"
        int size "Bytes"
    }
    
    CONFIG {
        string type "swap, layout, textCycler, etc."
        object data "Configuration data"
    }
```

---

## API Architecture

### Enhanced API Framework

```mermaid
graph TB
    subgraph Client["Client API Layer"]
        Request[API Request]
        Batch[Request Batcher]
        Queue[Priority Queue]
        Cache[Response Cache]
    end
    
    subgraph Middleware["Middleware Pipeline"]
        Auth[Auth Middleware]
        Retry[Retry Middleware]
        Circuit[Circuit Breaker]
        Transform[Transform Middleware]
    end
    
    subgraph Network["Network Layer"]
        HTTP[HTTP Client]
        WS[WebSocket Client]
    end
    
    subgraph Server["Server Layer"]
        Worker[Cloudflare Worker]
        Router[Request Router]
        Handler[Request Handler]
    end
    
    Request --> Batch
    Batch --> Queue
    Queue --> Cache
    Cache --> Auth
    Auth --> Retry
    Retry --> Circuit
    Circuit --> Transform
    Transform --> HTTP
    HTTP --> Worker
    Worker --> Router
    Router --> Handler
    
    style Client fill:#e8f5e9,stroke:#4caf50
    style Middleware fill:#fff3e0,stroke:#ff9800
    style Network fill:#e3f2fd,stroke:#2196f3
    style Server fill:#9c27b0,stroke:#7b1fa2
```

### Request Lifecycle

```mermaid
stateDiagram-v2
    [*] --> Created: API Request
    Created --> Batched: Add to Batch
    Batched --> Queued: Batch Ready
    Queued --> Cached: Check Cache
    Cached --> Authenticated: Cache Miss
    Authenticated --> Retried: Auth Success
    Retried --> CircuitChecked: Retry Logic
    CircuitChecked --> Transformed: Circuit Open
    Transformed --> Sent: Transform Data
    Sent --> Received: HTTP Request
    Received --> Processed: Server Response
    Processed --> Cached: Store in Cache
    Cached --> [*]: Return Response
    
    CircuitChecked --> Failed: Circuit Closed
    Failed --> [*]: Error Response
```

---

## Code Examples

### Source Animation Configuration

```typescript
// src/core/animations/types.ts
export interface AnimationConfig {
  type: 'fade' | 'slide' | 'zoom' | 'pop';
  duration: number; // 50-5000ms
  easing: EasingFunction;
  direction?: 'left' | 'right' | 'up' | 'down';
  offset?: number; // pixels
  animateOnShow: boolean;
  animateOnHide: boolean;
}

// Usage in Lua script
local function animate_source(source_name, config)
    local source = obs.obs_get_source_by_name(source_name)
    if not source then return end
    
    local scene_item = get_scene_item(source_name)
    if not scene_item then return end
    
    -- Calculate animation based on config
    local start_time = obs.obs_get_video_info().video_time
    local duration_ms = config.duration or 300
    local easing = get_easing(config.easing or "ease_out")
    
    -- Animation loop
    obs.timer_add(function()
        local elapsed = (obs.obs_get_video_info().video_time - start_time) / 1000
        local progress = math.min(elapsed / (duration_ms / 1000), 1.0)
        local eased = easing(progress)
        
        -- Apply transform based on animation type
        apply_animation_transform(scene_item, config, eased)
        
        if progress >= 1.0 then
            obs.timer_remove(obs.timer_callback)
        end
    end, ANIM_FRAME_MS)
end
```

### Storage Service Usage

```typescript
// src/modules/storage.ts
export const storage = {
  async get<T>(key: string): Promise<T | null> {
    // Check memory cache first
    if (cache.has(key)) {
      return cache.get(key) as T;
    }
    
    // Try IndexedDB
    try {
      const value = await idb.get(key);
      if (value) {
        cache.set(key, value);
        return value as T;
      }
    } catch (e) {
      console.warn('[Storage] IndexedDB read failed:', e);
    }
    
    // Try localStorage
    try {
      const value = localStorage.getItem(key);
      if (value) {
        const parsed = JSON.parse(value);
        cache.set(key, parsed);
        return parsed as T;
      }
    } catch (e) {
      console.warn('[Storage] localStorage read failed:', e);
    }
    
    return null;
  },
  
  async set(key: string, value: unknown): Promise<void> {
    // Update memory cache
    cache.set(key, value);
    
    // Write to IndexedDB (async, fire-and-forget)
    idb.set(key, value).catch(e => {
      console.error('[Storage] IndexedDB write failed:', e);
    });
    
    // Write to localStorage (sync)
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.error('[Storage] localStorage write failed:', e);
    }
    
    // Schedule recovery snapshot if config key
    if (key.startsWith('sss_') && isConfigKey(key)) {
      scheduleRecoverySnapshot();
    }
  }
};
```

### API Client Usage

```typescript
// src/core/api/enhanced-client.ts
import { createEnhancedClient } from './enhanced-client';

const api = createEnhancedClient({
  baseURL: 'https://api.example.com',
  encryption: {
    enabled: true,
    algorithm: 'AES-GCM-256'
  },
  retry: {
    attempts: 3,
    backoff: 'exponential'
  },
  circuitBreaker: {
    threshold: 5,
    timeout: 60000
  }
});

// Usage
const response = await api.get('/user/profile', {
  tags: ['user', 'profile'],
  cache: {
    ttl: 300000 // 5 minutes
  }
});
```

---

## Deployment Architecture

### CI/CD Pipeline

```mermaid
flowchart LR
    subgraph GitHub["GitHub Repository"]
        Code[Source Code]
        Push[Push to main]
    end
    
    subgraph Actions["GitHub Actions"]
        Trigger[Workflow Triggered]
        Build[Build & Test]
        DeployPages[Deploy Pages]
        DeployWorker[Deploy Worker]
    end
    
    subgraph Cloudflare["Cloudflare"]
        Pages[GitHub Pages<br/>Static Assets]
        Worker[Cloudflare Worker<br/>Serverless]
        KV[(Cloudflare KV<br/>Storage)]
    end
    
    Code --> Push
    Push --> Trigger
    Trigger --> Build
    Build --> DeployPages
    Build --> DeployWorker
    DeployPages --> Pages
    DeployWorker --> Worker
    Worker --> KV
    
    style GitHub fill:#24292e,stroke:#0366d6
    style Actions fill:#2088ff,stroke:#0052cc
    style Cloudflare fill:#f38020,stroke:#fa8e39
```

### Environment Structure

```mermaid
graph TB
    subgraph Dev["Development"]
        LocalOBS[Local OBS Studio]
        LocalWorker[wrangler dev<br/>Local Worker]
        LocalKV[Local KV<br/>Simulation]
    end
    
    subgraph Staging["Staging"]
        StagingPages[GitHub Pages<br/>Preview Branch]
        StagingWorker[Worker Preview<br/>wrangler dev --remote]
        StagingKV[Preview KV<br/>Namespace]
    end
    
    subgraph Prod["Production"]
        ProdPages[GitHub Pages<br/>Production]
        ProdWorker[Worker Production<br/>wrangler deploy]
        ProdKV[Production KV<br/>Namespace]
    end
    
    LocalOBS --> LocalWorker
    LocalWorker --> LocalKV
    
    StagingPages --> StagingWorker
    StagingWorker --> StagingKV
    
    ProdPages --> ProdWorker
    ProdWorker --> ProdKV
    
    style Dev fill:#e8f5e9,stroke:#4caf50
    style Staging fill:#fff3e0,stroke:#ff9800
    style Prod fill:#f3e5f5,stroke:#9c27b0
```

---

## Security Architecture

### Authentication & Authorization

```mermaid
flowchart TB
    subgraph Client["Client"]
        User[User]
        App[Application]
        Token[JWT Token]
    end
    
    subgraph Auth["Authentication"]
        OTP[OTP Request]
        Verify[OTP Verification]
        JWTGen[JWT Generation]
    end
    
    subgraph Authz["Authorization"]
        Validate[Token Validation]
        Check[Permission Check]
        Allow[Allow/Deny]
    end
    
    User --> App
    App --> OTP
    OTP --> Verify
    Verify --> JWTGen
    JWTGen --> Token
    Token --> Validate
    Validate --> Check
    Check --> Allow
    
    style Client fill:#e8f5e9,stroke:#4caf50
    style Auth fill:#fff3e0,stroke:#ff9800
    style Authz fill:#e3f2fd,stroke:#2196f3
```

### Encryption Flow

```mermaid
sequenceDiagram
    participant User
    participant Client
    participant API
    participant KV
    
    User->>Client: Enter Data
    Client->>Client: Encrypt with JWT (AES-GCM-256)
    Client->>API: POST /data (Encrypted)
    API->>API: Validate JWT
    API->>KV: Store Encrypted Data
    KV-->>API: Success
    API-->>Client: 200 OK
    
    Note over Client,KV: Data encrypted at rest<br/>and in transit
```

---

## Performance Considerations

### Caching Strategy

```mermaid
flowchart LR
    Request[API Request] --> Memory{Memory Cache?}
    Memory -->|Hit| Return1[Return Cached]
    Memory -->|Miss| IndexedDB{IndexedDB Cache?}
    IndexedDB -->|Hit| Return2[Return from IDB]
    IndexedDB -->|Miss| Network[Network Request]
    Network --> API[API Server]
    API --> Store1[Store in IDB]
    Store1 --> Store2[Store in Memory]
    Store2 --> Return3[Return Response]
    
    style Memory fill:#e8f5e9,stroke:#4caf50
    style IndexedDB fill:#fff3e0,stroke:#ff9800
    style Network fill:#e3f2fd,stroke:#2196f3
```

### Request Optimization

```mermaid
graph TB
    subgraph Optimization["Optimization Strategies"]
        Batch[Request Batching<br/>Max 10 per batch]
        Dedupe[Request Deduplication<br/>Same request = 1 call]
        Queue[Priority Queue<br/>High/Normal/Low]
        Cache[Response Caching<br/>TTL-based]
        Retry[Exponential Backoff<br/>3 attempts]
    end
    
    Request[API Request] --> Batch
    Batch --> Dedupe
    Dedupe --> Queue
    Queue --> Cache
    Cache --> Retry
    Retry --> Network[Network Call]
    
    style Optimization fill:#fff3e0,stroke:#ff9800
```

---

## Technology Stack

### Frontend
- **Framework:** Svelte 5
- **Language:** TypeScript
- **Build Tool:** Vite
- **Styling:** SCSS
- **State Management:** Svelte Stores
- **Testing:** Vitest

### Backend
- **Runtime:** Cloudflare Workers (V8 Isolates)
- **Language:** TypeScript / JavaScript
- **Storage:** Cloudflare KV
- **Email:** Resend API
- **Authentication:** JWT (HMAC-SHA256)

### OBS Integration
- **Scripting:** Lua 5.1 (obslua)
- **Communication:** OBS WebSocket API
- **Browser:** Chromium Embedded Framework (CEF)

---

**Document End**
