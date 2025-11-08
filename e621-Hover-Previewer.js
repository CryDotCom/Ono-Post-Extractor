// ==UserScript==
// @name         e621/e6ai Hover Zoom Previewer+
// @namespace    http://tampermonkey.net/
// @version      17.0
// @description  The preview window now always starts at 350x350 in the top-left corner. The user can then resize and move it, and it will persist.
// @match        https://e621.net/posts*
// @match        https://e6ai.net/posts*
// @updateURL    https://raw.githubusercontent.com/CryDotCom/Ono-Post-Extractor/master/e621-Hover-Previewer.js
// @downloadURL  https://raw.githubusercontent.com/CryDotCom/Ono-Post-Extractor/master/e621-Hover-Previewer.js
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @connect      e621.net
// @connect      e6ai.net
// @require      https://cdn.jsdelivr.net/npm/interactjs/dist/interact.min.js
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    initScript();

    function initScript() {
        const siteName = window.location.hostname.includes('e621') ? 'e621' : 'e6ai';
        let pageData = null;
        const hoverDelay = 3000;
        let hoverTimer = null;
        let activePreview = null;

        const MIN_PREVIEW_WIDTH = 300;
        const MIN_PREVIEW_HEIGHT = 200;

        GM_addStyle(`
            #hoverPreview {
                position: fixed; z-index: 99999; display: none;
                flex-direction: column; background: rgba(0,0,0,0.9);
                border: 2px solid #444; border-radius: 8px;
                min-width: ${MIN_PREVIEW_WIDTH}px; min-height: ${MIN_PREVIEW_HEIGHT}px;
                overflow: hidden;
                touch-action: none;
            }
            #hoverPreviewHeader {
                display: flex; justify-content: space-between; align-items: center;
                background: #333; color: white; font-weight: bold; cursor: grab;
                padding: 6px 10px; user-select: none; width: 100%; box-sizing: border-box;
            }
            #hoverPreviewContent {
                flex: 1; overflow: hidden; display: flex;
                align-items: center; justify-content: center;
                background: black;
            }
            #hoverPreviewContent img, #hoverPreviewContent video {
                max-width: 100%; max-height: 100%;
                object-fit: contain;
                user-select: none; cursor: grab;
                touch-action: none;
            }
            #hoverPreview .controls {
                background: #222; padding: 4px; display: flex; justify-content: center; gap: 6px;
                flex-wrap: wrap; user-select: none;
            }
            #hoverPreview .controls button {
                padding: 4px 8px; border: none; border-radius: 4px; cursor: pointer; background: #555; color: white; margin: 2px;
            }
            #hoverPreview .controls button:hover { background: #888; }
            #hoverPreviewHeader button { background: #aa2222; color: white; border: none; padding: 2px 6px; border-radius: 3px; cursor: pointer; }
            #hoverPreviewHeader button:hover { background: #ff4444; }
        `);

        const preview = document.createElement('div');
        preview.id = 'hoverPreview';
        document.body.appendChild(preview);

        function fetchPageData() {
            const url = window.location.href.replace('/posts', '/posts.json');
            GM_xmlhttpRequest({ method: 'GET', url, onload: r => { if (r.status === 200) try { pageData = JSON.parse(r.responseText).posts; } catch (e) {} } });
        }
        fetchPageData();

        function attachHover() {
            document.querySelectorAll('article.thumbnail').forEach(article => {
                if (article.dataset.hoverBound) return;
                article.dataset.hoverBound = 'true';
                article.addEventListener('mouseenter', () => { clearTimeout(hoverTimer); hoverTimer = setTimeout(() => showPreview(article.dataset.id), hoverDelay); });
                article.addEventListener('mouseleave', () => clearTimeout(hoverTimer));
            });
        }

        let scale = 1, currentTranslate = { x: 0, y: 0 };

        function showPreview(postID) {
            const post = pageData?.find(p => String(p.id) === String(postID));
            if (!post) return;

            if (activePreview === postID) return;
            activePreview = postID;
            scale = 1; currentTranslate = { x: 0, y: 0 }; // Always reset zoom for a new image

            // --- FIXED STARTING SIZE & POSITION LOGIC ---
            // If the preview is not currently shown, set it to the fixed starting state.
            if (preview.style.display !== 'flex') {
                preview.style.width = '400px';
                preview.style.height = '400px';
                preview.style.left = '0px';
                preview.style.top = '0px';
                preview.style.transform = 'translate(0px, 0px)';
                preview.dataset.x = 0;
                preview.dataset.y = 0;
            }

            const mediaExt = post.file.ext;
            let initialUrl, fullUrl = null;
            const isStatic = ['jpg', 'jpeg', 'png'].includes(mediaExt);
            const hasSample = post.sample && post.sample.has && post.sample.url;

            if (isStatic && hasSample) {
                initialUrl = post.sample.url;
                fullUrl = post.file.url;
            } else {
                initialUrl = post.file.url;
            }

            // Build the HTML content and create the media element
            preview.innerHTML = `
                <div id="hoverPreviewHeader"><span id="previewTitle">Preview - ${postID}</span><button id="btnCloseHeader">X</button></div>
                <div id="hoverPreviewContent"></div>
                <div class="controls">
                    <button id="btnOpenPost">Open Post</button> <button id="btnDownload">Download</button>
                    <button id="btnCopyTags">Copy Tags</button> <button id="btnDownloadTags">Download Tags</button>
                    <button id="btnDownloadJSON">Download JSON</button>
                </div>
            `;
            const content = preview.querySelector('#hoverPreviewContent');
            const media = (mediaExt === 'webm' || mediaExt === 'mp4') ? document.createElement('video') : document.createElement('img');

            // Set media properties and append it
            if (media.tagName === 'VIDEO') {
                media.controls = true; media.autoplay = true; media.loop = true; media.muted = true;
            } else if (fullUrl) {
                media.dataset.fullUrl = fullUrl;
            }
            content.appendChild(media);
            media.src = initialUrl;

            // Bind controls
            setupZoomPan(media);
            preview.querySelector('#btnCloseHeader').onclick = closePreview;
            preview.querySelector('#btnOpenPost').onclick = () => window.open(`/posts/${postID}`, '_blank');
            preview.querySelector('#btnDownload').onclick = () => downloadFile(post.file.url, `${siteName}_${postID}.${post.file.ext}`);
            preview.querySelector('#btnCopyTags').onclick = () => copyTags(post.tags);
            preview.querySelector('#btnDownloadTags').onclick = () => downloadTags(post.tags, postID);
            preview.querySelector('#btnDownloadJSON').onclick = () => downloadJSON(postID);

            // Finally, ensure the preview is visible
            preview.style.display = 'flex';
        }

        function downloadFile(url, filename) { GM_xmlhttpRequest({ method: 'GET', url, responseType: 'blob', onload: r => { if (r.status === 200) { const a = document.createElement('a'); a.href = URL.createObjectURL(r.response); a.download = filename; a.click(); URL.revokeObjectURL(a.href); } } }); }
        function copyTags(tags) { if(!tags) return; const s = [...(tags.artist || []), ...(tags.general || []), ...(tags.species || []), ...(tags.character || []), ...(tags.copyright || []), ...(tags.meta || []), ...(tags.lore || [])].map(t => t.replace(/_/g, ' ').replace(/\(/g, '\\(').replace(/\)/g, '\\)')).join(', '); navigator.clipboard.writeText(s); }
        function downloadTags(tags, id) { if(!tags) return; const s = [...(tags.artist || []), ...(tags.general || []), ...(tags.species || []), ...(tags.character || []), ...(tags.copyright || []), ...(tags.meta || []), ...(tags.lore || [])].map(t=>t.replace(/_/g,' ')).join(', '); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([s],{type:'text/plain;charset=utf-8'})); a.download = `${siteName}_${id}.txt`; a.click(); URL.revokeObjectURL(a.href); }
        function downloadJSON(id) { GM_xmlhttpRequest({ method: 'GET', url: `${window.location.origin}/posts/${id}.json`, onload: r => { if (r.status === 200) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([r.responseText],{type:'application/json;charset=utf-8'})); a.download = `${siteName}_${id}.json`; a.click(); URL.revokeObjectURL(a.href); } } }); }

        function closePreview() { if (preview.style.display !== 'none') { preview.style.display = 'none'; preview.innerHTML = ''; activePreview = null; } }
        document.addEventListener('keydown', e => { if (e.key === 'Escape') closePreview(); });

        interact(preview).draggable({ allowFrom: '#hoverPreviewHeader', listeners: { move: e => { const t = e.target, x = (parseFloat(t.dataset.x) || 0) + e.dx, y = (parseFloat(t.dataset.y) || 0) + e.dy; t.style.transform = `translate(${x}px, ${y}px)`; t.dataset.x = x; t.dataset.y = y; } } }).resizable({ edges: { left: true, right: true, bottom: true, top: true }, listeners: { move: e => { const t = e.target; t.style.width = e.rect.width + 'px'; t.style.height = e.rect.height + 'px'; let x = (parseFloat(t.dataset.x) || 0) + e.deltaRect.left, y = (parseFloat(t.dataset.y) || 0) + e.deltaRect.top; t.style.transform = `translate(${x}px, ${y}px)`; t.dataset.x = x; t.dataset.y = y; }, end: (e) => constrainTransform(e.target.querySelector('#hoverPreviewContent').firstChild) }, modifiers: [interact.modifiers.restrictSize({ min: { width: MIN_PREVIEW_WIDTH, height: MIN_PREVIEW_HEIGHT } })] });

        function setupZoomPan(media) {
            if (!media) return;
            media.style.transformOrigin = '0 0';
            let isPanning = false, start = { x: 0, y: 0 };

            media.addEventListener('wheel', e => {
                e.preventDefault();
                if (media.dataset.fullUrl && e.deltaY < 0) {
                    const fullUrl = media.dataset.fullUrl;
                    delete media.dataset.fullUrl;
                    media.dataset.isLoadingFull = 'true';
                    media.onload = () => {
                        delete media.dataset.isLoadingFull;
                        scale += 0.1;
                        constrainTransform(media);
                        media.onload = null;
                    };
                    media.src = fullUrl;
                    return;
                }
                const rect = media.getBoundingClientRect(), cursorX = e.clientX - rect.left, cursorY = e.clientY - rect.top, delta = e.deltaY < 0 ? 0.1 : -0.1;
                let newScale = Math.min(Math.max(scale + delta, 1), 5);
                if (newScale === 1) { currentTranslate = { x: 0, y: 0 }; }
                else { const ratio = newScale / scale; currentTranslate.x = (currentTranslate.x - cursorX) * ratio + cursorX; currentTranslate.y = (currentTranslate.y - cursorY) * ratio + cursorY; }
                scale = newScale;
                constrainTransform(media);
            });

            media.addEventListener('pointerdown', e => { if (scale > 1) { isPanning = true; start = { x: e.clientX, y: e.clientY }; media.style.cursor = 'grabbing'; media.setPointerCapture(e.pointerId); e.preventDefault(); } });
            media.addEventListener('pointermove', e => { if (isPanning) { e.preventDefault(); currentTranslate.x += e.clientX - start.x; currentTranslate.y += e.clientY - start.y; constrainTransform(media); start = { x: e.clientX, y: e.clientY }; } });
            media.addEventListener('pointerup', e => { if(isPanning){ isPanning = false; media.style.cursor = 'grab'; media.releasePointerCapture(e.pointerId); } });
        }

        function constrainTransform(media) {
            if (!media || media.dataset.isLoadingFull === 'true') return;
            const iw = media.naturalWidth || media.videoWidth; if (iw === 0) return;
            const contentRect = media.parentElement.getBoundingClientRect(), sw = iw * scale, sh = (media.naturalHeight || media.videoHeight) * scale;
            if (scale <= 1) { currentTranslate = { x: 0, y: 0 }; }
            else { let lx = Math.max(0, (sw - contentRect.width) / 2), ly = Math.max(0, (sh - contentRect.height) / 2); currentTranslate.x = Math.min(lx, Math.max(-lx, currentTranslate.x)); currentTranslate.y = Math.min(ly, Math.max(-ly, currentTranslate.y)); }
            media.style.transform = `translate(${currentTranslate.x}px,${currentTranslate.y}px) scale(${scale})`;
        }

        attachHover();
        const observer = new MutationObserver(attachHover);
        observer.observe(document.body, { childList: true, subtree: true });
    }
})();
