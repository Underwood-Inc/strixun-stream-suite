/**
 * Header Component
 * Sticky header with logo and action buttons
 */

export function Header() {
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
