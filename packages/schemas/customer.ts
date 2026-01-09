/**
 * Customer Data Validation Schemas
 * 
 * All customer-related data validation using Valibot
 * Source of truth for customer data structure
 */

import * as v from 'valibot';

/**
 * Customer tier levels
 */
export const CustomerTierSchema = v.picklist(['free', 'basic', 'premium', 'enterprise']);

/**
 * Customer status
 */
export const CustomerStatusSchema = v.picklist(['active', 'suspended', 'cancelled']);

/**
 * Email visibility settings
 */
export const EmailVisibilitySchema = v.picklist(['private', 'public']);

/**
 * Display name change reason
 */
export const DisplayNameChangeReasonSchema = v.picklist([
  'auto-generated',
  'user-changed',
  'regenerated',
]);

/**
 * Display name history entry
 */
export const DisplayNameHistoryEntrySchema = v.object({
  name: v.pipe(v.string(), v.minLength(1), v.maxLength(32)),
  changedAt: v.string(), // ISO 8601 date string
  reason: DisplayNameChangeReasonSchema,
});

/**
 * Display name preferences
 */
export const DisplayNamePreferencesSchema = v.object({
  current: v.pipe(v.string(), v.minLength(3), v.maxLength(32)),
  previousNames: v.array(DisplayNameHistoryEntrySchema),
  lastChangedAt: v.nullable(v.string()), // ISO 8601 date string or null
  changeCount: v.pipe(v.number(), v.integer(), v.minValue(0)),
});

/**
 * Customer preferences (stored in CUSTOMER_KV)
 */
export const CustomerPreferencesSchema = v.object({
  emailVisibility: EmailVisibilitySchema,
  displayName: DisplayNamePreferencesSchema,
});

/**
 * Subscription billing cycle
 */
export const BillingCycleSchema = v.picklist(['monthly', 'yearly', 'lifetime']);

/**
 * Subscription status
 */
export const SubscriptionStatusSchema = v.picklist(['active', 'cancelled', 'expired', 'pending']);

/**
 * Customer subscription
 */
export const SubscriptionSchema = v.object({
  planId: v.string(),
  status: SubscriptionStatusSchema,
  startDate: v.string(), // ISO 8601
  endDate: v.nullable(v.string()), // ISO 8601 or null
  renewalDate: v.optional(v.nullable(v.string())), // ISO 8601 or null
  cancelledAt: v.optional(v.nullable(v.string())), // ISO 8601 or null
  planName: v.optional(v.string()),
  billingCycle: v.optional(BillingCycleSchema),
});

/**
 * Customer flair/badge
 */
export const FlairSchema = v.object({
  flairId: v.string(),
  name: v.string(),
  icon: v.optional(v.string()),
  description: v.optional(v.string()),
  earnedAt: v.string(), // ISO 8601
  category: v.optional(v.string()),
});

/**
 * Complete customer data (stored in CUSTOMER_KV)
 */
export const CustomerDataSchema = v.object({
  customerId: v.pipe(v.string(), v.minLength(1)),
  email: v.optional(v.pipe(v.string(), v.email())), // Optional in responses (privacy)
  companyName: v.optional(v.string()),
  plan: v.optional(v.string()), // Legacy field
  tier: v.optional(CustomerTierSchema),
  status: v.optional(CustomerStatusSchema),
  createdAt: v.optional(v.string()), // ISO 8601
  updatedAt: v.optional(v.string()), // ISO 8601
  subscriptions: v.optional(v.array(SubscriptionSchema)),
  flairs: v.optional(v.array(FlairSchema)),
  displayName: v.pipe(v.string(), v.minLength(3), v.maxLength(32)), // REQUIRED
  config: v.optional(v.record(v.string(), v.any())),
  features: v.optional(v.record(v.string(), v.any())),
});

/**
 * Customer creation request
 */
export const CustomerCreateRequestSchema = v.object({
  email: v.pipe(v.string(), v.email()),
  companyName: v.optional(v.string()),
  displayName: v.optional(v.pipe(v.string(), v.minLength(3), v.maxLength(32))),
  tier: v.optional(CustomerTierSchema),
  customerId: v.optional(v.string()), // Can be provided or generated
});

/**
 * Customer update request
 */
export const CustomerUpdateRequestSchema = v.partial(
  v.object({
    companyName: v.string(),
    tier: CustomerTierSchema,
    status: CustomerStatusSchema,
    subscriptions: v.array(SubscriptionSchema),
    flairs: v.array(FlairSchema),
    displayName: v.pipe(v.string(), v.minLength(3), v.maxLength(32)),
    config: v.record(v.string(), v.any()),
    features: v.record(v.string(), v.any()),
  })
);

/**
 * Display name update request
 */
export const DisplayNameUpdateRequestSchema = v.object({
  displayName: v.pipe(v.string(), v.minLength(3), v.maxLength(32)),
});

/**
 * Type exports for TypeScript
 */
export type CustomerTier = v.InferOutput<typeof CustomerTierSchema>;
export type CustomerStatus = v.InferOutput<typeof CustomerStatusSchema>;
export type EmailVisibility = v.InferOutput<typeof EmailVisibilitySchema>;
export type DisplayNameChangeReason = v.InferOutput<typeof DisplayNameChangeReasonSchema>;
export type DisplayNameHistoryEntry = v.InferOutput<typeof DisplayNameHistoryEntrySchema>;
export type DisplayNamePreferences = v.InferOutput<typeof DisplayNamePreferencesSchema>;
export type CustomerPreferences = v.InferOutput<typeof CustomerPreferencesSchema>;
export type BillingCycle = v.InferOutput<typeof BillingCycleSchema>;
export type SubscriptionStatus = v.InferOutput<typeof SubscriptionStatusSchema>;
export type Subscription = v.InferOutput<typeof SubscriptionSchema>;
export type Flair = v.InferOutput<typeof FlairSchema>;
export type CustomerData = v.InferOutput<typeof CustomerDataSchema>;
export type CustomerCreateRequest = v.InferOutput<typeof CustomerCreateRequestSchema>;
export type CustomerUpdateRequest = v.InferOutput<typeof CustomerUpdateRequestSchema>;
export type DisplayNameUpdateRequest = v.InferOutput<typeof DisplayNameUpdateRequestSchema>;
