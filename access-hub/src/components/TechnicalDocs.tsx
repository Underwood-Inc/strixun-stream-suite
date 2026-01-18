/**
 * TechnicalDocs Component
 * Container for technical documentation accordions
 */

import { ApiEndpointsAccordion } from './docs/ApiEndpointsAccordion';
import { ArchitectureAccordion } from './docs/ArchitectureAccordion';
import { RoleHierarchyAccordion } from './docs/RoleHierarchyAccordion';
import { SecurityBestPracticesAccordion } from './docs/SecurityBestPracticesAccordion';
import { StandardsAccordion } from './docs/StandardsAccordion';

interface TechnicalDocsProps {
  apiUrl: string;
  toggleAccordion: (header: HTMLElement) => void;
}

export function TechnicalDocs({ apiUrl, toggleAccordion }: TechnicalDocsProps) {
  return (
    <section className="code-examples" id="docs">
      <h2>Technical Documentation</h2>
      <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginBottom: 'var(--spacing-xl)' }}>
        Expand sections below for detailed technical information
      </p>

      {/* API Endpoints Accordion */}
      <div className="accordion">
        <div className="accordion-header" onClick={(e) => toggleAccordion(e.currentTarget)}>
          <h3>API Endpoints</h3>
          <span className="accordion-icon">▼</span>
        </div>
        <div className="accordion-content">
          <div className="accordion-body">
            <ApiEndpointsAccordion apiUrl={apiUrl} />
          </div>
        </div>
      </div>

      {/* Architecture Accordion */}
      <div className="accordion">
        <div className="accordion-header" onClick={(e) => toggleAccordion(e.currentTarget)}>
          <h3>Architecture</h3>
          <span className="accordion-icon">▼</span>
        </div>
        <div className="accordion-content">
          <div className="accordion-body">
            <ArchitectureAccordion />
          </div>
        </div>
      </div>

      {/* Role Hierarchy Accordion */}
      <div className="accordion">
        <div className="accordion-header" onClick={(e) => toggleAccordion(e.currentTarget)}>
          <h3>Role Hierarchy</h3>
          <span className="accordion-icon">▼</span>
        </div>
        <div className="accordion-content">
          <div className="accordion-body">
            <RoleHierarchyAccordion />
          </div>
        </div>
      </div>

      {/* Security Accordion */}
      <div className="accordion">
        <div className="accordion-header" onClick={(e) => toggleAccordion(e.currentTarget)}>
          <h3>Security Best Practices</h3>
          <span className="accordion-icon">▼</span>
        </div>
        <div className="accordion-content">
          <div className="accordion-body">
            <SecurityBestPracticesAccordion />
          </div>
        </div>
      </div>

      {/* Standards Accordion */}
      <div className="accordion">
        <div className="accordion-header" onClick={(e) => toggleAccordion(e.currentTarget)}>
          <h3>Standards & Specifications</h3>
          <span className="accordion-icon">▼</span>
        </div>
        <div className="accordion-content">
          <div className="accordion-body">
            <StandardsAccordion />
          </div>
        </div>
      </div>
    </section>
  );
}
