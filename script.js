document.addEventListener('DOMContentLoaded', () => {
  const thumbnailsContainer = document.getElementById('thumbnails-container');
  const feedPicker = document.getElementById('feed-picker');
  const folderPicker = document.getElementById('folder-picker');
  const dataSourceRadios = document.querySelectorAll('input[name="data-source"]');
  const feedFormatRadios = document.querySelectorAll('input[name="feed-format"]');
  const idTagInput = document.getElementById('id-tag');
  const imageTagInput = document.getElementById('image-tag');

  let covers = [];

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

    const feedFormat = document.querySelector('input[name="feed-format"]:checked').value;
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

  feedPicker.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const feedFormat = document.querySelector('input[name="feed-format"]:checked').value;
    if (feedFormat === 'xml') {
      const reader = new FileReader();
      reader.onload = (e) => {
        const xmlString = e.target.result;
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlString, "text/xml"); // Изменено с "application/xml"
        const idTag = idTagInput.value;
        const imageTag = imageTagInput.value;
        covers = parseXMLFeed(xmlDoc, idTag, imageTag);
        displayThumbnails(covers);
      };
      reader.readAsText(file);
    } else if (feedFormat === 'csv') {
      // ... (код для CSV остается без изменений)
    }
  });

  document.getElementById('get-defective').addEventListener('click', () => {
      const defectiveIds = covers.filter(cover => cover.isDefective).map(cover => cover.id);
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

  function parseXMLFeed(xmlDoc, idTag, imageTag) {
    const covers = [];
    const offers = xmlDoc.getElementsByTagName('offer');
    console.log(`Найдено предложений: ${offers.length}`);
    for (let offer of offers) {
        const id = offer.getAttribute('id');
        const title = offer.getElementsByTagName('name')[0]?.textContent || '';
        const src = offer.getElementsByTagName(imageTag)[0]?.textContent || '';
        if (id && src) {
            covers.push({ id, title, src, isDefective: false });
            console.log(`Добавлено предложение: ID=${id}, Title=${title}, Src=${src}`);
        } else {
            console.warn(`Пропущено предложение: ID=${id}, Title=${title}, Src=${src}`);
        }
    }
    console.log(`Всего обработано предложений: ${covers.length}`);
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

  function displayThumbnails(covers) {
    console.log('Начало отображения миниатюр');
    thumbnailsContainer.innerHTML = '';
    covers.forEach((cover, index) => {
      const div = createThumbnail(cover);
      thumbnailsContainer.appendChild(div);
      console.log(`Миниатюра ${index + 1} добавлена:`, cover);
    });
    console.log('Завершено отображение миниатюр');
  }

  function createThumbnail(cover) {
    const div = document.createElement('div');
    div.className = 'thumbnail';
    
    const img = document.createElement('img');
    img.alt = cover.title;
    
    // Добавляем обработку ошибок загрузки изображения
    img.onerror = function() {
        console.error(`Ошибка загрузки изображения: ${cover.src}`);
        // Заменяем битое изображение на плейсхолдер
        img.src = 'path/to/placeholder-image.jpg';
        div.classList.add('image-load-error');
    };
    
    img.onload = function() {
        console.log(`Изображение успешно загружено: ${cover.src}`);
    };
    
    // Устанавливаем src после назначения обработчиков событий
    img.src = cover.src;
    
    const label = document.createElement('label');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = cover.id;

    label.appendChild(checkbox);
    label.appendChild(document.createTextNode(` ${cover.title}`));

    div.appendChild(img);
    div.appendChild(label);

    div.addEventListener('click', (event) => {
        if (event.target !== checkbox) {
            checkbox.checked = !checkbox.checked;
        }
        cover.isDefective = checkbox.checked;
        div.classList.toggle('selected');
    });

    checkbox.addEventListener('click', (event) => {
        event.stopPropagation();
    });

    return div;
  }
});
