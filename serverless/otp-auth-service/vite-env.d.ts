/// <reference types="svelte" />
/// <reference types="vite/client" />

// Allow importing HTML files as text (esbuild --loader:.html=text)
declare module '*.html' {
    const content: string;
    export default content;
}

// Allow importing CSS files as text (esbuild --loader:.css=text)
declare module '*.css' {
    const content: string;
    export default content;
}

// Allow importing .tpl template files as text (esbuild --loader:.tpl=text)
// Used for JavaScript templates embedded in generated HTML
declare module '*.tpl' {
    const content: string;
    export default content;
}
