/* Back-button guard (press back twice to exit) and pull-to-refresh with a spinning two-arrow icon */
(function () {
    'use strict';

    /* ---------- Back button: first press closes an open panel or warns, second press exits ---------- */
    let armed = false, timer = null;

    function toast(msg) {
        let t = document.getElementById('exitToast');
        if (!t) { t = document.createElement('div'); t.id = 'exitToast'; document.body.appendChild(t); }
        t.textContent = msg; t.classList.add('show');
        clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 1900);
    }
    function closeOverlay() {
        const pv = document.getElementById('printPreview');
        if (pv && pv.parentNode) { pv.parentNode.removeChild(pv); return true; }
        const gd = document.getElementById('guideView');
        if (gd && gd.classList.contains('open')) { if (window.hideGuide) window.hideGuide(); return true; }
        if (window.Swal && Swal.isVisible && Swal.isVisible()) { Swal.close(); return true; }
        return false;
    }
    function guard() { try { history.pushState({ amrGuard: true }, ''); } catch (e) {} }

    try { history.replaceState({ amrRoot: true }, ''); guard(); } catch (e) {}

    window.addEventListener('popstate', function () {
        if (closeOverlay()) { guard(); return; }            // back closes a panel first
        if (armed) {                                         // second press inside 2 s: leave the app
            armed = false; clearTimeout(timer);
            try { history.back(); } catch (e) {}
            return;
        }
        armed = true; guard();
        toast('Press back again to exit');
        timer = setTimeout(() => { armed = false; }, 2000);
    });

    /* ---------- Pull to refresh ---------- */
    const ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M8 16H3v5"/></svg>';
    const THRESHOLD = 70, MAX = 110;
    let startY = null, pulling = false, busy = false, ptr = null;

    function el() {
        if (ptr) return ptr;
        ptr = document.createElement('div'); ptr.id = 'ptr'; ptr.innerHTML = ICON;
        document.body.appendChild(ptr);
        return ptr;
    }
    function topOffset() { const h = document.querySelector('header'); return h ? h.getBoundingClientRect().bottom : 0; }
    function blocked() {
        return busy || document.getElementById('loadView') || document.getElementById('printPreview') ||
            document.body.classList.contains('gd-lock') || document.body.classList.contains('swal2-shown') ||
            (window.scrollY || document.documentElement.scrollTop) > 0;
    }
    function place(dy) {
        const p = el(), d = Math.min(dy, MAX), base = topOffset();
        p.style.top = (base + 4) + 'px';
        p.style.transform = 'translateY(' + (d * 0.55) + 'px) rotate(' + (d * 3.2) + 'deg)';
        p.style.opacity = Math.min(1, d / THRESHOLD);
        p.classList.toggle('ready', d >= THRESHOLD);
    }
    function reset() { if (ptr) { ptr.classList.remove('spin', 'ready'); ptr.style.opacity = 0; ptr.style.transform = 'translateY(0)'; } }

    document.addEventListener('touchstart', function (e) {
        if (e.touches.length !== 1 || blocked()) { startY = null; return; }
        if (e.target.closest && e.target.closest('select, input, textarea, .select2-container, .custom-scroll')) { startY = null; return; }
        startY = e.touches[0].clientY; pulling = false;
    }, { passive: true });

    document.addEventListener('touchmove', function (e) {
        if (startY === null) return;
        const dy = e.touches[0].clientY - startY;
        if (dy > 8 && (window.scrollY || 0) <= 0) {
            pulling = true; place(dy);
            if (e.cancelable) e.preventDefault();
        } else if (dy < 0) { startY = null; if (pulling) { pulling = false; reset(); } }
    }, { passive: false });

    document.addEventListener('touchend', function (e) {
        if (startY === null || !pulling) { startY = null; return; }
        const dy = (e.changedTouches[0] ? e.changedTouches[0].clientY : startY) - startY;
        startY = null; pulling = false;
        if (dy < THRESHOLD) { reset(); return; }
        busy = true;
        const p = el(); p.style.top = (topOffset() + 4) + 'px'; p.style.transform = 'translateY(44px)'; p.style.opacity = 1; p.classList.add('spin');
        const t0 = Date.now();
        Promise.resolve(window.pullRefresh ? window.pullRefresh() : null).then(ok => {
            const wait = Math.max(0, 700 - (Date.now() - t0));
            setTimeout(() => { busy = false; reset(); if (ok === false) toast('Could not refresh. Showing saved data.'); }, wait);
        });
    }, { passive: true });
})();
