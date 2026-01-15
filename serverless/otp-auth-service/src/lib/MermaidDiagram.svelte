<script lang="ts">
  import { onMount } from 'svelte';
  import mermaid from 'mermaid';

  export let diagram: string;
  export let id: string = `mermaid-${Math.random().toString(36).substr(2, 9)}`;

  onMount(() => {
    mermaid.initialize({
      startOnLoad: true,
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
        // Sequence diagram specific colors
        actorBkg: '#252017',
        actorBorder: '#edae49',
        actorTextColor: '#f9f9f9',
        actorLineColor: '#6495ed',
        signalColor: '#f9f9f9',
        signalTextColor: '#f9f9f9',
        labelBoxBkgColor: '#1a1611',
        labelBoxBorderColor: '#3d3627',
        labelTextColor: '#f9f9f9',
        loopTextColor: '#f9f9f9',
        noteBorderColor: '#edae49',
        noteBkgColor: '#252017',
        noteTextColor: '#f9f9f9',
        activationBorderColor: '#6495ed',
        activationBkgColor: 'rgba(100, 149, 237, 0.2)',
        sequenceNumberColor: '#f9f9f9',
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
      },
      sequence: {
        useMaxWidth: true,
        diagramMarginX: 50,
        diagramMarginY: 10,
        actorMargin: 50,
        width: 150,
        height: 65,
        boxMargin: 10,
        boxTextMargin: 5,
        noteMargin: 10,
        messageMargin: 35
      }
    });
    
    mermaid.run();
  });
</script>

<div class="mermaid-container">
  <div class="mermaid" id={id}>
    {diagram}
  </div>
</div>

<style>
  .mermaid-container {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: var(--spacing-lg);
    margin: var(--spacing-lg) 0;
    overflow-x: auto;
  }

  .mermaid-container :global(.mermaid) {
    display: flex;
    justify-content: center;
    align-items: center;
  }
</style>

