<!--
    ErrorDisplay Component (Svelte)
    
    A user-friendly error display component that properly parses and renders:
    - RFC 7807 Problem Details errors
    - Standard Error objects
    - Plain string messages
    - Unknown error types
    
    @see https://tools.ietf.org/html/rfc7807
-->

<script lang="ts">
    // ============================================================================
    // Types
    // ============================================================================

    interface ErrorDisplayTheme {
        background?: string;
        border?: string;
        danger?: string;
        textSecondary?: string;
        text?: string;
        buttonBg?: string;
        buttonText?: string;
    }

    interface ParsedError {
        title: string;
        detail: string;
        status?: number;
        instance?: string;
    }

    interface RFC7807Shape {
        type?: string;
        title?: string;
        status?: number;
        detail?: string;
        instance?: string;
    }

    // ============================================================================
    // Props
    // ============================================================================

    /** The error to display - can be any type */
    export let error: unknown;
    /** Callback when retry button is clicked */
    export let onRetry: (() => void) | undefined = undefined;
    /** Text for the retry button */
    export let retryText: string = 'Retry';
    /** Theme colors */
    export let theme: ErrorDisplayTheme = {};
    /** Minimum height for the container */
    export let minHeight: string = '300px';
    /** Whether to show the instance/path info */
    export let showInstance: boolean = true;
    /** Whether to show the status code */
    export let showStatus: boolean = true;

    // ============================================================================
    // Default Theme
    // ============================================================================

    const defaultTheme: Required<ErrorDisplayTheme> = {
        background: '#1a1611',
        border: '#dc3545',
        danger: '#dc3545',
        textSecondary: '#888888',
        text: '#f9f9f9',
        buttonBg: '#edae49',
        buttonText: '#1a1611',
    };

    // ============================================================================
    // Error Parsing
    // ============================================================================

    function isRFC7807Like(obj: unknown): obj is RFC7807Shape {
        if (typeof obj !== 'object' || obj === null) return false;
        const o = obj as Record<string, unknown>;
        return (
            (typeof o.title === 'string' || typeof o.detail === 'string') &&
            (o.status === undefined || typeof o.status === 'number')
        );
    }

    function tryParseJSON(str: string): unknown | null {
        try {
            return JSON.parse(str);
        } catch {
            return null;
        }
    }

    function extractMessageParts(message: string): { prefix: string; jsonPart: RFC7807Shape | null } {
        // Check for pattern: "Some message: {json}"
        const colonJsonMatch = message.match(/^(.+?):\s*(\{.+\})$/s);
        if (colonJsonMatch) {
            const prefix = colonJsonMatch[1];
            const jsonStr = colonJsonMatch[2];
            const parsed = tryParseJSON(jsonStr);
            if (parsed && isRFC7807Like(parsed)) {
                return { prefix, jsonPart: parsed };
            }
        }
        
        // Check if the whole string is JSON
        if (message.trim().startsWith('{')) {
            const parsed = tryParseJSON(message);
            if (parsed && isRFC7807Like(parsed)) {
                return { prefix: '', jsonPart: parsed };
            }
        }
        
        return { prefix: '', jsonPart: null };
    }

    function parseError(err: unknown): ParsedError {
        // Handle null/undefined
        if (err == null) {
            return {
                title: 'Unknown Error',
                detail: 'An unexpected error occurred.',
            };
        }

        // Handle RFC 7807 object directly
        if (isRFC7807Like(err)) {
            return {
                title: err.title || 'Error',
                detail: err.detail || 'An error occurred.',
                status: err.status,
                instance: err.instance,
            };
        }

        // Handle Error objects
        if (err instanceof Error) {
            const message = err.message;
            
            const { prefix, jsonPart } = extractMessageParts(message);
            if (jsonPart) {
                return {
                    title: jsonPart.title || prefix || 'Error',
                    detail: jsonPart.detail || message,
                    status: jsonPart.status,
                    instance: jsonPart.instance,
                };
            }
            
            return {
                title: 'Error',
                detail: message || 'An error occurred.',
            };
        }

        // Handle string errors
        if (typeof err === 'string') {
            const { prefix, jsonPart } = extractMessageParts(err);
            if (jsonPart) {
                return {
                    title: jsonPart.title || prefix || 'Error',
                    detail: jsonPart.detail || err,
                    status: jsonPart.status,
                    instance: jsonPart.instance,
                };
            }
            
            return {
                title: 'Error',
                detail: err,
            };
        }

        // Handle objects with message property
        if (typeof err === 'object' && 'message' in err) {
            const msg = (err as { message: unknown }).message;
            if (typeof msg === 'string') {
                const { prefix, jsonPart } = extractMessageParts(msg);
                if (jsonPart) {
                    return {
                        title: jsonPart.title || prefix || 'Error',
                        detail: jsonPart.detail || msg,
                        status: jsonPart.status,
                        instance: jsonPart.instance,
                    };
                }
                return {
                    title: 'Error',
                    detail: msg,
                };
            }
        }

        // Ultimate fallback
        return {
            title: 'Unknown Error',
            detail: 'An unexpected error occurred.',
        };
    }

    // ============================================================================
    // Reactive
    // ============================================================================

    $: mergedTheme = { ...defaultTheme, ...theme };
    $: parsed = parseError(error);
    $: titleDisplay = showStatus && parsed.status 
        ? `${parsed.status} - ${parsed.title}` 
        : parsed.title;
</script>

<div 
    class="error-display" 
    style="min-height: {minHeight};"
>
    <!-- Icon -->
    <div class="error-icon">
        <slot name="icon">⚠</slot>
    </div>

    <!-- Title with optional status -->
    <div 
        class="error-title" 
        style="color: {mergedTheme.danger};"
    >
        {titleDisplay}
    </div>

    <!-- Detail message -->
    <div 
        class="error-detail"
        style="
            background: {mergedTheme.background};
            border-color: {mergedTheme.border};
            color: {mergedTheme.textSecondary};
        "
    >
        {parsed.detail}
    </div>

    <!-- Instance/path info -->
    {#if showInstance && parsed.instance}
        <div 
            class="error-instance"
            style="color: {mergedTheme.textSecondary};"
        >
            Endpoint: {parsed.instance}
        </div>
    {/if}

    <!-- Retry button -->
    {#if onRetry}
        <button
            class="error-retry-btn"
            style="
                background-color: {mergedTheme.buttonBg};
                color: {mergedTheme.buttonText};
            "
            on:click={onRetry}
        >
            {retryText}
        </button>
    {/if}
</div>

<style>
    .error-display {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 2rem;
        text-align: center;
    }

    .error-icon {
        font-size: 3rem;
        margin-bottom: 1rem;
    }

    .error-title {
        font-size: 1.5rem;
        font-weight: 600;
        margin-bottom: 1rem;
    }

    .error-detail {
        font-size: 0.875rem;
        max-width: 500px;
        padding: 1rem;
        border-radius: 8px;
        border-width: 1px;
        border-style: solid;
        word-break: break-word;
        margin-bottom: 0.5rem;
    }

    .error-instance {
        font-size: 0.75rem;
        margin-bottom: 1rem;
        font-family: monospace;
    }

    .error-retry-btn {
        margin-top: 1rem;
        padding: 0.625rem 1.5rem;
        border: none;
        border-radius: 6px;
        font-size: 0.875rem;
        font-weight: 600;
        cursor: pointer;
        transition: opacity 0.2s ease;
    }

    .error-retry-btn:hover {
        opacity: 0.9;
    }
</style>
