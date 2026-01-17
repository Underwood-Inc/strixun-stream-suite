/**
 * Chat Hub Landing Page
 * 
 * Marketing and documentation page for the P2P Chat service.
 * Follows the same structure as otp-auth-service landing page.
 */

import { useState } from 'react';
import '../landing.scss';

export function LandingPage() {
  return (
    <div className="landing">
      <Header />
      <Hero />
      <Features />
      <HowItWorks />
      <Security />
      <Architecture />
      <Integration />
      <Footer />
    </div>
  );
}

// ============ Header ============
function Header() {
  return (
    <header className="landing-header">
      <div className="landing-header__logo">
        <span className="landing-header__icon">◆</span>
        <span className="landing-header__title">Strixun Chat</span>
      </div>
      <nav className="landing-header__nav">
        <a href="#features">Features</a>
        <a href="#how-it-works">How It Works</a>
        <a href="#security">Security</a>
        <a href="#integration">Integration</a>
        <a href="/#/chat" className="landing-header__cta">Open Chat</a>
      </nav>
    </header>
  );
}

// ============ Hero ============
function Hero() {
  return (
    <section className="landing-hero">
      <h1 className="landing-hero__title">
        P2P Encrypted Chat
        <br />
        <span className="landing-hero__highlight">No Servers. No Limits.</span>
      </h1>
      <p className="landing-hero__description">
        Peer-to-peer messaging with blockchain-style persistence. 
        Your messages are encrypted end-to-end and stored across 
        a distributed network of peers. No central server, no data mining.
      </p>
      <div className="landing-hero__cta">
        <a href="/#/chat" className="btn btn-primary">Start Chatting</a>
        <a href="#how-it-works" className="btn btn-secondary">Learn More</a>
      </div>
      <div className="landing-hero__stats">
        <div className="landing-hero__stat">
          <span className="landing-hero__stat-value">E2E</span>
          <span className="landing-hero__stat-label">Encrypted</span>
        </div>
        <div className="landing-hero__stat">
          <span className="landing-hero__stat-value">P2P</span>
          <span className="landing-hero__stat-label">Network</span>
        </div>
        <div className="landing-hero__stat">
          <span className="landing-hero__stat-value">0</span>
          <span className="landing-hero__stat-label">Servers</span>
        </div>
      </div>
    </section>
  );
}

