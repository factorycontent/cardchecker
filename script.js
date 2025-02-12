document.addEventListener('DOMContentLoaded', () => {
  // --- DOM Element References (Cached for Performance) ---
  const thumbnailsContainer = document.getElementById('thumbnails-container');
  const aspectRatioSelector = document.getElementById('aspect-ratio');
  const feedPicker = document.getElementById('feed-picker');
  const folderPicker = document.getElementById('folder-picker');
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabContents = document.querySelectorAll('.tab-content');
  const formatButtons = document.querySelectorAll('.format-button');
  const xmlFields = document.getElementById('xml-tags');
  const csvFields = document.getElementById('csv-columns');
  const xmlIdTag = document.getElementById('xml-id-tag');
  const xmlImageTag = document.getElementById('xml-image-tag');
  const csvIdColumn = document.getElementById('csv-id-column');
  const csvImageColumn = document.getElementById('csv-image-column');
  const getDefectiveButton = document.getElementById('get-defective');
  const copyIdsButton = document.getElementById('copy-ids');
  const downloadTxtButton = document.getElementById('download-txt');
  const closePopupButton = document.getElementById('close-popup');
  const sortDirectionSelector = document.getElementById('sort-direction');
  const bannerCountElement = document.getElementById('banner-count');

  let covers = [];
  let aspectRatio = '1:1'; // Default aspect ratio

  // --- Helper Functions ---

  function getImageLink(pictureNodes, format) {
      const formatMap = {
          '1:1': ['_0.', '.png', '/11.', '/169.'],
          '3:4': ['_34.', '/34.'],
          '4:3': ['_43.', '/43.'],
          '16:5': ['_165.', '/165.']
      };

      // First, filter valid nodes once to improve performance
      const validNodes = Array.from(pictureNodes).filter(node => {
          const src = node.textContent.toLowerCase();
          return src.includes('fabrikont.ru') || src.includes('storage.yandexcloud.net');
      });

      if (validNodes.length === 0) return '';

      // For 4:3 format specifically, prioritize exact match first
      if (format === '4:3') {
          const exact43Match = validNodes.find(node => 
              node.textContent.includes('_43.') || 
              node.textContent.includes('/43.')
          );
          if (exact43Match) return exact43Match.textContent;
      }

      // If no specific format match found, return the first valid URL
      return validNodes[0].textContent;
  }

  function extractTimestamp(url) {
      if (!url) return null;
      const timestampParam = url.match(/timestamp=(\d+)/);
      if (timestampParam) return parseInt(timestampParam[1]);
      const timestampInPath = url.match(/\/(\d{13})\//);
      if (timestampInPath) return parseInt(timestampInPath[1]);
      return null;
  }

  function formatDate(timestamp) {
      if (!timestamp) return 'Дата не указана';
      const date = new Date(timestamp);
      const now = new Date();
      const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
      const dateStr = date.toLocaleDateString('ru-RU');
      let relativeTime;
      if (diffDays === 0) {
          relativeTime = 'сегодня';
      } else if (diffDays === 1) {
          relativeTime = 'вчера';
      } else {
          relativeTime = `${diffDays} дн. назад`;
      }
      return `${dateStr} (${relativeTime})`;
  }

  function sortCovers(covers) {
    const sortDirection = sortDirectionSelector.value;
      return [...covers].sort((a, b) => { // use the spread operator to avoid mutating the original array.
        if (!a.timestamp && !b.timestamp) return 0;
        if (!a.timestamp) return 1;
        if (!b.timestamp) return -1;

        const timeA = a.timestamp;
        const timeB = b.timestamp;

        return sortDirection === 'desc' ? timeB - timeA : timeA - timeB;
      });
  }

  function updateBannerCount(count) {
      bannerCountElement.textContent = `Загружено баннеров: ${count}`;
  }
  function clearThumbnails() {
    thumbnailsContainer.innerHTML = ''; // Clear existing thumbnails
  }

  // --- New Function:  Load and Display ---
function loadAndDisplay(newCovers) {
  covers = newCovers; // Update the global covers array
  const sortedCovers = sortCovers(covers);
  displayThumbnails(sortedCovers);
}
  function displayThumbnails(coversToDisplay) {
      clearThumbnails(); // Clear before adding new ones

      for (const cover of coversToDisplay) {
          const div = document.createElement('div');
          div.className = 'thumbnail';
          div.classList.add(`aspect-${aspectRatio.replace(':', '-')}`);

          const img = document.createElement('img');
          img.src = cover.src || 'placeholder.png'; // Use the single src
          img.alt = cover.title;
          img.onerror = () => img.src = 'placeholder.png';

          const label = document.createElement('label');
          const checkbox = document.createElement('input');
          checkbox.type = 'checkbox';
          checkbox.value = cover.id;
          checkbox.checked = cover.isDefective;  // Preserve checked state

          const dateInfo = document.createElement('div');
          dateInfo.className = 'update-date';
          dateInfo.textContent = formatDate(cover.timestamp);

          label.appendChild(checkbox);
          label.appendChild(document.createTextNode(` ${cover.title}`));

          div.appendChild(img);
          div.appendChild(label);
          div.appendChild(dateInfo);
          thumbnailsContainer.appendChild(div);

          div.addEventListener('click', (event) => {
              if (event.target !== checkbox) {
                  checkbox.click(); // Consistent checkbox behavior
              }
          });

          checkbox.addEventListener('change', () => {
              cover.isDefective = checkbox.checked;
              div.classList.toggle('selected', checkbox.checked);
          });
      }

      updateBannerCount(coversToDisplay.length);
  }


  // --- Parsing Functions (Now with Aspect Ratio) ---
function processOffers(offers, imageTag, currentAspectRatio) {
  const covers = [];
  for (let offer of offers) {
      const id = offer.getAttribute('id');
      let pictureNodes = offer.getElementsByTagName(imageTag);
      if (!pictureNodes.length) pictureNodes = offer.getElementsByTagName('poster');
      if (!pictureNodes.length) pictureNodes = offer.getElementsByTagName('picture');

      // Get the image link for the *current* aspect ratio
      const src = getImageLink(pictureNodes, currentAspectRatio);

      if (id && src) {
          const timestamp = extractTimestamp(src);
          covers.push({
              id,
              title: id,
              src, // Just the single src for the current aspect ratio
              isDefective: false, // Keep track of defective state
              timestamp
          });
      }
  }
  return covers;
}

function parseXMLFeed(xmlDoc, idTag, imageTag, currentAspectRatio) {
  const offers = xmlDoc.getElementsByTagName('offer');
  return processOffers(offers, imageTag, currentAspectRatio);
}

function parseYMLFeed(xmlDoc, idTag, imageTag, currentAspectRatio) {
  const offers = xmlDoc.querySelector('shop offers')?.getElementsByTagName('offer') || [];
  return processOffers(offers, imageTag, currentAspectRatio);
}

function parseCSVFeed(csvString, idColumn, imageColumn, currentAspectRatio) {
    const covers = [];
    const lines = csvString.trim().split('\n');
    const headers = lines[0].split(',');

    const idIndex = headers.indexOf(idColumn);
    const srcIndex = headers.indexOf(imageColumn);
    const titleIndex = headers.indexOf('ID Cruise'); // Consider making this configurable too

    if (idIndex === -1 || srcIndex === -1) {
        console.error(`Не удалось найти указанные столбцы: "${idColumn}" или "${imageColumn}"`);
        return covers;
    }

    for (let i = 1; i < lines.length; i++) {
        const cells = lines[i].split(',');
        const id = cells[idIndex];
        const originalSrc = cells[srcIndex]; // Keep the original src
        const title = titleIndex !== -1 ? (cells[titleIndex] || id) : id;

        if (id && originalSrc) {
             // Create mock pictureNodes for CSV, now we use getImageLink
            const mockPictureNodes = [{ textContent: originalSrc }];
            const src = getImageLink(mockPictureNodes, currentAspectRatio);
            const timestamp = extractTimestamp(src);
            covers.push({
                id,
                title,
                src, // Just the single src
                isDefective: false,
                timestamp
            });
        }
    }
    return covers;
}
function parseFolder(files, currentAspectRatio) {
  const covers = [];
  for (let file of files) {
      if (file.type.startsWith('image/')) {
          const pathParts = file.webkitRelativePath.split('/');
          const id = pathParts[pathParts.length - 1].split('.')[0];
          const title = id;
          const src = URL.createObjectURL(file);
          const timestamp = file.lastModified;

          // For files, we assume they are already in the desired aspect ratio
          // No need for getImageLink, we just use the src directly.
          covers.push({ id, title, src, isDefective: false, timestamp });
      }
  }
  return covers;
}


  // --- Event Listeners ---

  aspectRatioSelector.addEventListener('change', () => {
  aspectRatio = aspectRatioSelector.value; // Update global aspect ratio
  const newAspectClass = `aspect-${aspectRatio.replace(':', '-')}`;

  // Remove old aspect ratio classes and add the new one
  thumbnailsContainer.querySelectorAll('.thumbnail').forEach(thumbnail => {
      thumbnail.classList.remove('aspect-1-1', 'aspect-3-4', 'aspect-4-3', 'aspect-16-5');
      thumbnail.classList.add(newAspectClass);
  });


  // Reload images with the new aspect ratio, preserving defective state
  if (covers.length > 0) {
      // We have existing data, reload based on the new aspect ratio.
      const currentTab = document.querySelector('.tab-button.active').getAttribute('data-tab');

      if (currentTab === 'feed') {
          // Reload from feed
          const file = feedPicker.files && feedPicker.files[0];
          if (file) { // Check if a file was actually selected
              const feedFormat = document.querySelector('.format-button.active').getAttribute('data-format');
              const reader = new FileReader();

              reader.onload = (e) => {
                  const content = e.target.result;
                  let newCovers = [];

                  if (feedFormat === 'xml' || feedFormat === 'yml') {
                      const parser = new DOMParser();
                      const xmlDoc = parser.parseFromString(content, "text/xml");
                      const isYML = xmlDoc.querySelector('yml_catalog') !== null;
                      newCovers = isYML
                          ? parseYMLFeed(xmlDoc, xmlIdTag.value, xmlImageTag.value, aspectRatio)
                          : parseXMLFeed(xmlDoc, xmlIdTag.value, xmlImageTag.value, aspectRatio);

                  } else if (feedFormat === 'csv') {
                      newCovers = parseCSVFeed(content, csvIdColumn.value, csvImageColumn.value, aspectRatio);
                  }

                  // Crucial: Merge defective state from the *old* covers
                  const mergedCovers = newCovers.map(newCover => {
                      const oldCover = covers.find(c => c.id === newCover.id);
                      return {
                          ...newCover,
                          isDefective: oldCover ? oldCover.isDefective : false,
                      };
                  });

                  loadAndDisplay(mergedCovers); // Load and display with merged data
              };

              reader.onerror = (e) => console.error('Ошибка чтения файла:', e);
              reader.readAsText(file);
          }

      } else if (currentTab === 'folder') {
          // Reload from folder
            const files = folderPicker.files;
            if(files.length > 0){
              let newCovers = parseFolder(files, aspectRatio);

              const mergedCovers = newCovers.map(newCover => {
                    const oldCover = covers.find(c => c.id === newCover.id);
                    return {
                        ...newCover,
                        isDefective: oldCover ? oldCover.isDefective : false,
                    };
                });

              loadAndDisplay(mergedCovers);
            }
      }
  }
});


  tabButtons.forEach(button => {
      button.addEventListener('click', () => {
          const tabName = button.getAttribute('data-tab');
          
          // Remove active class from all buttons and contents
          tabButtons.forEach(btn => btn.classList.remove('active'));
          tabContents.forEach(content => content.classList.remove('active'));
          
          // Add active class to clicked button
          button.classList.add('active');
          
          // Find and show the corresponding content
          const activeContent = document.getElementById(`${tabName}-input`);
          if (activeContent) {
              activeContent.classList.add('active');
              activeContent.style.display = 'block'; // Явно устанавливаем display: block
          }
      });
  });

  formatButtons.forEach(button => {
      button.addEventListener('click', () => {
          const format = button.getAttribute('data-format');
          formatButtons.forEach(btn => btn.classList.remove('active'));
          button.classList.add('active');
          xmlFields.style.display = format === 'xml' || format === 'yml' ? 'block' : 'none';
          csvFields.style.display = format === 'csv' ? 'block' : 'none';
      });
  });

//Initial load function
function initialLoad(){
  const file = feedPicker.files && feedPicker.files[0];
  if(!file) return;

  const feedFormat = document.querySelector('.format-button.active').getAttribute('data-format');
  const reader = new FileReader();
  reader.onload = (e) => {
    const content = e.target.result;
    let newCovers = [];
    if (feedFormat === 'xml' || feedFormat === 'yml') {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(content, "text/xml");
        const isYML = xmlDoc.querySelector('yml_catalog') !== null;
        newCovers = isYML
            ? parseYMLFeed(xmlDoc, xmlIdTag.value, xmlImageTag.value, aspectRatio)
            : parseXMLFeed(xmlDoc, xmlIdTag.value, xmlImageTag.value, aspectRatio);
    } else if (feedFormat === 'csv') {
        newCovers = parseCSVFeed(content, csvIdColumn.value, csvImageColumn.value, aspectRatio);
    }
    loadAndDisplay(newCovers);
};
reader.readAsText(file);
}

  feedPicker.addEventListener('change', initialLoad);

  folderPicker.addEventListener('change', (event) => {
      const files = event.target.files;
      if (files.length === 0) return;
      const newCovers = parseFolder(files, aspectRatio); // No need for merging here
      loadAndDisplay(newCovers);

  });

  getDefectiveButton.addEventListener('click', () => {
      const defectiveIds = covers.filter(cover => cover.isDefective).map(cover => cover.id);
      if (defectiveIds.length === 0) {
          alert('Нет выделенных карточек.');
          return;
      }
      document.getElementById('defective-ids').value = defectiveIds.join('\n');
      document.getElementById('overlay').style.display = 'block';
      document.getElementById('popup').style.display = 'block';
  });

  copyIdsButton.addEventListener('click', () => {
      const textarea = document.getElementById('defective-ids');
      textarea.select();
      document.execCommand('copy');
  });

  downloadTxtButton.addEventListener('click', () => {
      const text = document.getElementById('defective-ids').value;
      const blob = new Blob([text], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'defective_ids.txt';
      a.click();
      URL.revokeObjectURL(url);
  });

  closePopupButton.addEventListener('click', () => {
      document.getElementById('overlay').style.display = 'none';
      document.getElementById('popup').style.display = 'none';
  });

  sortDirectionSelector.addEventListener('change', () => {
      // We don't reload everything, just re-sort and re-display
      if (covers.length > 0) {
        displayThumbnails(sortCovers(covers));
      }
  });

  document.getElementById('folder-input').style.display = 'none';

  // Initialize tabs correctly
  const folderInput = document.getElementById('folder-input');
  if (folderInput) {
      folderInput.style.display = 'none'; // Initially hidden
  }
});