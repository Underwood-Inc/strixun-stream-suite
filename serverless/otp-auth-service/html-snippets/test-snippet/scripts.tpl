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

// Toggle security documentation
function toggleSecurityDocs() {
    const content = document.getElementById('securityContent');
    const icon = document.getElementById('toggleIcon');
    content.classList.toggle('expanded');
    icon.textContent = content.classList.contains('expanded') ? '▼' : '▶';
}

// Tab switching for integration methods
function showTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    
    const tab = document.getElementById('tab-' + tabName);
    if (tab) tab.classList.add('active');
    event.target.classList.add('active');
    
    // Re-render mermaid diagrams in the newly visible tab
    if (window.mermaid) {
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
    'openid profile': '#sec-scopes',
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

// --- Page search system ---

let searchIndex = [];
let searchActiveIdx = -1;

function buildSearchIndex() {
    searchIndex = [];
    const container = document.querySelector('.container');
    if (!container) return;

    const headings = container.querySelectorAll('h2[id], h3[id], h4[id]');
    headings.forEach(function(h) {
        const parent = h.closest('h3[id], h2[id]');
        const section = (parent && parent !== h) ? parent.textContent.trim() : '';
        searchIndex.push({
            id: h.id,
            title: h.textContent.trim(),
            section: section,
            type: 'heading',
            el: h,
        });
    });

    const rows = container.querySelectorAll('tr[id]');
    rows.forEach(function(r) {
        const cells = r.querySelectorAll('td');
        const heading = r.closest('.security-docs')
            ? r.closest('table').previousElementSibling
            : null;
        let sectionTitle = '';
        let node = r.closest('table');
        while (node && !sectionTitle) {
            node = node.previousElementSibling;
            if (node && (node.tagName === 'H3' || node.tagName === 'H4')) {
                sectionTitle = node.textContent.trim();
            }
        }
        searchIndex.push({
            id: r.id,
            title: Array.from(cells).map(function(c) { return c.textContent.trim(); }).join(' — '),
            section: sectionTitle,
            type: 'term',
            el: r,
        });
    });

    const methodBoxes = container.querySelectorAll('.method-box h4[id]');
    methodBoxes.forEach(function(h4) {
        const box = h4.closest('.method-box');
        if (!box) return;
        const desc = box.querySelector('p');
        if (desc) {
            searchIndex.push({
                id: h4.id,
                title: h4.textContent.trim(),
                section: desc.textContent.trim().substring(0, 120),
                type: 'endpoint',
                el: h4,
            });
        }
    });
}

function openSearch() {
    const overlay = document.getElementById('searchOverlay');
    if (!overlay) return;
    overlay.classList.add('open');
    const input = overlay.querySelector('input');
    input.value = '';
    input.focus();
    searchActiveIdx = -1;
    renderSearchResults('');
}

function closeSearch() {
    const overlay = document.getElementById('searchOverlay');
    if (!overlay) overlay.classList.remove('open');
    if (overlay) overlay.classList.remove('open');
}

function renderSearchResults(query) {
    const resultsEl = document.getElementById('searchResults');
    if (!resultsEl) return;

    if (!query || query.length < 2) {
        resultsEl.innerHTML = '<div class="sr-empty">Start typing to search the guide...</div>';
        searchActiveIdx = -1;
        return;
    }

    const q = query.toLowerCase();
    const matches = searchIndex.filter(function(item) {
        return item.title.toLowerCase().includes(q) ||
               item.section.toLowerCase().includes(q) ||
               item.id.toLowerCase().includes(q);
    });

    if (matches.length === 0) {
        resultsEl.innerHTML = '<div class="sr-empty">No results for "' + query + '"</div>';
        searchActiveIdx = -1;
        return;
    }

    searchActiveIdx = 0;
    resultsEl.innerHTML = matches.map(function(m, i) {
        const hl = highlightMatch(m.title, q);
        const cls = i === 0 ? 'sr-item active' : 'sr-item';
        return '<div class="' + cls + '" data-href="#' + m.id + '">' +
            '<div class="sr-title">' + hl + '</div>' +
            (m.section ? '<div class="sr-section">' + m.section + '</div>' : '') +
            '</div>';
    }).join('');

    resultsEl.querySelectorAll('.sr-item').forEach(function(item) {
        item.addEventListener('click', function() {
            navigateToResult(item.dataset.href);
        });
    });
}

function highlightMatch(text, query) {
    const idx = text.toLowerCase().indexOf(query);
    if (idx === -1) return text;
    return text.substring(0, idx) +
        '<mark>' + text.substring(idx, idx + query.length) + '</mark>' +
        text.substring(idx + query.length);
}

function navigateToResult(href) {
    closeSearch();
    const target = document.querySelector(href);
    if (!target) return;

    target.scrollIntoView({ behavior: 'smooth', block: 'center' });

    target.style.transition = 'background 0.3s';
    target.style.background = 'rgba(237, 174, 73, 0.25)';
    setTimeout(function() {
        target.style.background = '';
        setTimeout(function() { target.style.transition = ''; }, 300);
    }, 1500);
}

function handleSearchKeydown(e) {
    const resultsEl = document.getElementById('searchResults');
    if (!resultsEl) return;
    const items = resultsEl.querySelectorAll('.sr-item');
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
        navigateToResult(items[searchActiveIdx].dataset.href);
    }
}

function updateActiveItem(items) {
    items.forEach(function(item, i) {
        item.classList.toggle('active', i === searchActiveIdx);
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

document.addEventListener('DOMContentLoaded', function() {
    buildGlossaryLinks();
    buildSearchIndex();
});

// Verify API key on page load
verifyApiKey();
