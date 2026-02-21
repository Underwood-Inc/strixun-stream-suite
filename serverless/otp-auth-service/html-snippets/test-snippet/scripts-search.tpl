function parseSearchQuery(query) {
    var trimmed = query.trim();
    if (!trimmed) return { exactPhrases: [], orGroups: [], hasContent: false };
    var exactPhrases = [];
    var processedQuery = trimmed.replace(/"([^"]+)"/g, function(_m, phrase) {
        exactPhrases.push(phrase.toLowerCase());
        return '';
    }).trim();
    var orGroups = [];
    if (processedQuery) {
        var groups = processedQuery.split('|').map(function(g) { return g.trim(); }).filter(Boolean);
        for (var i = 0; i < groups.length; i++) {
            var andTerms = groups[i].split(/\s+/).filter(Boolean);
            if (andTerms.length > 0) orGroups.push(andTerms);
        }
    }
    return { exactPhrases: exactPhrases, orGroups: orGroups, hasContent: exactPhrases.length > 0 || orGroups.length > 0 };
}

function matchesSearchQuery(text, query) {
    var searchText = text.toLowerCase();
    var parsed = parseSearchQuery(query);
    if (!parsed.hasContent) return false;
    for (var i = 0; i < parsed.exactPhrases.length; i++) {
        if (searchText.indexOf(parsed.exactPhrases[i]) === -1) return false;
    }
    if (parsed.orGroups.length === 0) return parsed.exactPhrases.length > 0;
    return parsed.orGroups.some(function(orGroup) {
        return orGroup.every(function(term) {
            if (term.endsWith('*')) {
                return searchText.indexOf(term.slice(0, -1).toLowerCase()) !== -1;
            }
            return searchText.indexOf(term.toLowerCase()) !== -1;
        });
    });
}

var anchorIndex = [];
var contentIndex = [];
var searchActiveIdx = -1;

function findSectionTitle(el) {
    var node = el;
    while (node) {
        if (node.previousElementSibling) {
            node = node.previousElementSibling;
            if (/^H[2-4]$/.test(node.tagName)) return node.textContent.trim();
        } else {
            node = node.parentElement;
        }
    }
    return '';
}

function buildSearchIndex() {
    anchorIndex = [];
    contentIndex = [];
    var main = document.getElementById('main-content');
    if (!main) return;
    main.querySelectorAll('[id]').forEach(function(el) {
        var tag = el.tagName;
        var text = el.textContent.trim();
        if (!text || text.length < 3) return;
        var type = 'anchor';
        if (/^H[2-4]$/.test(tag)) type = 'heading';
        else if (tag === 'TR') type = 'term';
        var section = type !== 'heading' ? findSectionTitle(el) : '';
        anchorIndex.push({ id: el.id, title: text.substring(0, 200), section: section, type: type, el: el });
    });
    var anchorIds = new Set(anchorIndex.map(function(a) { return a.el; }));
    var seenText = new Set();
    var selectors = 'p, li, td, .method-box, .diagram-title, h2, h3, h4, strong';
    main.querySelectorAll(selectors).forEach(function(el) {
        if (el.closest('.code-example') || el.closest('.mermaid') || el.closest('.search-hint')) return;
        if (anchorIds.has(el)) return;
        var text = el.textContent.trim();
        if (!text || text.length < 6) return;
        var key = text.substring(0, 80);
        if (seenText.has(key)) return;
        seenText.add(key);
        var section = findSectionTitle(el);
        contentIndex.push({ title: text.substring(0, 200), section: section, el: el });
    });
}

function openSearch() {
    var overlay = document.getElementById('searchOverlay');
    if (!overlay) return;
    overlay.classList.add('open');
    var box = document.querySelector('.search-box');
    if (box) box.classList.remove('has-results');
    var input = document.getElementById('searchInput');
    if (input) { input.value = ''; input.focus(); }
    searchActiveIdx = -1;
    renderSearchResults('');
}

function closeSearch() {
    var overlay = document.getElementById('searchOverlay');
    if (overlay) overlay.classList.remove('open');
}

function escHtml(s) {
    var d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
}

function highlightTerms(text, terms) {
    if (!terms.length) return escHtml(text);
    var escaped = terms.map(function(t) {
        return t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    });
    var re = new RegExp('(' + escaped.join('|') + ')', 'gi');
    return escHtml(text).replace(re, '<mark>$1</mark>');
}

