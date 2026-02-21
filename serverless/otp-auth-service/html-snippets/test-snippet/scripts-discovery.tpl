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
