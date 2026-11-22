import { describe, test, expect, vi, beforeEach } from 'vitest';

const getCustomerByEmailService = vi.fn();
const getCustomerService = vi.fn();
const createCustomer = vi.fn();
const updateCustomer = vi.fn();

vi.mock('@strixun/api-framework', () => ({
    getCustomerByEmailService,
    getCustomerService,
    createCustomer,
    updateCustomer,
}));

vi.mock('../../services/customer.js', () => ({
    generateCustomerId: () => 'cust_testnew123456',
}));

vi.mock('../../services/nameGenerator.js', () => ({
    generateUniqueDisplayName: vi.fn(),
    reserveDisplayName: vi.fn(),
}));

const mockEnv = {
    OTP_AUTH_KV: {
        get: vi.fn().mockResolvedValue(null),
        put: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn().mockResolvedValue(undefined),
    },
} as any;

describe('ensureCustomerAccount — login paths', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getCustomerService.mockResolvedValue(null);
        updateCustomer.mockResolvedValue({});
    });

    test('existing user: returns customerId from email lookup without createCustomer', async () => {
        getCustomerByEmailService.mockResolvedValue({
            customerId: 'cust_existing99',
            status: 'active',
            displayName: 'PlayerOne',
            subscriptions: [{ planId: 'free', status: 'active' }],
            config: { rateLimits: {} },
        });

        const { ensureCustomerAccount } = await import('./customer-creation.js');
        const id = await ensureCustomerAccount('User@Example.com', null, mockEnv);

        expect(id).toBe('cust_existing99');
        expect(createCustomer).not.toHaveBeenCalled();
        expect(getCustomerByEmailService).toHaveBeenCalledWith('user@example.com', mockEnv);
    });

    test('new user: creates customer when lookup returns null', async () => {
        getCustomerByEmailService
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce({
                customerId: 'cust_testnew123456',
                status: 'active',
                displayName: 'NewPlayer',
            });

        createCustomer.mockResolvedValue({
            customerId: 'cust_testnew123456',
            status: 'active',
        });

        const { ensureCustomerAccount } = await import('./customer-creation.js');
        const id = await ensureCustomerAccount('new@example.com', null, mockEnv);

        expect(id).toBe('cust_testnew123456');
        expect(createCustomer).toHaveBeenCalledTimes(1);
    });

    test('existing user: lookup API error does not call createCustomer', async () => {
        getCustomerByEmailService.mockRejectedValue(new Error('Failed to get customer by email: Unauthorized'));

        const { ensureCustomerAccount } = await import('./customer-creation.js');

        await expect(ensureCustomerAccount('existing@example.com', null, mockEnv)).rejects.toThrow(/Unauthorized/);
        expect(createCustomer).not.toHaveBeenCalled();
    });

    test('existing user: create conflict recovers via follow-up lookup', async () => {
        getCustomerByEmailService
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce({
                customerId: 'cust_recovered01',
                status: 'active',
                displayName: 'Recovered',
            });

        createCustomer.mockRejectedValue(new Error('Customer with this email already exists'));

        const { ensureCustomerAccount } = await import('./customer-creation.js');
        const id = await ensureCustomerAccount('race@example.com', null, mockEnv);

        expect(id).toBe('cust_recovered01');
        expect(createCustomer).toHaveBeenCalled();
    });
});