function renderSearchResults(query) {
    var resultsEl = document.getElementById('searchResults');
    if (!resultsEl) return;
    var box = resultsEl.closest('.search-box');
    if (!query || query.trim().length < 2) {
        resultsEl.innerHTML = '<div class="sr-empty" role="status">Type to search — supports "exact phrases", OR with |, prefix*</div>';
        if (box) box.classList.remove('has-results');
        searchActiveIdx = -1;
        return;
    }
    var parsed = parseSearchQuery(query);
    if (!parsed.hasContent) {
        resultsEl.innerHTML = '<div class="sr-empty" role="status">Type to search — supports "exact phrases", OR with |, prefix*</div>';
        if (box) box.classList.remove('has-results');
        searchActiveIdx = -1;
        return;
    }
    var anchorMatches = anchorIndex.filter(function(item) {
        return matchesSearchQuery(item.title + ' ' + item.section + ' ' + item.id, query);
    });
    var contentMatches = contentIndex.filter(function(item) {
        return matchesSearchQuery(item.title + ' ' + item.section, query);
    });
    var allMatches = [];
    anchorMatches.forEach(function(m) { allMatches.push({ data: m, kind: 'anchor' }); });
    contentMatches.forEach(function(m) { allMatches.push({ data: m, kind: 'content' }); });
    if (allMatches.length === 0) {
        resultsEl.innerHTML = '<div class="sr-empty" role="status">No results for "' + escHtml(query) + '"</div>';
        if (box) box.classList.remove('has-results');
        searchActiveIdx = -1;
        return;
    }
    if (box) box.classList.add('has-results');
    var capped = allMatches.slice(0, 50);
    searchActiveIdx = 0;
    var hlTerms = [];
    parsed.exactPhrases.forEach(function(p) { hlTerms.push(p); });
    parsed.orGroups.forEach(function(g) {
        g.forEach(function(t) { hlTerms.push(t.replace(/\*$/, '')); });
    });
    resultsEl.innerHTML = capped.map(function(m, i) {
        var d = m.data;
        var snippet = d.title.length > 120 ? d.title.substring(0, 120) + '...' : d.title;
        var hl = highlightTerms(snippet, hlTerms);
        var cls = i === 0 ? 'sr-item active' : 'sr-item';
        var badge = m.kind === 'anchor'
            ? '<span class="sr-type sr-type-anchor">ref</span>'
            : '<span class="sr-type sr-type-content">content</span>';
        var dataAttr = d.id ? ' data-id="' + d.id + '"' : '';
        var idx = ' data-idx="' + i + '"';
        return '<div class="' + cls + '" role="option" aria-selected="' + (i === 0) + '"' + dataAttr + idx + '>' +
            '<div class="sr-title">' + badge + hl + '</div>' +
            (d.section ? '<div class="sr-section">' + escHtml(d.section) + '</div>' : '') +
            '</div>';
    }).join('');
    capped.forEach(function(m, i) {
        var item = resultsEl.querySelector('[data-idx="' + i + '"]');
        if (item) item._targetEl = m.data.el;
    });
    resultsEl.querySelectorAll('.sr-item').forEach(function(item) {
        item.addEventListener('click', function() { navigateToResultEl(item._targetEl, item.dataset.id); });
    });
}

function findScrollParent(el) {
    var node = el.parentElement;
    while (node && node !== document.body && node !== document.documentElement) {
        var style = getComputedStyle(node);
        var overflowY = style.overflowY || style.overflow;
        if ((overflowY === 'auto' || overflowY === 'scroll') && node.scrollHeight > node.clientHeight) {
            return node;
        }
        node = node.parentElement;
    }
    return null;
}

function smoothScrollTo(target) {
    var scrollParent = findScrollParent(target);
    if (scrollParent) {
        var containerRect = scrollParent.getBoundingClientRect();
        var inViewport = containerRect.top >= 0 && containerRect.bottom <= window.innerHeight;
        if (!inViewport) {
            scrollParent.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
        setTimeout(function() {
            var targetTop = target.getBoundingClientRect().top - scrollParent.getBoundingClientRect().top + scrollParent.scrollTop;
            var desired = targetTop - scrollParent.clientHeight / 3;
            scrollParent.scrollTo({ top: Math.max(0, desired), behavior: 'smooth' });
        }, inViewport ? 0 : 200);
    } else {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

function flashHighlight(target) {
    target.style.transition = 'background 0.3s';
    target.style.background = 'rgba(237, 174, 73, 0.25)';
    setTimeout(function() {
        target.style.background = '';
        setTimeout(function() { target.style.transition = ''; }, 300);
    }, 1500);
}

function navigateToResultEl(el, id) {
    closeSearch();
    var target = id ? document.getElementById(id) : el;
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
}

function handleSearchKeydown(e) {
    var resultsEl = document.getElementById('searchResults');
    if (!resultsEl) return;
    var items = resultsEl.querySelectorAll('.sr-item');
    if (items.length === 0) return;
    if (e.key === 'ArrowDown') {
        e.preventDefault();
        searchActiveIdx = Math.min(searchActiveIdx + 1, items.length - 1);
        updateActiveItem(items);
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        searchActiveIdx = Math.max(searchActiveIdx - 1, 0);
        updateActiveItem(items);
    } else if (e.key === 'Enter' && searchActiveIdx >= 0 && items[searchActiveIdx]) {
        e.preventDefault();
        navigateToResultEl(items[searchActiveIdx]._targetEl, items[searchActiveIdx].dataset.id);
    }
}

function updateActiveItem(items) {
    items.forEach(function(item, i) {
        var active = i === searchActiveIdx;
        item.classList.toggle('active', active);
        item.setAttribute('aria-selected', String(active));
    });
    if (items[searchActiveIdx]) {
        items[searchActiveIdx].scrollIntoView({ block: 'nearest' });
    }
}

document.addEventListener('keydown', function(e) {
    if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'f')) {
        e.preventDefault();
        openSearch();
    }
    if (e.key === 'Escape') {
        closeSearch();
    }
});
