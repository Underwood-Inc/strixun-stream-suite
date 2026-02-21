/**
 * OTP Auth Test Snippet Scripts
 * Client-side JavaScript for the integration test page
 * 
 * Variables {{API_KEY}} and {{BASE_URL}} are replaced at generation time
 */

const API_KEY = '{{API_KEY}}';
const BASE_URL = '{{BASE_URL}}';
let authToken = null;
let idToken = null;
let refreshToken = null;

/** Focus and smooth-scroll to the next input/button to guide the user through the test flow. */
function focusAndScrollTo(el) {
    if (!el || typeof el.scrollIntoView !== 'function') return;
    var reduceMotion = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
    setTimeout(function() { el.focus(); }, reduceMotion ? 0 : 100);
}

// Toggle security documentation
function toggleSecurityDocs() {
    const content = document.getElementById('securityContent');
    const icon = document.getElementById('toggleIcon');
    const header = content.previousElementSibling;
    const expanded = content.classList.toggle('expanded');
    icon.textContent = expanded ? '▼' : '▶';
    if (header) header.setAttribute('aria-expanded', String(expanded));
}

// Tab switching for integration methods
function showTab(tabName, clickedBtn) {
    document.querySelectorAll('.tab-content').forEach(function(t) { t.classList.remove('active'); });
    document.querySelectorAll('.tab-btn[role="tab"]').forEach(function(b) {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
    });
    
    var tab = document.getElementById('tab-' + tabName);
    if (tab) tab.classList.add('active');
    if (clickedBtn) {
        clickedBtn.classList.add('active');
        clickedBtn.setAttribute('aria-selected', 'true');
    }
    
    if (window.mermaid && tab) {
        mermaid.init(undefined, tab.querySelectorAll('.mermaid'));
    }
}

// Download this file
function downloadThisFile() {
    const html = document.documentElement.outerHTML;
    const blob = new Blob(['<!DOCTYPE html>\n' + html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'otp-auth-test.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Verify API key on load
async function verifyApiKey() {
    try {
        const response = await fetch(BASE_URL + '/api-key/verify', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-OTP-API-Key': API_KEY
            }
        });
        const data = await response.json();
        
        const statusEl = document.getElementById('keyStatus');
        const statusText = document.getElementById('keyStatusText');
        const detailsEl = document.getElementById('keyDetails');
        
        if (data.valid) {
            statusEl.className = 'status-indicator valid';
            statusText.textContent = 'Valid - Ready to test';
            detailsEl.innerHTML = `
                <p><strong>Plan:</strong> ${data.customerPlan || 'free'}</p>
                <p><strong>Key ID:</strong> ${data.keyId}</p>
                <p><strong>Services Available:</strong> ${data.services.filter(s => s.available).length}</p>
            `;
        } else {
            statusEl.className = 'status-indicator invalid';
            statusText.textContent = 'Invalid - ' + (data.error || 'Check your API key');
        }
    } catch (err) {
        document.getElementById('keyStatus').className = 'status-indicator invalid';
        document.getElementById('keyStatusText').textContent = 'Error: ' + err.message;
    }
}

async function requestOTP() {
    const email = document.getElementById('email').value;
    if (!email) { alert('Please enter an email'); return; }
    
    const btn = document.getElementById('requestOtpBtn');
    const resultEl = document.getElementById('requestResult');
    btn.disabled = true;
    btn.textContent = 'Sending...';
    
    try {
        const response = await fetch(BASE_URL + '/auth/request-otp', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-OTP-API-Key': API_KEY
            },
            body: JSON.stringify({ email })
        });
        const data = await response.json();
        
        resultEl.style.display = 'block';
        resultEl.className = response.ok ? 'result success' : 'result error';
        resultEl.textContent = JSON.stringify(data, null, 2);
        
        if (response.ok) {
            document.getElementById('step1').classList.add('completed');
            document.getElementById('verifyOtpBtn').disabled = false;
            focusAndScrollTo(document.getElementById('otp'));
        }
    } catch (err) {
        resultEl.style.display = 'block';
        resultEl.className = 'result error';
        resultEl.textContent = 'Error: ' + err.message;
    } finally {
        btn.disabled = false;
        btn.textContent = 'Send OTP';
    }
}

