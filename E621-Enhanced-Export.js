// ==UserScript==
// @name         E621/E6AI Enhanced Export Tools
// @namespace    https://github.com/CryDotCom/Ono-Post-Extractor
// @version      1.7
// @description  Adds enhanced export functionality (Tags, File, JSON) to e621.net and e6ai.net posts with native button styling.
// @author       Onocom & AI Assistant
// @match        https://e621.net/posts/*
// @match        https://e6ai.net/posts/*
// @updateURL    https://raw.githubusercontent.com/CryDotCom/Ono-Post-Extractor/master/E621-Enhanced-Export.js
// @downloadURL  https://raw.githubusercontent.com/CryDotCom/Ono-Post-Extractor/master/E621-Enhanced-Export.js
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @connect      e621.net
// @connect      e6ai.net
// @connect      static1.e621.net
// @connect      static1.e6ai.net
// @connect      *
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    // Small tweak to group the custom buttons neatly
    GM_addStyle(`
        #custom-export-button-container {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
            align-items: center;
            margin-left: 6px;
        }
    `);

    function getPostId() {
        const path = window.location.pathname;
        const match = path.match(/\/posts\/(\d+)/);
        return match ? match[1] : null;
    }

    function getSitePrefix() {
        const hostname = window.location.hostname;
        if (hostname.includes('e621')) return 'e621';
        if (hostname.includes('e6ai')) return 'e6ai';
        return 'unknown';
    }

    function formatTag(tag) { return tag.replace(/_/g, ' '); }
    function formatTagForClipboard(tag) { return formatTag(tag).replace(/\(/g, '\\(').replace(/\)/g, '\\)'); }

    function downloadFileViaGM(url, filename) {
        GM_xmlhttpRequest({
            method: 'GET', url: url, responseType: 'blob', headers: { 'Referer': window.location.href }, timeout: 60000,
            onload: function(response) {
                if (response.status === 200 || response.status === 206) {
                    const blob = response.response;
                    const a = document.createElement('a');
                    a.href = URL.createObjectURL(blob);
                    a.download = filename;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(a.href);
                } else { alert(`Download Error for ${filename}: Status ${response.status}.`); }
            },
            onerror: function() { alert(`Download Network Error for ${filename}.`); },
            ontimeout: function() { alert(`Download Timeout for ${filename}.`); }
        });
    }

    function downloadFileFromString(content, filename, contentType) {
        const blob = new Blob([content], { type: contentType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    async function fetchPostData(postId) {
        if (!postId) return Promise.reject(new Error("Invalid Post ID."));
        const siteHost = window.location.hostname;
        const apiUrl = `https://${siteHost}/posts/${postId}.json`;

        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET', url: apiUrl, headers: { 'Accept': 'application/json' }, timeout: 15000,
                onload: function(response) {
                    if (response.status === 200) {
                        try {
                            const data = JSON.parse(response.responseText);
                            if (data && data.post) { resolve(data.post); }
                            else { reject(new Error('API response did not contain "post" object.')); }
                        } catch { reject(new Error('Failed to parse JSON from API.')); }
                    } else { reject(new Error(`API request failed: status ${response.status}.`)); }
                },
                onerror: function() { reject(new Error('API request network error.')); },
                ontimeout: function() { reject(new Error('API request timed out.')); }
            });
        });
    }

    async function handleExportTags() {
        const postId = getPostId();
        if (!postId) { alert('Post ID not found!'); return; }
        const sitePrefix = getSitePrefix();

        try {
            const postData = await fetchPostData(postId);
            const tagData = postData.tags;
            let orderedTags = [];

            if (tagData.artist && Array.isArray(tagData.artist)) {
                orderedTags = orderedTags.concat(tagData.artist);
            }
            const categoryOrder = ['general', 'species', 'character', 'copyright', 'meta', 'lore', 'invalid'];
            for (const category of categoryOrder) {
                if (category !== 'artist' && tagData[category] && Array.isArray(tagData[category])) {
                    orderedTags = orderedTags.concat(tagData[category]);
                }
            }
            for (const category in tagData) {
                if (tagData.hasOwnProperty(category) && category !== 'artist' && !categoryOrder.includes(category)) {
                    if (Array.isArray(tagData[category])) {
                        orderedTags = orderedTags.concat(tagData[category]);
                    }
                }
            }

            if (orderedTags.length === 0) { alert('No tags found.'); return; }
            const choice = confirm(`Found ${orderedTags.length} tags (artists first).\n\nOK: Copy to clipboard\nCancel: Download .txt file`);
            if (choice) {
                const clipboardText = orderedTags.map(formatTagForClipboard).join(', ');
                try {
                    await navigator.clipboard.writeText(clipboardText);
                    alert(`${orderedTags.length} tags copied!`);
                } catch {
                    const textArea = document.createElement("textarea");
                    textArea.value = clipboardText;
                    textArea.style.position = "fixed"; textArea.style.opacity = "0";
                    document.body.appendChild(textArea); textArea.focus(); textArea.select();
                    try {
                        document.execCommand('copy');
                        alert(`${orderedTags.length} tags copied (fallback)!`);
                    } catch { alert('Failed to copy tags.'); }
                    document.body.removeChild(textArea);
                }
            } else {
                const fileContent = orderedTags.map(formatTag).join(', ');
                const filename = `${sitePrefix}_${postId}.txt`;
                downloadFileFromString(fileContent, filename, 'text/plain;charset=utf-8');
            }
        } catch (error) { alert(`Tag Export Error: ${error.message}`); }
    }

    async function handleExportFile() {
        const postId = getPostId();
        if (!postId) { alert('Post ID not found!'); return; }
        const sitePrefix = getSitePrefix();

        try {
            const postData = await fetchPostData(postId);
            let fileUrl = postData.file.url;
            let fileExt = postData.file.ext;

            if (!fileUrl && postData.sample && postData.sample.has && postData.sample.url) {
                fileUrl = postData.sample.url;
                if (!fileExt && fileUrl.includes('.')) {
                     fileExt = fileUrl.split('.').pop().split('?')[0];
                }
                alert("Original file not found. Downloading sample instead.");
            }

            if (!fileUrl) {
                alert('No file URL could be found (original or sample).');
                return;
            }
            if (!fileExt) {
                fileExt = fileUrl.split('.').pop().split('?')[0] || 'dat';
            }

            const filename = `${sitePrefix}_${postId}.${fileExt}`;
            downloadFileViaGM(fileUrl, filename);
        } catch (error) {
            alert(`File Export Error: ${error.message}`);
        }
    }

    async function handleExportJson() {
        const postId = getPostId();
        if (!postId) { alert('Post ID not found!'); return; }
        const sitePrefix = getSitePrefix();
        try {
            const siteHost = window.location.hostname;
            const apiUrl = `https://${siteHost}/posts/${postId}.json`;
            GM_xmlhttpRequest({
                method: 'GET', url: apiUrl,
                onload: function(response) {
                    if (response.status === 200) {
                        try {
                            const parsedJson = JSON.parse(response.responseText);
                            const jsonString = JSON.stringify(parsedJson, null, 2);
                            const filename = `${sitePrefix}_${postId}.json`;
                            downloadFileFromString(jsonString, filename, 'application/json;charset=utf-8');
                        } catch (e) { alert(`JSON processing error: ${e.message}`); }
                    } else { alert(`JSON fetch error: Status ${response.status}.`); }
                },
                onerror: function() { alert('Network error fetching JSON.'); },
                ontimeout: function() { alert('Timeout fetching JSON.'); }
            });
        } catch (error) { alert(`JSON export error: ${error.message}`); }
    }

    // --- Button Creation and DOM Insertion ---
    function addExportButtons() {
        if (document.getElementById('custom-export-button-container')) return;

        const ptbrWrapper = document.getElementById('ptbr-wrapper');
        if (!ptbrWrapper) return;

        const fullscreenDiv = ptbrWrapper.querySelector('.ptbr-fullscreen');
        const container = document.createElement('div');
        container.id = 'custom-export-button-container';

        const buttonData = [
            { id: 'export-tags-btn', text: 'Tags', handler: handleExportTags, title: 'Export Tags (Copy or TXT)' },
            { id: 'export-file-btn', text: 'File', handler: handleExportFile, title: 'Download Original/Sample File' },
            { id: 'export-json-btn', text: 'JSON', handler: handleExportJson, title: 'Download Post JSON Data' }
        ];

        buttonData.forEach(data => {
            const button = document.createElement('button');
            button.id = data.id;
            button.type = 'button';
            button.className = 'st-button kinetic'; // native site style
            button.title = data.title;
            button.textContent = data.text;
            button.addEventListener('click', (event) => {
                event.preventDefault();
                data.handler();
            });
            container.appendChild(button);
        });

        if (fullscreenDiv && fullscreenDiv.parentNode) {
            fullscreenDiv.parentNode.insertBefore(container, fullscreenDiv.nextSibling);
        } else {
            ptbrWrapper.appendChild(container);
        }
    }

    function initialSetup() {
        addExportButtons();
        const observer = new MutationObserver(() => {
            if (document.getElementById('ptbr-wrapper') && !document.getElementById('custom-export-button-container')) {
                addExportButtons();
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    function runInitialAttempts() {
        setTimeout(addExportButtons, 500);
        setTimeout(addExportButtons, 1500);
        setTimeout(addExportButtons, 3000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => { runInitialAttempts(); initialSetup(); });
    } else { runInitialAttempts(); initialSetup(); }

})();
