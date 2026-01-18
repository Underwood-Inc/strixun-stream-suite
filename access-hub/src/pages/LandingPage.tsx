/**
 * Access Hub Landing Page
 * Main orchestrator for all landing page components
 * Follows atomic design pattern matching otp-auth-service
 */

import { useEffect } from 'react';
import { FooterContainer, FooterBrand } from '../../../shared-components/react';
import StrixunSuiteLink from '../../../shared-components/react/StrixunSuiteLink';
import { Header } from '../components/Header';
import { Hero } from '../components/Hero';
import { Features } from '../components/Features';
import { Limitations } from '../components/Limitations';
import { SelfHosting } from '../components/SelfHosting';
import { TechnicalDocs } from '../components/TechnicalDocs';
import '../LandingPage.scss';

export function LandingPage() {
  const apiUrl = import.meta.env.VITE_ACCESS_API_URL || 'https://access-api.idling.app';

  // Initialize mermaid, global click ripple, and accordion functionality
  useEffect(() => {
    // Initialize mermaid
    if (typeof (window as any).mermaid !== 'undefined') {
      (window as any).mermaid.initialize({
        startOnLoad: false,
        theme: 'dark',
        themeVariables: {
          primaryColor: '#edae49',
          primaryTextColor: '#1a1611',
          primaryBorderColor: '#c68214',
          secondaryColor: '#252017',
          secondaryTextColor: '#b8b8b8',
          secondaryBorderColor: '#3d3627',
          tertiaryColor: '#1a1611',
          tertiaryTextColor: '#888',
          tertiaryBorderColor: '#4a4336',
          background: '#0f0e0b',
          mainBkg: '#252017',
          secondBkg: '#1a1611',
          tertiaryBkg: '#0f0e0b',
          textColor: '#f9f9f9',
          border1: '#3d3627',
          border2: '#4a4336',
          border3: '#c68214',
          lineColor: '#6495ed',
          nodeBkg: '#252017',
          nodeBorder: '#edae49',
          clusterBkg: '#1a1611',
          clusterBorder: '#3d3627',
          defaultLinkColor: '#6495ed',
          titleColor: '#edae49',
          edgeLabelBackground: '#252017',
          edgeLabelTextColor: '#f9f9f9',
          arrowheadColor: '#6495ed',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
          fontSize: '14px'
        },
        flowchart: {
          useMaxWidth: true,
          htmlLabels: true,
          curve: 'basis',
          padding: 20,
          nodeSpacing: 50,
          rankSpacing: 80,
          diagramPadding: 20
        }
      });
    }
    
    // Global click ripple effect - creates a ring ripple on ANY click
    const handleClick = (e: MouseEvent) => {
      // Create ripple element
      const ripple = document.createElement('div');
      ripple.className = 'click-ripple';
      
      const x = e.clientX;
      const y = e.clientY;
      
      ripple.style.left = `${x}px`;
      ripple.style.top = `${y}px`;
      
      document.body.appendChild(ripple);
      
      // Remove after animation completes
      setTimeout(() => {
        ripple.remove();
      }, 400);
      
      // Smooth scroll for anchor links
      const target = e.target as HTMLElement;
      if (target.tagName === 'A' && (target as HTMLAnchorElement).hash) {
        const element = document.querySelector((target as HTMLAnchorElement).hash);
        if (element) {
          e.preventDefault();
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    };

    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  // Accordion toggle function
  const toggleAccordion = (header: HTMLElement) => {
    const accordion = header.parentElement;
    if (!accordion) return;
    
    const isActive = accordion.classList.contains('active');
    
    // Close all accordions
    document.querySelectorAll('.accordion').forEach(acc => {
      acc.classList.remove('active');
    });
    
    // Open clicked accordion if it wasn't active
    if (!isActive) {
      accordion.classList.add('active');
      
      // Scroll to the accordion header with proper offset for sticky header
      // Wait for accordion to finish expanding (300ms transition)
      setTimeout(() => {
        const headerHeight = document.querySelector('.header')?.getBoundingClientRect().height || 0;
        const accordionTop = accordion.getBoundingClientRect().top + window.scrollY;
        const scrollToPosition = accordionTop - headerHeight - 20; // 20px padding
        
        window.scrollTo({
          top: scrollToPosition,
          behavior: 'smooth'
        });
      }, 350);
      
      // Re-render Mermaid diagrams when accordion opens
      const accordionTitle = header.querySelector('h3')?.textContent || '';
      if ((accordionTitle.includes('Architecture') || accordionTitle.includes('Role Hierarchy')) && typeof (window as any).mermaid !== 'undefined') {
        setTimeout(() => {
          const mermaidElements = accordion.querySelectorAll('.mermaid:not([data-processed])');
          if (mermaidElements.length > 0) {
            mermaidElements.forEach((el: Element) => {
              (el as HTMLElement).dataset.processed = 'true';
            });
            (window as any).mermaid.run();
          }
        }, 100);
      }
    }
  };

  return (
    <main className="landing">
      <Header />
      <Hero apiUrl={apiUrl} />
      <Features />
      <Limitations />
      <SelfHosting />
      <TechnicalDocs apiUrl={apiUrl} toggleAccordion={toggleAccordion} />
      
      <FooterContainer>
        <FooterBrand
          serviceName="Access Hub"
          description="Authorization & access control service"
        />
        <div style={{ textAlign: 'center', margin: '0.5rem 0 0 0', fontSize: '0.875rem', color: 'var(--text-secondary, #b8b8b8)' }}>
          Part of the <StrixunSuiteLink />
        </div>
        <div style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.75rem', color: 'var(--text-muted, #888)' }}>
          &copy; {new Date().getFullYear()} Strixun. All rights reserved.
        </div>
      </FooterContainer>
    </main>
  );
}
