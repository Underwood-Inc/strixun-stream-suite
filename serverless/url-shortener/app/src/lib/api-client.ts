/**
 * URL Shortener API Client
 * TypeScript client for URL shortener API
 * 
 * SIMPLIFIED: HttpOnly cookie-based authentication
 * - No localStorage token storage
 * - Cookies sent automatically
 */

function getApiUrl(): string {
    if (typeof window === 'undefined') {
        return 'https://s.idling.app';
    }
    
    const isLocalhost = window.location.hostname === 'localhost' || 
                        window.location.hostname === '127.0.0.1' ||
                        import.meta.env?.DEV ||
                        import.meta.env?.MODE === 'development';
    
    if (isLocalhost) {
        // In dev, always use the Vite proxy to avoid CORS and ensure cookies flow correctly.
        // Vite proxy is configured for `/api` -> http://localhost:8793
        return '';
    }
    
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
    private async decryptResponse<T>(response: Response): Promise<T> {
        // Check if response is encrypted
        const encryptedHeader = response.headers.get('X-Encrypted') || response.headers.get('x-encrypted');
        const isEncrypted = encryptedHeader === 'true';
        
        let data: any = await response.json();
        
        // Check if data looks encrypted
        const looksEncrypted = data && typeof data === 'object' && 'encrypted' in data && data.encrypted === true;
        
        if (isEncrypted || looksEncrypted) {
            // Wait for decryptWithJWT to be available (it's loaded via script tag)
            let decryptFn = (window as any).decryptWithJWT;
            
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
                console.error('[API Client] Decryption library not available after waiting.');
                throw new Error('Decryption library not loaded');
            }
            
            try {
                // Decrypt with cookie token (token is extracted from cookie by decrypt function)
                data = await decryptFn(data, null); // null = use cookie
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
        const response = await fetch(`${API_URL}${endpoint}`, {
            ...options,
            credentials: 'include', // Send cookies
            cache: 'no-store',
        });

        if (response.status === 401) {
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

    async getStats(): Promise<StatsResponse> {
        const response = await fetch(`${API_URL}/api/stats`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include', // Send cookies
            cache: 'no-store',
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch stats: ${response.statusText}`);
        }

        return this.decryptResponse<StatsResponse>(response);
    }
}

export const apiClient = new UrlShortenerApiClient();
