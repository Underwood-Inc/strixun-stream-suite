/**
 * SelfHosting Component
 * Information about self-hosting and open source options
 */

export function SelfHosting() {
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
