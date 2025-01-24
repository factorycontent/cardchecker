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
  const yamlFields = document.getElementById('yaml-fields');

  formatButtons.forEach(button => {
      button.addEventListener('click', () => {
          const format = button.getAttribute('data-format');
          
          formatButtons.forEach(btn => btn.classList.remove('active'));
          button.classList.add('active');
          
          xmlFields.style.display = format === 'xml' || format === 'yml' ? 'block' : 'none';
          csvFields.style.display = format === 'csv' ? 'block' : 'none';
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
  
      if (feedFormat === 'xml' || feedFormat === 'yml') {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(content, "text/xml");
        
        // Check if it's a YML feed by looking for yml_catalog tag
        const isYML = xmlDoc.querySelector('yml_catalog') !== null;
        
        covers = isYML ? 
            parseYMLFeed(xmlDoc, xmlIdTag.value, xmlImageTag.value) :
            parseXMLFeed(xmlDoc, xmlIdTag.value, xmlImageTag.value);
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
    const formatMap = {
        '1:1': ['_0.', '.png', '/11.', '/169.'], // Добавлены паттерны для 1:1
        '3:4': ['_34.', '/34.'],
        '16:5': ['_165.', '/165.']
    };

    // Фильтруем изображения по домену
    const validNodes = Array.from(pictureNodes).filter(node => {
        const src = node.textContent.toLowerCase();
        return src.includes('fabrikont.ru'); // Проверка домена
    });

    // Если формат 1:1 и нет специфичных паттернов - выбираем первое изображение
    if (format === '1:1' && validNodes.length > 0) {
        const defaultImage = validNodes.find(node => 
            !node.textContent.match(/_\d+\./) && 
            !node.textContent.match(/\/\d+\./)
        );
        if (defaultImage) return defaultImage.textContent;
    }

    // Ищем изображение, соответствующее формату
    for (let node of validNodes) {
        const src = node.textContent;
        const patterns = formatMap[format] || [];
        
        if (patterns.some(pattern => src.includes(pattern))) {
            return src;
        }
    }

    return validNodes[0]?.textContent || ''; // Возвращаем первое изображение с доменом
  }

  function extractTimestamp(url) {
    let timestamp = null;
    
    // Проверяем формат с timestamp в параметре URL
    const timestampParam = url.match(/timestamp=(\d+)/);
    if (timestampParam) {
        timestamp = parseInt(timestampParam[1]);
    } else {
        // Проверяем формат с timestamp в пути
        const timestampInPath = url.match(/\/(\d{13})\//);
        if (timestampInPath) {
            timestamp = parseInt(timestampInPath[1]);
        }
    }
    return timestamp;
  }

  function formatDate(timestamp) {
    if (!timestamp) return 'Дата не указана';
    
    const date = new Date(timestamp);
    const now = new Date();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
    
    // Форматируем дату
    const dateStr = date.toLocaleDateString('ru-RU');
    
    // Добавляем относительное время
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

  function parseXMLFeed(xmlDoc, idTag, imageTag) {
    const covers = [];
    const offers = xmlDoc.getElementsByTagName('offer');
  
    for (let offer of offers) {
      const id = offer.getAttribute('id');
  
      // Сначала пробуем получить элементы по пользовательскому тегу:
      let pictureNodes = offer.getElementsByTagName(imageTag);
      
      // Если пусто — переходим к poster:
      if (!pictureNodes.length) {
        pictureNodes = offer.getElementsByTagName('poster');
      }
      // Если всё ещё пусто — к picture:
      if (!pictureNodes.length) {
        pictureNodes = offer.getElementsByTagName('picture');
      }
  
      const src = getImageLink(pictureNodes, aspectRatio);
  
      if (id && src) {
        const timestamp = extractTimestamp(src);
        covers.push({ 
          id, 
          title: id, 
          src, 
          pictureNodes, 
          isDefective: false,
          timestamp: timestamp
        });
      }
    }
  
    return sortCovers(covers);
  }  

  function sortCovers(covers) {
    const sortDirection = document.getElementById('sort-direction').value;
    
    return covers.sort((a, b) => {
        if (!a.timestamp && !b.timestamp) return 0;
        if (!a.timestamp) return 1;
        if (!b.timestamp) return -1;
        
        return sortDirection === 'desc' 
            ? b.timestamp - a.timestamp 
            : a.timestamp - b.timestamp;
    });
  }

  function parseCSVFeed(csvString, idColumn, imageColumn) {
    const covers = [];
    const lines = csvString.split('\n');
    
    // Берём первую строку как «шапку» CSV и сразу разбиваем по запятым
    const headers = lines[0].split(',');
  
    // Пользователь обязан указать теги (имена колонок) ровно так, как в CSV
    const idIndex = headers.indexOf(idColumn);
    const srcIndex = headers.indexOf(imageColumn);
  
    // Если хотите анализировать какие-то другие колонки (например, "ID Cruise"),
    // то тоже ищите их по точному совпадению без toLowerCase():
    const titleIndex = headers.indexOf('ID Cruise');
  
    // Если индексы не найдены - выводим ошибку и завершаем
    if (idIndex === -1 || srcIndex === -1) {
      console.error(`Не удалось найти указанные столбцы: "${idColumn}" или "${imageColumn}"`);
      return covers;
    }
  
    // Идём по строкам со 2-й (i=1) до конца
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
  
      // Разбиваем строку по запятым
      const cells = line.split(',');
  
      const id    = cells[idIndex];
      const src   = cells[srcIndex];
  
      // Если столбец 'ID Cruise' в шапке есть, то берём его как title,
      // иначе пусть title = id (заглушка).
      let title = id;
      if (titleIndex !== -1) {
        title = cells[titleIndex] || id;
      }
  
      if (id && src) {
        covers.push({
          id,
          title,
          src,
          isDefective: false
        });
      }
    }
  
    console.log(`Обработано ${covers.length} записей из CSV`);
    return covers;
  }  

  function parseYMLFeed(xmlDoc, idTag, imageTag) {
    const covers = [];
    const offers = xmlDoc.querySelector('shop offers')?.getElementsByTagName('offer') || [];
  
    for (let offer of offers) {
      const id = offer.getAttribute('id');
  
      let pictureNodes = offer.getElementsByTagName(imageTag);
      if (!pictureNodes.length) {
        pictureNodes = offer.getElementsByTagName('poster');
      }
      if (!pictureNodes.length) {
        pictureNodes = offer.getElementsByTagName('picture');
      }
  
      const src = getImageLink(Array.from(pictureNodes), aspectRatio);
  
      if (id && src) {
        const timestamp = extractTimestamp(src);
        covers.push({ 
          id, 
          title: id, 
          src, 
          pictureNodes: Array.from(pictureNodes), 
          isDefective: false,
          timestamp: timestamp
        });
      }
    }
  
    return sortCovers(covers);
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

        const dateInfo = document.createElement('div');
        dateInfo.className = 'update-date';
        dateInfo.textContent = formatDate(cover.timestamp);

        label.appendChild(checkbox);
        label.appendChild(document.createTextNode(` ${cover.title}`));

        div.appendChild(img);
        div.appendChild(label);
        div.appendChild(dateInfo);
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

  document.getElementById('sort-direction').addEventListener('change', () => {
    covers = sortCovers(covers);
    displayThumbnails(covers);
  });

  function handleFeedUpload(event) {
    const file = event.target.files[0];
    const reader = new FileReader();
    
    reader.onload = function(e) {
        const xmlString = e.target.result;
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlString, "text/xml");
        
        // Get the tag names from input fields
        const idTag = document.getElementById('xml-id-tag').value || 'id';
        const imageTag = document.getElementById('xml-image-tag').value || 'picture';
        
        const offers = xmlDoc.querySelectorAll('offer');
        offers.forEach(offer => {
            const id = offer.getAttribute('id') || offer.querySelector(idTag)?.textContent;
            const imageUrl = offer.querySelector(imageTag)?.textContent;
            
            if (id && imageUrl) {
                createThumbnail(id, imageUrl);
            }
        });
        
        updateBannerCount();
    };
    
    reader.readAsText(file);
  }

});

