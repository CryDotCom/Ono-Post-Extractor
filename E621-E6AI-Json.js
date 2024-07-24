// ==UserScript==
// @name         E621/E6AI JSON Downloader
// @namespace    ""
// @version      1.2
// @description  Adds a button to download post data as JSON on e621.net and e6ai.net
// @author       Onocom/GPT
// @match        https://e621.net/posts/*
// @match        https://e6ai.net/posts/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // Function to get the post ID from the URL
    function getPostId() {
        const urlParts = window.location.pathname.split('/');
        return urlParts[urlParts.length - 1];
    }

    // Function to create the JSON download link
    function createJsonLink(postId) {
        const baseUrl = window.location.origin;
        return `${baseUrl}/posts/${postId}.json`;
    }

    // Function to download JSON data
    function downloadJson(url, filename) {
        fetch(url)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(data => {
                const json = JSON.stringify(data, null, 2);
                const blob = new Blob([json], {type: 'application/json'});
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = filename;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            })
            .catch(error => {
                console.error('There has been a problem with your fetch operation:', error);
            });
    }

    // Main function to add the button
    function addJsonButton() {
        const extraControlsSection = document.getElementById('image-extra-controls');
        if (!extraControlsSection) {
            console.error('Extra controls section not found');
            return;
        }

        const downloadDiv = document.getElementById('image-download-link');
        if (!downloadDiv) {
            console.error('Download link div not found');
            return;
        }

        const postId = getPostId();
        const jsonLink = createJsonLink(postId);

        const div = document.createElement('div');
        const button = document.createElement('a');
        button.href = '#';
        button.className = 'button btn-warn';
        button.innerHTML = '<i class="fa-solid fa-file-code"></i><span>JSON</span>';

        button.addEventListener('click', (event) => {
            event.preventDefault();
            downloadJson(jsonLink, `${postId}.json`);
        });

        div.appendChild(button);
        downloadDiv.insertAdjacentElement('afterend', div);
    }

    // Wait for the DOM to load
    window.addEventListener('load', addJsonButton);
})();
