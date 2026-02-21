var tocEntries = [];

function buildToc() {
    var nav = document.getElementById('tocNav');
    var main = document.getElementById('main-content');
    if (!nav || !main) return;
    var headings = main.querySelectorAll('h2[id], h3[id], h4[id]');
    var html = '';
    headings.forEach(function(h) {
        var level = h.tagName.toLowerCase();
        var text = h.textContent.trim();
        var id = h.id;
        var clean = text.replace(/^[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}⚙️⚠️❌📋📖📧🎫🔄👤🔍🚪🔐🔑🔒🛡️🌐🚨⏱️🎯🏗️]+\s*/u, '');
        tocEntries.push({ id: id, text: clean, searchText: clean.toLowerCase(), level: level, el: h });
        html += '<a href="#' + id + '" class="toc-' + level + '" data-toc-id="' + id + '">' + escHtml(clean) + '</a>';
    });
    nav.innerHTML = html;
    var tocLinks = nav.querySelectorAll('a[data-toc-id]');
    if (!tocLinks.length) return;
    var observer = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
            if (entry.isIntersecting) {
                var id = entry.target.id;
                tocLinks.forEach(function(a) {
                    a.classList.toggle('toc-active', a.dataset.tocId === id);
                });
            }
        });
    }, { rootMargin: '-10% 0px -70% 0px', threshold: 0 });
    tocEntries.forEach(function(e) { observer.observe(e.el); });
    tocLinks.forEach(function(link) {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            var sidebar = document.getElementById('tocSidebar');
            if (sidebar) sidebar.classList.remove('open');
            var targetId = link.dataset.tocId;
            var target = document.getElementById(targetId);
            if (!target) return;
            var sec = document.getElementById('securityContent');
            if (sec && !sec.classList.contains('expanded') && sec.contains(target)) {
                toggleSecurityDocs();
            }
            var tabPanel = target.closest('.tab-content');
            if (tabPanel && !tabPanel.classList.contains('active')) {
                var tabId = tabPanel.id.replace('tab-', '');
                var btn = document.getElementById('tabBtn-' + tabId);
                showTab(tabId, btn);
            }
            setTimeout(function() {
                smoothScrollTo(target);
                setTimeout(function() { flashHighlight(target); }, 300);
            }, 120);
        });
    });
}

function filterToc(query) {
    var nav = document.getElementById('tocNav');
    if (!nav) return;
    var tocLinks = nav.querySelectorAll('a[data-toc-id]');
    nav.querySelectorAll('.toc-divider, .toc-content-match, .toc-section-label').forEach(function(el) { el.remove(); });
    if (!query || query.trim().length < 2) {
        tocLinks.forEach(function(a) { a.classList.remove('toc-hidden'); });
        return;
    }
    var anyTocMatch = false;
    tocEntries.forEach(function(entry, i) {
        var matches = matchesSearchQuery(entry.searchText + ' ' + entry.id, query);
        tocLinks[i].classList.toggle('toc-hidden', !matches);
        if (matches) anyTocMatch = true;
    });
    if (contentIndex.length > 0) {
        var parsed = parseSearchQuery(query);
        if (!parsed.hasContent) return;
        var hlTerms = [];
        parsed.exactPhrases.forEach(function(p) { hlTerms.push(p); });
        parsed.orGroups.forEach(function(g) { g.forEach(function(t) { hlTerms.push(t.replace(/\*$/, '')); }); });
        var contentMatches = contentIndex.filter(function(item) {
            return matchesSearchQuery(item.title + ' ' + item.section, query);
        }).slice(0, 20);
        if (contentMatches.length > 0) {
            var divider = document.createElement('div');
            divider.className = 'toc-divider';
            nav.appendChild(divider);
            var label = document.createElement('div');
            label.className = 'toc-section-label';
            label.textContent = 'Page content';
            nav.appendChild(label);
            contentMatches.forEach(function(m) {
                var snippet = m.title.length > 80 ? m.title.substring(0, 80) + '...' : m.title;
                var div = document.createElement('div');
                div.className = 'toc-content-match';
                div.innerHTML = highlightTerms(snippet, hlTerms);
                div.addEventListener('click', function() {
                    navigateToResultEl(m.el, null);
                    var sidebar = document.getElementById('tocSidebar');
                    if (sidebar) sidebar.classList.remove('open');
                });
                nav.appendChild(div);
            });
        }
    }
}

function toggleTocSidebar() {
    var sidebar = document.getElementById('tocSidebar');
    if (sidebar) sidebar.classList.toggle('open');
}
