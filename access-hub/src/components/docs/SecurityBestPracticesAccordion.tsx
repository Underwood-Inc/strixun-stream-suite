/**
 * SecurityBestPracticesAccordion Component
 * Accordion for security best practices documentation
 */

import { TechnicalTerm } from '../../../../shared-components/react';

export function SecurityBestPracticesAccordion() {
  return (
    <>
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
    </>
  );
}
