// ==UserScript==
// @name         Image and Tag Extractor for chan.Sankaku Complex/Rule34.xxx/gelbooru
// @version      3.8
// @namespace    https://github.com/CryDotCom/Ono-Post-Extractor
// @updateURL    https://raw.githubusercontent.com/CryDotCom/Ono-Post-Extractor/master/chanSankaku_Rule34_Extractor.js
// @downloadURL  https://raw.githubusercontent.com/CryDotCom/Ono-Post-Extractor/master/chanSankaku_Rule34_Extractor.js
// @description  Extracts image and tag information from chan.Sankaku Complex/Rule34.xxx/gelbooru, formats tags, and saves them to files, excluding certain categories of tags, ensuring sequential downloads.
// @author       Onocom/Crydotcom
// @match        https://chan.sankakucomplex.com/*
// @match        https://rule34.xxx/*
// @match        https://gelbooru.com/index.php?page=post*
// @grant        GM_registerMenuCommand
// @grant        GM_download
// ==/UserScript==

(function() {
    'use strict';

    // Function to extract data from Sankaku Complex
    async function extractDataFromSankaku() {
        try {
            // Get the content and sidebar elements
            const contentDiv = document.querySelector('#content');
            const sidebarDiv = document.querySelector('.sidebar');
            const statsDiv = document.querySelector('#stats');

            if (!contentDiv || !sidebarDiv || !statsDiv) {
                alert("Required elements not found on this page.");
                return;
            }

            // Extract the name or fallback to Post ID
            let saveName;
            const nameSpan = contentDiv.querySelector('span[itemprop="name"]');
            if (nameSpan) {
                saveName = nameSpan.textContent.trim();
            } else {
                // Fallback: Extract Post ID from stats or URL
                const postIdSpan = Array.from(statsDiv.querySelectorAll('span')).find(span =>
                 span.textContent.includes('Post ID:')
                );
                if (postIdSpan) {
                    saveName = postIdSpan.textContent.replace('Post ID:', '').trim();
                } else {
                    // Fallback to extracting Post ID from URL
                    const currentUrl = window.location.href;
                    const urlMatch = currentUrl.match(/\/posts\/([a-zA-Z0-9]+)[^a-zA-Z0-9]?/);
                    saveName = urlMatch ? urlMatch[1] : "unnamed";
                }
            }

            // Extract tags
            const tags = [];
            const tagSidebar = sidebarDiv.querySelector('ul#tag-sidebar');
            if (tagSidebar) {
                tagSidebar.querySelectorAll('li').forEach(li => {
                   const tagLink = li.querySelector('a[href^="/en/?tags="]');
                       let tag = tagLink.getAttribute('href').split('=')[1];
                       if (li.classList.contains('tag-type-artist')) {
                           tag = `by_${tag}`;
                       }
                       tags.push(tag);
               });
            }

            // Format tags
            const formattedTags = tags.map(tag => {
                // Decode URL-encoded characters
                tag = decodeURIComponent(tag);
                // Replace underscores with spaces
                tag = tag.replace(/_/g, ' ');

                return tag;
            });

            // Extract the original image link
            const highresLink = statsDiv.querySelector('a#highres');
            if (!highresLink) {
                alert("Original image link not found.");
                return;
            }
            let imageUrl = highresLink.href;

            // Ensure the image URL starts with https:
            if (imageUrl.startsWith("//")) {
                imageUrl = "https:" + imageUrl;
            }

            // Extract the file extension from the image URL
            const fileExtensionMatch = imageUrl.match(/\.(\w{3,4})(\?|$)/);
            let fileExtension = "png"; // Default to PNG
            if (fileExtensionMatch) {
                fileExtension = fileExtensionMatch[1];
            }

            // Save tags to a text file and wait for it to complete
            const tagsContent = formattedTags.join(',');
            const tagsBlob = new Blob([tagsContent], { type: 'text/plain' });
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

    // Function to extract data from Rule34.xxx
    async function extractDataFromRule34() {
        try {
            // Get the stats and sidebar elements
            const statsDiv = document.querySelector('#stats');
            const sidebarDiv = document.querySelector('.sidebar');
            const linkListDiv = document.querySelector('.link-list');

            if (!statsDiv || !sidebarDiv || !linkListDiv) {
                alert("Required elements not found on this page.");
                return;
            }

            // Extract the name (Id)
            const idLi = Array.from(statsDiv.querySelectorAll('li')).find(li => li.textContent.startsWith('Id:'));
            if (!idLi) {
                alert("ID not found.");
                return;
            }
            const saveName = idLi.textContent.replace('Id: ', '').trim();

            // Extract tags
            const tagSidebar = sidebarDiv.querySelector('ul#tag-sidebar');
            if (!tagSidebar) {
                alert("Tag sidebar not found.");
                return;
            }
            // Extract tags
            const tags = [];
            tagSidebar.querySelectorAll('li').forEach(li => {
                const tagLink = li.querySelector('a[href*="tags="]');
                if (tagLink) { // Ensure tagLink is not null before proceeding
                    let tag = tagLink.getAttribute('href').split('tags=')[1];
                    if (li.classList.contains('tag-type-artist')) {
                        tag = `by_${tag}`;
                    }
                    tags.push(tag);
                }
            });

            // Format tags
            const formattedTags = tags.map(tag => {
                // Decode URL-encoded characters
                tag = decodeURIComponent(tag);

                // Replace parentheses with escaped parentheses
                tag = tag.replace(/\(/g, '\\(').replace(/\)/g, '\\)');

                // Replace underscores with spaces
                tag = tag.replace(/_/g, ' ');

                return tag;
            });

            // Extract the original image link
            const highresLink = linkListDiv.querySelector('a[href*="images"]');
            if (!highresLink) {
                alert("Original image link not found.");
                return;
            }
            let imageUrl = highresLink.href;

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

    // Function to extract data from Gelbooru
    async function extractDataFromGelbooru() {
        try {
            const tagListSection = document.querySelector('#tag-list');

            if (!tagListSection) {
                alert("The #tag-list section was not found on this page.");
                return;
            }

            // Extract the ID from a specific list item in #tag-list
            const idLi = Array.from(tagListSection.querySelectorAll('li')).find(li => li.textContent.startsWith('Id:'));
            if (!idLi) {
                alert("ID not found.");
                return;
            }
            const saveName = idLi.textContent.replace('Id: ', '').trim();

            // Extract tags
            const tags = [];
            tagListSection.querySelectorAll('li').forEach(li => {
                if (li.className.startsWith('tag-type-')) { // Matches any class starting with 'tag-type-'
                    const tagLink = li.querySelector('a[href*="tags="]');
                    if (tagLink) {
                        let tag = tagLink.textContent.trim();
                        if (li.classList.contains('tag-type-artist')) {
                            tag = `by_${tag}`;
                        }
                        tags.push(tag);
                    }
                }
            });

            // Format tags
            const formattedTags = tags.map(tag => {
                // Decode URL-encoded characters and replace underscores with spaces
                return decodeURIComponent(tag).replace(/_/g, ' ');
            });

            // Save tags to a text file
            const tagsContent = formattedTags.join(',');
            const tagsBlob = new Blob([tagsContent], { type: 'text/plain' });
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

            // Extract the original image link
            const originalImageLi = Array.from(tagListSection.querySelectorAll('li')).find(li => {
                const aTag = li.querySelector('a');
                return aTag && aTag.textContent.includes('Original image');
            });

            if (!originalImageLi) {
                alert("Original image link not found.");
                return;
            }

            const imageUrl = originalImageLi.querySelector('a').href;

            // Extract the file extension from the image URL
            const fileExtensionMatch = imageUrl.match(/\.(\w{3,4})(\?|$)/);
            let fileExtension = "png"; // Default to PNG
            if (fileExtensionMatch) {
                fileExtension = fileExtensionMatch[1];
            }

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
            console.error("Error extracting data from Gelbooru:", error);
            alert("An error occurred while extracting data from Gelbooru.");
        }
    }


    // Function to determine the site and extract data accordingly
    function extractData() {
        const currentURL = window.location.href;

        if (currentURL.includes("chan.sankakucomplex.com")) {
            extractDataFromSankaku();
        } else if (currentURL.includes("rule34.xxx")) {
            extractDataFromRule34();
        } else if (currentURL.includes("gelbooru.com")) {
            extractDataFromGelbooru();
        } else {
            alert("This script does not support the current site.");
        }
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
