/**
 * StandardsAccordion Component
 * Accordion for standards and specifications documentation
 */

export function StandardsAccordion() {
  return (
    <>
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
    </>
  );
}
