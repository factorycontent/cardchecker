document.addEventListener('DOMContentLoaded', () => {
  const thumbnailsContainer = document.getElementById('thumbnails-container');
  const aspectRatioSelector = document.getElementById('aspect-ratio');
  const feedPicker = document.getElementById('feed-picker');
  const folderPicker = document.getElementById('folder-picker');
  const dataSourceRadios = document.querySelectorAll('input[name="data-source"]');
  const feedFormatRadios = document.querySelectorAll('input[name="feed-format"]');
  const idTagInput = document.getElementById('id-tag');
  const imageTagInput = document.getElementById('image-tag');

  let covers = [];
  let aspectRatio = '1:1'; // Значение по умолчанию

  // Обработчик изменения выбора соотношения сторон
  aspectRatioSelector.addEventListener('change', () => {
    aspectRatio = aspectRatioSelector.value;
    updateThumbnailsAspect(covers); // Обновляем миниатюры, если выбор изменен
  });

  function updateThumbnailsAspect(covers) {
    // Обновляем ссылки на изображения из фида в зависимости от выбранного формата
    covers.forEach(cover => {
        const pictureNodes = cover.pictureNodes; // Сохраняем pictureNodes при загрузке фида
        cover.src = getImageLink(pictureNodes, aspectRatio);
    });

    // Обновляем миниатюры
    displayThumbnails(covers);
  }

  dataSourceRadios.forEach(radio => {
      radio.addEventListener('change', () => {
          const selectedValue = document.querySelector('input[name="data-source"]:checked').value;
          document.getElementById('feed-input').style.display = selectedValue === 'feed' ? 'block' : 'none';
          document.getElementById('folder-input').style.display = selectedValue === 'folder' ? 'block' : 'none';
      });
  });

  // Обработка переключения вкладок
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabContents = document.querySelectorAll('.tab-content');

  tabButtons.forEach(button => {
      button.addEventListener('click', () => {
          const tabName = button.getAttribute('data-tab');
          
          tabButtons.forEach(btn => btn.classList.remove('active'));
          tabContents.forEach(content => content.classList.remove('active'));
          
          button.classList.add('active');
          document.getElementById(`${tabName}-input`).classList.add('active');
      });
  });

  // Обработка переключения формата файла
  const formatButtons = document.querySelectorAll('.format-button');
  const xmlFields = document.getElementById('xml-tags');
  const csvFields = document.getElementById('csv-columns');

  formatButtons.forEach(button => {
      button.addEventListener('click', () => {
          const format = button.getAttribute('data-format');
          
          formatButtons.forEach(btn => btn.classList.remove('active'));
          button.classList.add('active');
          
          if (format === 'xml') {
              xmlFields.style.display = 'block';
              csvFields.style.display = 'none';
          } else {
              xmlFields.style.display = 'none';
              csvFields.style.display = 'block';
          }
      });
  });

  const xmlTags = document.getElementById('xml-tags');
  const csvColumns = document.getElementById('csv-columns');
  const xmlIdTag = document.getElementById('xml-id-tag');
  const xmlImageTag = document.getElementById('xml-image-tag');
  const csvIdColumn = document.getElementById('csv-id-column');
  const csvImageColumn = document.getElementById('csv-image-column');

  feedFormatRadios.forEach(radio => {
    radio.addEventListener('change', () => {
      const selectedFormat = document.querySelector('input[name="feed-format"]:checked').value;
      xmlTags.style.display = selectedFormat === 'xml' ? 'block' : 'none';
      csvColumns.style.display = selectedFormat === 'csv' ? 'block' : 'none';
    });
  });

  feedPicker.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) return;
  
    const feedFormat = document.querySelector('.format-button.active').getAttribute('data-format');
    const reader = new FileReader();
  
    reader.onload = (e) => {
      const content = e.target.result;
  
      if (feedFormat === 'xml') {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(content, "text/xml");
        covers = parseXMLFeed(xmlDoc, xmlIdTag.value, xmlImageTag.value);
      } else if (feedFormat === 'csv') {
        covers = parseCSVFeed(content, csvIdColumn.value, csvImageColumn.value);
      }
  
      displayThumbnails(covers);
    };
  
    reader.onerror = (e) => {
      console.error('Ошибка чтения файла:', e);
    };
  
    reader.readAsText(file);
  });

  function getImageLink(pictureNodes, format) {
    for (let node of pictureNodes) {
        const src = node.textContent;
        if (format === '3:4' && src.includes('_34.jpg')) {
            return src;
        } else if (format === '16:5' && src.includes('_165.jpg')) {
            return src;
        } else if (format === '1:1' && src.includes('fabrikont.ru')) {
            return src; // Логика по умолчанию для 1:1
        }
    }
    return ''; // Если подходящее изображение не найдено
  }

  function parseXMLFeed(xmlDoc, idTag, imageTag) {
    const covers = [];
    const offers = xmlDoc.getElementsByTagName(idTag);

    for (let offer of offers) {
        const id = offer.getAttribute('id');
        const pictureNodes = offer.getElementsByTagName(imageTag); // Сохраняем все pictureNodes
        const src = getImageLink(pictureNodes, aspectRatio);

        if (id && src) {
            covers.push({ id, title: id, src, pictureNodes, isDefective: false });
        }
    }

    return covers;
  }

  function parseCSVFeed(csvString, idColumn, imageColumn) {
    const covers = [];
    const lines = csvString.split('\n');
    const headers = lines[0].toLowerCase().split(',');
    
    const idIndex = headers.indexOf(idColumn.toLowerCase());
    const srcIndex = headers.indexOf(imageColumn.toLowerCase());
    const titleIndex = headers.indexOf('id cruise'); // Предполагаем, что 'ID Cruise' - это название столбца с заголовком

    if (idIndex === -1 || srcIndex === -1) {
      console.error('Не удалось найти указанные столбцы ID или Image URL');
      return covers;
    }

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const cells = line.split(',');
      const id = cells[idIndex];
      const src = cells[srcIndex];
      const title = titleIndex !== -1 ? cells[titleIndex] : id; // Используем ID как заголовок, если столбец Title не найден

      if (id && src) {
        covers.push({ id, title, src, isDefective: false });
      }
    }

    console.log(`Обработано ${covers.length} записей из CSV`);
    return covers;
  }

  document.getElementById('get-defective').addEventListener('click', () => {
    const defectiveIds = covers.filter(cover => cover.isDefective).map(cover => cover.id);

    if (defectiveIds.length === 0) {
        alert('Нет выделенных карточек.');
        return;
    }

    document.getElementById('defective-ids').value = defectiveIds.join('\n');
    document.getElementById('overlay').style.display = 'block';
    document.getElementById('popup').style.display = 'block';
  });

  document.getElementById('copy-ids').addEventListener('click', () => {
      const textarea = document.getElementById('defective-ids');
      textarea.select();
      document.execCommand('copy');
  });

  document.getElementById('download-txt').addEventListener('click', () => {
      const text = document.getElementById('defective-ids').value;
      const blob = new Blob([text], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'defective_ids.txt';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
  });

  document.getElementById('close-popup').addEventListener('click', () => {
      document.getElementById('overlay').style.display = 'none';
      document.getElementById('popup').style.display = 'none';
  });

  folderPicker.addEventListener('change', (event) => {
    const files = event.target.files;
    if (files.length === 0) return;
  
    covers = parseFolder(files);
    displayThumbnails(covers);
  });

  function parseFolder(files) {
    const covers = [];
    for (let file of files) {
      if (file.type.startsWith('image/')) {
        const pathParts = file.webkitRelativePath.split('/');
        const id = pathParts[pathParts.length - 1].split('.')[0]; // Используем имя файла без расширения как ID
        const title = id;
        const src = URL.createObjectURL(file);
        covers.push({ id, title, src, isDefective: false });
      }
    }
    console.log(`Обработано ${covers.length} изображений из папки`);
    return covers;
  }

  function updateBannerCount(count) {
    const bannerCountElement = document.getElementById('banner-count');
    bannerCountElement.textContent = `Загружено баннеров: ${count}`;
  }

  function displayThumbnails(covers) {
    console.log('Начало отображения миниатюр');
    thumbnailsContainer.innerHTML = '';

    covers.forEach((cover, index) => {
        const div = document.createElement('div');
        div.className = 'thumbnail';

        if (aspectRatio === '1:1') {
            div.classList.add('aspect-1-1');
        } else if (aspectRatio === '3:4') {
            div.classList.add('aspect-3-4');
        } else if (aspectRatio === '16:5') {
            div.classList.add('aspect-16-5');
        }

        const img = document.createElement('img');
        img.src = cover.src;
        img.alt = cover.title;

        const label = document.createElement('label');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = cover.id;

        label.appendChild(checkbox);
        label.appendChild(document.createTextNode(` ${cover.title}`));

        div.appendChild(img);
        div.appendChild(label);
        thumbnailsContainer.appendChild(div);

        // Добавляем обработчик клика на div
        div.addEventListener('click', (event) => {
            if (event.target !== checkbox) { // Игнорируем клик непосредственно по чекбоксу
                checkbox.checked = !checkbox.checked;
                cover.isDefective = checkbox.checked;
                div.classList.toggle('selected', checkbox.checked);
            }
        });

        // Обработчик изменения состояния чекбокса
        checkbox.addEventListener('change', () => {
            cover.isDefective = checkbox.checked;
            div.classList.toggle('selected', checkbox.checked);
        });

        console.log(`Миниатюра ${index + 1} добавлена:`, cover);
    });

    console.log('Завершено отображение миниатюр');
    updateBannerCount(covers.length);
  }

});
