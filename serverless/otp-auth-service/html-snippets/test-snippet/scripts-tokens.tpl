async function refreshTokens() {
    const btn = document.getElementById('refreshBtn');
    const resultEl = document.getElementById('refreshResult');
    btn.disabled = true;
    btn.textContent = 'Refreshing...';
    try {
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
