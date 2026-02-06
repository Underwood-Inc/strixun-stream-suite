/**
 * Mermaid.js initialization with Strixun theme
 */
mermaid.initialize({ 
    startOnLoad: true, 
    theme: 'dark',
    themeVariables: {
        primaryColor: '#edae49',
        primaryTextColor: '#1a1611',
        primaryBorderColor: '#edae49',
        lineColor: '#b8b8b8',
        secondaryColor: '#252017',
        tertiaryColor: '#1a1611',
        background: '#1a1611',
        mainBkg: '#252017',
        secondBkg: '#1a1611',
        nodeBorder: '#edae49',
        clusterBkg: '#252017',
        clusterBorder: '#3d3627',
        titleColor: '#edae49',
        edgeLabelBackground: '#252017',
        actorTextColor: '#f9f9f9',
        actorBkg: '#252017',
        actorBorder: '#edae49',
        signalColor: '#f9f9f9',
        signalTextColor: '#f9f9f9',
        noteBkgColor: '#252017',
        noteTextColor: '#f9f9f9',
        noteBorderColor: '#3d3627',
        labelTextColor: '#f9f9f9',
        loopTextColor: '#f9f9f9'
    },
    sequence: {
        actorMargin: 80,
        width: 180,
        height: 50,
        boxMargin: 10,
        boxTextMargin: 5,
        noteMargin: 10,
        messageMargin: 35,
        messageFontSize: 12,
        wrap: true,
        wrapPadding: 10
    }
});
