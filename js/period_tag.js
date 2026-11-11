// Period tag: a small label on the top-right of every Analytics result card that names the analysis period in force.
// It follows Settings > Analysis period; the Heatmap card shows "Custom dates" when its own From/To fields are filled.
(function () {
    var NAMES = { year: 'Last 12 months', all: 'All completed years', alltimes: 'All times', calyear: 'Calendar year', quarter: 'Last 3 months', month: 'Last month', range: 'Specific period' };
    // [element id, host selector]: the card or panel that holds the chart
    var TARGETS = ['chartGuidedPie', 'chartPathoAMR', 'chartAbxAMR', 'an_cum_table', 'heatmapWrapper'];
    function hostOf(id) { var el = document.getElementById(id); return el ? (el.closest('[id$="_content"]') || el.closest('.mobile-card')) : null; }
    function nameFor(id) {
        if (id === 'heatmapWrapper') {
            var a = document.getElementById('adv_start'), b = document.getElementById('adv_end');
            if ((a && a.value) || (b && b.value)) return 'Custom dates';
        }
        var t = 'year'; try { t = anPeriod(); } catch (e) {}
        return NAMES[t] || NAMES.year;
    }
    window.updatePeriodTags = function () {
        TARGETS.forEach(function (id) {
            var host = hostOf(id); if (!host) return;
            var tag = host.querySelector(':scope > .per-tag');
            if (!tag) {
                host.classList.add('per-host');
                tag = document.createElement('button');
                tag.type = 'button'; tag.className = 'per-tag'; tag.setAttribute('data-noprint', '1');
                tag.title = 'Analysis period. Tap to change it in Settings.';
                tag.addEventListener('click', function () { if (window.showUserSettings) window.showUserSettings(); });
                host.insertBefore(tag, host.firstChild);
            }
            var n = nameFor(id);
            tag.innerHTML = '<svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 11h18"/></svg><span></span>';
            tag.lastChild.textContent = n;
        });
    };
    document.addEventListener('change', function (e) { if (e.target && (e.target.id === 'adv_start' || e.target.id === 'adv_end')) window.updatePeriodTags(); });
    document.addEventListener('DOMContentLoaded', function () { window.updatePeriodTags(); });
})();