async function verifyOTP() {
    const email = document.getElementById('email').value;
    const otp = document.getElementById('otp').value;
    if (!otp || otp.length !== 9) { alert('Please enter a 9-digit OTP'); return; }
    
    const btn = document.getElementById('verifyOtpBtn');
    const resultEl = document.getElementById('verifyResult');
    btn.disabled = true;
    btn.textContent = 'Verifying...';
    
    try {
        const response = await fetch(BASE_URL + '/auth/verify-otp', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-OTP-API-Key': API_KEY
            },
            credentials: 'include',
            body: JSON.stringify({ email, otp })
        });
        const data = await response.json();
        
        resultEl.style.display = 'block';
        resultEl.className = response.ok ? 'result success' : 'result error';
        resultEl.textContent = JSON.stringify(data, null, 2);
        
        if (response.ok) {
            authToken = data.access_token || data.token;
            idToken = data.id_token || null;
            refreshToken = data.refresh_token || null;
            document.getElementById('step2').classList.add('completed');
            document.getElementById('refreshBtn').disabled = false;
            document.getElementById('getMeBtn').disabled = false;
            document.getElementById('logoutBtn').disabled = false;

            // Populate OIDC token details card
            const card = document.getElementById('oidcTokenCard');
            card.style.display = 'block';
            document.getElementById('oidcTokenType').textContent = data.token_type || 'Bearer';
            document.getElementById('oidcExpiresIn').textContent = data.expires_in || '—';
            document.getElementById('oidcScope').textContent = data.scope || 'openid profile';
            document.getElementById('oidcAccessToken').value = authToken || '';
            document.getElementById('oidcIdToken').value = idToken || '';
            document.getElementById('idTokenStatus').textContent = idToken
                ? '(RS256-signed)'
                : '(not issued — OIDC_SIGNING_KEY may not be configured)';

            // Pre-fill introspect fields
            document.getElementById('introspectToken').value = authToken || '';
            focusAndScrollTo(document.getElementById('refreshBtn'));
        }
    } catch (err) {
        resultEl.style.display = 'block';
        resultEl.className = 'result error';
        resultEl.textContent = 'Error: ' + err.message;
    } finally {
        btn.disabled = false;
        btn.textContent = 'Verify OTP';
    }
}

async function refreshTokens() {
    const btn = document.getElementById('refreshBtn');
    const resultEl = document.getElementById('refreshResult');
    btn.disabled = true;
    btn.textContent = 'Refreshing...';
    
    try {
        // file:// pages cannot store HttpOnly cookies, so we pass the
        // refresh_token in the request body as a fallback.
        const body = refreshToken ? JSON.stringify({ refresh_token: refreshToken }) : undefined;
        const response = await fetch(BASE_URL + '/auth/refresh', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body
        });
        const data = await response.json();
        
        resultEl.style.display = 'block';
        resultEl.className = response.ok ? 'result success' : 'result error';
        resultEl.textContent = JSON.stringify(data, null, 2);
        
        if (response.ok) {
            authToken = data.access_token || data.token;
            idToken = data.id_token || null;
            refreshToken = data.refresh_token || refreshToken;
            document.getElementById('step3').classList.add('completed');

            // Update OIDC token card with refreshed tokens
            document.getElementById('oidcAccessToken').value = authToken || '';
            document.getElementById('oidcIdToken').value = idToken || '';
            document.getElementById('oidcExpiresIn').textContent = data.expires_in || '—';
            document.getElementById('introspectToken').value = authToken || '';
            focusAndScrollTo(document.getElementById('getMeBtn'));
        }
    } catch (err) {
        resultEl.style.display = 'block';
        resultEl.className = 'result error';
        resultEl.textContent = 'Error: ' + err.message;
    } finally {
        btn.disabled = false;
        btn.textContent = 'Refresh Tokens';
    }
}

