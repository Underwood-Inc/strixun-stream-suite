/**
 * ErrorDisplay Component
 * 
 * A user-friendly error display component that properly parses and renders:
 * - RFC 7807 Problem Details errors
 * - Standard Error objects
 * - Plain string messages
 * - Unknown error types
 * 
 * @see https://tools.ietf.org/html/rfc7807
 */

import React from 'react';

// ============================================================================
// Types
// ============================================================================

/**
 * Theme configuration for ErrorDisplay
 */
export interface ErrorDisplayTheme {
    /** Background color of the container */
    background?: string;
    /** Border color */
    border?: string;
    /** Error/danger color for title */
    danger?: string;
    /** Secondary text color */
    textSecondary?: string;
    /** Primary text color */
    text?: string;
    /** Button background color */
    buttonBg?: string;
    /** Button text color */
    buttonText?: string;
}

/**
 * Props for ErrorDisplay component
 */
export interface ErrorDisplayProps {
    /** The error to display - can be any type */
    error: unknown;
    /** Callback when retry button is clicked */
    onRetry?: () => void;
    /** Text for the retry button */
    retryText?: string;
    /** Theme colors */
    theme?: ErrorDisplayTheme;
    /** Custom CSS class */
    className?: string;
    /** Custom inline styles */
    style?: React.CSSProperties;
    /** Minimum height for the container */
    minHeight?: string;
    /** Icon to display (default: warning triangle) */
    icon?: React.ReactNode;
    /** Whether to show the instance/path info */
    showInstance?: boolean;
    /** Whether to show the status code */
    showStatus?: boolean;
}

/**
 * Parsed error structure
 */
interface ParsedError {
    title: string;
    detail: string;
    status?: number;
    instance?: string;
}

/**
 * RFC 7807 error shape
 */
interface RFC7807Shape {
    type?: string;
    title?: string;
    status?: number;
    detail?: string;
    instance?: string;
}

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

/**
 * Check if an object looks like an RFC 7807 error
 */
function isRFC7807Like(obj: unknown): obj is RFC7807Shape {
    if (typeof obj !== 'object' || obj === null) return false;
    const o = obj as Record<string, unknown>;
    // Must have at least title or detail, and optionally status
    return (
        (typeof o.title === 'string' || typeof o.detail === 'string') &&
        (o.status === undefined || typeof o.status === 'number')
    );
}

/**
 * Try to parse a string as JSON
 */
function tryParseJSON(str: string): unknown | null {
    try {
        return JSON.parse(str);
    } catch {
        return null;
    }
}

/**
 * Extract message from various error message formats
 * Handles patterns like "Failed to list customers: {json...}"
 */
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

/**
 * Parse any error type into a user-friendly format
 */
export function parseError(error: unknown): ParsedError {
    // Handle null/undefined
    if (error == null) {
        return {
            title: 'Unknown Error',
            detail: 'An unexpected error occurred.',
        };
    }

    // Handle RFC 7807 object directly
    if (isRFC7807Like(error)) {
        return {
            title: error.title || 'Error',
            detail: error.detail || 'An error occurred.',
            status: error.status,
            instance: error.instance,
        };
    }

    // Handle Error objects
    if (error instanceof Error) {
        const message = error.message;
        
        // Try to extract RFC 7807 from message
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
    if (typeof error === 'string') {
        // Try to extract RFC 7807 from string
        const { prefix, jsonPart } = extractMessageParts(error);
        if (jsonPart) {
            return {
                title: jsonPart.title || prefix || 'Error',
                detail: jsonPart.detail || error,
                status: jsonPart.status,
                instance: jsonPart.instance,
            };
        }
        
        return {
            title: 'Error',
            detail: error,
        };
    }

    // Handle objects with message property
    if (typeof error === 'object' && 'message' in error) {
        const msg = (error as { message: unknown }).message;
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
// Component
// ============================================================================

/**
 * ErrorDisplay - User-friendly error display component
 * 
 * Parses RFC 7807 errors and other error formats into a clean, readable display.
 * 
 * @example
 * ```tsx
 * <ErrorDisplay 
 *     error={error} 
 *     onRetry={() => refetch()} 
 *     retryText="Try Again"
 * />
 * ```
 */
export const ErrorDisplay: React.FC<ErrorDisplayProps> = ({
    error,
    onRetry,
    retryText = 'Retry',
    theme: userTheme,
    className,
    style,
    minHeight = '300px',
    icon,
    showInstance = true,
    showStatus = true,
}) => {
    const theme = { ...defaultTheme, ...userTheme };
    const parsed = parseError(error);

    return (
        <div
            className={className}
            style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '2rem',
                textAlign: 'center',
                minHeight,
                ...style,
            }}
        >
            {/* Icon */}
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>
                {icon ?? '⚠'}
            </div>

            {/* Title with optional status */}
            <div
                style={{
                    fontSize: '1.5rem',
                    fontWeight: 600,
                    marginBottom: '1rem',
                    color: theme.danger,
                }}
            >
                {showStatus && parsed.status ? `${parsed.status} - ` : ''}
                {parsed.title}
            </div>

            {/* Detail message */}
            <div
                style={{
                    fontSize: '0.875rem',
                    color: theme.textSecondary,
                    maxWidth: '500px',
                    padding: '1rem',
                    background: theme.background,
                    borderRadius: '8px',
                    border: `1px solid ${theme.border}`,
                    wordBreak: 'break-word',
                    marginBottom: '0.5rem',
                }}
            >
                {parsed.detail}
            </div>

            {/* Instance/path info */}
            {showInstance && parsed.instance && (
                <div
                    style={{
                        fontSize: '0.75rem',
                        color: theme.textSecondary,
                        marginBottom: '1rem',
                        fontFamily: 'monospace',
                    }}
                >
                    Endpoint: {parsed.instance}
                </div>
            )}

            {/* Retry button */}
            {onRetry && (
                <button
                    onClick={onRetry}
                    style={{
                        marginTop: '1rem',
                        padding: '0.625rem 1.5rem',
                        backgroundColor: theme.buttonBg,
                        color: theme.buttonText,
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '0.875rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'opacity 0.2s ease',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.9'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
                >
                    {retryText}
                </button>
            )}
        </div>
    );
};

export default ErrorDisplay;
