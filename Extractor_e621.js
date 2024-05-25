// ==UserScript==
// @name         Image and Tag Extractor for e621.net
// @namespace    https://github.com/CryDotCom/Ono-Post-Extractor
// @updateURL    https://raw.githubusercontent.com/CryDotCom/Ono-Post-Extractor/master/Extractor_e621.js
// @downloadURL  https://raw.githubusercontent.com/CryDotCom/Ono-Post-Extractor/master/Extractor_e621.js
// @version      1.4
// @description  Extracts image and tag information from e621.net, formats tags, and saves them to a file, excluding certain categories of tags, ensuring sequential downloads.
// @author       Onocom/Crydotcom
// @match        https://e621.net/*
// @grant        GM_registerMenuCommand
// @grant        GM_download
// ==/UserScript==

(function() {
    'use strict';

    // Function to extract data from e621.net
    async function extractDataFromE621() {
        try {
            // Get the post information and link list elements
            const postInfoSection = document.querySelector('#post-information');
            const linkListDiv = document.querySelector('#post-options');

            if (!postInfoSection || !linkListDiv) {
                alert("Required elements not found on this page.");
                return;
            }

            // Extract the name (ID)
            const idLi = Array.from(postInfoSection.querySelectorAll('li')).find(li => li.textContent.startsWith('ID:'));
            if (!idLi) {
                alert("ID not found.");
                return;
            }
            const saveName = idLi.textContent.replace('ID: ', '').trim();

            // Find the sidebar
            const sidebar = document.querySelector('aside#sidebar');

            // Find the tag list section within the sidebar
            const tagListSection = sidebar.querySelector('section#tag-list');

            // Extract tags from the tag list section
            const tags = [];
            tagListSection.querySelectorAll('ul[class$="-tag-list"] a.search-tag').forEach(tagLink => {
                const tag = tagLink.getAttribute('href').split('=')[1];
                const decodedTag = decodeURIComponent(tag);
                if (tagLink.closest('ul').classList.contains('artist-tag-list')) {
                    tags.push(`by ${decodedTag}`);
                } else {
                    tags.push(decodedTag);
                }
            });

            // Format tags
            const formattedTags = tags.map(tag => {
                // Replace underscores with spaces
                tag = tag.replace(/_/g, ' ');
                // Format parentheses
                tag = tag.replace(/\(/g, '\\(').replace(/\)/g, '\\)');
                return tag;
            });

            // Extract the original image link
            const downloadLink = Array.from(linkListDiv.querySelectorAll('a')).find(link => link.textContent.trim() === "Download");
            if (!downloadLink) {
                alert("Original image link not found.");
                return;
            }
            let imageUrl = downloadLink.href;

            // Extract the file extension from the image URL
            const fileExtensionMatch = imageUrl.match(/\.(\w{3,4})(\?|$)/);
            let fileExtension = "png"; // Default to PNG
            if (fileExtensionMatch) {
                fileExtension = fileExtensionMatch[1];
            }

            // Save tags to a text file and wait for it to complete
            const tagsContent = formattedTags.join(',');
            const tagsBlob = new Blob([tagsContent], {type: 'text/plain'});
            const tagsUrl = URL.createObjectURL(tagsBlob);
            const tagsFileName = `${saveName}.txt`;

            await new Promise((resolve, reject) => {
                GM_download({
                    url: tagsUrl,
                    name: tagsFileName,
                    saveAs: true,
                    onload: resolve,
                    onerror: reject
                });
            });

            // Download the image file
            await new Promise((resolve, reject) => {
                GM_download({
                    url: imageUrl,
                    name: `${saveName}.${fileExtension}`, // Set the file extension dynamically
                    saveAs: true,
                    onload: resolve,
                    onerror: error => {
                        alert("An error occurred while downloading the image.");
                        reject(error);
                    }
                });
            });

        } catch (error) {
            console.error("Error extracting data:", error);
            alert("An error occurred while extracting data.");
        }
    }

    // Function to extract data when triggered by hotkey or menu command
    function extractData() {
        extractDataFromE621();
    }

    // Register hotkey combination for triggering data extraction
    document.addEventListener("keydown", function(event) {
        if (event.ctrlKey && event.key === "0" && !event.shiftKey && !event.altKey && !event.metaKey) {
            event.preventDefault(); // Prevent the default behavior of the hotkey combination
            extractData(); // Call the function to extract and save data
        }
    });

    // Register menu command for triggering data extraction
    GM_registerMenuCommand("Extract Data", extractData);
})();