async function getMe() {
    const btn = document.getElementById('getMeBtn');
    const resultEl = document.getElementById('meResult');
    btn.disabled = true;
    btn.textContent = 'Loading...';
    
    try {
        const headers = { 
            'Content-Type': 'application/json',
            'X-OTP-API-Key': API_KEY
        };
        if (authToken) headers['Authorization'] = 'Bearer ' + authToken;
        
        const response = await fetch(BASE_URL + '/auth/me', {
            method: 'GET',
            headers,
            credentials: 'include'
        });
        const data = await response.json();
        
        resultEl.style.display = 'block';
        resultEl.className = response.ok ? 'result success' : 'result error';
        resultEl.textContent = JSON.stringify(data, null, 2);
        
        if (response.ok) {
            document.getElementById('step4').classList.add('completed');
            focusAndScrollTo(document.getElementById('logoutBtn'));
        }
    } catch (err) {
        resultEl.style.display = 'block';
        resultEl.className = 'result error';
        resultEl.textContent = 'Error: ' + err.message;
    } finally {
        btn.disabled = false;
        btn.textContent = 'Get User Info';
    }
}

async function logout() {
    const btn = document.getElementById('logoutBtn');
    const resultEl = document.getElementById('logoutResult');
    btn.disabled = true;
    btn.textContent = 'Logging out...';
    
    try {
        const headers = { 
            'Content-Type': 'application/json',
            'X-OTP-API-Key': API_KEY
        };
        if (authToken) headers['Authorization'] = 'Bearer ' + authToken;
        
        const response = await fetch(BASE_URL + '/auth/logout', {
            method: 'POST',
            headers,
            credentials: 'include'
        });
        const data = await response.json();
        
        resultEl.style.display = 'block';
        resultEl.className = response.ok ? 'result success' : 'result error';
        resultEl.textContent = JSON.stringify(data, null, 2);
        
        if (response.ok) {
            authToken = null;
            idToken = null;
            document.getElementById('step5').classList.add('completed');
        }
    } catch (err) {
        resultEl.style.display = 'block';
        resultEl.className = 'result error';
        resultEl.textContent = 'Error: ' + err.message;
    } finally {
        btn.disabled = false;
        btn.textContent = 'Logout';
    }
}

// --- OIDC Token Decode ---

function decodeIdToken() {
    const resultEl = document.getElementById('idTokenDecoded');
    resultEl.style.display = 'block';
    const token = idToken || document.getElementById('oidcIdToken').value.trim();
    if (!token) {
        resultEl.className = 'result error';
        resultEl.textContent = 'No ID token available. Complete Step 2 first, and ensure OIDC_SIGNING_KEY is configured on the server.';
        return;
    }
    try {
        const parts = token.split('.');
        if (parts.length !== 3) throw new Error('Not a valid JWT (expected 3 parts)');
        const header = JSON.parse(atob(parts[0].replace(/-/g,'+').replace(/_/g,'/')));
        const payload = JSON.parse(atob(parts[1].replace(/-/g,'+').replace(/_/g,'/')));
        resultEl.className = 'result success';
        resultEl.textContent = 'HEADER:\n' + JSON.stringify(header, null, 2) +
            '\n\nCLAIMS:\n' + JSON.stringify(payload, null, 2);
    } catch (err) {
        resultEl.className = 'result error';
        resultEl.textContent = 'Decode error: ' + err.message;
    }
}

// --- OIDC Infrastructure Testing ---

async function testDiscovery() {
    const resultEl = document.getElementById('discoveryResult');
    resultEl.style.display = 'block';
    resultEl.className = 'result';
    resultEl.textContent = 'Fetching...';
    try {
        const response = await fetch(BASE_URL + '/.well-known/openid-configuration');
        const data = await response.json();
        resultEl.className = response.ok ? 'result success' : 'result error';
        resultEl.textContent = JSON.stringify(data, null, 2);
    } catch (err) {
        resultEl.className = 'result error';
        resultEl.textContent = 'Error: ' + err.message;
    }
}

