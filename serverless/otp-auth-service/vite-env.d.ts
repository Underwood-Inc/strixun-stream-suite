/// <reference types="svelte" />
/// <reference types="vite/client" />

// Allow importing HTML files as text (esbuild --loader:.html=text)
declare module '*.html' {
    const content: string;
    export default content;
}
