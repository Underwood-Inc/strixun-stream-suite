import './App.css'

function App() {
  const apiUrl = import.meta.env.VITE_ACCESS_API_URL || 'https://access-api.idling.app'

  return (
    <div className="app">
      <header>
        <h1>Access Control System</h1>
        <p>Strixun Stream Suite - Authorization Service</p>
      </header>

      <main>
        <section>
          <h2>About</h2>
          <p>
            The Access Control System provides centralized authorization, role-based access control (RBAC),
            and quota management for all Strixun Stream Suite services.
          </p>
          <p>
            This service handles authentication, permission verification, role assignment, and usage tracking
            across the entire platform, ensuring secure and scalable access management.
          </p>
        </section>

        <section>
          <h2>Features</h2>
          <ul>
            <li>Role-Based Access Control (RBAC) with hierarchical permissions</li>
            <li>Fine-grained permission management system</li>
            <li>Real-time quota tracking and enforcement</li>
            <li>Comprehensive audit logging for compliance</li>
            <li>Service-to-service authentication with JWT and API keys</li>
            <li>Rate limiting and security controls</li>
          </ul>
        </section>

        <section>
          <h2>API Endpoint</h2>
          <p>
            The Access API provides RESTful endpoints for managing roles, permissions, and quotas.
            All API access requires authentication via service keys or JWT tokens.
          </p>
          <div className="api-info">
            <p>API Base URL:</p>
            <code>{apiUrl}</code>
          </div>
        </section>
      </main>
    </div>
  )
}

export default App
