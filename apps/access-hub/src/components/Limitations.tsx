/**
 * Limitations Component
 * List of service limitations and considerations
 */

export function Limitations() {
  return (
    <section className="limitations">
      <h2>Limitations & Considerations</h2>
      <div className="limitations-list">
        <ul>
          <li>
            <strong>Rate Limits</strong>
            <p>100 permission checks per minute per customer to ensure fair resource allocation.</p>
          </li>
          <li>
            <strong>Role Hierarchy Depth</strong>
            <p>Maximum 10 levels of role inheritance to prevent circular dependencies.</p>
          </li>
          <li>
            <strong>Quota Reset</strong>
            <p>Quotas reset daily at midnight UTC. Custom reset schedules available for enterprise.</p>
          </li>
          <li>
            <strong>Audit Log Retention</strong>
            <p>Audit logs retained for 90 days on free tier. Extended retention available for enterprise.</p>
          </li>
          <li>
            <strong>Permission Wildcards</strong>
            <p>Wildcard permissions (*) should be used sparingly and only for admin roles.</p>
          </li>
          <li>
            <strong>Multi-Tenancy</strong>
            <p>All data is completely isolated per customer using prefixed KV keys.</p>
          </li>
        </ul>
      </div>
    </section>
  );
}
