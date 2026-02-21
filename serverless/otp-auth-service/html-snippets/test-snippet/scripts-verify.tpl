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