// ============ Features ============
function Features() {
  const features = [
    {
      icon: '🔐',
      title: 'End-to-End Encryption',
      description: 'Messages are encrypted with AES-256-GCM using room keys that only participants have access to.',
    },
    {
      icon: '🌐',
      title: 'Peer-to-Peer Network',
      description: 'No central server stores your messages. Data lives on participant devices and syncs directly between peers.',
    },
    {
      icon: '⛓️',
      title: 'Blockchain-Style Storage',
      description: 'Each message is cryptographically linked to the previous, forming a tamper-evident chain of history.',
    },
    {
      icon: '✓',
      title: 'Integrity Verification',
      description: 'HMAC-SHA256 signatures ensure message authenticity. Merkle trees verify chunk integrity.',
    },
    {
      icon: '📊',
      title: 'Gap Detection',
      description: 'Know exactly when and why messages might be missing. Clear UX for incomplete history.',
    },
    {
      icon: '💾',
      title: 'Choose Your Storage',
      description: 'Store messages in IndexedDB, local filesystem, or a custom location of your choice.',
    },
  ];

  return (
    <section id="features" className="landing-features">
      <h2 className="landing-section__title">Features</h2>
      <div className="landing-features__grid">
        {features.map((feature, index) => (
          <div key={index} className="landing-feature">
            <span className="landing-feature__icon">{feature.icon}</span>
            <h3 className="landing-feature__title">{feature.title}</h3>
            <p className="landing-feature__description">{feature.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ============ How It Works ============
function HowItWorks() {
  return (
    <section id="how-it-works" className="landing-how-it-works">
      <h2 className="landing-section__title">How It Works</h2>
      
      <div className="landing-diagram">
        <div className="landing-diagram__step">
          <div className="landing-diagram__number">1</div>
          <h3>Create a Room</h3>
          <p>A 256-bit room key is generated and encrypted with your auth token.</p>
        </div>
        <div className="landing-diagram__arrow">→</div>
        <div className="landing-diagram__step">
          <div className="landing-diagram__number">2</div>
          <h3>Share Key with Peers</h3>
          <p>When peers join, the room key is re-encrypted and shared via WebRTC.</p>
        </div>
        <div className="landing-diagram__arrow">→</div>
        <div className="landing-diagram__step">
          <div className="landing-diagram__number">3</div>
          <h3>Send Messages</h3>
          <p>Messages are encrypted, signed with HMAC, and broadcast to all peers.</p>
        </div>
        <div className="landing-diagram__arrow">→</div>
        <div className="landing-diagram__step">
          <div className="landing-diagram__number">4</div>
          <h3>Sync on Reconnect</h3>
          <p>Peers sync missed messages. History is verified with Merkle proofs.</p>
        </div>
      </div>

      <div className="landing-code-block">
        <h3>Message Block Structure</h3>
        <pre>{`{
  "blockHash": "a7f3...4b2c",
  "previousHash": "e9d2...8a1f",
  "blockNumber": 42,
  "message": {
    "content": "[encrypted]",
    "senderId": "user_123",
    "timestamp": 1705420800000
  },
  "signature": "hmac-sha256...",
  "confirmedBy": ["peer_a", "peer_b", "peer_c"]
}`}</pre>
      </div>
    </section>
  );
}

// ============ Security ============
function Security() {
  return (
    <section id="security" className="landing-security">
      <h2 className="landing-section__title">Security Architecture</h2>
      
      <div className="landing-security__grid">
        <div className="landing-security__card">
          <h3>Encryption</h3>
          <ul>
            <li>AES-256-GCM for message encryption</li>
            <li>PBKDF2 (100k iterations) for key derivation</li>
            <li>Unique IV and salt per message</li>
            <li>Room keys never leave participants</li>
          </ul>
        </div>
        
        <div className="landing-security__card">
          <h3>Integrity</h3>
          <ul>
            <li>HMAC-SHA256 signatures on every message</li>
            <li>Hash chain links messages (blockchain-style)</li>
            <li>Merkle tree roots for chunk verification</li>
            <li>Peer consensus for confirmation</li>
          </ul>
        </div>
        
        <div className="landing-security__card">
          <h3>Privacy</h3>
          <ul>
            <li>No central server sees plaintext</li>
            <li>Messages stored encrypted at rest</li>
            <li>Only room members can decrypt</li>
            <li>Metadata minimized</li>
          </ul>
        </div>
      </div>
    </section>
  );
}

// ============ Architecture ============
function Architecture() {
  const [expanded, setExpanded] = useState<string | null>(null);
  
  const sections = [
    {
      id: 'storage',
      title: 'Storage Layer',
      content: `
Messages are stored in "chunks" of 100 messages each. Each chunk has a Merkle root 
for quick integrity verification. The storage layer supports:

- IndexedDB (default): Browser-based, persists across sessions
- File System API: For browsers that support it, allows folder selection
- Custom: Plugin architecture for external storage providers

Data is always encrypted before storage using the room key.
      `,
    },
    {
      id: 'sync',
      title: 'Sync Protocol',
      content: `
When a peer joins or reconnects, the sync protocol:

1. Sends SYNC_REQUEST with last known block number
2. Receives SYNC_RESPONSE with missed blocks
3. Verifies each block's signature and hash chain
4. Imports valid blocks, marks invalid ones
5. Detects and reports any gaps

Sync is bidirectional - all peers can serve history.
      `,
    },
    {
      id: 'consensus',
      title: 'Peer Consensus',
      content: `
Unlike blockchain, we don't need full consensus for every block. Instead:

- Messages are immediately available (optimistic)
- Confirmations accumulate as peers verify
- Integrity score reflects peer coverage
- Conflicts resolved by earliest timestamp

This gives instant messaging UX with eventual consistency guarantees.
      `,
    },
  ];

  return (
    <section id="architecture" className="landing-architecture">
      <h2 className="landing-section__title">Technical Architecture</h2>
      
      <div className="landing-accordion">
        {sections.map((section) => (
          <div key={section.id} className="landing-accordion__item">
            <button
              className={`landing-accordion__header ${expanded === section.id ? 'landing-accordion__header--active' : ''}`}
              onClick={() => setExpanded(expanded === section.id ? null : section.id)}
            >
              <span>{section.title}</span>
              <span className="landing-accordion__icon">
                {expanded === section.id ? '−' : '+'}
              </span>
            </button>
            {expanded === section.id && (
              <div className="landing-accordion__content">
                <pre>{section.content.trim()}</pre>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

// ============ Integration ============
function Integration() {
  return (
    <section id="integration" className="landing-integration">
      <h2 className="landing-section__title">Easy Integration</h2>
      
      <div className="landing-code-examples">
        <div className="landing-code-example">
          <h3>React</h3>
          <pre>{`import { ChatClient } from '@strixun/chat/react';
import { useChatStore } from './stores/chat';

function MyChat() {
  return (
    <ChatClient
      useChatStore={useChatStore}
      userId={user.id}
      userName={user.name}
    />
  );
}`}</pre>
        </div>
        
        <div className="landing-code-example">
          <h3>Vanilla JS</h3>
          <pre>{`import { SecureRoomManager } from '@strixun/chat/core';

const manager = new SecureRoomManager({
  signalingBaseUrl: 'https://chat-api.idling.app',
  userId: 'user_123',
  userName: 'Alice',
  getAuthToken: () => getToken(),
  onMessage: (msg) => console.log(msg),
});

await manager.createRoom('My Room');
await manager.sendMessage('Hello, world!');`}</pre>
        </div>
      </div>
    </section>
  );
}

// ============ Footer ============
function Footer() {
  return (
    <footer className="landing-footer">
      <div className="landing-footer__content">
        <div className="landing-footer__brand">
          <span className="landing-footer__logo">◆ Strixun Chat</span>
          <p>P2P encrypted messaging for the modern web.</p>
        </div>
        <div className="landing-footer__links">
          <a href="https://strixun.live" target="_blank" rel="noopener noreferrer">
            Strixun Stream Suite
          </a>
          <a href="https://github.com/strixun" target="_blank" rel="noopener noreferrer">
            GitHub
          </a>
          <a href="mailto:support@strixun.live">
            Support
          </a>
        </div>
      </div>
      <div className="landing-footer__copyright">
        &copy; {new Date().getFullYear()} Strixun. All rights reserved.
      </div>
    </footer>
  );
}
