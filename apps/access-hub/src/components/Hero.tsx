/**
 * Hero Component
 * Hero section with title, description, API URL, and badges
 */

import { TechnicalTerm } from '@strixun/shared-components/react';

interface HeroProps {
  apiUrl: string;
}

export function Hero({ apiUrl }: HeroProps) {
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