async function testJWKS() {
    const resultEl = document.getElementById('jwksResult');
    resultEl.style.display = 'block';
    resultEl.className = 'result';
    resultEl.textContent = 'Fetching...';
    try {
        const response = await fetch(BASE_URL + '/.well-known/jwks.json');
        const data = await response.json();
        resultEl.className = response.ok ? 'result success' : 'result error';
        resultEl.textContent = JSON.stringify(data, null, 2);
    } catch (err) {
        resultEl.className = 'result error';
        resultEl.textContent = 'Error: ' + err.message;
    }
}

async function testIntrospect() {
    const token = document.getElementById('introspectToken').value.trim();
    const resultEl = document.getElementById('introspectResult');

    if (!token) {
        resultEl.style.display = 'block';
        resultEl.className = 'result error';
        resultEl.textContent = 'Access Token is required.';
        return;
    }

    resultEl.style.display = 'block';
    resultEl.className = 'result';
    resultEl.textContent = 'Introspecting...';

    try {
        const response = await fetch(BASE_URL + '/auth/introspect', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-OTP-API-Key': API_KEY
            },
            body: JSON.stringify({ token })
        });
        const data = await response.json();
        resultEl.className = response.ok ? 'result success' : 'result error';
        resultEl.textContent = JSON.stringify(data, null, 2);
    } catch (err) {
        resultEl.className = 'result error';
        resultEl.textContent = 'Error: ' + err.message;
    }
}

// --- Glossary auto-linkifier ---

const GLOSSARY_MAP = {
    'iss': '#claim-iss',
    'sub': '#claim-sub',
    'aud': '#claim-aud',
    'exp': '#claim-exp',
    'iat': '#claim-iat',
    'at_hash': '#claim-at-hash',
    'email_verified': '#claim-email-verified',
    'access_token': '#token-access',
    'auth_token': '#token-access',
    'id_token': '#token-id',
    'refresh_token': '#token-refresh',
    'openid': '#scope-openid',
    'profile': '#scope-profile',
    'openid profile': '#sec-claims-scopes',
    'allowed scopes': '#sec-claims-scopes',
    'claims by scope': '#sec-claims-by-scope',
    'scope': '#sec-claims-scopes-request',
    '/auth/request-otp': '#ep-request-otp',
    '/auth/verify-otp': '#ep-verify-otp',
    '/auth/refresh': '#ep-refresh',
    '/auth/me': '#ep-userinfo',
    '/auth/introspect': '#ep-introspect',
    '/auth/logout': '#ep-logout',
    '/.well-known/openid-configuration': '#ep-discovery',
    '/.well-known/jwks.json': '#ep-jwks',
    'kid': '#ep-jwks',
    'customerId': '#claim-sub',
    'X-OTP-API-Key': '#sec-api-key',
    'RS256': '#sec-oidc-arch',
    'RFC 7662': '#ep-introspect',
    'RFC 7807': '#sec-errors',
};

function buildGlossaryLinks() {
    const secDocs = document.querySelector('.security-docs');
    if (!secDocs) return;

    const codeEls = secDocs.querySelectorAll('code');
    codeEls.forEach(function(el) {
        if (el.closest('.code-example') || el.closest('.mermaid') || el.closest('a')) return;

        const text = el.textContent.trim();
        const href = GLOSSARY_MAP[text];
        if (!href) return;

        if (el.closest(href.replace('#', '[id="') + '"]')) return;

        const link = document.createElement('a');
        link.href = href;
        link.className = 'gref';
        link.title = 'Jump to: ' + text;
        el.parentNode.insertBefore(link, el);
        link.appendChild(el);
    });
}

// --- Inlined search-query-parser (from @strixun/search-query-parser) ---

function parseSearchQuery(query) {
    var trimmed = query.trim();
    if (!trimmed) return { exactPhrases: [], orGroups: [], hasContent: false };

    var exactPhrases = [];
    var processedQuery = trimmed.replace(/"([^"]+)"/g, function(_m, phrase) {
        exactPhrases.push(phrase.toLowerCase());
        return '';
    }).trim();

    var orGroups = [];
    if (processedQuery) {
        var groups = processedQuery.split('|').map(function(g) { return g.trim(); }).filter(Boolean);
        for (var i = 0; i < groups.length; i++) {
            var andTerms = groups[i].split(/\s+/).filter(Boolean);
            if (andTerms.length > 0) orGroups.push(andTerms);
        }
    }

    return { exactPhrases: exactPhrases, orGroups: orGroups, hasContent: exactPhrases.length > 0 || orGroups.length > 0 };
}

