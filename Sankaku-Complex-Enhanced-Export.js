// ==UserScript==
// @name         Sankaku Complex Enhanced Export Tools
// @namespace    http://tampermonkey.net/
// @version      1.6
// @description  Add enhanced export functionality to Sankaku Complex posts (works on www and chan sites)
// @author       Onocom & AI Assistant
// @match        https://www.sankakucomplex.com/posts/*
// @match        https://www.sankakucomplex.com/*/posts/*
// @match        https://chan.sankakucomplex.com/posts/*
// @match        https://chan.sankakucomplex.com/*/posts/*
// @updateURL    https://raw.githubusercontent.com/CryDotCom/Ono-Post-Extractor/master/Sankaku-Complex-Enhanced-Export.js
// @downloadURL  https://raw.githubusercontent.com/CryDotCom/Ono-Post-Extractor/master/Sankaku-Complex-Enhanced-Export.js
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @connect      sankakuapi.com
// @connect      s.sankakucomplex.com
// @connect      v.sankakucomplex.com
// @connect      chan.sankakucomplex.com
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    let isAddingSection = false; // Prevent overlapping attempts
    const hostname = window.location.hostname;
    const isChanSite = hostname.startsWith('chan.');

    // --- CSS Styling ---
    GM_addStyle(`
        /* --- Styles for www.sankakucomplex.com (BELOW Header Toolbar) --- */
        #export-button-container-www {
            width: calc(100% - 16px); margin: 8px 8px 4px 8px; padding: 6px 8px;
            border-top: 1px solid rgba(255, 255, 255, 0.12); display: flex; align-items: center;
            gap: 8px; flex-wrap: wrap; justify-content: flex-start; order: 1;
        }
        #export-button-container-www .export-label {
            font-weight: bold; color: #fff; margin-right: 4px; font-size: 0.9rem; flex-shrink: 0;
        }
        #export-button-container-www .export-button {
            padding: 4px 8px !important; min-height: 28px !important; line-height: normal !important;
            background-color: rgba(255, 255, 255, 0.08) !important; color: #fff !important;
            border-radius: 4px; border: none; cursor: pointer; text-transform: none !important; font-size: 0.875rem;
        }
        #export-button-container-www .export-button:hover { background-color: rgba(255, 255, 255, 0.15) !important; }

        /* --- Styles for chan.sankakucomplex.com (Above #post-content) --- */
        #export-button-container-chan {
            padding: 8px 5px; margin: 5px 0 10px 0; border: none; background-color: transparent;
            display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
        }
        #export-button-container-chan .export-label {
             font-weight: bold; font-size: 1em; margin-right: 4px; flex-shrink: 0;
        }
        #export-button-container-chan .export-button {
            padding: 5px 10px; border: 1px solid; border-color: buttonborder; background-color: transparent;
            border-radius: 15px !important; cursor: pointer; font-size: 0.9em; text-decoration: none; display: inline-block;
        }
        #export-button-container-chan .export-button:hover { filter: brightness(90%); }
    `);

    // Function to extract post ID from the URL
    function getPostId() {
        const path = window.location.pathname;
        const match = path.match(/(?:\/[a-z]{2})?\/posts\/([a-zA-Z0-9]+)/);
        if (match && match[1]) { return match[1]; }
        console.warn('Could not extract post ID using regex from URL:', path);
        const parts = path.split('/'); const postsIndex = parts.indexOf('posts');
        if (postsIndex !== -1 && postsIndex + 1 < parts.length) {
            const potentialId = parts[postsIndex + 1].split(/[-?#]/)[0];
            if (/^[a-zA-Z0-9]+$/.test(potentialId)) { console.log('Extracted Post ID (Fallback):', potentialId); return potentialId; }
        }
        console.error('Failed to extract Post ID from URL after multiple attempts.');
        return null;
    }


    // --- Button Insertion Functions ---

    function addExportSectionWww() {
        const containerId = 'export-button-container-www';
        if (document.getElementById(containerId) || isAddingSection) return;
        const toolbarSelector = '.MuiToolbar-root.MuiToolbar-regular';
        const headerToolbar = document.querySelector(toolbarSelector); if (!headerToolbar) return;
        const toolbarContainer = headerToolbar.parentElement; if (!toolbarContainer || toolbarContainer.tagName !== 'DIV' || !document.body.contains(toolbarContainer)) { console.warn('[WWW] Toolbar container invalid/missing.'); return; }
        isAddingSection = true; console.log('[WWW] Target toolbar container found. Scheduling.');
        setTimeout(() => {
            try {
                if (document.getElementById(containerId)) { isAddingSection = false; return; }
                 const currentHeaderToolbar = document.querySelector(toolbarSelector); const currentToolbarContainer = currentHeaderToolbar?.parentElement;
                 if (!currentToolbarContainer || !document.body.contains(currentToolbarContainer)) { console.warn('[WWW] Toolbar container invalid/removed before insertion.'); isAddingSection = false; return; }
                console.log('[WWW] Executing insertion AFTER Toolbar Container.');
                const exportContainer = document.createElement('div'); exportContainer.id = containerId;
                const btnCls = "MuiButtonBase-root MuiButton-root MuiButton-text MuiButton-textSizeSmall MuiButton-sizeSmall export-button";
                exportContainer.innerHTML = `<span class="export-label">Export:</span><button class="${btnCls}" id="export-tags-btn" title="Tags"><span class="MuiButton-label">Tags</span><span class="MuiTouchRipple-root"></span></button><button class="${btnCls}" id="export-image-btn" title="Image"><span class="MuiButton-label">Image</span><span class="MuiTouchRipple-root"></span></button><button class="${btnCls}" id="export-json-btn" title="JSON"><span class="MuiButton-label">JSON</span><span class="MuiTouchRipple-root"></span></button>`;
                currentToolbarContainer.insertAdjacentElement('afterend', exportContainer);
                exportContainer.querySelector('#export-tags-btn').addEventListener('click', exportTags); exportContainer.querySelector('#export-image-btn').addEventListener('click', exportImage); exportContainer.querySelector('#export-json-btn').addEventListener('click', exportJson);
                console.log('[WWW] Buttons added.');
            } catch (error) { console.error("[WWW] Insert Error:", error); } finally { isAddingSection = false; }
        }, 150);
    }

    function addExportSectionChan() {
        const containerId = 'export-button-container-chan';
        if (document.getElementById(containerId) || isAddingSection) return;
        const postContent = document.getElementById('post-content'); if (!postContent || !document.body.contains(postContent) || !postContent.parentNode) return;
        isAddingSection = true; console.log('[CHAN] Target #post-content found. Inserting.');
        try {
            if (document.getElementById(containerId)) { isAddingSection = false; return; }
            const currentPostContent = document.getElementById('post-content'); if (!currentPostContent || !document.body.contains(currentPostContent) || !currentPostContent.parentNode) { console.warn('[CHAN] #post-content invalid.'); isAddingSection = false; return; }
            const exportContainer = document.createElement('div'); exportContainer.id = containerId; const btnCls = "export-button";
            exportContainer.innerHTML = `<span class="export-label">Export:</span><button class="${btnCls}" id="export-tags-btn" title="Tags">Tags</button><button class="${btnCls}" id="export-image-btn" title="Image">Image</button><button class="${btnCls}" id="export-json-btn" title="JSON">JSON</button>`;
            currentPostContent.parentNode.insertBefore(exportContainer, currentPostContent);
            exportContainer.querySelector('#export-tags-btn').addEventListener('click', exportTags); exportContainer.querySelector('#export-image-btn').addEventListener('click', exportImage); exportContainer.querySelector('#export-json-btn').addEventListener('click', exportJson);
            console.log('[CHAN] Buttons added.');
        } catch (error) { console.error("[CHAN] Insert Error:", error); } finally { isAddingSection = false; }
    }

    // ========================================================================
    // API Fetching, Formatting, Downloading Functions (SHARED)
    // ========================================================================

    async function fetchPostData(postId) {
        if (!postId || !/^[a-zA-Z0-9]+$/.test(postId)) return Promise.reject(new Error(`Invalid Post ID: "${postId}"`));
        console.log(`Fetching post data for ID: ${postId}`);
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({ method: 'GET', url: `https://sankakuapi.com/posts/${postId}`, headers: { 'Accept': 'application/json' }, timeout: 15000,
                onload: res => { if (res.status === 200) { try { const d=JSON.parse(res.responseText); if(d===null) reject(new Error('API null post')); else resolve(d); } catch (e) { reject(new Error('API JSON parse fail')); } } else { reject(new Error(`API post status ${res.status}`)); } },
                onerror: e => reject(new Error('API post network error')), ontimeout: () => reject(new Error('API post timeout'))
            });
        });
    }

    async function fetchTagsData(postId) {
        if (!postId || !/^[a-zA-Z0-9]+$/.test(postId)) return Promise.reject(new Error(`Invalid Post ID: "${postId}"`));
        console.log(`Fetching tags data (backup API) for ID: ${postId}`); const limit = 200, page = 1;
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({ method: 'GET', url: `https://sankakuapi.com/posts/${postId}/tags?lang=en&page=${page}&limit=${limit}`, headers: { 'Accept': 'application/json' }, timeout: 15000,
                onload: res => { if (res.status === 200) { try { const d=JSON.parse(res.responseText); if (d?.success && Array.isArray(d.data)) { const t=d.data.map(tg=>tg.name||tg.name_en||tg.tagName).filter(Boolean); if(d.data.length===limit) console.warn(`Tags API limit hit.`); resolve(t); } else { reject(new Error('API tags invalid structure')); } } catch (e) { reject(new Error('API tags parse fail')); } } else { reject(new Error(`API tags status ${res.status}`)); } },
                onerror: e => reject(new Error('API tags network error')), ontimeout: () => reject(new Error('API tags timeout'))
            });
        });
    }

    async function fetchOriginalImageUrlFromChanApi(postId) {
        if (!postId || !/^[a-zA-Z0-9]+$/.test(postId)) return Promise.reject(new Error(`Invalid Post ID: "${postId}"`));
        console.log(`[API] Fetching original image URL from chan site for ID: ${postId}`);
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({ method: 'GET', url: `https://chan.sankakucomplex.com/posts/${postId}?basic=1`, timeout: 20000,
                onload: res => { if (res.status === 200) { try { const p=new DOMParser(), d=p.parseFromString(res.responseText,'text/html'); const l=d.querySelector('#highres, a[href*="/data/"][href*="?download"]'); let u=null; if(l?.href) u=l.href; else { const i=d.querySelector('#image-link > img#image'); if(i?.src) u=i.src; } if(u) { if(u.startsWith("//")) u="https:"+u; else if(!u.startsWith("http")) u=new URL(u,`https://chan.sankakucomplex.com/`).href; resolve(u); } else reject(new Error('Chan API no img link found')); } catch(e){ reject(new Error('Chan API parse fail')); } } else reject(new Error(`Chan API status ${res.status}`)); },
                onerror: e => reject(new Error('Chan API network error')), ontimeout: () => reject(new Error('Chan API timeout'))
            });
        });
    }

    async function fetchTagsFromChanHtml(postId) {
        if (!postId || !/^[a-zA-Z0-9]+$/.test(postId)) return Promise.reject(new Error(`Invalid Post ID: "${postId}"`));
        console.log(`[HTML Scrape] Fetching tags from chan site for ID: ${postId}`);
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({ method: 'GET', url: `https://chan.sankakucomplex.com/posts/${postId}?basic=1`, timeout: 20000,
                onload: res => { if (res.status === 200) { try { const p=new DOMParser(), d=p.parseFromString(res.responseText,'text/html'); const ul=d.querySelector('ul#tag-sidebar'); if(!ul) return reject(new Error('Chan HTML no tag list')); const els=ul.querySelectorAll('li > a.tag-link[href*="tags="]'); const t=Array.from(els).map(el=>el.textContent.trim()).filter(Boolean); if(t.length>0) resolve(t); else reject(new Error('Chan HTML no tags found')); } catch(e){ reject(new Error('Chan HTML parse fail')); } } else reject(new Error(`Chan HTML status ${res.status}`)); },
                onerror: e => reject(new Error('Chan HTML network error')), ontimeout: () => reject(new Error('Chan HTML timeout'))
            });
        });
    }

    function formatTag(tag) { return tag.replace(/_/g, ' '); }
    function formatTagForClipboard(tag) { return formatTag(tag).replace(/\(/g, '\\(').replace(/\)/g, '\\)'); }
    function getFileNamePrefix(postId) { return `sankaku-${postId || 'unknown'}`; }

    function downloadFile(url, filename) {
        console.log(`Attempting download: ${filename}`);
        GM_xmlhttpRequest({ method: 'GET', url: url, responseType: 'blob', timeout: 60000, headers: { 'Referer': window.location.href },
            onload: res => { if (res.status === 200 || res.status === 206) { try { const b=res.response, u=URL.createObjectURL(b), a=document.createElement('a'); a.href=u; a.download=filename; a.style.display='none'; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(u); console.log(`DL initiated: ${filename}`); } catch (e) { console.error('DL link error:', e); alert(`DL link error.`); } } else { alert(`DL Error ${res.status}`); } },
            onerror: e => { alert(`DL Network Error.`); console.error('DL Network Error:', e); }, ontimeout: () => alert(`DL Timeout.`)
        });
    }

    // --- Export Functions (SHARED LOGIC) ---

    async function exportTags() {
        const postId = getPostId(); if (!postId) { alert('Post ID not found!'); return; }
        let rawTags = []; let source = "Unknown";
        try {
            try { source = "Post API"; console.log('Tags: Trying Post API...'); const data = await fetchPostData(postId); if (data?.tag_names?.length > 0) { rawTags = data.tag_names; } else if (data?.tags?.length > 0) { rawTags = data.tags.map(tag => tag.name || tag.name_en || tag.tagName).filter(Boolean); } if (rawTags.length === 0) { throw new Error('No tags found'); } }
            catch (error) { console.warn(`[${source}] Fail: ${error.message}. Try Tags API...`); try { source = "Tags API"; console.log('Tags: Trying Tags API...'); rawTags = await fetchTagsData(postId); if (rawTags.length === 0) { throw new Error('No tags found'); } }
            catch (tagError) { console.warn(`[${source}] Fail: ${tagError.message}. Try HTML...`); try { source = "HTML Scrape"; console.log('Tags: Trying HTML Scrape...'); rawTags = await fetchTagsFromChanHtml(postId); if (rawTags.length === 0) { throw new Error('No tags found'); } }
            catch (scrapeError) { console.error(`[${source}] Fail: ${scrapeError.message}. All fail.`); alert('Could not retrieve tags.'); return; } } }
            if (rawTags.length > 0) { const choice = confirm(`Tags: ${rawTags.length} (via ${source}).\nOK: Copy | Cancel: TXT`); if (choice) { const clip = rawTags.map(t=>formatTagForClipboard(t)).join(', '); try { await navigator.clipboard.writeText(clip); alert('Tags copied!'); } catch (err) { try { const ta=document.createElement('textarea'); ta.value=clip; ta.style.cssText='position:fixed;opacity:0'; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); alert('Tags copied! (fallback)'); } catch (fall) { alert('Copy failed.'); } } } else { const txt = rawTags.map(t=>formatTag(t)).join(', '); const fn = `${getFileNamePrefix(postId)}.txt`; const blob = new Blob([txt],{type:'text/plain;charset=utf-8'}); const url = URL.createObjectURL(blob); downloadFile(url, fn); setTimeout(()=>URL.revokeObjectURL(url),1000); } }
        } catch (error) { alert(`Tag Export Error: ${error.message}`); }
    }

    async function exportJson() {
        const postId = getPostId(); if (!postId) { alert('Post ID not found!'); return; }
        try { console.log('Fetching JSON data...'); const data = await fetchPostData(postId); const json = JSON.stringify(data, null, 2); const fn = `${getFileNamePrefix(postId)}.json`; const blob = new Blob([json],{type:'application/json;charset=utf-8'}); const url = URL.createObjectURL(blob); downloadFile(url, fn); setTimeout(()=>URL.revokeObjectURL(url),1000); }
        catch (error) { alert(`JSON Export Error: ${error.message}`); }
    }

    // *** UPDATED exportImage Function ***
    async function exportImage() {
        const postId = getPostId(); if (!postId) { alert('Post ID not found!'); return; }
        let finalImageUrl = null; let source = "Unknown"; let isUndesired = false; // Flag for sample or preview

        try {
            if (isChanSite) {
                // --- Logic for chan.sankakucomplex.com ---
                source = "Chan HTML"; console.log('[CHAN IMG] Finding URL...');
                const imageLink = document.getElementById('image-link') || document.getElementById('highres');
                const imageElement = document.getElementById('image');
                if (imageLink?.href) { finalImageUrl = imageLink.href; }
                else if (imageElement?.src) { finalImageUrl = imageElement.src; }
                if (!finalImageUrl) { throw new Error('Could not find image link/src on chan page.'); }
                 // Normalize URL immediately
                 if (finalImageUrl.startsWith('//')) finalImageUrl = 'https:' + finalImageUrl;
                 else if (!finalImageUrl.startsWith('http')) finalImageUrl = new URL(finalImageUrl, window.location.origin).href;

            } else {
                 // --- Logic for www.sankakucomplex.com ---
                 source = "WWW Page"; let mainPageImageUrl = null;
                 console.log('[WWW IMG] Finding URL...');
                 // Prioritize fullscreen, then general containers
                 let imgElement = document.querySelector('.fullscreen img') || document.querySelector('.MuiBox-root[style*="text-align: center;"] img, #content > div > img, .MuiBox-root img');

                 if (imgElement?.src) {
                     mainPageImageUrl = imgElement.src;
                     if (mainPageImageUrl.startsWith('//')) mainPageImageUrl = 'https:' + mainPageImageUrl;
                     else if (!mainPageImageUrl.startsWith('http') && mainPageImageUrl.includes('/')) mainPageImageUrl = new URL(mainPageImageUrl, window.location.origin).href;

                     // *** Check for BOTH sample and preview ***
                     isUndesired = mainPageImageUrl.includes('/sample/') || mainPageImageUrl.includes('sample-') || mainPageImageUrl.includes('/preview/');
                     finalImageUrl = mainPageImageUrl; // Assume this is the best initially

                     if (isUndesired) { console.warn(`[WWW IMG] Found undesired (sample/preview): ${finalImageUrl}`); }
                     else { console.log(`[WWW IMG] Found acceptable URL: ${finalImageUrl}`); }
                 } else {
                     console.warn('[WWW IMG] No image element found on page.');
                     isUndesired = true; // No image found, definitely need fallback
                 }

                 // If found image is undesired OR no image was found, try fetching from chan API
                 if (isUndesired && postId) {
                     console.log('[WWW IMG] Undesired/missing, trying chan API...');
                     try {
                         source = "Chan API";
                         const chanImageUrl = await fetchOriginalImageUrlFromChanApi(postId);
                         // Check if the chan URL is ALSO undesired
                         const isChanUndesired = chanImageUrl.includes('/sample/') || chanImageUrl.includes('sample-') || chanImageUrl.includes('/preview/');

                         if (!isChanUndesired) { // If chan gave a GOOD url, use it
                            console.log('[WWW IMG] Using good URL from chan API:', chanImageUrl);
                            finalImageUrl = chanImageUrl;
                            isUndesired = false; // Mark as desired now
                         } else {
                             console.warn('[WWW IMG] Chan API URL also undesired. Using original WWW URL (if any).');
                             // Keep the original finalImageUrl (which might be null, sample, or preview)
                             source += " (Undesired Result)";
                         }
                     } catch (chanError) {
                         console.warn(`[WWW IMG] Chan API fetch failed: ${chanError.message}. Falling back to WWW page URL (if any).`);
                         source += " (Fetch Failed)";
                         // Keep the original finalImageUrl
                     }
                 }
                 // If after all attempts, we still have no URL, throw error
                 if (!finalImageUrl) { throw new Error('Could not determine image URL.'); }
            }

            // --- Common Download Logic ---
            // Normalize URL again just in case (though should be done above)
            if (finalImageUrl.startsWith('//')) finalImageUrl = 'https:' + finalImageUrl;

            const urlParts = finalImageUrl.split('?')[0].split('/');
            const originalFilename = urlParts[urlParts.length - 1] || `image_${postId}`;
            let fileExt = 'jpg'; // Default
            if (originalFilename.includes('.')) {
                 const extPart = originalFilename.split('.').pop();
                 // More permissive extension check (allow webp, avif, etc.)
                 if (extPart && /^[a-z0-9]{1,5}$/i.test(extPart)) {
                      fileExt = extPart.toLowerCase();
                 }
            }
            const filename = `${getFileNamePrefix(postId)}.${fileExt}`;
            const qualityType = isUndesired ? '(Sample/Preview) ' : ''; // Add indicator if we ended up with sample/preview

            console.log(`Final Download (Source: ${source}): ${qualityType}${filename} from ${finalImageUrl}`);
            downloadFile(finalImageUrl, filename);

        } catch (error) {
            alert(`Image Export Error (Source: ${source}): ${error.message}`);
            console.error(`Image Export Error (Source: ${source}):`, error);
        }
    }


    // --- Initialization ---

    function initializeExportTools() {
        const containerId = isChanSite ? 'export-button-container-chan' : 'export-button-container-www';
        if (document.getElementById(containerId)) return;
        console.log(`Initializing Export Tools on ${hostname}`);
        if (isChanSite) { addExportSectionChan(); }
        else { addExportSectionWww(); }
    }

    const observer = new MutationObserver((mutationsList, observer) => { initializeExportTools(); });
    observer.observe(document.body, { childList: true, subtree: true });

    function initialAddAttempts() {
        console.log('Running initial add attempts...');
        setTimeout(initializeExportTools, 500);
        setTimeout(initializeExportTools, 1500);
        setTimeout(initializeExportTools, 3000);
    }

    if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', initialAddAttempts); }
    else { initialAddAttempts(); }

})(); // End of userscript IIFE
