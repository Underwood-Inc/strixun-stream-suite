/**
 * ApiEndpointsAccordion Component
 * Accordion for API endpoints documentation
 */

import { CodeBlock } from '../../../../shared-components/react/CodeBlock';

interface ApiEndpointsAccordionProps {
  apiUrl: string;
}

export function ApiEndpointsAccordion({ apiUrl }: ApiEndpointsAccordionProps) {
  return (
    <>
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
    </>
  );
}
