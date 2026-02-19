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
            document.getElementById('step2').classList.add('completed');
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
            document.getElementById('step3').classList.add('completed');
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
            document.getElementById('step4').classList.add('completed');
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
    const clientId = document.getElementById('introspectClientId').value.trim();
    const resultEl = document.getElementById('introspectResult');

    if (!token || !clientId) {
        resultEl.style.display = 'block';
        resultEl.className = 'result error';
        resultEl.textContent = 'Both Access Token and Client ID are required.';
        return;
    }

    resultEl.style.display = 'block';
    resultEl.className = 'result';
    resultEl.textContent = 'Introspecting...';

    try {
        const response = await fetch(BASE_URL + '/auth/introspect', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, client_id: clientId })
        });
        const data = await response.json();
        resultEl.className = response.ok ? 'result success' : 'result error';
        resultEl.textContent = JSON.stringify(data, null, 2);
    } catch (err) {
        resultEl.className = 'result error';
        resultEl.textContent = 'Error: ' + err.message;
    }
}

// Verify API key on page load
verifyApiKey();
