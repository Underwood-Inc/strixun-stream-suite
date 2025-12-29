/**
 * URL Shortener API Client
 * TypeScript client for URL shortener API
 */

const API_URL = typeof window !== 'undefined' 
    ? window.location.origin 
    : 'https://s.idling.app';

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
        const isEncrypted = response.headers.get('X-Encrypted') === 'true';
        let data: any = await response.json();
        
        if (isEncrypted && data && typeof data === 'object' && 'encrypted' in data && data.encrypted && this.token) {
            try {
                if (typeof (window as any).decryptWithJWT !== 'function') {
                    throw new Error('Decryption library not loaded');
                }
                data = await (window as any).decryptWithJWT(data, this.token);
            } catch (error) {
                console.error('Failed to decrypt response:', error);
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

    logout(): void {
        this.setToken(null);
        if (typeof window !== 'undefined') {
            localStorage.removeItem('urlShortenerEmail');
        }
    }
}

export const apiClient = new UrlShortenerApiClient();

