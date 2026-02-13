/**
 * Chat Hub Landing Page
 * 
 * Marketing and documentation page for the P2P Chat service.
 * Follows the same structure as otp-auth-service landing page.
 */

import { useEffect } from 'react';
import '../landing.scss';
import { CodeBlock } from '@strixun/shared-components/react/CodeBlock';
import { FooterContainer, FooterBrand } from '@strixun/shared-components/react';
import StrixunSuiteLink from '@strixun/shared-components/react/StrixunSuiteLink';

export function LandingPage() {
  // Initialize mermaid and accordion functionality
  useEffect(() => {
    // Initialize mermaid
    if (typeof (window as any).mermaid !== 'undefined') {
      (window as any).mermaid.initialize({
        startOnLoad: false,
        theme: 'dark',
        themeVariables: {
          primaryColor: '#edae49',
          primaryTextColor: '#1a1611',
          primaryBorderColor: '#c68214',
          secondaryColor: '#252017',
          secondaryTextColor: '#b8b8b8',
          secondaryBorderColor: '#3d3627',
          tertiaryColor: '#1a1611',
          tertiaryTextColor: '#888',
          tertiaryBorderColor: '#4a4336',
          background: '#0f0e0b',
          mainBkg: '#252017',
          secondBkg: '#1a1611',
          tertiaryBkg: '#0f0e0b',
          textColor: '#f9f9f9',
          border1: '#3d3627',
          border2: '#4a4336',
          border3: '#c68214',
          lineColor: '#6495ed',
          nodeBkg: '#252017',
          nodeBorder: '#edae49',
          clusterBkg: '#1a1611',
          clusterBorder: '#3d3627',
          defaultLinkColor: '#6495ed',
          titleColor: '#edae49',
          edgeLabelBackground: '#252017',
          edgeLabelTextColor: '#f9f9f9',
          arrowheadColor: '#6495ed',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
          fontSize: '14px'
        },
        flowchart: {
          useMaxWidth: true,
          htmlLabels: true,
          curve: 'basis',
          padding: 20,
          nodeSpacing: 50,
          rankSpacing: 80,
          diagramPadding: 20
        }
      });
    }
    
    // Smooth scroll for anchor links
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'A' && (target as HTMLAnchorElement).hash) {
        const element = document.querySelector((target as HTMLAnchorElement).hash);
        if (element) {
          e.preventDefault();
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    };

    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

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
        <CodeBlock
          language="json"
          code={`{
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
}`}
        />
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
  const toggleAccordion = (header: HTMLElement) => {
    const accordion = header.parentElement;
    if (!accordion) return;
    
    const isActive = accordion.classList.contains('active');
    
    // Close all accordions
    document.querySelectorAll('.accordion').forEach(acc => {
      acc.classList.remove('active');
    });
    
    // Open clicked accordion if it wasn't active
    if (!isActive) {
      accordion.classList.add('active');
      
      // Scroll to the accordion with offset for sticky header
      // Wait for accordion to finish expanding (300ms transition)
      setTimeout(() => {
        const headerHeight = document.querySelector('.landing-header')?.getBoundingClientRect().height || 0;
        const accordionTop = accordion.getBoundingClientRect().top + window.scrollY;
        const scrollToPosition = accordionTop - headerHeight - 20;
        
        window.scrollTo({
          top: scrollToPosition,
          behavior: 'smooth'
        });
      }, 350);
      
      // Re-render Mermaid diagrams when accordion opens
      setTimeout(() => {
        if (typeof (window as any).mermaid !== 'undefined') {
          (window as any).mermaid.run();
        }
      }, 100);
    }
  };

  return (
    <section id="architecture" className="code-examples">
      <h2>Technical Architecture</h2>
      <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginBottom: 'var(--spacing-xl)' }}>
        Deep dive into how P2P chat works under the hood
      </p>

      {/* Network Architecture */}
      <div className="accordion">
        <div className="accordion-header" onClick={(e) => toggleAccordion(e.currentTarget)}>
          <h3>Network Architecture</h3>
          <span className="accordion-icon">▼</span>
        </div>
        <div className="accordion-content">
          <div className="accordion-body">
            <h4>P2P Connection Flow</h4>
            <p>Every peer connects to every other peer using WebRTC. Signaling is handled via WebSockets, then peers establish direct connections.</p>
            <div className="mermaid-container">
              <div className="mermaid">{`graph TD
    A[New Peer Joins] --> B[Connect to Signaling Server]
    B --> C[Send OFFER to Existing Peers]
    C --> D[Receive ANSWER from Peers]
    D --> E[Establish WebRTC Connection]
    E --> F[Exchange ICE Candidates]
    F --> G[Direct P2P Connection]
    G --> H[Start Syncing Messages]
    
    classDef peerStyle fill:#252017,stroke:#edae49,stroke-width:3px,color:#f9f9f9
    classDef signalStyle fill:#1a1611,stroke:#6495ed,stroke-width:3px,color:#f9f9f9
    classDef webrtcStyle fill:#252017,stroke:#28a745,stroke-width:3px,color:#f9f9f9
    
    class A,G,H peerStyle
    class B,C,D signalStyle
    class E,F webrtcStyle`}</div>
            </div>
            <h4>Full Mesh Topology</h4>
            <p>Each peer maintains direct connections to all other peers in the room. This ensures:</p>
            <ul>
              <li>No single point of failure - any peer can relay messages</li>
              <li>Low latency - messages go directly between peers</li>
              <li>History redundancy - multiple peers store the full history</li>
              <li>Resilience - room continues even if some peers disconnect</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Message Chain Architecture */}
      <div className="accordion">
        <div className="accordion-header" onClick={(e) => toggleAccordion(e.currentTarget)}>
          <h3>Blockchain-Style Message Chain</h3>
          <span className="accordion-icon">▼</span>
        </div>
        <div className="accordion-content">
          <div className="accordion-body">
            <h4>Hash Chain Structure</h4>
            <p>Messages form a blockchain-style chain where each message cryptographically links to the previous one:</p>
            <div className="mermaid-container">
              <div className="mermaid">{`graph LR
    A[Block 0<br/>Genesis] --> B[Block 1<br/>Hash: a7f3...]
    B --> C[Block 2<br/>Hash: e9d2...]
    C --> D[Block 3<br/>Hash: b4c8...]
    D --> E[Block N<br/>Hash: f2a1...]
    
    classDef blockStyle fill:#252017,stroke:#edae49,stroke-width:2px,color:#f9f9f9
    class A,B,C,D,E blockStyle`}</div>
            </div>
            <h4>Block Contents</h4>
            <CodeBlock
              language="json"
              code={`{
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
}`}
            />
            <h4>Integrity Verification</h4>
            <ul>
              <li><strong>Hash Chain:</strong> Each block's hash includes the previous hash, making tampering evident</li>
              <li><strong>HMAC Signatures:</strong> Each message is signed with the room key using HMAC-SHA256</li>
              <li><strong>Merkle Trees:</strong> Chunks of 100 messages have a Merkle root for fast verification</li>
              <li><strong>Peer Confirmations:</strong> Multiple peers confirm receipt and validity</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Storage Layer */}
      <div className="accordion">
        <div className="accordion-header" onClick={(e) => toggleAccordion(e.currentTarget)}>
          <h3>Storage Layer</h3>
          <span className="accordion-icon">▼</span>
        </div>
        <div className="accordion-content">
          <div className="accordion-body">
            <h4>Storage Options</h4>
            <p>Messages are stored encrypted at rest using multiple storage backends:</p>
            <div className="mermaid-container">
              <div className="mermaid">{`graph TD
    A[Encrypted Messages] --> B{Storage Backend}
    B --> C[IndexedDB]
    B --> D[File System API]
    B --> E[Custom Plugin]
    
    C --> F[Browser Database]
    D --> G[Local Folder]
    E --> H[External Provider]
    
    classDef storageStyle fill:#252017,stroke:#edae49,stroke-width:3px,color:#f9f9f9
    classDef backendStyle fill:#1a1611,stroke:#6495ed,stroke-width:3px,color:#f9f9f9
    classDef targetStyle fill:#252017,stroke:#28a745,stroke-width:3px,color:#f9f9f9
    
    class A storageStyle
    class B,C,D,E backendStyle
    class F,G,H targetStyle`}</div>
            </div>
            <h4>Chunk Organization</h4>
            <p>Messages are organized in chunks of 100 messages each for efficient storage and retrieval:</p>
            <ul>
              <li><strong>Chunk Size:</strong> 100 messages per chunk (configurable)</li>
              <li><strong>Merkle Root:</strong> Each chunk has a Merkle tree root for integrity</li>
              <li><strong>Encryption:</strong> Each chunk is encrypted with AES-256-GCM</li>
              <li><strong>Compression:</strong> Chunks are compressed before storage</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Sync Protocol */}
      <div className="accordion">
        <div className="accordion-header" onClick={(e) => toggleAccordion(e.currentTarget)}>
          <h3>Sync Protocol</h3>
          <span className="accordion-icon">▼</span>
        </div>
        <div className="accordion-content">
          <div className="accordion-body">
            <h4>Reconnection Sync Flow</h4>
            <p>When a peer reconnects after being offline, it syncs missed messages:</p>
            <div className="mermaid-container">
              <div className="mermaid">{`%%{init: {'theme':'dark', 'themeVariables': { 'actorBkg':'#252017', 'actorBorder':'#edae49', 'actorTextColor':'#f9f9f9', 'actorLineColor':'#6495ed', 'signalColor':'#6495ed', 'signalTextColor':'#f9f9f9', 'labelBoxBkgColor':'#1a1611', 'labelBoxBorderColor':'#edae49', 'labelTextColor':'#f9f9f9', 'loopTextColor':'#f9f9f9', 'noteBkgColor':'#252017', 'noteBorderColor':'#c68214', 'noteTextColor':'#f9f9f9', 'activationBkgColor':'#edae49', 'activationBorderColor':'#c68214', 'sequenceNumberColor':'#1a1611'}}}%%
sequenceDiagram
    participant P1 as Peer 1 (Reconnecting)
    participant P2 as Peer 2
    participant P3 as Peer 3
    
    P1->>P2: SYNC_REQUEST (last block: 42)
    P1->>P3: SYNC_REQUEST (last block: 42)
    P2->>P1: SYNC_RESPONSE (blocks 43-50)
    P3->>P1: SYNC_RESPONSE (blocks 43-50)
    P1->>P1: Verify block hashes
    P1->>P1: Verify signatures
    P1->>P1: Import valid blocks
    P1->>P2: SYNC_COMPLETE (50 blocks)
    P1->>P3: SYNC_COMPLETE (50 blocks)`}</div>
            </div>
            <h4>Gap Detection</h4>
            <p>The sync protocol detects and reports gaps in message history:</p>
            <ul>
              <li><strong>Block Number Tracking:</strong> Each block has a sequential number</li>
              <li><strong>Gap Detection:</strong> Missing block numbers indicate gaps</li>
              <li><strong>Gap Reporting:</strong> UI shows clear indicators of missing messages</li>
              <li><strong>Multiple Sources:</strong> Attempts to fetch from multiple peers</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Encryption Architecture */}
      <div className="accordion">
        <div className="accordion-header" onClick={(e) => toggleAccordion(e.currentTarget)}>
          <h3>Encryption Architecture</h3>
          <span className="accordion-icon">▼</span>
        </div>
        <div className="accordion-content">
          <div className="accordion-body">
            <h4>Key Hierarchy</h4>
            <div className="mermaid-container">
              <div className="mermaid">{`graph TD
    A[User Auth Token] --> B[Room Key Generation]
    B --> C[256-bit AES Room Key]
    C --> D[Encrypt with Auth Token]
    D --> E[Store Encrypted Room Key]
    
    C --> F[Message Encryption]
    C --> G[Key Sharing with Peers]
    
    F --> H[AES-256-GCM per message]
    G --> I[Re-encrypt for each peer]
    
    classDef keyStyle fill:#252017,stroke:#edae49,stroke-width:3px,color:#f9f9f9
    classDef processStyle fill:#1a1611,stroke:#6495ed,stroke-width:3px,color:#f9f9f9
    classDef storageStyle fill:#252017,stroke:#28a745,stroke-width:3px,color:#f9f9f9
    
    class A,C keyStyle
    class B,D,F,G,I processStyle
    class E,H storageStyle`}</div>
              </div>
            <h4>Encryption Details</h4>
            <ul>
              <li><strong>Algorithm:</strong> AES-256-GCM (Galois/Counter Mode)</li>
              <li><strong>Key Derivation:</strong> PBKDF2 with 100,000 iterations</li>
              <li><strong>Unique IV:</strong> Each message has a unique initialization vector</li>
              <li><strong>Authentication:</strong> HMAC-SHA256 for message authenticity</li>
              <li><strong>Key Rotation:</strong> Support for periodic room key rotation</li>
            </ul>
          </div>
        </div>
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
          <CodeBlock
            language="tsx"
            code={`import { ChatClient } from '@strixun/chat/react';
import { useChatStore } from './stores/chat';

function MyChat() {
  return (
    <ChatClient
      useChatStore={useChatStore}
      userId={user.id}
      userName={user.name}
    />
  );
}`}
          />
        </div>
        
        <div className="landing-code-example">
          <h3>Vanilla JS</h3>
          <CodeBlock
            language="javascript"
            code={`import { SecureRoomManager } from '@strixun/chat/core';

const manager = new SecureRoomManager({
  signalingBaseUrl: 'https://chat-api.idling.app',
  userId: 'user_123',
  userName: 'Alice',
  getAuthToken: () => getToken(),
  onMessage: (msg) => console.log(msg),
});

await manager.createRoom('My Room');
await manager.sendMessage('Hello, world!');`}
          />
        </div>
      </div>
    </section>
  );
}

// ============ Footer ============
function Footer() {
  return (
    <FooterContainer>
      <FooterBrand
        serviceName="Strixun Chat"
        description="P2P encrypted messaging for the modern web."
      />
      <div style={{ textAlign: 'center', margin: '0.5rem 0 0 0', fontSize: '0.875rem', color: 'var(--text-secondary, #b8b8b8)' }}>
        Part of the <StrixunSuiteLink />
      </div>
      <div style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.75rem', color: 'var(--text-muted, #888)' }}>
        &copy; {new Date().getFullYear()} Strixun. All rights reserved.
      </div>
    </FooterContainer>
  );
}
