# Refactor audit: staged files (300+ lines)

Audit of git-staged files that exceed or approach the 300-line guideline for splitting into smaller, agnostic, maintainable modules.

---

## Done

### `handlers/admin/api-keys.ts` (620 lines) → split

**Done.** Replaced with `handlers/admin/api-keys/`:

- `types.ts` – shared interfaces (Env, ApiKeyData, response/request body types)
- `list.ts` – `handleListApiKeys`
- `create.ts` – `handleCreateApiKey`
- `rotate.ts` – `handleRotateApiKey`
- `reveal.ts` – `handleRevealApiKey`
- `revoke.ts` – `handleRevokeApiKey`
- `update-origins.ts` – `handleUpdateKeyOrigins`
- `index.ts` – re-exports

`handlers/admin.ts` still imports from `./admin/api-keys.js` (resolves to the folder index). No call-site changes.

---

## Recommended next (by priority)

### 1. `handlers/admin/analytics.ts` (~444 lines)

**Opportunity:** Split by endpoint/concern.

- **`analytics-types.ts`** – Env, request/response interfaces, shared types.
- **`analytics-get.ts`** – `handleGetAnalytics` (main analytics).
- **`analytics-errors.ts`** – `handleGetErrorAnalytics`.
- **`analytics-realtime.ts`** – `handleGetRealtimeAnalytics`.
- **`analytics-email.ts`** – `handleGetEmailAnalytics`.
- **`index.ts`** – re-export all handlers.

Keeps each handler in its own file and shared types in one place.

---

### 2. `handlers/auth/session.ts` (~378 lines)

**Opportunity:** Split by responsibility.

- **`session-types.ts`** – Env, payload/response types.
- **`session-userinfo.ts`** – UserInfo /auth/me logic (scope→claims, claim mapping).
- **`session-handler.ts`** – main request handling, cookie/session checks, delegation to userinfo.
- **`index.ts`** – re-export the single public handler (and types if needed).

Alternatively, extract a **userinfo-claims** helper (scope resolution + claim mapping) used by the main handler so session.ts stays one file but under 300 lines.

---

### 3. `html-snippets/test-snippet/scripts.tpl` (~862 lines) → split

**Done.** Replaced with feature fragments; generator assembles in order.

- **`scripts-core.tpl`** – API_KEY, BASE_URL, focusAndScrollTo, toggleSecurityDocs, showTab, downloadThisFile.
- **`scripts-verify.tpl`** – verifyApiKey.
- **`scripts-otp.tpl`** – requestOTP, verifyOTP.
- **`scripts-tokens.tpl`** – refreshTokens, getMe, logout, decodeIdToken.
- **`scripts-discovery.tpl`** – testDiscovery, testJWKS.
- **`scripts-introspect.tpl`** – testIntrospect.
- **`scripts-glossary.tpl`** – GLOSSARY_MAP, buildGlossaryLinks.
- **`scripts-search.tpl`** – parseSearchQuery, matchesSearchQuery, buildSearchIndex, openSearch, closeSearch, renderSearchResults, escHtml, highlightTerms, smoothScrollTo, flashHighlight, navigateToResultEl, handleSearchKeydown, updateActiveItem, keydown listener.
- **`scripts-toc.tpl`** – tocEntries, buildToc, filterToc, toggleTocSidebar.
- **`scripts-init.tpl`** – DOMContentLoaded (buildGlossaryLinks, buildSearchIndex, buildToc), verifyApiKey().

Generator (`index.ts`) imports all fragments and joins them; `interpolate(scripts, vars)` still replaces `{{API_KEY}}` and `{{BASE_URL}}`.

---

### 4. `src/dashboard/pages/ApiKeys.svelte` (~497 lines)

**Opportunity:** Extract subcomponents and logic.

- **`ApiKeysList.svelte`** – table of keys (rows, revoke/rotate/test/snippet/origins buttons).
- **`ApiKeysState.svelte`** or a **store/context** – loading, error, apiKeys, modals (new key, test, snippet, origins), editingKey, etc.
- Keep **ApiKeys.svelte** as the page shell: usage card, claims reference, create form, list component, modals.

Optional: **api-keys-helpers.ts** – `openOrigins`, `handleSaveOrigins`, `handleCreate` (if logic grows). Reduces page to layout + wiring.

---

### 5. `src/dashboard/pages/Analytics.svelte` (~458 lines)

**Opportunity:** Same pattern as ApiKeys.

- **`AnalyticsSummary.svelte`** – top-level KPIs/summary.
- **`AnalyticsCharts.svelte`** or **`AnalyticsTable.svelte`** – main chart/table sections.
- **`AnalyticsFilters.svelte`** – date range, filters.
- Page shell stays in **Analytics.svelte** (data loading, state, layout).

---

### 6. `apps/mods-hub/src/components/layout/Header.tsx` (~351 lines)

**Opportunity:** Extract subcomponents.

- **`HeaderNav.tsx`** – main nav links.
- **`HeaderAuth.tsx`** – login/user menu, auth state.
- **`HeaderMobile.tsx`** – mobile menu / drawer if present.
- **Header.tsx** – layout and composition only.

Reduces Header to layout + composition and keeps each concern testable.

---

## Borderline (monitor; split when touching)

| File | Lines | Note |
|------|-------|------|
| `handlers/auth/jwt-creation.ts` | ~319 | Just over 300. Consider extracting token-payload builder vs. response builder if it grows. |
| `services/api-key.ts` | ~316 | Consider splitting verify/create/rotate helpers vs. main export if it grows. |
| `handlers/auth/verify-otp.ts` | (check) | If near 300, extract validation/decrypt vs. handler. |
| `handlers/auth/refresh.ts` | (check) | Same as above. |

---

## Not applicable / low priority

- **Dashboard components** (Card, ApiKeyCreateForm, ApiKeyOriginsModal, ClaimsReference, etc.) – already component-sized.
- **Config/oidc-metadata/customers** – small handlers.
- **shared/oidc-constants.ts** – single-purpose constants; size is acceptable.
- **test-snippet/index.ts** – generator; keep as single entry that composes snippets.
- **router/dashboard-routes.ts** – routing table; splitting by route prefix is possible but can reduce readability.

---

## Summary

| Staged file | Lines | Action |
|-------------|-------|--------|
| `handlers/admin/api-keys.ts` | 620 | **Done** – split into `api-keys/*` |
| `handlers/admin/analytics.ts` | 444 | Split into types + per-handler files |
| `handlers/auth/session.ts` | 378 | Split userinfo vs. handler or extract claims helper |
| `html-snippets/test-snippet/scripts.tpl` | 862 | **Done** – split into scripts-*.tpl; generator assembles |
| `src/dashboard/pages/ApiKeys.svelte` | 497 | Extract list + optional store/helpers |
| `src/dashboard/pages/Analytics.svelte` | 458 | Extract summary/charts/filters components |
| `apps/mods-hub/.../Header.tsx` | 351 | Extract nav/auth/mobile components |
| `handlers/auth/jwt-creation.ts` | 319 | Monitor; extract when editing |
| `services/api-key.ts` | 316 | Monitor; extract when editing |
