document.addEventListener('DOMContentLoaded', function() {
    var isFileOrigin = !window.location.origin || window.location.protocol === 'file:';
    var banner = document.getElementById('fileOriginBanner');
    if (banner && isFileOrigin) {
        banner.style.display = 'block';
    }
    buildGlossaryLinks();
    buildSearchIndex();
    buildToc();
});
verifyApiKey();
