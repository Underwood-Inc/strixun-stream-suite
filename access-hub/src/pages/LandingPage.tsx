/**
 * Access Hub Landing Page
 * Matches otp-auth-service design pattern with accordions
 */

import { useEffect } from 'react';
import { CodeBlock } from '../../../shared-components/react/CodeBlock';
import { FooterContainer, FooterBrand, TechnicalTerm } from '../../../shared-components/react';
import StrixunSuiteLink from '../../../shared-components/react/StrixunSuiteLink';
import '../LandingPage.scss';

export function LandingPage() {
  const apiUrl = import.meta.env.VITE_ACCESS_API_URL || 'https://access-api.idling.app';

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
      const target = e.target as HTMLAnchorElement;
      if (target.tagName === 'A' && target.hash) {
        const element = document.querySelector(target.hash);
        if (element) {
          e.preventDefault();
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    };

    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  // Accordion toggle function
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
      
      // Re-render Mermaid diagrams when accordion opens
      const accordionTitle = header.querySelector('h3')?.textContent || '';
      if ((accordionTitle.includes('Architecture') || accordionTitle.includes('Role Hierarchy')) && typeof (window as any).mermaid !== 'undefined') {
        setTimeout(() => {
          const mermaidElements = accordion.querySelectorAll('.mermaid:not([data-processed])');
          if (mermaidElements.length > 0) {
            mermaidElements.forEach((el: Element) => {
              (el as HTMLElement).dataset.processed = 'true';
            });
            (window as any).mermaid.run();
          }
        }, 100);
      }
    }
  };

  return (
    <main className="landing">
      <Header />
      <Hero apiUrl={apiUrl} />
      <Features />
      <Limitations />
      <SelfHosting />
      <TechnicalDocs apiUrl={apiUrl} toggleAccordion={toggleAccordion} />
      
      <FooterContainer>
        <FooterBrand
          serviceName="Access Hub"
          description="Authorization & access control service"
        />
        <div style={{ textAlign: 'center', margin: '0.5rem 0 0 0', fontSize: '0.875rem', color: 'var(--text-secondary, #b8b8b8)' }}>
          Part of the <StrixunSuiteLink />
        </div>
        <div style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.75rem', color: 'var(--text-muted, #888)' }}>
          &copy; {new Date().getFullYear()} Strixun. All rights reserved.
        </div>
      </FooterContainer>
    </main>
  );
}

// ============ Header ============
function Header() {
  return (
    <header className="header">
      <div className="header-content">
        <a href="#" className="logo">Access Control</a>
        <div className="header-actions">
          <a href="#docs" className="btn btn-secondary">Documentation</a>
          <a href="https://github.com/Underwood-Inc/strixun-stream-suite/tree/master/serverless/access-service" target="_blank" rel="noopener noreferrer" className="btn btn-primary">
            <span>★</span> View on GitHub
          </a>
        </div>
      </div>
    </header>
  );
}

