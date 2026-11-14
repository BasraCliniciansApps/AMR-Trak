/* Save charts and tables as high-resolution PNG images (button next to Print).
   Uses the same item list as the print dialog (printGroups). Charts are re-drawn by Chart.js at a higher pixel ratio,
   tables and tiles are drawn from a styled copy through an SVG image, so every image is sharp at the chosen width. */
(function () {
    'use strict';
    const SIZES = [['1600', 'Standard (1600 px wide)'], ['2400', 'High (2400 px wide)'], ['3600', 'Very high (3600 px wide)']];
    const MAX_PIXELS = 36e6;          // keeps phones from running out of memory
    const PROPS = ['display', 'flex-direction', 'flex-wrap', 'align-items', 'justify-content', 'gap', 'grid-template-columns', 'box-sizing',
        'color', 'background-color', 'font-family', 'font-size', 'font-weight', 'font-style', 'line-height', 'letter-spacing', 'text-align', 'text-transform',
        'white-space', 'vertical-align', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
        'border-top', 'border-right', 'border-bottom', 'border-left', 'border-radius', 'border-collapse', 'border-spacing', 'fill', 'stroke', 'stroke-width', 'opacity'];

    function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

    // copy the computed look of every node into inline styles, so the copy needs no stylesheet
    function styledCopy(src) {
        const clone = src.cloneNode(true);
        const a = [src, ...src.querySelectorAll('*')], b = [clone, ...clone.querySelectorAll('*')];
        a.forEach((n, i) => {
            const t = b[i]; if (!t || !t.style) return;
            const cs = getComputedStyle(n);
            if (cs.display === 'none') { t.style.display = 'none'; return; }
            PROPS.forEach(p => { const v = cs.getPropertyValue(p); if (v) t.style.setProperty(p, v); });
            if (/^(TABLE|TH|TD|DIV|SECTION|UL|OL)$/.test(n.tagName)) { const w = n.getBoundingClientRect().width; if (w) t.style.setProperty('width', w + 'px'); }
        });
        clone.style.margin = '0';
        return clone;
    }

    // a table or tiles block -> {url, w, h} (SVG with the HTML inside); must run while the card is open
    function htmlBlock(el) {
        const tbl = el.querySelector('table');
        const w = Math.ceil(Math.max(el.scrollWidth, el.clientWidth, tbl ? tbl.scrollWidth : 0, 40));
        const copy = styledCopy(el);
        copy.style.width = w + 'px'; copy.style.overflow = 'visible'; copy.style.maxHeight = 'none'; copy.style.maxWidth = 'none';
        const stage = document.createElement('div');
        stage.style.cssText = 'position:fixed;left:-99999px;top:0;visibility:hidden;width:' + w + 'px';
        stage.appendChild(copy); document.body.appendChild(stage);
        const h = Math.ceil(Math.max(copy.scrollHeight, copy.getBoundingClientRect().height, 20));
        document.body.removeChild(stage);
        const xml = new XMLSerializer().serializeToString(copy);
        return { w, h, xml };
    }
    function svgToCanvas(b, u) {
        return new Promise((resolve, reject) => {
            const W = Math.round(b.w * u), H = Math.round(b.h * u);
            const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + b.w + ' ' + b.h + '"><foreignObject x="0" y="0" width="' + b.w + '" height="' + b.h + '"><div xmlns="http://www.w3.org/1999/xhtml">' + b.xml + '</div></foreignObject></svg>';
            const img = new Image();
            img.onload = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, W, H); g.drawImage(img, 0, 0, W, H); resolve(c); };
            img.onerror = () => reject(new Error('table render failed'));
            img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
        });
    }

    // a chart canvas drawn again at pixel ratio u; must run while the card is open
    function chartBlock(el, u) {
        const ch = window.Chart && Chart.getChart && Chart.getChart(el);
        const cssW = el.clientWidth || (el.width / (window.devicePixelRatio || 1));
        if (!ch) { const c = document.createElement('canvas'); c.width = el.width; c.height = el.height; c.getContext('2d').drawImage(el, 0, 0); return { canvas: c, cssW: cssW || el.width }; }
        const an = ch.options.animation, old = ch.options.devicePixelRatio;
        let out;
        try {
            ch.options.animation = false; ch.options.devicePixelRatio = u;
            ch.resize(); ch.update('none'); ch.draw && ch.draw();
            out = document.createElement('canvas'); out.width = el.width; out.height = el.height;
            const g = out.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, out.width, out.height); g.drawImage(el, 0, 0);
        } finally {
            ch.options.devicePixelRatio = old === undefined ? (window.devicePixelRatio || 1) : old; ch.options.animation = an;
            try { ch.resize(); ch.update('none'); } catch (e) {}
        }
        return { canvas: out, cssW };
    }

    function wrapText(g, text, maxW) {
        const words = String(text).split(/\s+/), lines = []; let cur = '';
        words.forEach(w => { const t = cur ? cur + ' ' + w : w; if (g.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; });
        if (cur) lines.push(cur); return lines;
    }

    function contextLine(item) {
        const tab = window._currentTab || 'analytics', parts = [];
        try { parts.push('Unit: ' + scopeLabel()); } catch (e) {}
        try {
            if (tab === 'analytics') parts.push(periodText());
            else if (item.sec.labelSel) { const t = ((document.querySelector(item.sec.labelSel) || {}).textContent || '').replace(' - ' + scopeLabel(), '').trim(); if (t) parts.push(t); }
        } catch (e) {}
        try { const s = typeof item.c.sub === 'function' ? item.c.sub() : ''; if (s) parts.push(s); } catch (e) {}
        return parts.filter(Boolean).join('   |   ');
    }

    // the symbol keys and notes the screen shows under the chart, as plain lines of text
    function noteLines(item) {
        const c = item.c, el = item.el; let h = '';
        try {
            if (c.key) { const ul = document.getElementById('keylist_' + c.key); if (ul && ul.innerHTML.trim()) h += ul.innerHTML.replace(/<\/li>/gi, '\n'); }
            const nid = c.noteSel ? c.noteSel.slice(1) : (el.id && /_table$/.test(el.id) ? el.id.replace(/_table$/, '_note') : '');
            const nel = nid ? document.getElementById(nid) : null;
            if (nel && nel.innerHTML.trim()) h += '\n' + nel.innerHTML;
            if (c.legendSel) { const lg = document.querySelector(c.legendSel); if (lg && lg.textContent.trim()) h += '\n' + lg.innerHTML; }
            if (typeof printClean === 'function') h = printClean(h);
        } catch (e) { return []; }
        const d = document.createElement('div'); d.innerHTML = h.replace(/<br\s*\/?>|<\/(p|div|li|ul|ol)>/gi, '\n');
        return (d.textContent || '').split(/\n+/).map(x => x.replace(/\s+/g, ' ').trim()).filter(Boolean);
    }

    // title + filters above, notes and app name below; u = output pixels per screen pixel
    function compose(body, cssW, u, item, withTitle, withNotes) {
        const pad = Math.round(18 * u), bw = body.width, titleSize = 17 * u, subSize = 11.5 * u, footSize = 10 * u;
        const probe = document.createElement('canvas').getContext('2d');
        const family = 'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';
        let head = [], sub = [], hh = 0;
        const title = chartTitleOf(item.c.title), ctx = contextLine(item);
        if (withTitle) {
            probe.font = '700 ' + titleSize + 'px ' + family; head = wrapText(probe, title, bw);
            probe.font = '400 ' + subSize + 'px ' + family; sub = ctx ? wrapText(probe, ctx, bw) : [];
            hh = head.length * titleSize * 1.3 + (sub.length ? sub.length * subSize * 1.45 + 6 * u : 0) + 12 * u;
        }
        const noteSize = 10.5 * u; let notes = [];
        if (withNotes) { probe.font = '400 ' + noteSize + 'px ' + family; noteLines(item).forEach(t => wrapText(probe, t, bw).forEach(l => notes.push(l))); }
        const nh = notes.length ? notes.length * noteSize * 1.4 + 12 * u : 0;
        const foot = footSize * 1.4 + 10 * u + nh;
        const W = bw + pad * 2, H = Math.round(pad + hh + body.height + foot + pad * 0.6);
        const c = document.createElement('canvas'); c.width = W; c.height = H;
        const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, W, H); g.textBaseline = 'top';
        let y = pad;
        if (withTitle) {
            g.fillStyle = '#0f172a'; g.font = '700 ' + titleSize + 'px ' + family; head.forEach(t => { g.fillText(t, pad, y); y += titleSize * 1.3; });
            if (sub.length) { y += 4 * u; g.fillStyle = '#475569'; g.font = '400 ' + subSize + 'px ' + family; sub.forEach(t => { g.fillText(t, pad, y); y += subSize * 1.45; }); y += 2 * u; }
            y += 6 * u;
        }
        g.drawImage(body, pad, y); y += body.height + 8 * u;
        if (notes.length) { y += 4 * u; g.fillStyle = '#475569'; g.font = '400 ' + noteSize + 'px ' + family; notes.forEach(t => { g.fillText(t, pad, y); y += noteSize * 1.4; }); y += 8 * u; }
        g.fillStyle = '#94a3b8'; g.font = '400 ' + footSize + 'px ' + family;
        const ver = ((document.getElementById('app_ver') || {}).textContent || 'AMR Trak').trim();
        g.fillText(ver, pad, y);
        return c;
    }

    function slug(s) { return String(s).replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60) || 'chart'; }
    function toFile(canvas, name) {
        return new Promise((resolve, reject) => canvas.toBlob(b => b ? resolve(new File([b], name, { type: 'image/png' })) : reject(new Error('encode failed')), 'image/png'));
    }

    // render the picked items one by one; returns File[]
    async function renderAll(items, targetW, withTitle, onStep, withNotes) {
        const files = [], used = {};
        for (let i = 0; i < items.length; i++) {
            const item = items[i]; if (onStep) onStep(i + 1, items.length);
            await new Promise(r => setTimeout(r, 30));
            const el = item.el, pad2 = 36;
            let body, cssW, u;
            if (el.tagName === 'CANVAS') {
                cssW = Math.max(el.clientWidth || 300, 200);
                u = Math.min(10, Math.max(1, targetW / (cssW + pad2)));
                const r = withOpened([item], () => chartBlock(el, u)); body = r.canvas; cssW = r.cssW || cssW;
            } else {
                const blk = withOpened([item], () => htmlBlock(el));
                u = Math.min(10, Math.max(1, targetW / (blk.w + pad2)));
                body = await svgToCanvas(blk, u); cssW = blk.w;
            }
            let c = compose(body, cssW, u, item, withTitle, withNotes);
            if (c.width * c.height > MAX_PIXELS) { const k = Math.sqrt(MAX_PIXELS / (c.width * c.height)); const s = document.createElement('canvas'); s.width = Math.floor(c.width * k); s.height = Math.floor(c.height * k); s.getContext('2d').drawImage(c, 0, 0, s.width, s.height); c = s; }
            let base = slug(chartTitleOf(item.c.title)); used[base] = (used[base] || 0) + 1; if (used[base] > 1) base += '_' + used[base];
            files.push(await toFile(c, 'AMR_Trak_' + base + '.png'));
        }
        return files;
    }

    function saveFiles(files) {
        files.forEach((f, i) => setTimeout(() => {
            const url = URL.createObjectURL(f), a = document.createElement('a');
            a.href = url; a.download = f.name; document.body.appendChild(a); a.click(); document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 15000);
        }, i * 350));
    }
    function canShareFiles() {
        try { return !!(navigator.share && navigator.canShare && navigator.canShare({ files: [new File([new Blob(['x'])], 'a.png', { type: 'image/png' })] })); } catch (e) { return false; }
    }

    const infoClasses = { popup: 'info-popup', title: 'info-title', htmlContainer: 'info-container', confirmButton: 'info-close', cancelButton: 'info-cancel', denyButton: 'info-deny', actions: 'info-actions' };

    window.openImageDialog = function () {
        const groups = printGroups(true);
        if (!groups.some(g => g.items.some(x => x.el))) { Swal.fire({ icon: 'info', title: 'Nothing to save yet', text: 'There are no charts on screen in this tab. Wait for the results to load.', confirmButtonText: 'OK', buttonsStyling: false, customClass: infoClasses }); return; }
        const flat = [];
        const saved = (() => { try { return JSON.parse(localStorage.getItem('amr_image_opts')) || {}; } catch (e) { return {}; } })();
        const rows = groups.map(g => `<div class="pd-h">${esc(sectionTitle(g.sec))}</div>` + g.items.map(x => {
            if (!x.el) return `<label class="pd-row pd-off"><input type="checkbox" disabled><span>${esc(chartTitleOf(x.c.title))}<small>${esc(x.hint)}</small></span></label>`;
            const i = flat.push(x) - 1; return `<label class="pd-row"><input type="checkbox" class="pd-chart" value="${i}" checked><span>${esc(chartTitleOf(x.c.title))}</span></label>`;
        }).join('')).join('');
        const share = canShareFiles();
        Swal.fire({
            title: 'Save as image',
            html: `<div class="pd">
                <div class="pd-h" style="margin-top:0">What to save from this screen</div>
                <label class="pd-row pd-all"><input type="checkbox" id="im_all" checked><span>Select everything</span></label>
                <div class="pd-list">${rows}</div>
                <div class="pd-h">Image</div>
                <div class="pd-grid"><span>Resolution</span><select id="im_size" class="pd-sel">${SIZES.map(o => `<option value="${o[0]}" ${o[0] === (saved.size || '2400') ? 'selected' : ''}>${o[1]}</option>`).join('')}</select></div>
                <label class="pd-row"><input type="checkbox" id="im_title" ${saved.title !== false ? 'checked' : ''}><span>Title and filters above the image</span></label>
                <label class="pd-row"><input type="checkbox" id="im_notes" ${saved.notes !== false ? 'checked' : ''}><span>Symbol keys and notes under the image</span></label>
                <div style="font-size:11px;color:#94a3b8;margin-top:8px;line-height:1.5">Each selected item is saved as its own PNG file.<br>${share ? 'Share sends the images to another app, or to Photos on an iPhone (choose Save Image).' : 'On this device the images are saved to the Downloads folder.'}</div>
            </div>`,
            showCancelButton: true, showDenyButton: share, confirmButtonText: 'Save', denyButtonText: 'Share', cancelButtonText: 'Cancel', width: 'min(92vw, 440px)', buttonsStyling: false, customClass: infoClasses,
            didOpen: () => {
                const all = document.getElementById('im_all');
                all.addEventListener('change', () => document.querySelectorAll('.pd-chart').forEach(c => { c.checked = all.checked; }));
                document.querySelectorAll('.pd-chart').forEach(c => c.addEventListener('change', () => { all.checked = [...document.querySelectorAll('.pd-chart')].every(x => x.checked); }));
            },
            // both buttons render first (progress shown on the dialog), then act
            preConfirm: () => run('save'), preDeny: () => run('share')
        });
        async function run(mode) {
            const picked = [...document.querySelectorAll('.pd-chart')].filter(c => c.checked).map(c => parseInt(c.value, 10));
            if (!picked.length) { Swal.showValidationMessage('Select at least one item'); return false; }
            const size = parseInt(document.getElementById('im_size').value, 10), withTitle = document.getElementById('im_title').checked, withNotes = document.getElementById('im_notes').checked;
            try { localStorage.setItem('amr_image_opts', JSON.stringify({ size: String(size), title: withTitle, notes: withNotes })); } catch (e) {}
            const btn = Swal.getConfirmButton(), btnD = Swal.getDenyButton(), cancel = Swal.getCancelButton();
            [btn, btnD, cancel].forEach(b => b && (b.disabled = true));
            const note = document.createElement('div'); note.style.cssText = 'font-size:12px;color:#0f766e;margin-top:8px;font-weight:600';
            Swal.getHtmlContainer().appendChild(note);
            try {
                const files = await renderAll(picked.map(i => flat[i]), size, withTitle, (k, n) => { note.textContent = 'Preparing image ' + k + ' of ' + n + '...'; }, withNotes);
                if (mode === 'share') {
                    try { await navigator.share({ files, title: 'AMR Trak' }); }
                    catch (e) { if (e && e.name === 'AbortError') { [btn, btnD, cancel].forEach(b => b && (b.disabled = false)); note.remove(); return false; } saveFiles(files); }
                } else saveFiles(files);
                return true;
            } catch (e) {
                console.error(e);
                [btn, btnD, cancel].forEach(b => b && (b.disabled = false));
                note.style.color = '#be123c'; note.textContent = 'The image could not be created on this device. Try a lower resolution or fewer items.';
                return false;
            }
        }
    };
    // one HTML block (for example the isolate card in the MDR popup) -> PNG File
    async function elementToFile(el, o) {
        const targetW = o.size || 2400, blk = htmlBlock(el), pad2 = 36;
        const u = Math.min(10, Math.max(1, targetW / (blk.w + pad2)));
        const body = await svgToCanvas(blk, u);
        const item = { sec: o.sec, c: { title: o.title || '' }, el };
        let c = compose(body, blk.w, u, item, !!o.title, false);
        if (c.width * c.height > MAX_PIXELS) { const k = Math.sqrt(MAX_PIXELS / (c.width * c.height)); const t = document.createElement('canvas'); t.width = Math.floor(c.width * k); t.height = Math.floor(c.height * k); t.getContext('2d').drawImage(c, 0, 0, t.width, t.height); c = t; }
        return toFile(c, 'AMR_Trak_' + slug(o.name || o.title || 'image') + '.png');
    }
    function savedSize() { try { return parseInt((JSON.parse(localStorage.getItem('amr_image_opts')) || {}).size, 10) || 2400; } catch (e) { return 2400; } }
    window.AMR_IMG = { renderAll, elementToFile, saveFiles, canShareFiles, savedSize };
})();