function matchesSearchQuery(text, query) {
    var searchText = text.toLowerCase();
    var parsed = parseSearchQuery(query);
    if (!parsed.hasContent) return false;

    for (var i = 0; i < parsed.exactPhrases.length; i++) {
        if (searchText.indexOf(parsed.exactPhrases[i]) === -1) return false;
    }
    if (parsed.orGroups.length === 0) return parsed.exactPhrases.length > 0;

    return parsed.orGroups.some(function(orGroup) {
        return orGroup.every(function(term) {
            if (term.endsWith('*')) {
                return searchText.indexOf(term.slice(0, -1).toLowerCase()) !== -1;
            }
            return searchText.indexOf(term.toLowerCase()) !== -1;
        });
    });
}

// --- Full-page search system ---

var anchorIndex = [];
var contentIndex = [];
var searchActiveIdx = -1;

function findSectionTitle(el) {
    var node = el;
    while (node) {
        if (node.previousElementSibling) {
            node = node.previousElementSibling;
            if (/^H[2-4]$/.test(node.tagName)) return node.textContent.trim();
        } else {
            node = node.parentElement;
        }
    }
    return '';
}

function buildSearchIndex() {
    anchorIndex = [];
    contentIndex = [];
    var main = document.getElementById('main-content');
    if (!main) return;

    // Phase 1: anchored elements (shown first in results)
    main.querySelectorAll('[id]').forEach(function(el) {
        var tag = el.tagName;
        var text = el.textContent.trim();
        if (!text || text.length < 3) return;

        var type = 'anchor';
        if (/^H[2-4]$/.test(tag)) type = 'heading';
        else if (tag === 'TR') type = 'term';

        var section = '';
        if (type !== 'heading') section = findSectionTitle(el);

        anchorIndex.push({
            id: el.id,
            title: text.substring(0, 200),
            section: section,
            type: type,
            el: el,
        });
    });

    // Phase 2: all visible content blocks (paragraphs, list items, table cells, method-boxes)
    var anchorIds = new Set(anchorIndex.map(function(a) { return a.el; }));
    var seenText = new Set();
    var selectors = 'p, li, td, .method-box, .diagram-title, h2, h3, h4, strong';
    main.querySelectorAll(selectors).forEach(function(el) {
        if (el.closest('.code-example') || el.closest('.mermaid') || el.closest('.search-hint')) return;
        if (anchorIds.has(el)) return;

        var text = el.textContent.trim();
        if (!text || text.length < 6) return;

        var key = text.substring(0, 80);
        if (seenText.has(key)) return;
        seenText.add(key);

        var section = findSectionTitle(el);
        contentIndex.push({
            title: text.substring(0, 200),
            section: section,
            el: el,
        });
    });
}

function openSearch() {
    var overlay = document.getElementById('searchOverlay');
    if (!overlay) return;
    overlay.classList.add('open');
    var box = document.querySelector('.search-box');
    if (box) box.classList.remove('has-results');
    var input = document.getElementById('searchInput');
    if (input) { input.value = ''; input.focus(); }
    searchActiveIdx = -1;
    renderSearchResults('');
}

function closeSearch() {
    var overlay = document.getElementById('searchOverlay');
    if (overlay) overlay.classList.remove('open');
}

