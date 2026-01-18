/**
 * ArchitectureAccordion Component
 * Accordion for architecture documentation with mermaid diagrams
 */

export function ArchitectureAccordion() {
  return (
    <>
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
    H --> I[Update Audit Log]
    
    classDef clientStyle fill:#252017,stroke:#edae49,stroke-width:3px,color:#f9f9f9
    classDef processStyle fill:#1a1611,stroke:#6495ed,stroke-width:3px,color:#f9f9f9
    classDef storageStyle fill:#252017,stroke:#28a745,stroke-width:3px,color:#f9f9f9
    classDef errorStyle fill:#1a1611,stroke:#f9df74,stroke-width:3px,color:#f9f9f9
    
    class A clientStyle
    class B,D,F processStyle
    class C,E,G,H processStyle
    class I storageStyle
    class X,Y,Z errorStyle`}</div>
      </div>
    </>
  );
}
