# @strixun/p2p-storage

> **Blockchain-style distributed storage with integrity verification**

A framework-agnostic P2P storage solution using hash chains, Merkle trees, and storage adapters.

---

## Features

- **Blockchain-style hash chains** - Every block links to the previous via cryptographic hash
- **Merkle tree chunks** - Efficient integrity verification of block batches
- **Storage adapter pattern** - Swap IndexedDB for filesystem, memory, or custom backends
- **Gap detection** - Identify missing blocks with human-friendly explanations
- **Integrity scoring** - Visual feedback on data completeness and peer coverage
- **P2P sync protocol** - Types and helpers for peer synchronization
- **React components** - Ready-to-use UI for integrity badges and storage pickers

---

## Architecture

```
+------------------+     +-------------------+     +------------------+
|  Your App        | --> |  BlockchainManager| --> |  StorageAdapter  |
|  (Chat, Notes,   |     |  (Hash chains,    |     |  (IndexedDB,     |
|   Documents...)  |     |   Merkle roots)   |     |   Memory, FS...) |
+------------------+     +-------------------+     +------------------+
                               |
                               v
                        +-------------+
                        |  Integrity  |
                        |  (Hashing,  |
                        |   Gaps,     |
                        |   Scoring)  |
                        +-------------+
```

---

## Installation

```bash
pnpm add @strixun/p2p-storage
```

---

## Usage

### Basic Usage

```typescript
import { 
  BlockchainManager, 
  createIndexedDBAdapter 
} from '@strixun/p2p-storage';

// Create storage adapter
const adapter = createIndexedDBAdapter();

// Create blockchain manager
const blockchain = new BlockchainManager({
  chainId: 'my-data-chain',
  signingKey: 'my-signing-secret',
  peerId: 'user-123',
  adapter,
});

// Initialize
await blockchain.initialize();

// Add data
const block = await blockchain.addBlock({ 
  message: 'Hello, distributed world!' 
});

console.log('Block hash:', block.blockHash);
console.log('Block number:', block.blockNumber);
```

### Using Memory Adapter (Testing)

```typescript
import { BlockchainManager, createMemoryAdapter } from '@strixun/p2p-storage';

const adapter = createMemoryAdapter();
const blockchain = new BlockchainManager({
  chainId: 'test-chain',
  signingKey: 'test-secret',
  peerId: 'test-peer',
  adapter,
});
```

### Creating a Custom Adapter

```typescript
import type { StorageAdapter } from '@strixun/p2p-storage';

class MyCustomAdapter implements StorageAdapter {
  readonly type = 'custom';
  
  async initialize(): Promise<void> {
    // Setup your storage
  }
  
  async storeBlock<T>(chainId: string, block: Block<T>): Promise<void> {
    // Store block in your backend
  }
  
  // ... implement other methods
}
```

### Integrity Information

```typescript
// Get integrity status
const integrity = await blockchain.getIntegrityInfo(totalPeerCount);

console.log('Score:', integrity.score);
console.log('Status:', integrity.status); // 'verified' | 'partial' | 'degraded' | 'unverified'
console.log('Gaps:', integrity.gaps);
```

### React Components

```tsx
import { 
  IntegrityBadge, 
  GapWarning, 
  PeerCount,
  StoragePicker 
} from '@strixun/p2p-storage/react';
import '@strixun/p2p-storage/react/styles';

function MyComponent({ integrityInfo }) {
  return (
    <>
      <IntegrityBadge info={integrityInfo} />
      <PeerCount count={integrityInfo.peerCount} />
      {integrityInfo.gaps.length > 0 && (
        <GapWarning gaps={integrityInfo.gaps} />
      )}
    </>
  );
}
```

---

## API Reference

### BlockchainManager

| Method | Description |
|--------|-------------|
| `initialize()` | Initialize the blockchain |
| `addBlock(data)` | Add new data block |
| `importBlocks(blocks)` | Import blocks from peers |
| `getBlocksAfter(n)` | Get blocks after number |
| `getAllBlocks()` | Get all blocks |
| `getLatestBlock()` | Get most recent block |
| `getIntegrityInfo(peers)` | Get integrity status |
| `getChunks()` | Get all chunks |
| `confirmBlock(hash, peer)` | Add peer confirmation |
| `destroy()` | Clean up |

### Storage Adapters

| Adapter | Use Case |
|---------|----------|
| `IndexedDBStorageAdapter` | Browser persistent storage (default) |
| `MemoryStorageAdapter` | Testing, temporary data |
| Custom | Your own backend |

### Integrity Functions

| Function | Description |
|----------|-------------|
| `generateHash(data)` | SHA-256 hash |
| `generateSignature(data, key)` | HMAC-SHA256 signature |
| `calculateMerkleRoot(hashes)` | Merkle root from hashes |
| `detectGaps(blocks, expected)` | Find missing blocks |
| `calculateIntegrityScore(state, peers)` | Score 0-100 |

---

## Theming

Override CSS variables to customize React components:

```css
:root {
  --p2p-accent: #d4af37;
  --p2p-success: #4ade80;
  --p2p-warning: #fbbf24;
  --p2p-danger: #f87171;
  --p2p-bg: #252525;
  --p2p-text: #f9f9f9;
}
```

---

## License

MIT - Strixun Stream Suite
