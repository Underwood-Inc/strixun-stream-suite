// Landing page HTML embedded as a module
// This file is generated from landing.html
// To regenerate: run the build script or watch script

export default `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>OTP Authentication API - Passwordless Auth for Modern Apps</title>
    <meta name="description" content="Secure, passwordless OTP authentication API. Easy integration with React, Svelte, and vanilla JavaScript. Enterprise-grade security with multi-tenancy support.">
    <!-- Prism.js for syntax highlighting -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism-tomorrow.min.css" integrity="sha512-vswe+cgvic4Boqnsfz8dYw3lD3Rfivs//w7KJL0xW8cz5Zb6qblDPPaoZ5wvw8r9MTRy0c3+auFzlpN8y2v1yUg==" crossorigin="anonymous" referrerpolicy="no-referrer" />
    <!-- Swagger UI -->
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.17.14/swagger-ui.css" />
    <!-- Mermaid.js for diagrams -->
    <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
    <!-- Prism.js script -->
    <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-core.min.js" integrity="sha512-9khQRAUBYEJDCDVP2yw3LRUQvjJ0Pjx0EShmaQjcHa6AXiOv6qHQu9sCA/8OoydzcBUKI4k5K6t6Yk7yY+3WQ==" crossorigin="anonymous" referrerpolicy="no-referrer"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/plugins/autoloader/prism-autoloader.min.js" integrity="sha512-SkmBfuA2hqjzEVpmnMt/LINrjop3GKWqsuLSSB3e7UgBmSwaHH/M3YUL3HkbuX7X03xZ3/3dQ4jHk6FT4Qo4wA==" crossorigin="anonymous" referrerpolicy="no-referrer"></script>
    <!-- Swagger UI scripts -->
    <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.17.14/swagger-ui-bundle.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.17.14/swagger-ui-standalone-preset.js"></script>
    <style>
        /**
         * OTP Auth Service Landing Page
         * Matches Strixun's Stream Suite Design System
         */
        
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        :root {
            /* Strixun Stream Suite Design System */
            --bg: #1a1611;
            --bg-dark: #0f0e0b;
            --card: #252017;
            --border: #3d3627;
            --border-light: #4a4336;
            
            /* Brand Colors */
            --accent: #edae49;
            --accent-light: #f9df74;
            --accent-dark: #c68214;
            --accent2: #6495ed;
            
            /* Status Colors */
            --success: #28a745;
            --warning: #ffc107;
            --danger: #ea2b1f;
            --info: #6495ed;
            
            /* Text Colors */
            --text: #f9f9f9;
            --text-secondary: #b8b8b8;
            --muted: #888;
            
            /* Spacing */
            --spacing-xs: 8px;
            --spacing-sm: 12px;
            --spacing-md: 16px;
            --spacing-lg: 24px;
            --spacing-xl: 32px;
            --spacing-2xl: 48px;
            --spacing-3xl: 64px;
            
            /* Border Radius */
            --radius-sm: 4px;
            --radius-md: 8px;
            --radius-lg: 12px;
            
            /* Shadows */
            --shadow-sm: 0 2px 4px rgba(0, 0, 0, 0.2);
            --shadow-md: 0 4px 8px rgba(0, 0, 0, 0.3);
            --shadow-lg: 0 8px 16px rgba(0, 0, 0, 0.4);
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
            background: var(--bg);
            color: var(--text);
            line-height: 1.6;
            min-height: 100vh;
        }

        /* Scrollbar Styling */
        ::-webkit-scrollbar {
            width: 6px;
            height: 6px;
        }

        ::-webkit-scrollbar-track {
            background: transparent;
        }

        ::-webkit-scrollbar-thumb {
            background: var(--border);
            border-radius: 3px;
        }

        ::-webkit-scrollbar-thumb:hover {
            background: var(--muted);
        }

        * {
            scrollbar-width: thin;
            scrollbar-color: var(--border) transparent;
        }

        /* Header */
        .header {
            background: var(--card);
            border-bottom: 1px solid var(--border);
            padding: var(--spacing-md) var(--spacing-xl);
            position: sticky;
            top: 0;
            z-index: 100;
            backdrop-filter: blur(10px);
            background: rgba(37, 32, 23, 0.95);
        }

        .header-content {
            max-width: 1200px;
            margin: 0 auto;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }

        .logo {
            font-size: 1.5rem;
            font-weight: 700;
            background: linear-gradient(135deg, var(--accent), var(--accent-light));
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            text-decoration: none;
        }

        .header-actions {
            display: flex;
            gap: var(--spacing-md);
            align-items: center;
        }

        .btn {
            padding: var(--spacing-sm) var(--spacing-lg);
            border: 3px solid;
            border-radius: 0;
            font-size: 0.875rem;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 1px;
            cursor: pointer;
            transition: all 0.1s cubic-bezier(0.4, 0, 0.2, 1);
            text-decoration: none;
            display: inline-block;
            background: transparent;
            color: var(--text);
        }

        .btn-primary {
            background: var(--accent);
            border-color: var(--accent-dark);
            color: #000;
            box-shadow: 0 4px 0 var(--accent-dark);
        }

        .btn-primary:hover:not(:disabled) {
            transform: translateY(-2px);
            box-shadow: 0 6px 0 var(--accent-dark);
        }

        .btn-primary:active:not(:disabled) {
            transform: translateY(2px);
            box-shadow: 0 2px 0 var(--accent-dark);
        }

        .btn-secondary {
            border-color: var(--border-light);
            color: var(--text);
        }

        .btn-secondary:hover {
            background: var(--border);
            border-color: var(--border-light);
        }

        /* Hero Section */
        .hero {
            padding: var(--spacing-3xl) var(--spacing-xl);
            text-align: center;
            max-width: 1200px;
            margin: 0 auto;
        }

        .hero h1 {
            font-size: clamp(2.5rem, 5vw, 4rem);
            margin-bottom: var(--spacing-lg);
            background: linear-gradient(135deg, var(--accent), var(--accent-light));
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            line-height: 1.2;
        }

        .hero p {
            font-size: clamp(1.1rem, 2vw, 1.5rem);
            color: var(--text-secondary);
            margin-bottom: var(--spacing-2xl);
            max-width: 800px;
            margin-left: auto;
            margin-right: auto;
        }

        .hero-cta {
            display: flex;
            gap: var(--spacing-md);
            justify-content: center;
            flex-wrap: wrap;
        }

        /* Features Grid */
        .features {
            padding: var(--spacing-3xl) var(--spacing-xl);
            max-width: 1200px;
            margin: 0 auto;
        }

        .features h2 {
            text-align: center;
            font-size: clamp(2rem, 4vw, 3rem);
            margin-bottom: var(--spacing-2xl);
            color: var(--accent);
        }

        .features-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: var(--spacing-lg);
            margin-bottom: var(--spacing-3xl);
        }

        .feature-card {
            background: var(--card);
            border: 1px solid var(--border);
            border-radius: var(--radius-md);
            padding: var(--spacing-xl);
            transition: transform 0.2s, box-shadow 0.2s;
        }

        .feature-card:hover {
            transform: translateY(-4px);
            box-shadow: var(--shadow-lg);
            border-color: var(--border-light);
        }

        .feature-icon {
            font-size: 2.5rem;
            margin-bottom: var(--spacing-md);
        }

        .feature-card h3 {
            font-size: 1.25rem;
            margin-bottom: var(--spacing-sm);
            color: var(--accent);
        }

        .feature-card p {
            color: var(--text-secondary);
        }

        /* Security Section */
        .security {
            background: var(--bg-dark);
            padding: var(--spacing-3xl) var(--spacing-xl);
            margin: var(--spacing-3xl) 0;
        }

        .security-content {
            max-width: 1200px;
            margin: 0 auto;
        }

        .security h2 {
            text-align: center;
            font-size: clamp(2rem, 4vw, 3rem);
            margin-bottom: var(--spacing-2xl);
            color: var(--accent);
        }

        .security-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: var(--spacing-lg);
        }

        .security-item {
            background: var(--card);
            border: 1px solid var(--border);
            border-radius: var(--radius-md);
            padding: var(--spacing-lg);
            border-left: 4px solid var(--success);
        }

        .security-item h3 {
            color: var(--success);
            margin-bottom: var(--spacing-sm);
        }

        /* Code Examples */
        .code-examples {
            padding: var(--spacing-3xl) var(--spacing-xl);
            max-width: 1200px;
            margin: 0 auto;
        }

        .code-examples h2 {
            text-align: center;
            font-size: clamp(2rem, 4vw, 3rem);
            margin-bottom: var(--spacing-2xl);
            color: var(--accent);
        }

        .code-tabs {
            display: flex;
            gap: var(--spacing-sm);
            margin-bottom: var(--spacing-lg);
            flex-wrap: wrap;
            border-bottom: 2px solid var(--border);
        }

        .code-tab {
            padding: var(--spacing-sm) var(--spacing-lg);
            background: transparent;
            border: none;
            border-bottom: 3px solid transparent;
            color: var(--text-secondary);
            cursor: pointer;
            font-size: 0.875rem;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            transition: all 0.2s;
            margin-bottom: -2px;
        }

        .code-tab:hover {
            color: var(--text);
            border-bottom-color: var(--border-light);
        }

        .code-tab.active {
            color: var(--accent);
            border-bottom-color: var(--accent);
        }

        .code-block {
            background: var(--bg-dark);
            border: 1px solid var(--border);
            border-radius: var(--radius-md);
            padding: var(--spacing-lg);
            overflow-x: auto;
            display: none;
        }

        .code-block.active {
            display: block;
        }

        .code-block pre {
            margin: 0;
            font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', monospace;
            font-size: 0.875rem;
            line-height: 1.6;
            color: var(--text);
            background: transparent !important;
            padding: 0;
        }

        .code-block code {
            color: var(--text);
            background: transparent !important;
        }

        /* Override Prism theme to match design system */
        .code-block pre[class*="language-"] {
            background: var(--bg-dark) !important;
        }

        .code-block code[class*="language-"] {
            background: var(--bg-dark) !important;
            color: var(--text) !important;
        }

        /* Custom syntax highlighting colors to match design system */
        .code-block .token.comment,
        .code-block .token.prolog,
        .code-block .token.doctype,
        .code-block .token.cdata {
            color: var(--muted) !important;
        }

        .code-block .token.punctuation {
            color: var(--text-secondary) !important;
        }

        .code-block .token.property,
        .code-block .token.tag,
        .code-block .token.boolean,
        .code-block .token.number,
        .code-block .token.constant,
        .code-block .token.symbol,
        .code-block .token.deleted {
            color: var(--accent) !important;
        }

        .code-block .token.selector,
        .code-block .token.attr-name,
        .code-block .token.string,
        .code-block .token.char,
        .code-block .token.builtin,
        .code-block .token.inserted {
            color: var(--accent-light) !important;
        }

        .code-block .token.operator,
        .code-block .token.entity,
        .code-block .token.url,
        .code-block .language-css .token.string,
        .code-block .style .token.string {
            color: var(--accent2) !important;
        }

        .code-block .token.atrule,
        .code-block .token.attr-value,
        .code-block .token.keyword {
            color: var(--accent) !important;
        }

        .code-block .token.function,
        .code-block .token.class-name {
            color: var(--accent-light) !important;
        }

        .code-block .token.regex,
        .code-block .token.important,
        .code-block .token.variable {
            color: var(--accent2) !important;
        }

        /* Accordion */
        .accordion {
            background: var(--card);
            border: 1px solid var(--border);
            border-radius: var(--radius-md);
            margin-bottom: var(--spacing-md);
            overflow: hidden;
        }

        .accordion-header {
            padding: var(--spacing-lg);
            cursor: pointer;
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: var(--bg-dark);
            transition: background 0.2s;
        }

        .accordion-header:hover {
            background: var(--card);
        }

        .accordion-header h3 {
            font-size: 1.1rem;
            color: var(--text);
            margin: 0;
        }

        .accordion-icon {
            transition: transform 0.3s;
            color: var(--accent);
            font-size: 1.25rem;
        }

        .accordion.active .accordion-icon {
            transform: rotate(180deg);
        }

        .accordion-content {
            max-height: 0;
            overflow: hidden;
            transition: max-height 0.3s ease-out;
        }

        .accordion.active .accordion-content {
            max-height: 5000px;
        }

        .accordion-body {
            padding: var(--spacing-lg);
            color: var(--text-secondary);
        }

        .accordion-body h4 {
            color: var(--accent);
            margin-top: var(--spacing-lg);
            margin-bottom: var(--spacing-sm);
        }

        .accordion-body ul {
            margin-left: var(--spacing-lg);
            margin-bottom: var(--spacing-md);
        }

        .accordion-body li {
            margin-bottom: var(--spacing-xs);
        }

        /* Limitations */
        .limitations {
            padding: var(--spacing-3xl) var(--spacing-xl);
            max-width: 1200px;
            margin: 0 auto;
        }

        .limitations h2 {
            text-align: center;
            font-size: clamp(2rem, 4vw, 3rem);
            margin-bottom: var(--spacing-2xl);
            color: var(--accent);
        }

        .limitations-list {
            background: var(--card);
            border: 1px solid var(--border);
            border-radius: var(--radius-md);
            padding: var(--spacing-xl);
        }

        .limitations-list ul {
            list-style: none;
            margin: 0;
        }

        .limitations-list li {
            padding: var(--spacing-md);
            border-bottom: 1px solid var(--border);
            color: var(--text-secondary);
        }

        .limitations-list li:last-child {
            border-bottom: none;
        }

        .limitations-list li strong {
            color: var(--accent);
            display: block;
            margin-bottom: var(--spacing-xs);
        }

        /* Self-Hosting Section */
        .self-hosting {
            background: linear-gradient(135deg, var(--bg-dark) 0%, var(--card) 100%);
            padding: var(--spacing-3xl) var(--spacing-xl);
            margin: var(--spacing-3xl) 0;
            border-top: 1px solid var(--border);
            border-bottom: 1px solid var(--border);
        }

        .self-hosting-content {
            max-width: 1200px;
            margin: 0 auto;
        }

        .self-hosting h2 {
            text-align: center;
            font-size: clamp(2rem, 4vw, 3rem);
            margin-bottom: var(--spacing-lg);
            color: var(--accent);
        }

        .self-hosting-subtitle {
            text-align: center;
            font-size: clamp(1.1rem, 2vw, 1.25rem);
            color: var(--text-secondary);
            margin-bottom: var(--spacing-2xl);
            max-width: 800px;
            margin-left: auto;
            margin-right: auto;
        }

        .self-hosting-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: var(--spacing-lg);
            margin-bottom: var(--spacing-2xl);
        }

        .self-hosting-card {
            background: var(--card);
            border: 1px solid var(--border);
            border-radius: var(--radius-md);
            padding: var(--spacing-xl);
            transition: transform 0.2s, box-shadow 0.2s, border-color 0.2s;
            position: relative;
            overflow: hidden;
        }

        .self-hosting-card::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 4px;
            background: linear-gradient(90deg, var(--accent), var(--accent-light));
            transform: scaleX(0);
            transition: transform 0.3s;
        }

        .self-hosting-card:hover {
            transform: translateY(-4px);
            box-shadow: var(--shadow-lg);
            border-color: var(--accent);
        }

        .self-hosting-card:hover::before {
            transform: scaleX(1);
        }

        .self-hosting-card h3 {
            font-size: 1.5rem;
            margin-bottom: var(--spacing-md);
            color: var(--accent);
            display: flex;
            align-items: center;
            gap: var(--spacing-sm);
        }

        .self-hosting-card p {
            color: var(--text-secondary);
            line-height: 1.7;
            margin-bottom: var(--spacing-md);
        }

        .self-hosting-card ul {
            list-style: none;
            margin: var(--spacing-md) 0;
            padding: 0;
        }

        .self-hosting-card li {
            padding: var(--spacing-xs) 0;
            color: var(--text-secondary);
            padding-left: var(--spacing-lg);
            position: relative;
        }

        .self-hosting-card li::before {
            content: '✓';
            position: absolute;
            left: 0;
            color: var(--success);
            font-weight: bold;
        }

        .self-hosting-cta {
            display: flex;
            gap: var(--spacing-md);
            justify-content: center;
            flex-wrap: wrap;
            margin-top: var(--spacing-2xl);
        }

        .btn-github {
            background: var(--bg-dark);
            border-color: var(--border-light);
            color: var(--text);
            display: inline-flex;
            align-items: center;
            gap: var(--spacing-sm);
        }

        .btn-github:hover {
            background: var(--card);
            border-color: var(--accent);
            color: var(--accent);
        }

        .coming-soon-badge {
            display: inline-block;
            background: var(--accent);
            color: #000;
            padding: var(--spacing-xs) var(--spacing-sm);
            border-radius: var(--radius-sm);
            font-size: 0.75rem;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-left: var(--spacing-sm);
        }

        /* Footer */
        .footer {
            background: var(--bg-dark);
            border-top: 1px solid var(--border);
            padding: var(--spacing-xl);
            text-align: center;
            color: var(--text-secondary);
            margin-top: var(--spacing-3xl);
        }

        /* Responsive */
        @media (max-width: 768px) {
            .hero {
                padding: var(--spacing-2xl) var(--spacing-md);
            }

            .features,
            .code-examples,
            .limitations {
                padding: var(--spacing-2xl) var(--spacing-md);
            }

            .header-content {
                flex-direction: column;
                gap: var(--spacing-md);
            }

            .code-tabs {
                overflow-x: auto;
            }
        }

        /* Mermaid diagram container */
        .mermaid-container {
            background: var(--bg-dark);
            border: 1px solid var(--border);
            border-radius: var(--radius-md);
            padding: var(--spacing-lg);
            margin: var(--spacing-lg) 0;
            overflow-x: auto;
        }

        /* Enhanced Mermaid diagram styling */
        .mermaid-container .mermaid {
            background: transparent;
        }

        /* Mermaid node styling to match brand */
        .mermaid-container .node rect,
        .mermaid-container .node circle,
        .mermaid-container .node ellipse,
        .mermaid-container .node polygon {
            fill: var(--card) !important;
            stroke: var(--accent) !important;
            stroke-width: 2px !important;
        }

        .mermaid-container .nodeLabel {
            color: var(--text) !important;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif !important;
        }

        /* Mermaid edge/arrow styling */
        .mermaid-container .edgePath .path {
            stroke: var(--accent2) !important;
            stroke-width: 2px !important;
        }

        .mermaid-container .edgeLabel {
            background: var(--card) !important;
            color: var(--text) !important;
        }

        .mermaid-container .arrowheadPath {
            fill: var(--accent2) !important;
        }

        /* Mermaid cluster styling */
        .mermaid-container .cluster rect {
            fill: var(--bg-dark) !important;
            stroke: var(--border) !important;
            stroke-width: 2px !important;
        }

        /* API Usage Bar */
        .api-usage-bar {
            display: none;
            background: var(--card);
            border: 1px solid var(--border);
            border-radius: var(--radius-md);
            padding: var(--spacing-md) var(--spacing-lg);
            margin: var(--spacing-md) var(--spacing-xl);
            max-width: 1200px;
            margin-left: auto;
            margin-right: auto;
        }

        .api-usage-bar.visible {
            display: block;
        }

        .api-usage-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: var(--spacing-sm);
        }

        .api-usage-title {
            font-size: 0.875rem;
            font-weight: 600;
            color: var(--text);
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .api-usage-stats {
            display: flex;
            gap: var(--spacing-lg);
            font-size: 0.875rem;
            color: var(--text-secondary);
        }

        .api-usage-stat {
            display: flex;
            align-items: center;
            gap: var(--spacing-xs);
        }

        .api-usage-stat-label {
            color: var(--muted);
        }

        .api-usage-stat-value {
            font-weight: 600;
            color: var(--text);
        }

        .api-usage-progress-container {
            position: relative;
            width: 100%;
            height: 24px;
            background: var(--bg-dark);
            border: 1px solid var(--border);
            border-radius: var(--radius-sm);
            overflow: hidden;
            margin-top: var(--spacing-sm);
        }

        .api-usage-progress-bar {
            height: 100%;
            background: linear-gradient(90deg, var(--accent), var(--accent-light));
            border-radius: var(--radius-sm);
            transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            position: relative;
            display: flex;
            align-items: center;
            justify-content: flex-end;
            padding-right: var(--spacing-xs);
            min-width: 0;
        }

        .api-usage-progress-bar.warning {
            background: linear-gradient(90deg, var(--warning), #ffd54f);
        }

        .api-usage-progress-bar.danger {
            background: linear-gradient(90deg, var(--danger), #ff6b6b);
        }

        .api-usage-progress-text {
            font-size: 0.75rem;
            font-weight: 700;
            color: #000;
            text-shadow: 0 1px 2px rgba(255, 255, 255, 0.3);
            white-space: nowrap;
        }

        .api-usage-progress-bar:not(.has-text) .api-usage-progress-text {
            display: none;
        }

        .api-usage-periods {
            display: flex;
            gap: var(--spacing-md);
            margin-top: var(--spacing-sm);
        }

        .api-usage-period {
            flex: 1;
        }

        .api-usage-period-label {
            font-size: 0.75rem;
            color: var(--muted);
            margin-bottom: var(--spacing-xs);
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        @media (max-width: 768px) {
            .api-usage-bar {
                margin: var(--spacing-md);
            }

            .api-usage-header {
                flex-direction: column;
                align-items: flex-start;
                gap: var(--spacing-sm);
            }

            .api-usage-stats {
                flex-direction: column;
                gap: var(--spacing-xs);
                width: 100%;
            }

            .api-usage-periods {
                flex-direction: column;
                gap: var(--spacing-sm);
            }
        }
    </style>
</head>
<body>
    <!-- Header -->
    <header class="header">
        <div class="header-content">
            <a href="/" class="logo">🔐 OTP Auth API</a>
            <div class="header-actions">
                <a href="/dashboard" class="btn btn-secondary">Developer Dashboard</a>
                <a href="#code-examples" class="btn btn-secondary">Get Started</a>
                <a href="#docs" class="btn btn-primary">Documentation</a>
            </div>
        </div>
    </header>

    <!-- API Usage Bar (shown for authenticated users) -->
    <div id="api-usage-bar" class="api-usage-bar">
        <div class="api-usage-header">
            <div class="api-usage-title">📊 API Usage</div>
            <div class="api-usage-stats">
                <div class="api-usage-stat">
                    <span class="api-usage-stat-label">Daily:</span>
                    <span class="api-usage-stat-value" id="daily-usage">-</span>
                    <span class="api-usage-stat-label">/</span>
                    <span class="api-usage-stat-value" id="daily-limit">-</span>
                </div>
                <div class="api-usage-stat">
                    <span class="api-usage-stat-label">Monthly:</span>
                    <span class="api-usage-stat-value" id="monthly-usage">-</span>
                    <span class="api-usage-stat-label">/</span>
                    <span class="api-usage-stat-value" id="monthly-limit">-</span>
                </div>
            </div>
        </div>
        <div class="api-usage-periods">
            <div class="api-usage-period">
                <div class="api-usage-period-label">Daily Usage</div>
                <div class="api-usage-progress-container">
                    <div class="api-usage-progress-bar" id="daily-progress">
                        <span class="api-usage-progress-text" id="daily-progress-text"></span>
                    </div>
                </div>
            </div>
            <div class="api-usage-period">
                <div class="api-usage-period-label">Monthly Usage</div>
                <div class="api-usage-progress-container">
                    <div class="api-usage-progress-bar" id="monthly-progress">
                        <span class="api-usage-progress-text" id="monthly-progress-text"></span>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Hero Section -->
    <section class="hero">
        <h1>Passwordless Authentication Made Simple</h1>
        <p>
            Secure, scalable OTP authentication API built for modern applications. 
            No passwords, no complexity—just email verification that works.
            <strong style="color: var(--accent);">Open-source and self-hostable.</strong> 🐼
        </p>
        <div class="hero-cta">
            <a href="/dashboard" class="btn btn-primary">Developer Dashboard</a>
            <a href="#code-examples" class="btn btn-secondary">Start Integrating</a>
            <a href="#self-hosting" class="btn btn-secondary">Self-Host Option</a>
        </div>
    </section>

    <!-- Features -->
    <section class="features">
        <h2>Why Choose OTP Auth?</h2>
        <div class="features-grid">
            <div class="feature-card">
                <div class="feature-icon">⚡</div>
                <h3>Lightning Fast</h3>
                <p>Built on Cloudflare Workers for global edge deployment. Sub-100ms response times worldwide.</p>
            </div>
            <div class="feature-card">
                <div class="feature-icon">🔒</div>
                <h3>Enterprise Security</h3>
                <p>Cryptographically secure OTP codes, JWT tokens, rate limiting, and comprehensive audit logging.</p>
            </div>
            <div class="feature-card">
                <div class="feature-icon">🚀</div>
                <h3>Easy Integration</h3>
                <p>Simple REST API that works with any framework. React, Svelte, Vue, or vanilla JavaScript—we've got you covered.</p>
            </div>
            <div class="feature-card">
                <div class="feature-icon">📊</div>
                <h3>Multi-Tenant Ready</h3>
                <p>Built for SaaS applications. Complete customer isolation, per-tenant rate limiting, and usage analytics.</p>
            </div>
            <div class="feature-card">
                <div class="feature-icon">💰</div>
                <h3>Cost Effective</h3>
                <p>Pay only for what you use. No infrastructure to manage, no servers to maintain.</p>
            </div>
            <div class="feature-card">
                <div class="feature-icon">🌍</div>
                <h3>Global Scale</h3>
                <p>Deployed on Cloudflare's edge network. Your users get the same fast experience anywhere in the world.</p>
            </div>
            <div class="feature-card">
                <div class="feature-icon">🔓</div>
                <h3>Open Source & Self-Hostable</h3>
                <p>Completely open-source on GitHub. Self-host with unlimited rate limits or wait for subscription tiers. 🐼</p>
            </div>
            <div class="feature-card">
                <div class="feature-icon">🎛️</div>
                <h3>Developer Dashboard</h3>
                <p>Manage API keys, view audit logs, monitor analytics, and track usage—all from a beautiful, intuitive dashboard.</p>
                <div style="margin-top: var(--spacing-md);">
                    <a href="/dashboard" class="btn btn-secondary" style="font-size: 0.875rem; padding: var(--spacing-sm) var(--spacing-md);">Open Dashboard →</a>
                </div>
            </div>
        </div>
    </section>

    <!-- Security Section -->
    <section class="security" id="security">
        <div class="security-content">
            <h2>Security You Can Trust</h2>
            <div class="security-grid">
                <div class="security-item">
                    <h3>🔐 Cryptographically Secure</h3>
                    <p>6-digit OTP codes generated using cryptographically secure random number generators. 1 million possible combinations.</p>
                </div>
                <div class="security-item">
                    <h3>⏱️ Time-Limited</h3>
                    <p>OTP codes expire after 10 minutes. Single-use only—once verified, the code is immediately invalidated.</p>
                </div>
                <div class="security-item">
                    <h3>🛡️ Brute Force Protection</h3>
                    <p>Maximum 5 verification attempts per OTP code. After that, a new code must be requested.</p>
                </div>
                <div class="security-item">
                    <h3>🚦 Rate Limiting</h3>
                    <p>3 OTP requests per email per hour. Prevents abuse and email spam while maintaining usability.</p>
                </div>
                <div class="security-item">
                    <h3>🎫 JWT Tokens</h3>
                    <p>HMAC-SHA256 signed tokens with 7-hour expiration. Token blacklisting for secure logout.</p>
                </div>
                <div class="security-item">
                    <h3>📝 Audit Logging</h3>
                    <p>Comprehensive security event logging with 90-day retention. Track all authentication attempts and failures.</p>
                </div>
                <div class="security-item">
                    <h3>🌐 CORS Protection</h3>
                    <p>Configurable CORS policies per customer. IP allowlisting for additional security layers.</p>
                </div>
                <div class="security-item">
                    <h3>✅ GDPR Compliant</h3>
                    <p>Data export and deletion endpoints. Complete user data portability and right to be forgotten.</p>
                </div>
            </div>
        </div>
    </section>

    <!-- Code Examples -->
    <section class="code-examples" id="code-examples">
        <h2>Get Started in Minutes</h2>
        <p style="text-align: center; color: var(--text-secondary); margin-bottom: var(--spacing-xl);">
            Choose your framework and start integrating. All examples use the same simple API.
        </p>
        
        <div class="code-tabs">
            <button class="code-tab active" onclick="switchTab('vanilla')">Vanilla JS/TS</button>
            <button class="code-tab" onclick="switchTab('react')">React</button>
            <button class="code-tab" onclick="switchTab('svelte')">Svelte</button>
        </div>

        <div id="vanilla" class="code-block active">
            <pre><code class="language-javascript">// Vanilla JavaScript/TypeScript Example
const API_URL = 'https://auth.idling.app';

// Step 1: Request OTP
async function requestOTP(email) {
  const response = await fetch(\`\${API_URL}/auth/request-otp\`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email })
  });
  
  if (!response.ok) {
    throw new Error('Failed to request OTP');
  }
  
  return await response.json();
}

// Step 2: Verify OTP
async function verifyOTP(email, otp) {
  const response = await fetch(\`\${API_URL}/auth/verify-otp\`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, otp })
  });
  
  if (!response.ok) {
    throw new Error('Invalid OTP');
  }
  
  const data = await response.json();
  // Store token securely
  localStorage.setItem('auth_token', data.token);
  return data;
}

// Step 3: Use token for authenticated requests
async function getCurrentUser() {
  const token = localStorage.getItem('auth_token');
  
  const response = await fetch(\`\${API_URL}/auth/me\`, {
    headers: {
      'Authorization': \`Bearer \${token}\`
    }
  });
  
  return await response.json();
}

// Usage
async function login() {
  const email = document.getElementById('email').value;
  
  // Request OTP
  await requestOTP(email);
  alert('Check your email for the OTP code!');
  
  // User enters OTP
  const otp = prompt('Enter 6-digit OTP:');
  
  // Verify OTP
  const user = await verifyOTP(email, otp);
  console.log('Logged in as:', user.email);
}</code></pre>
        </div>

        <div id="react" class="code-block">
            <pre><code class="language-jsx">// React Example
import React, { useState } from 'react';

const API_URL = 'https://auth.idling.app';

function LoginForm() {
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState('email');
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState(null);

  const requestOTP = async () => {
    setLoading(true);
    try {
      const response = await fetch(\`\${API_URL}/auth/request-otp\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      
      if (response.ok) {
        setStep('otp');
        alert('OTP sent to your email!');
      }
    } catch (error) {
      alert('Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const verifyOTP = async () => {
    setLoading(true);
    try {
      const response = await fetch(\`\${API_URL}/auth/verify-otp\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp })
      });
      
      const data = await response.json();
      if (response.ok) {
        setToken(data.token);
        localStorage.setItem('auth_token', data.token);
      }
    } catch (error) {
      alert('Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  if (token) {
    return <div>Welcome! You're logged in.</div>;
  }

  return (
    <div>
      {step === 'email' ? (
        <div>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
          />
          <button onClick={requestOTP} disabled={loading}>
            {loading ? 'Sending...' : 'Send OTP'}
          </button>
        </div>
      ) : (
        <div>
          <input
            type="text"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            placeholder="123456"
            maxLength={6}
          />
          <button onClick={verifyOTP} disabled={loading || otp.length !== 6}>
            {loading ? 'Verifying...' : 'Verify OTP'}
          </button>
          <button onClick={() => setStep('email')}>Back</button>
        </div>
      )}
    </div>
  );
}

export default LoginForm;</code></pre>
        </div>

        <div id="svelte" class="code-block">
            <pre><code class="language-svelte">&lt;!-- Svelte Example --&gt;
&lt;script&gt;
  let email = '';
  let otp = '';
  let step = 'email';
  let loading = false;
  let token = null;

  const API_URL = 'https://auth.idling.app';

  async function requestOTP() {
    loading = true;
    try {
      const response = await fetch(\`\${API_URL}/auth/request-otp\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      
      if (response.ok) {
        step = 'otp';
        alert('OTP sent to your email!');
      }
    } catch (error) {
      alert('Failed to send OTP');
    } finally {
      loading = false;
    }
  }

  async function verifyOTP() {
    loading = true;
    try {
      const response = await fetch(\`\${API_URL}/auth/verify-otp\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp })
      });
      
      const data = await response.json();
      if (response.ok) {
        token = data.token;
        localStorage.setItem('auth_token', data.token);
      }
    } catch (error) {
      alert('Invalid OTP');
    } finally {
      loading = false;
    }
  }
&lt;/script&gt;

{#if token}
  &lt;div&gt;Welcome! You're logged in.&lt;/div&gt;
{:else if step === 'email'}
  &lt;div&gt;
    &lt;input
      type="email"
      bind:value={email}
      placeholder="your@email.com"
      disabled={loading}
    /&gt;
    &lt;button on:click={requestOTP} disabled={loading || !email}&gt;
      {loading ? 'Sending...' : 'Send OTP'}
    &lt;/button&gt;
  &lt;/div&gt;
{:else}
  &lt;div&gt;
    &lt;input
      type="text"
      bind:value={otp}
      placeholder="123456"
      maxlength="6"
      disabled={loading}
    /&gt;
    &lt;button on:click={verifyOTP} disabled={loading || otp.length !== 6}&gt;
      {loading ? 'Verifying...' : 'Verify OTP'}
    &lt;/button&gt;
    &lt;button on:click={() => step = 'email'}&gt;Back&lt;/button&gt;
  &lt;/div&gt;
{/if}</code></pre>
        </div>
    </section>

    <!-- Limitations -->
    <section class="limitations">
        <h2>Limitations & Considerations</h2>
        <div class="limitations-list">
            <ul>
                <li>
                    <strong>Rate Limits</strong>
                    <p>3 OTP requests per email address per hour to prevent abuse and email spam.</p>
                </li>
                <li>
                    <strong>OTP Expiration</strong>
                    <p>OTP codes expire after 10 minutes. Users must request a new code if expired.</p>
                </li>
                <li>
                    <strong>Verification Attempts</strong>
                    <p>Maximum 5 verification attempts per OTP code. After that, a new code must be requested.</p>
                </li>
                <li>
                    <strong>Token Expiration</strong>
                    <p>JWT tokens expire after 7 hours. Use the refresh endpoint to extend sessions.</p>
                </li>
                <li>
                    <strong>Email Delivery</strong>
                    <p>OTP delivery depends on email provider reliability. Check spam folders if code doesn't arrive.</p>
                </li>
                <li>
                    <strong>Multi-Tenancy</strong>
                    <p>API key authentication required for multi-tenant features. Contact us for enterprise setup.</p>
                </li>
                <li>
                    <strong>Exceeded Free Tier?</strong>
                    <p>No problem! This application is open-source and can be self-hosted. Subscription tiers with enhanced rate limits are coming soon. 🐼</p>
                </li>
            </ul>
        </div>
    </section>

    <!-- Self-Hosting & Open Source Section -->
    <section class="self-hosting" id="self-hosting">
        <div class="self-hosting-content">
            <h2>Outgrown the Free Tier? We've Got You Covered 🐼</h2>
            <p class="self-hosting-subtitle">
                Great news! This application is completely open-source on GitHub, so you can self-host with unlimited rate limits. 
                Or sit tight—subscription tiers with enhanced limits are coming soon.
            </p>
            
            <div class="self-hosting-grid">
                <div class="self-hosting-card">
                    <h3>🔓 Self-Host on GitHub</h3>
                    <p>
                        The entire codebase is open-source and available on GitHub. Deploy it on your own infrastructure 
                        with complete control over rate limits, configuration, and data.
                    </p>
                    <ul>
                        <li>Unlimited rate limits</li>
                        <li>Full control over configuration</li>
                        <li>Complete data ownership</li>
                        <li>Custom email providers</li>
                        <li>Deploy anywhere (Cloudflare, AWS, GCP, etc.)</li>
                    </ul>
                    <div style="margin-top: var(--spacing-lg);">
                        <a href="https://github.com" target="_blank" rel="noopener noreferrer" class="btn btn-github">
                            <span>📦</span> View on GitHub
                        </a>
                    </div>
                </div>

                <div class="self-hosting-card">
                    <h3>⚡ Subscription Tiers <span class="coming-soon-badge">Coming Soon</span></h3>
                    <p>
                        Don't want to manage infrastructure? Subscription tiers with enhanced rate limits are on the way. 
                        Get notified when they launch and keep using our managed service.
                    </p>
                    <ul>
                        <li>Enhanced rate limits</li>
                        <li>Priority support</li>
                        <li>Advanced analytics</li>
                        <li>Custom email templates</li>
                        <li>Dedicated infrastructure</li>
                    </ul>
                    <div style="margin-top: var(--spacing-lg);">
                        <a href="#code-examples" class="btn btn-secondary">
                            Get Notified
                        </a>
                    </div>
                </div>

                <div class="self-hosting-card">
                    <h3>🚀 Why Choose Self-Hosting?</h3>
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
                    <div style="margin-top: var(--spacing-lg);">
                        <a href="#docs" class="btn btn-secondary">
                            View Documentation
                        </a>
                    </div>
                </div>
            </div>

            <div class="self-hosting-cta">
                <a href="https://github.com" target="_blank" rel="noopener noreferrer" class="btn btn-primary">
                    <span>⭐</span> Star on GitHub
                </a>
                <a href="#code-examples" class="btn btn-secondary">
                    Continue with Free Tier
                </a>
            </div>
        </div>
    </section>

    <!-- Technical Documentation (Accordions) -->
    <section class="code-examples" id="docs">
        <h2>Technical Documentation</h2>
        <p style="text-align: center; color: var(--text-secondary); margin-bottom: var(--spacing-xl);">
            Expand sections below for detailed technical information
        </p>

        <div class="accordion">
            <div class="accordion-header" onclick="toggleAccordion(this)">
                <h3>API Endpoints</h3>
                <span class="accordion-icon">▼</span>
            </div>
            <div class="accordion-content">
                <div class="accordion-body">
                    <h4>Interactive API Documentation (OpenAPI/Swagger)</h4>
                    <p style="margin-bottom: var(--spacing-md); color: var(--text-secondary);">
                        Explore and test all API endpoints with our interactive Swagger UI. You can try out requests directly from this interface:
                    </p>
                    <div id="swagger-ui" style="margin-top: var(--spacing-lg); min-height: 400px;"></div>
                    
                    <h4 style="margin-top: var(--spacing-2xl);">Quick Reference</h4>
                    <p style="margin-bottom: var(--spacing-md); color: var(--text-secondary);">
                        For a quick overview, here are the main endpoints:
                    </p>
                    
                    <h5>Authentication Endpoints</h5>
                    <ul>
                        <li><strong>POST /auth/request-otp</strong> - Request OTP code via email</li>
                        <li><strong>POST /auth/verify-otp</strong> - Verify OTP and receive JWT token</li>
                        <li><strong>GET /auth/me</strong> - Get current user info (requires Bearer token)</li>
                        <li><strong>POST /auth/logout</strong> - Logout and revoke token</li>
                        <li><strong>POST /auth/refresh</strong> - Refresh expiring JWT token</li>
                    </ul>

                    <h5>Public Endpoints</h5>
                    <ul>
                        <li><strong>POST /signup</strong> - Public customer signup</li>
                        <li><strong>POST /signup/verify</strong> - Verify signup email</li>
                        <li><strong>GET /health</strong> - Health check</li>
                        <li><strong>GET /health/ready</strong> - Readiness probe</li>
                        <li><strong>GET /health/live</strong> - Liveness probe</li>
                    </ul>
                </div>
            </div>
        </div>

        <div class="accordion">
            <div class="accordion-header" onclick="toggleAccordion(this)">
                <h3>Architecture</h3>
                <span class="accordion-icon">▼</span>
            </div>
            <div class="accordion-content">
                <div class="accordion-body">
                    <h4>System Architecture</h4>
                    <div class="mermaid-container">
                        <div class="mermaid">
graph TB
    Client["\`**Client Application**<br/>Web/Mobile App\`"] -->|"\`**1. Request OTP**\`"| API["\`**Cloudflare Worker**<br/>OTP Auth API\`"]
    API -->|"\`**2. Generate OTP**\`"| KV["\`**Cloudflare KV**<br/>Secure Storage\`"]
    API -->|"\`**3. Send Email**\`"| Email["\`**Email Service**<br/>Resend/SendGrid\`"]
    Email -->|"\`**4. Deliver OTP**\`"| User["\`**User Email**<br/>Inbox\`"]
    User -->|"\`**5. Enter OTP**\`"| Client
    Client -->|"\`**6. Verify OTP**\`"| API
    API -->|"\`**7. Validate**\`"| KV
    API -->|"\`**8. Issue JWT**\`"| Client
    Client -->|"\`**9. Authenticated Requests**\`"| API
    
    classDef clientStyle fill:#252017,stroke:#edae49,stroke-width:3px,color:#f9f9f9
    classDef apiStyle fill:#1a1611,stroke:#6495ed,stroke-width:3px,color:#f9f9f9
    classDef storageStyle fill:#252017,stroke:#28a745,stroke-width:3px,color:#f9f9f9
    classDef emailStyle fill:#1a1611,stroke:#f9df74,stroke-width:3px,color:#f9f9f9
    classDef userStyle fill:#252017,stroke:#edae49,stroke-width:3px,color:#f9f9f9
    
    class Client clientStyle
    class API apiStyle
    class KV storageStyle
    class Email emailStyle
    class User userStyle
</div>
                    </div>

                    <h4>Data Flow</h4>
                    <ol>
                        <li>Client requests OTP by sending email address</li>
                        <li>Worker generates cryptographically secure 6-digit code</li>
                        <li>OTP stored in KV with 10-minute TTL</li>
                        <li>Email sent via Resend/SendGrid with OTP code</li>
                        <li>User receives email and enters code</li>
                        <li>Client sends OTP for verification</li>
                        <li>Worker validates OTP against KV store</li>
                        <li>If valid, JWT token issued and OTP deleted</li>
                        <li>Client uses JWT for authenticated requests</li>
                    </ol>

                    <h4>Storage</h4>
                    <ul>
                        <li><strong>Cloudflare KV</strong> - OTP codes, user sessions, customer data</li>
                        <li><strong>JWT Tokens</strong> - Stateless authentication (no server-side storage)</li>
                        <li><strong>Token Blacklist</strong> - Stored in KV for logout/revocation</li>
                    </ul>
                </div>
            </div>
        </div>

        <div class="accordion">
            <div class="accordion-header" onclick="toggleAccordion(this)">
                <h3>Error Handling</h3>
                <span class="accordion-icon">▼</span>
            </div>
            <div class="accordion-content">
                <div class="accordion-body">
                    <h4>Error Response Format</h4>
                    <p>All errors follow RFC 7807 Problem Details format:</p>
                    <pre><code class="language-json">{
  "type": "https://tools.ietf.org/html/rfc7231#section-6.5.1",
  "title": "Bad Request",
  "status": 400,
  "detail": "Valid email address required",
  "instance": "https://auth.idling.app/auth/request-otp"
}</code></pre>

                    <h4>Common Error Codes</h4>
                    <ul>
                        <li><strong>400 Bad Request</strong> - Invalid input (email format, OTP format)</li>
                        <li><strong>401 Unauthorized</strong> - Invalid/expired token, invalid OTP</li>
                        <li><strong>404 Not Found</strong> - OTP not found or expired</li>
                        <li><strong>429 Too Many Requests</strong> - Rate limit or quota exceeded</li>
                        <li><strong>500 Internal Server Error</strong> - Server error</li>
                    </ul>

                    <h4>Rate Limit Headers</h4>
                    <p>Rate limit information included in response headers:</p>
                    <ul>
                        <li><strong>X-RateLimit-Limit</strong> - Maximum requests allowed</li>
                        <li><strong>X-RateLimit-Remaining</strong> - Remaining requests</li>
                        <li><strong>X-RateLimit-Reset</strong> - Time when limit resets (Unix timestamp)</li>
                        <li><strong>Retry-After</strong> - Seconds to wait before retrying (429 responses)</li>
                    </ul>
                </div>
            </div>
        </div>

        <div class="accordion">
            <div class="accordion-header" onclick="toggleAccordion(this)">
                <h3>Multi-Tenancy</h3>
                <span class="accordion-icon">▼</span>
            </div>
            <div class="accordion-content">
                <div class="accordion-body">
                    <h4>Customer Isolation</h4>
                    <p>All data is completely isolated per customer using KV key prefixes:</p>
                    <ul>
                        <li>OTP codes: <code>cust_{customerId}_otp_{emailHash}</code></li>
                        <li>User data: <code>cust_{customerId}_user_{userId}</code></li>
                        <li>Rate limits: <code>cust_{customerId}_ratelimit_{email}</code></li>
                    </ul>

                    <h4>API Key Authentication</h4>
                    <p>Multi-tenant features require API key authentication:</p>
                    <pre><code class="language-http">Authorization: Bearer otp_live_sk_...</code></pre>

                    <h4>Per-Customer Configuration</h4>
                    <ul>
                        <li>Custom email templates</li>
                        <li>Custom email providers (Resend, SendGrid, AWS SES)</li>
                        <li>Custom rate limits</li>
                        <li>Custom CORS policies</li>
                        <li>IP allowlisting</li>
                    </ul>
                </div>
            </div>
        </div>

        <div class="accordion">
            <div class="accordion-header" onclick="toggleAccordion(this)">
                <h3>Security Best Practices</h3>
                <span class="accordion-icon">▼</span>
            </div>
            <div class="accordion-content">
                <div class="accordion-body">
                    <h4>Token Storage</h4>
                    <ul>
                        <li><strong>Web Apps:</strong> Store in httpOnly cookies (preferred) or localStorage</li>
                        <li><strong>Mobile Apps:</strong> Use secure storage (Keychain/Keystore)</li>
                        <li><strong>Never:</strong> Store tokens in URL parameters or plain cookies</li>
                    </ul>

                    <h4>HTTPS Only</h4>
                    <p>Always use HTTPS in production. The API only accepts HTTPS connections.</p>

                    <h4>CORS Configuration</h4>
                    <p>Configure allowed origins in your customer settings to prevent unauthorized access.</p>

                    <h4>IP Allowlisting</h4>
                    <p>For additional security, configure IP allowlists in customer settings.</p>

                    <h4>Token Refresh</h4>
                    <p>Implement automatic token refresh before expiration to maintain seamless user experience.</p>
                </div>
            </div>
        </div>
    </section>

    <!-- Footer -->
    <footer class="footer">
        <p>OTP Authentication API - Powered by Cloudflare Workers</p>
        <p style="margin-top: var(--spacing-sm); font-size: 0.875rem;">
            Part of the Strixun Stream Suite
        </p>
    </footer>

    <script>
        // Wait for DOM and scripts to be ready
        (function() {
            // Tab switching - can be called immediately
            window.switchTab = function switchTab(tabName) {
            // Hide all code blocks
            document.querySelectorAll('.code-block').forEach(block => {
                block.classList.remove('active');
            });
            
            // Remove active class from all tabs
            document.querySelectorAll('.code-tab').forEach(tab => {
                tab.classList.remove('active');
            });
            
            // Show selected code block
            document.getElementById(tabName).classList.add('active');
            
            // Add active class to clicked tab
            if (event && event.target) {
                event.target.classList.add('active');
            }
            
            // Re-highlight code after tab switch
            setTimeout(() => {
                if (typeof Prism !== 'undefined') {
                    Prism.highlightAll();
                }
            }, 50);
        }

        // Accordion toggle
        function toggleAccordion(header) {
            const accordion = header.parentElement;
            const isActive = accordion.classList.contains('active');
            
            // Close all accordions
            document.querySelectorAll('.accordion').forEach(acc => {
                acc.classList.remove('active');
            });
            
            // Open clicked accordion if it wasn't active
            if (!isActive) {
                accordion.classList.add('active');
                
                // Re-render Mermaid diagrams when Architecture accordion opens
                const accordionTitle = header.querySelector('h3')?.textContent || '';
                if (accordionTitle.includes('Architecture') && typeof mermaid !== 'undefined') {
                    setTimeout(() => {
                        const mermaidElements = accordion.querySelectorAll('.mermaid:not([data-processed])');
                        if (mermaidElements.length > 0) {
                            mermaidElements.forEach((el) => {
                                el.dataset.processed = 'true';
                            });
                            mermaid.run();
                        }
                    }, 100);
                }
            }
        }

        // Smooth scroll for anchor links
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function (e) {
                e.preventDefault();
                const target = document.querySelector(this.getAttribute('href'));
                if (target) {
                    target.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                }
            });
        });


        // API Usage Bar functionality
        const API_URL = window.location.origin;
        const usageBar = document.getElementById('api-usage-bar');
        
        async function loadApiUsage() {
            const token = localStorage.getItem('auth_token');
            if (!token) {
                usageBar.classList.remove('visible');
                return;
            }

            try {
                const response = await fetch(\`\${API_URL}/auth/quota\`, {
                    headers: {
                        'Authorization': \`Bearer \${token}\`,
                        'Content-Type': 'application/json'
                    }
                });

                if (!response.ok) {
                    // If unauthorized, hide the bar
                    if (response.status === 401) {
                        usageBar.classList.remove('visible');
                        localStorage.removeItem('auth_token');
                    }
                    return;
                }

                const data = await response.json();
                if (!data.success || !data.quota || !data.usage) {
                    return;
                }

                // Show the bar
                usageBar.classList.add('visible');

                // Update daily stats
                const dailyUsage = data.usage.daily || 0;
                const dailyLimit = data.quota.otpRequestsPerDay || 1000;
                const dailyRemaining = data.usage.remainingDaily || (dailyLimit - dailyUsage);
                const dailyPercent = Math.min(100, (dailyUsage / dailyLimit) * 100);

                document.getElementById('daily-usage').textContent = dailyUsage.toLocaleString();
                document.getElementById('daily-limit').textContent = dailyLimit.toLocaleString();

                const dailyProgress = document.getElementById('daily-progress');
                dailyProgress.style.width = \`\${dailyPercent}%\`;
                dailyProgress.classList.remove('warning', 'danger', 'has-text');
                
                if (dailyPercent >= 90) {
                    dailyProgress.classList.add('danger');
                } else if (dailyPercent >= 75) {
                    dailyProgress.classList.add('warning');
                }
                
                if (dailyPercent > 10) {
                    dailyProgress.classList.add('has-text');
                    document.getElementById('daily-progress-text').textContent = 
                        \`\${Math.round(dailyPercent)}%\`;
                }

                // Update monthly stats
                const monthlyUsage = data.usage.monthly || 0;
                const monthlyLimit = data.quota.otpRequestsPerMonth || 10000;
                const monthlyRemaining = data.usage.remainingMonthly || (monthlyLimit - monthlyUsage);
                const monthlyPercent = Math.min(100, (monthlyUsage / monthlyLimit) * 100);

                document.getElementById('monthly-usage').textContent = monthlyUsage.toLocaleString();
                document.getElementById('monthly-limit').textContent = monthlyLimit.toLocaleString();

                const monthlyProgress = document.getElementById('monthly-progress');
                monthlyProgress.style.width = \`\${monthlyPercent}%\`;
                monthlyProgress.classList.remove('warning', 'danger', 'has-text');
                
                if (monthlyPercent >= 90) {
                    monthlyProgress.classList.add('danger');
                } else if (monthlyPercent >= 75) {
                    monthlyProgress.classList.add('warning');
                }
                
                if (monthlyPercent > 10) {
                    monthlyProgress.classList.add('has-text');
                    document.getElementById('monthly-progress-text').textContent = 
                        \`\${Math.round(monthlyPercent)}%\`;
                }
            } catch (error) {
                console.error('Failed to load API usage:', error);
                usageBar.classList.remove('visible');
            }
        }

        // Load usage on page load
        loadApiUsage();

        // Refresh usage every 30 seconds if user is authenticated
        setInterval(() => {
            if (localStorage.getItem('auth_token')) {
                loadApiUsage();
            }
        }, 30000);

        // Initialize Swagger UI when API Endpoints accordion is opened
        let swaggerInitialized = false;
        function initSwagger() {
            if (swaggerInitialized) return;
            
            const swaggerContainer = document.getElementById('swagger-ui');
            if (!swaggerContainer) {
                console.warn('Swagger UI container not found');
                return;
            }
            
            // Clear container in case of re-initialization
            swaggerContainer.innerHTML = '';
            
            if (typeof SwaggerUIBundle !== 'undefined' && typeof SwaggerUIStandalonePreset !== 'undefined') {
                swaggerInitialized = true;
                try {
                    window.ui = SwaggerUIBundle({
                        url: '/openapi.json',
                        dom_id: '#swagger-ui',
                        presets: [
                            SwaggerUIBundle.presets.apis,
                            SwaggerUIStandalonePreset
                        ],
                        layout: 'StandaloneLayout',
                        deepLinking: true,
                        defaultModelsExpandDepth: 1,
                        defaultModelExpandDepth: 1,
                        docExpansion: 'list',
                        filter: true,
                        showExtensions: true,
                        showCommonExtensions: true,
                        tryItOutEnabled: true,
                        requestSnippetsEnabled: true,
                        onComplete: function() {
                            // Customize Swagger UI to match design system
                            const style = document.createElement('style');
                            style.id = 'swagger-custom-styles';
                            style.textContent = \`
                                .swagger-ui .topbar { display: none; }
                                .swagger-ui .info { margin: var(--spacing-lg) 0; color: var(--text); }
                                .swagger-ui .scheme-container { background: var(--card); padding: var(--spacing-md); border-radius: var(--radius-md); margin: var(--spacing-md) 0; }
                                .swagger-ui .opblock { background: var(--card); border: 1px solid var(--border); border-radius: var(--radius-md); margin: var(--spacing-md) 0; }
                                .swagger-ui .opblock.opblock-post { border-left: 4px solid var(--accent); }
                                .swagger-ui .opblock.opblock-get { border-left: 4px solid var(--info); }
                                .swagger-ui .opblock.opblock-put { border-left: 4px solid var(--warning); }
                                .swagger-ui .opblock.opblock-delete { border-left: 4px solid var(--danger); }
                                .swagger-ui .opblock-tag { color: var(--accent); }
                                .swagger-ui .opblock-summary { color: var(--text); }
                                .swagger-ui .opblock-description-wrapper p { color: var(--text-secondary); }
                                .swagger-ui input, .swagger-ui select, .swagger-ui textarea { background: var(--bg-dark); border: 1px solid var(--border); color: var(--text); }
                                .swagger-ui .btn { background: var(--accent); color: #000; border: none; }
                                .swagger-ui .btn:hover { background: var(--accent-light); }
                                .swagger-ui .response-col_status { color: var(--text); }
                                .swagger-ui code { background: var(--bg-dark); color: var(--accent); }
                                .swagger-ui pre { background: var(--bg-dark); border: 1px solid var(--border); }
                                .swagger-ui .model-box { background: var(--card); border: 1px solid var(--border); }
                                .swagger-ui .model-title { color: var(--accent); }
                            \`;
                            // Remove old style if exists
                            const oldStyle = document.getElementById('swagger-custom-styles');
                            if (oldStyle) oldStyle.remove();
                            document.head.appendChild(style);
                            console.log('Swagger UI initialized successfully');
                        },
                        onFailure: function(error) {
                            console.error('Swagger UI initialization failed:', error);
                            swaggerInitialized = false;
                        }
                    });
                } catch (error) {
                    console.error('Error initializing Swagger UI:', error);
                    swaggerInitialized = false;
                }
            } else {
                console.warn('SwaggerUIBundle or SwaggerUIStandalonePreset not loaded yet');
            }
        }

        // Watch for API Endpoints accordion opening
        function setupSwaggerWatcher() {
            const apiEndpointsHeader = Array.from(document.querySelectorAll('.accordion-header')).find(
                h => h.querySelector('h3')?.textContent?.includes('API Endpoints')
            );
            
            if (apiEndpointsHeader) {
                const originalToggle = window.toggleAccordion;
                
                window.toggleAccordion = function(header) {
                    if (originalToggle) originalToggle(header);
                    if (header === apiEndpointsHeader && header.parentElement.classList.contains('active')) {
                        // Wait a bit for accordion animation, then initialize Swagger
                        setTimeout(() => {
                            const checkAndInitSwagger = () => {
                                if (typeof SwaggerUIBundle !== 'undefined' && typeof SwaggerUIStandalonePreset !== 'undefined') {
                                    initSwagger();
                                } else {
                                    setTimeout(checkAndInitSwagger, 100);
                                }
                            };
                            checkAndInitSwagger();
                        }, 200);
                    }
                };
            }
        }
        
        // Setup watcher when DOM is ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', setupSwaggerWatcher);
        } else {
            setupSwaggerWatcher();
        }
        
        // Initialize Prism syntax highlighting
        function initPrismHighlighting() {
            if (typeof Prism !== 'undefined') {
                Prism.highlightAll();
                console.log('Prism.js initialized - syntax highlighting active');
            } else {
                setTimeout(initPrismHighlighting, 100);
            }
        }
        
        // Initialize Mermaid diagrams
        function initMermaidDiagrams() {
            if (typeof mermaid !== 'undefined') {
                mermaid.initialize({
                    startOnLoad: false, // We'll manually trigger rendering
                    theme: 'dark',
                    themeVariables: {
                        primaryColor: '#edae49',
                        primaryTextColor: '#1a1611',
                        primaryBorderColor: '#c68214',
                        secondaryColor: '#252017',
                        secondaryTextColor: '#f9f9f9',
                        secondaryBorderColor: '#3d3627',
                        tertiaryColor: '#1a1611',
                        tertiaryTextColor: '#f9f9f9',
                        tertiaryBorderColor: '#4a4336',
                        background: '#0f0e0b',
                        mainBkg: '#252017',
                        secondBkg: '#1a1611',
                        tertiaryBkg: '#0f0e0b',
                        textColor: '#f9f9f9',
                        primaryTextColor: '#1a1611',
                        secondaryTextColor: '#b8b8b8',
                        tertiaryTextColor: '#888',
                        border1: '#3d3627',
                        border2: '#4a4336',
                        border3: '#c68214',
                        lineColor: '#6495ed',
                        primaryBorderColor: '#c68214',
                        secondaryBorderColor: '#3d3627',
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
                console.log('Mermaid initialized - diagrams will render when accordions open');
            } else {
                setTimeout(initMermaidDiagrams, 100);
            }
        }
        
        // Initialize everything when page is ready
        function initAll() {
            initPrismHighlighting();
            initMermaidDiagrams();
        }
        
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initAll);
        } else {
            initAll();
        }

    </script>
</body>
</html>


`;