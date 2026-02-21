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