function renderSearchResults(query) {
    var resultsEl = document.getElementById('searchResults');
    if (!resultsEl) return;
    var box = resultsEl.closest('.search-box');

    if (!query || query.trim().length < 2) {
        resultsEl.innerHTML = '<div class="sr-empty" role="status">Type to search — supports "exact phrases", OR with |, prefix*</div>';
        if (box) box.classList.remove('has-results');
        searchActiveIdx = -1;
        return;
    }

    var parsed = parseSearchQuery(query);
    if (!parsed.hasContent) {
        resultsEl.innerHTML = '<div class="sr-empty" role="status">Type to search — supports "exact phrases", OR with |, prefix*</div>';
        if (box) box.classList.remove('has-results');
        searchActiveIdx = -1;
        return;
    }

    // Phase 1: match anchored items (precedence)
    var anchorMatches = anchorIndex.filter(function(item) {
        return matchesSearchQuery(item.title + ' ' + item.section + ' ' + item.id, query);
    });

    // Phase 2: match full content
    var contentMatches = contentIndex.filter(function(item) {
        return matchesSearchQuery(item.title + ' ' + item.section, query);
    });

    var allMatches = [];
    anchorMatches.forEach(function(m) { allMatches.push({ data: m, kind: 'anchor' }); });
    contentMatches.forEach(function(m) { allMatches.push({ data: m, kind: 'content' }); });

    if (allMatches.length === 0) {
        resultsEl.innerHTML = '<div class="sr-empty" role="status">No results for "' + escHtml(query) + '"</div>';
        if (box) box.classList.remove('has-results');
        searchActiveIdx = -1;
        return;
    }
    if (box) box.classList.add('has-results');

    // Cap results
    var capped = allMatches.slice(0, 50);
    searchActiveIdx = 0;

    var hlTerms = [];
    parsed.exactPhrases.forEach(function(p) { hlTerms.push(p); });
    parsed.orGroups.forEach(function(g) {
        g.forEach(function(t) { hlTerms.push(t.replace(/\*$/, '')); });
    });

    resultsEl.innerHTML = capped.map(function(m, i) {
        var d = m.data;
        var snippet = d.title.length > 120 ? d.title.substring(0, 120) + '...' : d.title;
        var hl = highlightTerms(snippet, hlTerms);
        var cls = i === 0 ? 'sr-item active' : 'sr-item';
        var badge = m.kind === 'anchor'
            ? '<span class="sr-type sr-type-anchor">ref</span>'
            : '<span class="sr-type sr-type-content">content</span>';
        var dataAttr = d.id ? ' data-id="' + d.id + '"' : '';
        var idx = ' data-idx="' + i + '"';
        return '<div class="' + cls + '" role="option" aria-selected="' + (i === 0) + '"' + dataAttr + idx + '>' +
            '<div class="sr-title">' + badge + hl + '</div>' +
            (d.section ? '<div class="sr-section">' + escHtml(d.section) + '</div>' : '') +
            '</div>';
    }).join('');

    // Store element refs for navigation
    capped.forEach(function(m, i) {
        var item = resultsEl.querySelector('[data-idx="' + i + '"]');
        if (item) item._targetEl = m.data.el;
    });

    resultsEl.querySelectorAll('.sr-item').forEach(function(item) {
        item.addEventListener('click', function() { navigateToResultEl(item._targetEl, item.dataset.id); });
    });
}

function escHtml(s) {
    var d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
}

function highlightTerms(text, terms) {
    if (!terms.length) return escHtml(text);
    var escaped = terms.map(function(t) {
        return t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    });
    var re = new RegExp('(' + escaped.join('|') + ')', 'gi');
    return escHtml(text).replace(re, '<mark>$1</mark>');
}

/**
 * Finds the nearest scrollable ancestor (not the viewport) for an element.
 */
function findScrollParent(el) {
    var node = el.parentElement;
    while (node && node !== document.body && node !== document.documentElement) {
        var style = getComputedStyle(node);
        var overflowY = style.overflowY || style.overflow;
        if ((overflowY === 'auto' || overflowY === 'scroll') && node.scrollHeight > node.clientHeight) {
            return node;
        }
        node = node.parentElement;
    }
    return null;
}

/**
 * Two-phase smooth scroll that handles nested scroll containers reliably.
 * Phase 1: scroll the viewport so the container is visible.
 * Phase 2: scroll within the container so the target is visible.
 */
