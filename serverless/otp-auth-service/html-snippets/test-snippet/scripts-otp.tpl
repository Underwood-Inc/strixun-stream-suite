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
