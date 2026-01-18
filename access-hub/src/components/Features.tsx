/**
 * Features Component
 * Grid of feature cards showcasing key capabilities
 */

import { TechnicalTerm } from '../../../shared-components/react';

export function Features() {
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