function smoothScrollTo(target) {
    var scrollParent = findScrollParent(target);

    if (scrollParent) {
        var containerRect = scrollParent.getBoundingClientRect();
        var inViewport = containerRect.top >= 0 && containerRect.bottom <= window.innerHeight;

        if (!inViewport) {
            scrollParent.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }

        setTimeout(function() {
            var targetTop = target.getBoundingClientRect().top - scrollParent.getBoundingClientRect().top + scrollParent.scrollTop;
            var desired = targetTop - scrollParent.clientHeight / 3;
            scrollParent.scrollTo({ top: Math.max(0, desired), behavior: 'smooth' });
        }, inViewport ? 0 : 200);
    } else {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

function flashHighlight(target) {
    target.style.transition = 'background 0.3s';
    target.style.background = 'rgba(237, 174, 73, 0.25)';
    setTimeout(function() {
        target.style.background = '';
        setTimeout(function() { target.style.transition = ''; }, 300);
    }, 1500);
}

function navigateToResultEl(el, id) {
    closeSearch();
    var target = id ? document.getElementById(id) : el;
    if (!target) return;

    // Expand the security docs section if collapsed
    var sec = document.getElementById('securityContent');
    if (sec && !sec.classList.contains('expanded') && sec.contains(target)) {
        toggleSecurityDocs();
    }

    // Expand inactive tab if target is inside one
    var tabPanel = target.closest('.tab-content');
    if (tabPanel && !tabPanel.classList.contains('active')) {
        var tabId = tabPanel.id.replace('tab-', '');
        var btn = document.getElementById('tabBtn-' + tabId);
        showTab(tabId, btn);
    }

    setTimeout(function() {
        smoothScrollTo(target);
        setTimeout(function() { flashHighlight(target); }, 300);
    }, 120);
}

function handleSearchKeydown(e) {
    var resultsEl = document.getElementById('searchResults');
    if (!resultsEl) return;
    var items = resultsEl.querySelectorAll('.sr-item');
    if (items.length === 0) return;

    if (e.key === 'ArrowDown') {
        e.preventDefault();
        searchActiveIdx = Math.min(searchActiveIdx + 1, items.length - 1);
        updateActiveItem(items);
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        searchActiveIdx = Math.max(searchActiveIdx - 1, 0);
        updateActiveItem(items);
    } else if (e.key === 'Enter' && searchActiveIdx >= 0 && items[searchActiveIdx]) {
        e.preventDefault();
        navigateToResultEl(items[searchActiveIdx]._targetEl, items[searchActiveIdx].dataset.id);
    }
}

function updateActiveItem(items) {
    items.forEach(function(item, i) {
        var active = i === searchActiveIdx;
        item.classList.toggle('active', active);
        item.setAttribute('aria-selected', String(active));
    });
    if (items[searchActiveIdx]) {
        items[searchActiveIdx].scrollIntoView({ block: 'nearest' });
    }
}

document.addEventListener('keydown', function(e) {
    if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'f')) {
        e.preventDefault();
        openSearch();
    }
    if (e.key === 'Escape') {
        closeSearch();
    }
});

// --- Sidebar TOC ---

var tocEntries = [];

function buildToc() {
    var nav = document.getElementById('tocNav');
    var main = document.getElementById('main-content');
    if (!nav || !main) return;

    var headings = main.querySelectorAll('h2[id], h3[id], h4[id]');
    var html = '';

    headings.forEach(function(h) {
        var level = h.tagName.toLowerCase();
        var text = h.textContent.trim();
        var id = h.id;

        // Strip leading emoji for cleaner display
        var clean = text.replace(/^[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}⚙️⚠️❌📋📖📧🎫🔄👤🔍🚪🔐🔑🔒🛡️🌐🚨⏱️🎯🏗️]+\s*/u, '');

        tocEntries.push({ id: id, text: clean, searchText: clean.toLowerCase(), level: level, el: h });
        html += '<a href="#' + id + '" class="toc-' + level + '" data-toc-id="' + id + '">' + escHtml(clean) + '</a>';
    });

    nav.innerHTML = html;

    // Scroll spy: highlight the TOC item nearest to viewport center
    var tocLinks = nav.querySelectorAll('a[data-toc-id]');
    if (!tocLinks.length) return;

    var observer = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
            if (entry.isIntersecting) {
                var id = entry.target.id;
                tocLinks.forEach(function(a) {
                    a.classList.toggle('toc-active', a.dataset.tocId === id);
                });
            }
        });
    }, { rootMargin: '-10% 0px -70% 0px', threshold: 0 });

    tocEntries.forEach(function(e) { observer.observe(e.el); });

    // Close mobile sidebar on link click & handle collapsed/tab expansion
    tocLinks.forEach(function(link) {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            var sidebar = document.getElementById('tocSidebar');
            if (sidebar) sidebar.classList.remove('open');

            var targetId = link.dataset.tocId;
            var target = document.getElementById(targetId);
            if (!target) return;

            // Expand collapsed security docs if target is inside
            var sec = document.getElementById('securityContent');
            if (sec && !sec.classList.contains('expanded') && sec.contains(target)) {
                toggleSecurityDocs();
            }

            // Switch to correct tab if target is in an inactive tab panel
            var tabPanel = target.closest('.tab-content');
            if (tabPanel && !tabPanel.classList.contains('active')) {
                var tabId = tabPanel.id.replace('tab-', '');
                var btn = document.getElementById('tabBtn-' + tabId);
                showTab(tabId, btn);
            }

            setTimeout(function() {
                smoothScrollTo(target);
                setTimeout(function() { flashHighlight(target); }, 300);
            }, 120);
        });
    });
}

