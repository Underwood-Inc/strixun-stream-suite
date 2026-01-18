/**
 * RoleHierarchyAccordion Component
 * Accordion for role hierarchy documentation with mermaid diagram and table
 */

export function RoleHierarchyAccordion() {
  return (
    <>
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
    GUEST -.->|Inherits| LIMITED[Read-Only]
    
    classDef adminStyle fill:#252017,stroke:#edae49,stroke-width:3px,color:#f9f9f9
    classDef userStyle fill:#1a1611,stroke:#6495ed,stroke-width:3px,color:#f9f9f9
    classDef permStyle fill:#252017,stroke:#28a745,stroke-width:3px,color:#f9f9f9
    
    class SUPER,ADMIN adminStyle
    class MOD,PREMIUM userStyle
    class USER,GUEST userStyle
    class PERMISSIONS,MANAGE,MODERATE,EXTENDED,BASIC,LIMITED permStyle`}</div>
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
    </>
  );
}
