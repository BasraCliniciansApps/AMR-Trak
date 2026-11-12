// Tolerant search for every drop-down list (Select2): ignores case, dots and spacing,
// matches abbreviated names ("e coli" finds Escherichia coli) and forgives small spelling mistakes.
// Only affects how a list is filtered while typing; stored values and all calculations are untouched.
(function () {
    function norm(s) {
        return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    }
    // Edit distance where swapping two neighbouring letters ("auerus" for "aureus") counts as one mistake
    function lev(a, b, max) {
        if (Math.abs(a.length - b.length) > max) return max + 1;
        let pp = null, prev = []; for (let j = 0; j <= b.length; j++) prev[j] = j;
        for (let i = 1; i <= a.length; i++) {
            const cur = [i]; let rowMin = i;
            for (let j = 1; j <= b.length; j++) {
                let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
                if (pp && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, pp[j - 2] + 1);
                cur[j] = v; if (v < rowMin) rowMin = v;
            }
            if (rowMin > max) return max + 1;
            pp = prev; prev = cur;
        }
        return prev[b.length];
    }
    // Lower score = better. Returns null when the term does not match.
    function score(term, hay) {
        const q = norm(term);
        if (!q) return 0;
        const h = norm(hay);
        if (!h) return null;
        const ht = h.split(' '), qt = q.split(' ');
        let total = 0;
        for (const t of qt) {
            let best = null;
            for (const w of ht) {
                let s = null;
                if (w === t) s = 0;
                else if (w.startsWith(t)) s = 0.5;
                else if (t.length >= 3 && w.includes(t)) s = 2;
                else if (t.length >= 4) {
                    const max = t.length >= 8 ? 2 : 1;
                    const d = Math.min(lev(t, w.slice(0, t.length), max), lev(t, w, max));
                    if (d <= max) s = 3 + d;
                }
                if (s !== null && (best === null || s < best)) best = s;
            }
            if (best === null) { total = null; break; }
            total += best;
        }
        if (total !== null) return total;
        // Typed without spaces ("ecoli", "tmpsmx"): compare against the compact text
        const qc = q.replace(/ /g, ''), hc = h.replace(/ /g, '');
        if (qc.length >= 2 && hc.startsWith(qc)) return 1;
        if (qc.length >= 3 && hc.includes(qc)) return 3;
        if (qc.length >= 5) { const max = qc.length >= 8 ? 2 : 1; const d = lev(qc, hc.slice(0, qc.length), max); if (d <= max) return 5 + d; }
        return null;
    }
    function matcher(params, data) {
        const term = params.term;
        if (term == null || String(term).trim() === '') return data;
        if (data.children && data.children.length) {
            const kids = [];
            data.children.forEach(c => { const m = matcher(params, c); if (m) kids.push(m); });
            if (!kids.length) return null;
            const out = Object.assign({}, data); out.children = kids; return out;
        }
        const id = (data.id != null && !/^(all|total|)$/i.test(String(data.id)) && isNaN(Number(data.id))) ? ' ' + data.id : '';
        const s = score(term, (data.text || '') + id);
        if (s === null) return null;
        const out = Object.assign({}, data); out._score = s; return out;
    }
    function sorter(results) {
        // Best matches first; lists without a typed term keep their original order
        if (!results.some(r => r && typeof r._score === 'number')) return results;
        return results.map((r, i) => [r, i]).sort((a, b) => ((a[0]._score || 0) - (b[0]._score || 0)) || (a[1] - b[1])).map(x => x[0]);
    }
    window.AMR_SEARCH = { score: score, norm: norm };
    try {
        if (window.jQuery && jQuery.fn.select2) {
            jQuery.fn.select2.defaults.set('matcher', matcher);
            jQuery.fn.select2.defaults.set('sorter', sorter);
        }
    } catch (e) { console.warn('Tolerant search not enabled', e); }
})();
