/**
 * OTP Auth Test Snippet - Core
 * Variables {{API_KEY}} and {{BASE_URL}} are replaced at generation time
 */
const API_KEY = '{{API_KEY}}';
const BASE_URL = '{{BASE_URL}}';
let authToken = null;
let idToken = null;
let refreshToken = null;

function focusAndScrollTo(el) {
    if (!el || typeof el.scrollIntoView !== 'function') return;
    var reduceMotion = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
    setTimeout(function() { el.focus(); }, reduceMotion ? 0 : 100);
}

function toggleSecurityDocs() {
    const content = document.getElementById('securityContent');
    const icon = document.getElementById('toggleIcon');
    const header = content.previousElementSibling;
    const expanded = content.classList.toggle('expanded');
    icon.textContent = expanded ? '▼' : '▶';
    if (header) header.setAttribute('aria-expanded', String(expanded));
}

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