// ============ Hero ============
function Hero({ apiUrl }: { apiUrl: string }) {
  return (
    <section className="hero">
      <div className="hero-content">
        <h1>Enterprise-Grade Authorization & <TechnicalTerm
          term="RBAC"
          definition="Role-Based Access Control - A method of regulating access based on roles assigned to users."
          link="https://en.wikipedia.org/wiki/Role-based_access_control"
          sourceLink="https://github.com/Underwood-Inc/strixun-stream-suite/blob/master/serverless/access-service/handlers/check.ts"
        >RBAC</TechnicalTerm></h1>
        <p className="hero-subtitle">
          Centralized access control for Strixun Stream Suite. Fine-grained permissions, quota management, 
          and comprehensive audit logging for secure, scalable authorization.
        </p>
        <div className="hero-api">
          <span className="hero-api-label">API Base URL:</span>
          <code className="hero-api-url">{apiUrl}</code>
        </div>
        <div className="hero-badges">
          <span className="badge badge--info">
            <TechnicalTerm
              term="OAuth 2.0"
              definition="An authorization framework that enables applications to obtain limited access to user accounts."
              link="https://datatracker.ietf.org/doc/html/rfc6749"
            >OAuth 2.0</TechnicalTerm> Compatible
          </span>
          <span className="badge badge--success">
            <TechnicalTerm
              term="JWT"
              definition="JSON Web Token - A compact, URL-safe means of representing claims to be transferred between two parties."
              link="https://datatracker.ietf.org/doc/html/rfc7519"
              sourceLink="https://github.com/Underwood-Inc/strixun-stream-suite/blob/master/serverless/access-service/utils/auth.ts"
            >JWT RFC 7519</TechnicalTerm>
          </span>
          <span className="badge badge--warning">
            <TechnicalTerm
              term="NIST RBAC"
              definition="NIST Special Publication 800-162 - Comprehensive model for role-based access control."
              link="https://csrc.nist.gov/publications/detail/sp/800-162/final"
            >NIST RBAC</TechnicalTerm>
          </span>
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
      title: 'Role-Based Access Control',
      description: (<>Hierarchical <TechnicalTerm
        term="RBAC"
        definition="Role-Based Access Control - A method of regulating access based on roles."
        link="https://en.wikipedia.org/wiki/Role-based_access_control"
        sourceLink="https://github.com/Underwood-Inc/strixun-stream-suite/blob/master/serverless/access-service/handlers/check.ts"
      >RBAC</TechnicalTerm> with <TechnicalTerm
        term="Role Inheritance"
        definition="A feature where roles can inherit permissions from parent roles, creating a hierarchy that simplifies permission management."
        sourceLink="https://github.com/Underwood-Inc/strixun-stream-suite/blob/master/serverless/access-service/handlers/definitions.ts"
      >inheritance</TechnicalTerm>, <TechnicalTerm
        term="Role Composition"
        definition="The ability to assign multiple roles to a single user, combining their permissions."
        sourceLink="https://github.com/Underwood-Inc/strixun-stream-suite/blob/master/serverless/access-service/handlers/manage.ts"
      >role composition</TechnicalTerm>, and dynamic role assignment.</>),
    },
    {
      icon: '⚡',
      title: 'Fine-Grained Permissions',
      description: (<>Granular permission management with <TechnicalTerm
        term="Wildcard Matching"
        definition="Pattern matching that allows permissions like 'mods:*' to grant access to all mod-related actions, or '*' for superadmin access."
        sourceLink="https://github.com/Underwood-Inc/strixun-stream-suite/blob/master/serverless/access-service/handlers/check.ts"
      >wildcard matching</TechnicalTerm>, <TechnicalTerm
        term="Resource-Level Permissions"
        definition="Permissions that can be scoped to specific resources (e.g., 'mods:edit:mod-123'), allowing fine-grained access control."
        sourceLink="https://github.com/Underwood-Inc/strixun-stream-suite/blob/master/serverless/access-service/handlers/check.ts"
      >resource-level permissions</TechnicalTerm>, and custom rules.</>),
    },
    {
      icon: '📊',
      title: 'Quota Management',
      description: (<>Real-time <TechnicalTerm
        term="Quota Tracking"
        definition="System for monitoring resource usage per customer/role with automatic enforcement of limits to prevent abuse."
        sourceLink="https://github.com/Underwood-Inc/strixun-stream-suite/blob/master/serverless/access-service/handlers/manage.ts"
      >quota tracking</TechnicalTerm> with enforcement, usage analytics, and automated limit management.</>),
    },
    {
      icon: '🔍',
      title: 'Audit Logging',
      description: (<>Comprehensive audit trails for compliance (<TechnicalTerm
        term="GDPR"
        definition="General Data Protection Regulation - EU regulation on data protection and privacy."
        link="https://gdpr.eu/"
      >GDPR</TechnicalTerm>, <TechnicalTerm
        term="SOC 2"
        definition="Service Organization Control 2 - Auditing procedure for secure data management."
        link="https://www.aicpa.org/interestareas/frc/assuranceadvisoryservices/aicpasoc2report.html"
      >SOC 2</TechnicalTerm>) with tamper-proof logs.</>),
    },
    {
      icon: '🔑',
      title: 'Service Authentication',
      description: (<>Service-to-service auth with <TechnicalTerm
        term="JWT"
        definition="JSON Web Token - Compact, URL-safe means of representing claims."
        link="https://datatracker.ietf.org/doc/html/rfc7519"
        sourceLink="https://github.com/Underwood-Inc/strixun-stream-suite/blob/master/serverless/access-service/utils/auth.ts"
      >JWT</TechnicalTerm>, <TechnicalTerm
        term="API Keys"
        definition="Long-lived authentication tokens for service-to-service communication, validated on every request."
        sourceLink="https://github.com/Underwood-Inc/strixun-stream-suite/blob/master/serverless/access-service/utils/auth.ts"
      >API keys</TechnicalTerm>, and <TechnicalTerm
        term="mTLS"
        definition="Mutual Transport Layer Security - Mutual authentication using certificates."
        link="https://en.wikipedia.org/wiki/Mutual_authentication"
      >mTLS</TechnicalTerm> support.</>),
    },
    {
      icon: '🛡️',
      title: 'Security Controls',
      description: (<><TechnicalTerm
        term="Rate Limiting"
        definition="Technique to control the rate of requests to prevent abuse and ensure fair resource allocation. Implemented using Cloudflare Workers KV for distributed rate limiting."
        sourceLink="https://github.com/Underwood-Inc/strixun-stream-suite/blob/master/serverless/access-service/utils/rate-limit.ts"
      >Rate limiting</TechnicalTerm>, <TechnicalTerm
        term="IP Whitelisting"
        definition="Security feature that allows access only from pre-approved IP addresses, useful for restricting admin access or API endpoints."
        sourceLink="https://github.com/Underwood-Inc/strixun-stream-suite/blob/master/serverless/access-service/utils/cors.ts"
      >IP whitelisting</TechnicalTerm>, <TechnicalTerm
        term="Anomaly Detection"
        definition="Automated monitoring system that identifies unusual access patterns, such as rapid permission changes, excessive failed attempts, or suspicious role assignments."
        sourceLink="https://github.com/Underwood-Inc/strixun-stream-suite/blob/master/serverless/access-service/handlers/audit.ts"
      >anomaly detection</TechnicalTerm>, and <TechnicalTerm
        term="DDoS Protection"
        definition="Distributed Denial of Service Protection - Security measures against traffic attacks, provided by Cloudflare's edge network."
        link="https://www.cloudflare.com/learning/ddos/what-is-a-ddos-attack/"
      >DDoS protection</TechnicalTerm> at the edge.</>),
    },
  ];

  return (
    <section className="features" id="features">
      <h2>Features</h2>
      <div className="features-grid">
        {features.map((feature, index) => (
          <div key={index} className="feature-card">
            <div className="feature-icon">{feature.icon}</div>
            <h3>{feature.title}</h3>
            <div className="feature-description">{feature.description}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ============ Limitations ============
function Limitations() {
  return (
    <section className="limitations">
      <h2>Limitations & Considerations</h2>
      <div className="limitations-list">
        <ul>
          <li>
            <strong>Rate Limits</strong>
            <p>100 permission checks per minute per customer to ensure fair resource allocation.</p>
          </li>
          <li>
            <strong>Role Hierarchy Depth</strong>
            <p>Maximum 10 levels of role inheritance to prevent circular dependencies.</p>
          </li>
          <li>
            <strong>Quota Reset</strong>
            <p>Quotas reset daily at midnight UTC. Custom reset schedules available for enterprise.</p>
          </li>
          <li>
            <strong>Audit Log Retention</strong>
            <p>Audit logs retained for 90 days on free tier. Extended retention available for enterprise.</p>
          </li>
          <li>
            <strong>Permission Wildcards</strong>
            <p>Wildcard permissions (*) should be used sparingly and only for admin roles.</p>
          </li>
          <li>
            <strong>Multi-Tenancy</strong>
            <p>All data is completely isolated per customer using prefixed KV keys.</p>
          </li>
        </ul>
      </div>
    </section>
  );
}

// ============ Self-Hosting ============
function SelfHosting() {
  return (
    <section className="self-hosting" id="self-hosting">
      <div className="self-hosting-content">
        <h2>Open Source & Self-Hosting</h2>
        <p className="self-hosting-subtitle">
          This application is completely open-source on GitHub. Deploy it on your own infrastructure 
          with complete control over configuration and data.
        </p>
        
        <div className="self-hosting-grid">
          <div className="self-hosting-card">
            <h3>⊕ Self-Host on GitHub</h3>
            <p>
              The entire codebase is open-source and available on GitHub. Deploy it on your own infrastructure 
              with complete control over rate limits, configuration, and data.
            </p>
            <ul>
              <li>Unlimited rate limits</li>
              <li>Full control over configuration</li>
              <li>Complete data ownership</li>
              <li>Custom role hierarchies</li>
              <li>Deploy anywhere (Cloudflare, AWS, GCP, etc.)</li>
            </ul>
            <div style={{ marginTop: 'var(--spacing-lg)' }}>
              <a href="https://github.com/Underwood-Inc/strixun-stream-suite/tree/master/serverless/access-service" target="_blank" rel="noopener noreferrer" className="btn btn-github">
                <span>★</span> View on GitHub
              </a>
            </div>
          </div>

          <div className="self-hosting-card">
            <h3>ℹ Why Choose Self-Hosting?</h3>
            <p>
              Self-hosting gives you complete freedom and control. Perfect for enterprises, high-traffic applications, 
              or when you need custom configurations.
            </p>
            <ul>
              <li>No usage limits</li>
              <li>Full source code access</li>
              <li>Custom modifications allowed</li>
              <li>No vendor lock-in</li>
              <li>Community-driven improvements</li>
            </ul>
            <div style={{ marginTop: 'var(--spacing-lg)' }}>
              <a href="#docs" className="btn btn-secondary">
                View Documentation
              </a>
            </div>
          </div>
        </div>

        <div className="self-hosting-cta">
          <a href="https://github.com/Underwood-Inc/strixun-stream-suite" target="_blank" rel="noopener noreferrer" className="btn btn-primary">
            <svg className="star-icon" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
            Star on GitHub
          </a>
          <a href="#features" className="btn btn-secondary">
            Continue with Free Tier
          </a>
        </div>
      </div>
    </section>
  );
}

// ============ Technical Docs (Accordions) ============
function TechnicalDocs({ apiUrl, toggleAccordion }: { apiUrl: string; toggleAccordion: (header: HTMLElement) => void }) {
  return (
    <section className="code-examples" id="docs">
      <h2>Technical Documentation</h2>
      <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginBottom: 'var(--spacing-xl)' }}>
        Expand sections below for detailed technical information
      </p>

      {/* API Endpoints Accordion */}
      <div className="accordion">
        <div className="accordion-header" onClick={(e) => toggleAccordion(e.currentTarget)}>
          <h3>API Endpoints</h3>
          <span className="accordion-icon">▼</span>
        </div>
        <div className="accordion-content">
          <div className="accordion-body">
            <h4>Permission Check</h4>
            <CodeBlock language="typescript" code={`// Check if user has permission
const response = await fetch('${apiUrl}/access/check', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_JWT_TOKEN'
  },
  credentials: 'include',
  body: JSON.stringify({
    permission: 'mods:upload',
    resourceId: 'mod-123' // Optional
  })
});

const data = await response.json();
if (data.hasPermission) {
  console.log('✓ Permission granted');
}`} />

            <h4 style={{ marginTop: 'var(--spacing-2xl)' }}>Role Management</h4>
            <CodeBlock language="typescript" code={`// Get customer roles
const response = await fetch('${apiUrl}/access/roles/customer/cust_abc123', {
  headers: { 'Authorization': 'Bearer YOUR_JWT_TOKEN' },
  credentials: 'include'
});

const data = await response.json();
console.log('Roles:', data.roles);
// Output: ['user', 'premium', 'moderator']`} />

            <h4 style={{ marginTop: 'var(--spacing-2xl)' }}>Quota Management</h4>
            <CodeBlock language="typescript" code={`// Check quota usage
const response = await fetch('${apiUrl}/access/quotas/mods_upload', {
  headers: { 'Authorization': 'Bearer YOUR_JWT_TOKEN' },
  credentials: 'include'
});

const data = await response.json();
console.log(\`Used: \${data.used} / \${data.limit}\`);
console.log(\`Remaining: \${data.remaining}\`);`} />
          </div>
        </div>
      </div>

      {/* Architecture Accordion */}
      <div className="accordion">
        <div className="accordion-header" onClick={(e) => toggleAccordion(e.currentTarget)}>
          <h3>Architecture</h3>
          <span className="accordion-icon">▼</span>
        </div>
        <div className="accordion-content">
          <div className="accordion-body">
            <h4>Authorization Flow</h4>
            <p style={{ marginBottom: 'var(--spacing-md)', color: 'var(--text-secondary)' }}>
              Every request follows a strict authorization pipeline ensuring security, compliance, and performance.
            </p>
            <div className="mermaid-container">
              <div className="mermaid">{`graph TD
    A[Client Request] --> B{Authentication}
    B -->|Valid Token| C[Extract Customer ID]
    B -->|Invalid| Z[401 Unauthorized]
    C --> D{Check Permissions}
    D -->|Has Permission| E[Execute Request]
    D -->|No Permission| Y[403 Forbidden]
    E --> F{Check Quotas}
    F -->|Within Limits| G[Process & Log]
    F -->|Exceeded| X[429 Rate Limited]
    G --> H[Return Success]
    H --> I[Update Audit Log]`}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Role Hierarchy Accordion */}
      <div className="accordion">
        <div className="accordion-header" onClick={(e) => toggleAccordion(e.currentTarget)}>
          <h3>Role Hierarchy</h3>
          <span className="accordion-icon">▼</span>
        </div>
        <div className="accordion-content">
          <div className="accordion-body">
            <h4>Hierarchical Role Inheritance</h4>
            <p style={{ marginBottom: 'var(--spacing-md)', color: 'var(--text-secondary)' }}>
              Roles inherit permissions from higher roles, allowing efficient permission management.
            </p>
            <div className="mermaid-container">
              <div className="mermaid">{`graph TD
    SUPER[Super Admin] --> ADMIN[Admin]
    ADMIN --> MOD[Moderator]
    MOD --> PREMIUM[Premium User]
    PREMIUM --> USER[User]
    USER --> GUEST[Guest]
    
    SUPER -.->|Inherits All| PERMISSIONS[All Permissions]
    ADMIN -.->|Inherits| MANAGE[Manage Users, Content]
    MOD -.->|Inherits| MODERATE[Moderate Content]
    PREMIUM -.->|Inherits| EXTENDED[Extended Quotas]
    USER -.->|Inherits| BASIC[Basic Access]
    GUEST -.->|Inherits| LIMITED[Read-Only]`}</div>
            </div>

            <h4 style={{ marginTop: 'var(--spacing-2xl)' }}>Role Permissions Matrix</h4>
            <table className="role-table">
              <thead>
                <tr>
                  <th>Role</th>
                  <th>Permissions</th>
                  <th>Quotas</th>
                  <th>Special Access</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>Super Admin</strong></td>
                  <td>All permissions (wildcard *)</td>
                  <td>Unlimited</td>
                  <td>System config, user management, audit logs</td>
                </tr>
                <tr>
                  <td><strong>Admin</strong></td>
                  <td>Manage users, content, settings</td>
                  <td>10x standard</td>
                  <td>Customer management, role assignment</td>
                </tr>
                <tr>
                  <td><strong>Moderator</strong></td>
                  <td>Moderate content, ban users</td>
                  <td>5x standard</td>
                  <td>Content moderation tools</td>
                </tr>
                <tr>
                  <td><strong>Premium User</strong></td>
                  <td>Create, edit, delete own content</td>
                  <td>3x standard</td>
                  <td>API access, advanced features</td>
                </tr>
                <tr>
                  <td><strong>User</strong></td>
                  <td>Read, create own content</td>
                  <td>Standard</td>
                  <td>Basic features</td>
                </tr>
                <tr>
                  <td><strong>Guest</strong></td>
                  <td>Read-only</td>
                  <td>Limited</td>
                  <td>Public content only</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Security Accordion */}
      <div className="accordion">
        <div className="accordion-header" onClick={(e) => toggleAccordion(e.currentTarget)}>
          <h3>Security Best Practices</h3>
          <span className="accordion-icon">▼</span>
        </div>
        <div className="accordion-content">
          <div className="accordion-body">
            <h4>Authentication</h4>
            <ul>
              <li><strong><TechnicalTerm
                term="JWT RFC 7519"
                definition="JSON Web Token standard for secure information exchange."
                link="https://datatracker.ietf.org/doc/html/rfc7519"
                sourceLink="https://github.com/Underwood-Inc/strixun-stream-suite/blob/master/serverless/access-service/utils/auth.ts"
              >JWT RFC 7519</TechnicalTerm>:</strong> Industry-standard JSON Web Tokens (<a href="https://github.com/Underwood-Inc/strixun-stream-suite/blob/master/serverless/access-service/utils/auth.ts" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--info, #6495ed)' }}>view source</a>)</li>
              <li><strong><TechnicalTerm
                term="HttpOnly Cookies"
                definition="Cookies with the HttpOnly flag set, preventing client-side JavaScript access and providing XSS protection."
                link="https://owasp.org/www-community/HttpOnly"
              >HttpOnly Cookies</TechnicalTerm>:</strong> <TechnicalTerm
                term="XSS"
                definition="Cross-Site Scripting - A security vulnerability where attackers inject malicious scripts into web pages."
                link="https://owasp.org/www-community/attacks/xss/"
              >XSS</TechnicalTerm> protection for browser clients</li>
              <li><strong>API Keys:</strong> Service-to-service authentication (<a href="https://github.com/Underwood-Inc/strixun-stream-suite/blob/master/serverless/access-service/utils/auth.ts" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--info, #6495ed)' }}>view source</a>)</li>
              <li><strong><TechnicalTerm
                term="mTLS"
                definition="Mutual Transport Layer Security - Both client and server authenticate each other using certificates."
                link="https://en.wikipedia.org/wiki/Mutual_authentication"
              >mTLS</TechnicalTerm>:</strong> Mutual TLS for high-security scenarios</li>
            </ul>

            <h4 style={{ marginTop: 'var(--spacing-2xl)' }}>Authorization</h4>
            <ul>
              <li><strong><TechnicalTerm
                term="NIST RBAC"
                definition="NIST SP 800-162 - Comprehensive model for role-based access control."
                link="https://csrc.nist.gov/publications/detail/sp/800-162/final"
                sourceLink="https://github.com/Underwood-Inc/strixun-stream-suite/blob/master/serverless/access-service/handlers/check.ts"
              >NIST RBAC</TechnicalTerm>:</strong> Compliant with NIST SP 800-162 (<a href="https://github.com/Underwood-Inc/strixun-stream-suite/blob/master/serverless/access-service/handlers/check.ts" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--info, #6495ed)' }}>view source</a>)</li>
              <li><strong><TechnicalTerm
                term="Zero Trust"
                definition="Security model that assumes no implicit trust and continuously validates every stage of digital interaction. 'Never trust, always verify.'"
                link="https://www.nist.gov/publications/zero-trust-architecture"
              >Zero Trust</TechnicalTerm>:</strong> Verify every request, trust nothing</li>
              <li><strong><TechnicalTerm
                term="Least Privilege"
                definition="Security principle of providing users and systems with the minimum levels of access needed to perform their functions."
                link="https://en.wikipedia.org/wiki/Principle_of_least_privilege"
                sourceLink="https://github.com/Underwood-Inc/strixun-stream-suite/blob/master/serverless/access-service/handlers/definitions.ts"
              >Least Privilege</TechnicalTerm>:</strong> Minimum permissions by default</li>
              <li><strong><TechnicalTerm
                term="Dynamic Policies"
                definition="Access control policies that are evaluated at runtime based on current context, user attributes, and resource state."
                sourceLink="https://github.com/Underwood-Inc/strixun-stream-suite/blob/master/serverless/access-service/handlers/check.ts"
              >Dynamic Policies</TechnicalTerm>:</strong> Runtime policy evaluation</li>
            </ul>

            <h4 style={{ marginTop: 'var(--spacing-2xl)' }}>Compliance</h4>
            <ul>
              <li><strong><TechnicalTerm
                term="GDPR"
                definition="General Data Protection Regulation - EU regulation on data protection and privacy in the European Union and the European Economic Area."
                link="https://gdpr.eu/"
              >GDPR</TechnicalTerm>:</strong> Data protection and privacy compliance</li>
              <li><strong><TechnicalTerm
                term="SOC 2"
                definition="Service Organization Control 2 - Auditing procedure that ensures service providers securely manage data to protect the interests of the organization and the privacy of its clients."
                link="https://www.aicpa.org/interestareas/frc/assuranceadvisoryservices/aicpasoc2report.html"
              >SOC 2</TechnicalTerm>:</strong> Security, availability, confidentiality</li>
              <li><strong><TechnicalTerm
                term="HIPAA"
                definition="Health Insurance Portability and Accountability Act - US legislation that provides data privacy and security provisions for safeguarding medical information."
                link="https://www.hhs.gov/hipaa/index.html"
              >HIPAA</TechnicalTerm>-Ready:</strong> Healthcare data protection</li>
              <li><strong><TechnicalTerm
                term="Audit Logs"
                definition="Tamper-proof, immutable logs that record all access control events for compliance and security monitoring."
                sourceLink="https://github.com/Underwood-Inc/strixun-stream-suite/blob/master/serverless/access-service/handlers/audit.ts"
              >Audit Logs</TechnicalTerm>:</strong> Tamper-proof, immutable logs (<a href="https://github.com/Underwood-Inc/strixun-stream-suite/blob/master/serverless/access-service/handlers/audit.ts" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--info, #6495ed)' }}>view source</a>)</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Standards Accordion */}
      <div className="accordion">
        <div className="accordion-header" onClick={(e) => toggleAccordion(e.currentTarget)}>
          <h3>Standards & Specifications</h3>
          <span className="accordion-icon">▼</span>
        </div>
        <div className="accordion-content">
          <div className="accordion-body">
            <p style={{ marginBottom: 'var(--spacing-lg)', color: 'var(--text-secondary)' }}>
              Our Access Control System adheres to industry-standard specifications and best practices.
            </p>
            
            <div className="standards-grid">
              <a href="https://csrc.nist.gov/publications/detail/sp/800-162/final" target="_blank" rel="noopener noreferrer" className="standard-card">
                <div className="standard-header">
                  <h4>NIST RBAC</h4>
                  <span className="standard-spec">SP 800-162</span>
                </div>
                <p>Role-Based Access Control standard by NIST for secure authorization.</p>
              </a>

              <a href="https://datatracker.ietf.org/doc/html/rfc7519" target="_blank" rel="noopener noreferrer" className="standard-card">
                <div className="standard-header">
                  <h4>JWT</h4>
                  <span className="standard-spec">RFC 7519</span>
                </div>
                <p>JSON Web Token standard for secure information exchange.</p>
              </a>

              <a href="https://datatracker.ietf.org/doc/html/rfc6749" target="_blank" rel="noopener noreferrer" className="standard-card">
                <div className="standard-header">
                  <h4>OAuth 2.0</h4>
                  <span className="standard-spec">RFC 6749</span>
                </div>
                <p>Authorization framework for delegated access.</p>
              </a>

              <a href="https://openid.net/specs/openid-connect-core-1_0.html" target="_blank" rel="noopener noreferrer" className="standard-card">
                <div className="standard-header">
                  <h4>OpenID Connect</h4>
                  <span className="standard-spec">OIDC Core</span>
                </div>
                <p>Identity layer on top of OAuth 2.0.</p>
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