function filterToc(query) {
    var nav = document.getElementById('tocNav');
    if (!nav) return;

    var tocLinks = nav.querySelectorAll('a[data-toc-id]');

    // Remove old content-match results
    nav.querySelectorAll('.toc-divider, .toc-content-match, .toc-section-label').forEach(function(el) { el.remove(); });

    if (!query || query.trim().length < 2) {
        tocLinks.forEach(function(a) { a.classList.remove('toc-hidden'); });
        return;
    }

    // Filter TOC headings using the search-query-parser
    var anyTocMatch = false;
    tocEntries.forEach(function(entry, i) {
        var matches = matchesSearchQuery(entry.searchText + ' ' + entry.id, query);
        tocLinks[i].classList.toggle('toc-hidden', !matches);
        if (matches) anyTocMatch = true;
    });

    // Also search full page content and show results below a divider
    if (contentIndex.length > 0) {
        var parsed = parseSearchQuery(query);
        if (!parsed.hasContent) return;

        var hlTerms = [];
        parsed.exactPhrases.forEach(function(p) { hlTerms.push(p); });
        parsed.orGroups.forEach(function(g) { g.forEach(function(t) { hlTerms.push(t.replace(/\*$/, '')); }); });

        var contentMatches = contentIndex.filter(function(item) {
            return matchesSearchQuery(item.title + ' ' + item.section, query);
        }).slice(0, 20);

        if (contentMatches.length > 0) {
            var divider = document.createElement('div');
            divider.className = 'toc-divider';
            nav.appendChild(divider);

            var label = document.createElement('div');
            label.className = 'toc-section-label';
            label.textContent = 'Page content';
            nav.appendChild(label);

            contentMatches.forEach(function(m) {
                var snippet = m.title.length > 80 ? m.title.substring(0, 80) + '...' : m.title;
                var div = document.createElement('div');
                div.className = 'toc-content-match';
                div.innerHTML = highlightTerms(snippet, hlTerms);
                div.addEventListener('click', function() {
                    navigateToResultEl(m.el, null);
                    // Close mobile sidebar
                    var sidebar = document.getElementById('tocSidebar');
                    if (sidebar) sidebar.classList.remove('open');
                });
                nav.appendChild(div);
            });
        }
    }
}

function toggleTocSidebar() {
    var sidebar = document.getElementById('tocSidebar');
    if (sidebar) sidebar.classList.toggle('open');
}

document.addEventListener('DOMContentLoaded', function() {
    // Show banner when opened from file:// — Origin is null; server does not auto-allow null (user must serve page or add "null" to key origins)
    var isFileOrigin = !window.location.origin || window.location.protocol === 'file:';
    var banner = document.getElementById('fileOriginBanner');
    if (banner && isFileOrigin) {
        banner.style.display = 'block';
    }

    buildGlossaryLinks();
    buildSearchIndex();
    buildToc();
});

// Verify API key on page load
verifyApiKey();
