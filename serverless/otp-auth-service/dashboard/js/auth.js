/**
 * Authentication Component
 * Handles OTP-based login flow
 */

import { apiClient } from './api-client.js';

/**
 * Login Component
 * Composable login component using OTP flow
 */
export class LoginComponent {
    constructor(container) {
        this.container = container;
        this.step = 'email'; // 'email' | 'otp'
        this.email = '';
        this.loading = false;
        this.error = null;
    }

    /**
     * Render login form
     */
    render() {
        this.container.innerHTML = `
            <div style="max-width: 400px; margin: 0 auto; padding: var(--spacing-3xl) var(--spacing-xl);">
                <div style="text-align: center; margin-bottom: var(--spacing-2xl);">
                    <h1 style="font-size: 2rem; margin-bottom: var(--spacing-md); color: var(--accent);">
                        Developer Dashboard
                    </h1>
                    <p style="color: var(--text-secondary);">
                        Sign in with your email to access your dashboard
                    </p>
                </div>

                ${this.error ? `
                    <div class="error" style="margin-bottom: var(--spacing-lg);">
                        ${this.error}
                    </div>
                ` : ''}

                ${this.step === 'email' ? this.renderEmailStep() : this.renderOTPStep()}
            </div>
        `;

        // Attach event listeners
        if (this.step === 'email') {
            const emailInput = this.container.querySelector('#login-email');
            const submitBtn = this.container.querySelector('#login-submit');
            
            if (emailInput) {
                emailInput.addEventListener('input', (e) => {
                    this.email = e.target.value;
                });
                emailInput.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter' && !this.loading) {
                        this.handleRequestOTP();
                    }
                });
            }
            
            if (submitBtn) {
                submitBtn.addEventListener('click', () => this.handleRequestOTP());
            }
        } else {
            const otpInput = this.container.querySelector('#login-otp');
            const verifyBtn = this.container.querySelector('#verify-submit');
            const backBtn = this.container.querySelector('#verify-back');
            
            if (otpInput) {
                otpInput.addEventListener('input', (e) => {
                    e.target.value = e.target.value.replace(/\D/g, '').slice(0, 9);
                });
                otpInput.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter' && !this.loading) {
                        this.handleVerifyOTP();
                    }
                });
            }
            
            if (verifyBtn) {
                verifyBtn.addEventListener('click', () => this.handleVerifyOTP());
            }
            
            if (backBtn) {
                backBtn.addEventListener('click', () => {
                    this.step = 'email';
                    this.error = null;
                    this.render();
                });
            }
        }
    }

    /**
     * Render email input step
     */
    renderEmailStep() {
        return `
            <form onsubmit="return false;">
                <div style="margin-bottom: var(--spacing-lg);">
                    <label for="login-email" style="display: block; margin-bottom: var(--spacing-sm); color: var(--text-secondary);">
                        Email Address
                    </label>
                    <input
                        type="email"
                        id="login-email"
                        required
                        autocomplete="email"
                        placeholder="your@email.com"
                        disabled="${this.loading}"
                        style="
                            width: 100%;
                            padding: var(--spacing-md);
                            background: var(--bg-dark);
                            border: 1px solid var(--border);
                            border-radius: var(--radius-md);
                            color: var(--text);
                            font-size: 1rem;
                            box-sizing: border-box;
                        "
                    />
                </div>
                <button
                    type="button"
                    id="login-submit"
                    disabled="${this.loading}"
                    style="
                        width: 100%;
                        padding: var(--spacing-md);
                        background: var(--accent);
                        border: 3px solid var(--accent-dark);
                        border-radius: 0;
                        color: #000;
                        font-weight: 700;
                        font-size: 0.875rem;
                        text-transform: uppercase;
                        letter-spacing: 1px;
                        cursor: pointer;
                        transition: all 0.1s;
                        box-shadow: 0 4px 0 var(--accent-dark);
                    "
                    onmouseover="if (!this.disabled) { this.style.transform = 'translateY(-2px)'; this.style.boxShadow = '0 6px 0 var(--accent-dark)'; }"
                    onmouseout="if (!this.disabled) { this.style.transform = 'translateY(0)'; this.style.boxShadow = '0 4px 0 var(--accent-dark)'; }"
                >
                    ${this.loading ? 'Sending...' : 'Send OTP Code'}
                </button>
            </form>
        `;
    }

    /**
     * Render OTP input step
     */
    renderOTPStep() {
        return `
            <form onsubmit="return false;">
                <div style="margin-bottom: var(--spacing-lg);">
                    <label for="login-otp" style="display: block; margin-bottom: var(--spacing-sm); color: var(--text-secondary);">
                        9-Digit OTP Code
                    </label>
                    <input
                        type="text"
                        id="login-otp"
                        required
                        autocomplete="one-time-code"
                        inputmode="numeric"
                        pattern="[0-9]{9}"
                        maxlength="9"
                        placeholder="123456789"
                        disabled="${this.loading}"
                        style="
                            width: 100%;
                            padding: var(--spacing-md);
                            background: var(--bg-dark);
                            border: 1px solid var(--border);
                            border-radius: var(--radius-md);
                            color: var(--text);
                            font-size: 1.5rem;
                            text-align: center;
                            letter-spacing: 0.5rem;
                            font-family: monospace;
                            box-sizing: border-box;
                        "
                    />
                    <p style="margin-top: var(--spacing-sm); font-size: 0.875rem; color: var(--muted);">
                        Check your email (${this.email}) for the code
                    </p>
                </div>
                <div style="display: flex; gap: var(--spacing-md);">
                    <button
                        type="button"
                        id="verify-back"
                        disabled="${this.loading}"
                        style="
                            flex: 1;
                            padding: var(--spacing-md);
                            background: transparent;
                            border: 2px solid var(--border);
                            border-radius: 0;
                            color: var(--text);
                            font-weight: 600;
                            font-size: 0.875rem;
                            text-transform: uppercase;
                            letter-spacing: 0.5px;
                            cursor: pointer;
                        "
                    >
                        Back
                    </button>
                    <button
                        type="button"
                        id="verify-submit"
                        disabled="${this.loading}"
                        style="
                            flex: 1;
                            padding: var(--spacing-md);
                            background: var(--accent);
                            border: 3px solid var(--accent-dark);
                            border-radius: 0;
                            color: #000;
                            font-weight: 700;
                            font-size: 0.875rem;
                            text-transform: uppercase;
                            letter-spacing: 1px;
                            cursor: pointer;
                            transition: all 0.1s;
                            box-shadow: 0 4px 0 var(--accent-dark);
                        "
                        onmouseover="if (!this.disabled) { this.style.transform = 'translateY(-2px)'; this.style.boxShadow = '0 6px 0 var(--accent-dark)'; }"
                        onmouseout="if (!this.disabled) { this.style.transform = 'translateY(0)'; this.style.boxShadow = '0 4px 0 var(--accent-dark)'; }"
                    >
                        ${this.loading ? 'Verifying...' : 'Verify & Login'}
                    </button>
                </div>
            </form>
        `;
    }

    /**
     * Handle OTP request
     */
    async handleRequestOTP() {
        const emailInput = this.container.querySelector('#login-email');
        const email = emailInput?.value.trim().toLowerCase();
        
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            this.error = 'Please enter a valid email address';
            this.render();
            return;
        }

        this.email = email;
        this.loading = true;
        this.error = null;
        this.render();

        try {
            await apiClient.requestOTP(email);
            this.step = 'otp';
            this.error = null;
        } catch (error) {
            this.error = error.message || 'Failed to send OTP. Please try again.';
            this.step = 'email';
        } finally {
            this.loading = false;
            this.render();
        }
    }

    /**
     * Handle OTP verification
     */
    async handleVerifyOTP() {
        const otpInput = this.container.querySelector('#login-otp');
        const otp = otpInput?.value.trim();
        
        if (!otp || otp.length !== 9) {
            this.error = 'Please enter a valid 9-digit OTP code';
            this.render();
            return;
        }

        this.loading = true;
        this.error = null;
        this.render();

        try {
            const response = await apiClient.verifyOTP(this.email, otp);
            
            // Store token
            const token = response.access_token || response.token;
            if (token) {
                apiClient.setToken(token);
                
                // Dispatch login event
                window.dispatchEvent(new CustomEvent('auth:login', {
                    detail: { user: response }
                }));
            } else {
                throw new Error('No token received from server');
            }
        } catch (error) {
            this.error = error.message || 'Invalid OTP code. Please try again.';
            this.render();
        } finally {
            this.loading = false;
        }
    }
}

