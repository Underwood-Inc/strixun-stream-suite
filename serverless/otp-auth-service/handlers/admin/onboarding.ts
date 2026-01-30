/**
 * Onboarding Handlers
 * Handles onboarding progress and testing endpoints
 */

import { getCorsHeadersRecord } from '../../utils/cors.js';
import { handleRequestOTP } from '../auth.js';

interface Env {
    OTP_AUTH_KV: KVNamespace;
    ENVIRONMENT?: string;
}

interface OnboardingSteps {
    accountCreated: boolean;
    emailVerified: boolean;
    apiKeyGenerated: boolean;
    firstTestCompleted: boolean;
    webhookConfigured: boolean;
    emailTemplateConfigured: boolean;
}

interface OnboardingData {
    customerId: string;
    step: number;
    completed: boolean;
    steps: OnboardingSteps;
    createdAt: string;
    updatedAt?: string;
}

/**
 * Get onboarding progress
 * GET /admin/onboarding
 */
export async function handleGetOnboarding(request: Request, env: Env, customerId: string): Promise<Response> {
    try {
        const onboardingKey = `onboarding_${customerId}`;
        const onboarding: OnboardingData = await env.OTP_AUTH_KV.get(onboardingKey, { type: 'json' }) || {
            customerId,
            step: 1,
            completed: false,
            steps: {
                accountCreated: false,
                emailVerified: false,
                apiKeyGenerated: false,
                firstTestCompleted: false,
                webhookConfigured: false,
                emailTemplateConfigured: false
            },
            createdAt: new Date().toISOString()
        };
        
        return new Response(JSON.stringify({
            success: true,
            onboarding
        }), {
            headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error) {
        const err = error as Error;
        return new Response(JSON.stringify({
            error: 'Failed to get onboarding status',
            message: err.message
        }), {
            status: 500,
            headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
        });
    }
}

/**
 * Update onboarding progress
 * PUT /admin/onboarding
 */
export async function handleUpdateOnboarding(request: Request, env: Env, customerId: string): Promise<Response> {
    try {
        const body = await request.json() as { step?: number; completed?: boolean; steps?: Partial<OnboardingSteps> };
        const { step, completed, steps } = body;
        
        const onboardingKey = `onboarding_${customerId}`;
        const existing: OnboardingData = await env.OTP_AUTH_KV.get(onboardingKey, { type: 'json' }) || {
            customerId,
            step: 1,
            completed: false,
            steps: {
                accountCreated: false,
                emailVerified: false,
                apiKeyGenerated: false,
                firstTestCompleted: false,
                webhookConfigured: false,
                emailTemplateConfigured: false
            },
            createdAt: new Date().toISOString()
        };
        
        if (step !== undefined) existing.step = step;
        if (completed !== undefined) existing.completed = completed;
        if (steps) existing.steps = { ...existing.steps, ...steps };
        existing.updatedAt = new Date().toISOString();
        
        await env.OTP_AUTH_KV.put(onboardingKey, JSON.stringify(existing), { expirationTtl: 2592000 });
        
        return new Response(JSON.stringify({
            success: true,
            onboarding: existing
        }), {
            headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error) {
        const err = error as Error;
        return new Response(JSON.stringify({
            error: 'Failed to update onboarding',
            message: err.message
        }), {
            status: 500,
            headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
        });
    }
}

/**
 * Test OTP request (for onboarding)
 * POST /admin/onboarding/test-otp
 */
export async function handleTestOTP(request: Request, env: Env, customerId: string): Promise<Response> {
    try {
        const body = await request.json() as { email?: string };
        const { email } = body;
        
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return new Response(JSON.stringify({ error: 'Valid email address required' }), {
                status: 400,
                headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        // Use the actual OTP request handler
        const testRequest = new Request(request.url, {
            method: 'POST',
            headers: request.headers,
            body: JSON.stringify({ email })
        });
        
        const response = await handleRequestOTP(testRequest, env, customerId);
        
        // If successful, update onboarding
        if (response.ok) {
            const onboardingKey = `onboarding_${customerId}`;
            const onboarding: Partial<OnboardingData> = await env.OTP_AUTH_KV.get(onboardingKey, { type: 'json' }) || {};
            onboarding.steps = onboarding.steps || {} as OnboardingSteps;
            onboarding.steps.firstTestCompleted = true;
            onboarding.step = Math.max(onboarding.step || 1, 4);
            await env.OTP_AUTH_KV.put(onboardingKey, JSON.stringify(onboarding), { expirationTtl: 2592000 });
        }
        
        return response;
    } catch (error) {
        const err = error as Error;
        return new Response(JSON.stringify({
            error: 'Failed to test OTP',
            message: err.message
        }), {
            status: 500,
            headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
        });
    }
}
