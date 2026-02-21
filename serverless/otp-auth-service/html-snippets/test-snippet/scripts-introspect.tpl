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
