/**
 * URL Shortener API Client
 * TypeScript client for URL shortener API
 */

// CRITICAL: NO FALLBACKS ON LOCAL - Always use localhost in development
function getApiUrl(): string {
    if (typeof window === 'undefined') {
        return 'https://s.idling.app';
    }
    
    const isLocalhost = window.location.hostname === 'localhost' || 
                        window.location.hostname === '127.0.0.1' ||
                        import.meta.env?.DEV ||
                        import.meta.env?.MODE === 'development';
    
    if (isLocalhost) {
        // NEVER fall back to production when on localhost
        // URL shortener worker runs on port 8793
        return 'http://localhost:8793';
    }
    
    // Only use production URL if NOT on localhost
    return window.location.origin;
}

const API_URL = getApiUrl();

export interface ShortUrl {
    shortCode: string;
    shortUrl: string;
    url: string;
    createdAt: string;
    clickCount: number;
}

export interface CreateUrlRequest {
    url: string;
    customCode?: string;
}

export interface CreateUrlResponse {
    success: boolean;
    shortUrl?: string;
    error?: string;
}

export interface ListUrlsResponse {
    success: boolean;
    urls?: ShortUrl[];
    error?: string;
}

export interface DeleteUrlResponse {
    success: boolean;
    error?: string;
}

export interface StatsResponse {
    success: boolean;
    totalUrls?: number;
    error?: string;
}

class UrlShortenerApiClient {
    private token: string | null = null;

    constructor() {
        // Load token from localStorage
        if (typeof window !== 'undefined') {
            this.token = localStorage.getItem('urlShortenerToken');
        }
    }

    setToken(token: string | null): void {
        this.token = token;
        if (typeof window !== 'undefined') {
            if (token) {
                localStorage.setItem('urlShortenerToken', token);
            } else {
                localStorage.removeItem('urlShortenerToken');
            }
        }
    }

    getToken(): string | null {
        return this.token;
    }

    private async decryptResponse<T>(response: Response): Promise<T> {
        // Check if response is encrypted (headers are case-insensitive, but be defensive)
        const encryptedHeader = response.headers.get('X-Encrypted') || response.headers.get('x-encrypted');
        const isEncrypted = encryptedHeader === 'true';
        
        let data: any = await response.json();
        
        // Check if data looks encrypted (even if header check failed)
        const looksEncrypted = data && typeof data === 'object' && 'encrypted' in data && data.encrypted === true;
        
        if ((isEncrypted || looksEncrypted) && this.token) {
            // Wait for decryptWithJWT to be available (it's loaded via script tag)
            let decryptFn = (window as any).decryptWithJWT;
            
            // Poll for decryptWithJWT if not immediately available (script might still be loading)
            if (typeof decryptFn !== 'function') {
                console.warn('[API Client] Decryption library not loaded yet, waiting...');
                for (let i = 0; i < 10; i++) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                    decryptFn = (window as any).decryptWithJWT;
                    if (typeof decryptFn === 'function') {
                        console.log('[API Client] Decryption library loaded after wait');
                        break;
                    }
                }
            }
            
            if (typeof decryptFn !== 'function') {
                console.error('[API Client] Decryption library not available after waiting. Response is encrypted but cannot decrypt.');
                throw new Error('Decryption library not loaded');
            }
            
            try {
                // Trim token to ensure it matches what backend used for encryption
                const trimmedToken = this.token.trim();
                data = await decryptFn(data, trimmedToken);
            } catch (error) {
                console.error('[API Client] Failed to decrypt response:', error);
                throw new Error('Failed to decrypt response');
            }
        }
        
        return data as T;
    }

    private async request<T>(
        endpoint: string,
        options: RequestInit = {}
    ): Promise<T> {
        const headers = new Headers(options.headers);
        
        if (this.token) {
            headers.set('Authorization', `Bearer ${this.token}`);
        }

        const response = await fetch(`${API_URL}${endpoint}`, {
            ...options,
            headers,
            // CRITICAL: Prevent caching of API calls
            // This ensures fresh data and prevents stale responses after deployments
            cache: 'no-store',
        });

        if (response.status === 401) {
            this.setToken(null);
            throw new Error('Unauthorized - please sign in again');
        }

        return this.decryptResponse<T>(response);
    }

    async createUrl(data: CreateUrlRequest): Promise<CreateUrlResponse> {
        return this.request<CreateUrlResponse>('/api/create', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        });
    }

    async listUrls(): Promise<ListUrlsResponse> {
        return this.request<ListUrlsResponse>('/api/list');
    }

    async deleteUrl(shortCode: string): Promise<DeleteUrlResponse> {
        return this.request<DeleteUrlResponse>(`/api/delete/${shortCode}`, {
            method: 'DELETE',
        });
    }

    /**
     * Get total URL count (public endpoint, no auth required)
     * This endpoint is service-to-service only but accessible from frontend
     */
    async getStats(): Promise<StatsResponse> {
        // Public endpoint - don't include auth token
        const response = await fetch(`${API_URL}/api/stats`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
            // CRITICAL: Prevent caching to ensure fresh data on each page load
            cache: 'no-store',
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch stats: ${response.statusText}`);
        }

        return this.decryptResponse<StatsResponse>(response);
    }

    logout(): void {
        this.setToken(null);
        if (typeof window !== 'undefined') {
            localStorage.removeItem('urlShortenerEmail');
        }
    }
}

export const apiClient = new UrlShortenerApiClient();

