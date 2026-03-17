/**
 * Logic for PDF to EPUB Tool
 */

document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const uploadArea = document.getElementById('upload-area');
    const toolSettings = document.getElementById('tool-settings');
    const fileNameDisplay = document.getElementById('file-name-display');
    const fileInfoDisplay = document.getElementById('file-info-display');
    const cancelBtn = document.getElementById('cancel-btn');
    const processBtn = document.getElementById('process-btn');
    const downloadBtn = document.getElementById('download-btn');
    const resetBtn = document.getElementById('reset-btn');
    const resultActions = document.getElementById('result-actions');
    const loadingOverlay = document.getElementById('loading-overlay');
    const progressText = document.getElementById('progress-text');
    
    const epubTitleInput = document.getElementById('epub-title');
    const epubAuthorInput = document.getElementById('epub-author');

    let currentFile = null;
    let pdfDocument = null;
    let totalPages = 0;
    let processedBlob = null;
    let downloadName = 'ebook.epub';

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => dropZone.classList.add('drag-over'), false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => dropZone.classList.remove('drag-over'), false);
    });

    dropZone.addEventListener('drop', handleDrop, false);

    function handleDrop(e) {
        const dt = e.dataTransfer;
        const file = dt.files[0];
        handleFile(file);
    }

    fileInput.addEventListener('change', function() {
        if (this.files.length > 0) {
            handleFile(this.files[0]);
        }
    });

    async function handleFile(file) {
        if (!file || file.type !== 'application/pdf') {
            alert('Please select a valid PDF file.');
            return;
        }

        currentFile = file;
        fileNameDisplay.textContent = file.name;
        
        let baseName = file.name.replace('.pdf', '');
        epubTitleInput.value = baseName;
        downloadName = baseName + '.epub';
        
        uploadArea.style.display = 'none';
        loadingOverlay.classList.add('active');
        progressText.textContent = 'Loading PDF...';

        try {
            const arrayBuffer = await file.arrayBuffer();
            const typedarray = new Uint8Array(arrayBuffer);

            pdfDocument = await pdfjsLib.getDocument({ data: typedarray }).promise;
            totalPages = pdfDocument.numPages;
            
            fileInfoDisplay.textContent = `${totalPages} pages • ${formatFileSize(file.size)}`;
            
            loadingOverlay.classList.remove('active');
            toolSettings.style.display = 'block';
        } catch (error) {
            console.error(error);
            loadingOverlay.classList.remove('active');
            alert('Error reading PDF file.');
            resetUI();
        }
    }

    function resetUI() {
        currentFile = null;
        pdfDocument = null;
        totalPages = 0;
        processedBlob = null;
        fileInput.value = '';
        
        uploadArea.style.display = 'block';
        toolSettings.style.display = 'none';
        resultActions.style.display = 'none';
    }

    cancelBtn.addEventListener('click', resetUI);
    resetBtn.addEventListener('click', resetUI);

    processBtn.addEventListener('click', async () => {
        if (!pdfDocument) return;

        let title = epubTitleInput.value || 'Unknown Title';
        let author = epubAuthorInput.value || 'Unknown Author';

        loadingOverlay.classList.add('active');

        try {
            // EPUB Generation using JSZip
            // EPUB 3 minimal structure
            const zip = new JSZip();
            
            // 1. mimetype (MUST be uncompressed, first file)
            zip.file("mimetype", "application/epub+zip", {compression: "STORE"});

            // 2. META-INF/container.xml
            const containerXml = `<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
    <rootfiles>
        <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
    </rootfiles>
</container>`;
            zip.file("META-INF/container.xml", containerXml);

            // Create OEBPS folder
            const oebps = zip.folder("OEBPS");

            // Extract text into HTML chapters
            let spineItems = [];
            let manifestItems = [];
            let navPoints = [];

            for (let i = 1; i <= totalPages; i++) {
                progressText.textContent = `Extracting page ${i} of ${totalPages}...`;
                const page = await pdfDocument.getPage(i);
                const textContent = await page.getTextContent();
                
                let lastY = -1;
                let lineBuffer = '';
                
                let chapterHtml = `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
    <title>Page ${i}</title>
</head>
<body>
    <div class="page-content">
`;
                
                textContent.items.forEach(item => {
                    if (lastY !== -1 && Math.abs(item.transform[5] - lastY) > 5) {
                        if (lineBuffer.trim()) {
                            chapterHtml += `        <p>${escapeXml(lineBuffer.trim())}</p>\n`;
                        }
                        lineBuffer = '';
                    }
                    lineBuffer += item.str + ' ';
                    lastY = item.transform[5];
                });
                
                if (lineBuffer.trim()) {
                    chapterHtml += `        <p>${escapeXml(lineBuffer.trim())}</p>\n`;
                }

                chapterHtml += `    </div>\n</body>\n</html>`;

                const filename = `page_${i}.xhtml`;
                oebps.file(filename, chapterHtml);

                manifestItems.push(`<item id="page_${i}" href="${filename}" media-type="application/xhtml+xml"/>`);
                spineItems.push(`<itemref idref="page_${i}"/>`);
                navPoints.push(`
        <navPoint id="navPoint-${i}" playOrder="${i}">
            <navLabel><text>Page ${i}</text></navLabel>
            <content src="${filename}"/>
        </navPoint>`);
            }

            // 3. OEBPS/content.opf
            const contentOpf = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="BookId">
    <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
        <dc:title>${escapeXml(title)}</dc:title>
        <dc:creator>${escapeXml(author)}</dc:creator>
        <dc:language>en</dc:language>
        <dc:identifier id="BookId">urn:uuid:${generateUUID()}</dc:identifier>
    </metadata>
    <manifest>
        <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
        ${manifestItems.join('\n        ')}
    </manifest>
    <spine toc="ncx">
        ${spineItems.join('\n        ')}
    </spine>
</package>`;
            oebps.file("content.opf", contentOpf);

            // 4. OEBPS/toc.ncx
            const tocNcx = `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
    <head>
        <meta name="dtb:uid" content="urn:uuid:${generateUUID()}"/>
        <meta name="dtb:depth" content="1"/>
        <meta name="dtb:totalPageCount" content="${totalPages}"/>
        <meta name="dtb:maxPageNumber" content="${totalPages}"/>
    </head>
    <docTitle><text>${escapeXml(title)}</text></docTitle>
    <navMap>
        ${navPoints.join('')}
    </navMap>
</ncx>`;
            oebps.file("toc.ncx", tocNcx);

            progressText.textContent = 'Zipping EPUB...';

            processedBlob = await zip.generateAsync({type: 'blob', mimeType: 'application/epub+zip'});

            loadingOverlay.classList.remove('active');
            toolSettings.style.display = 'none';
            resultActions.style.display = 'block';

        } catch (error) {
            console.error(error);
            loadingOverlay.classList.remove('active');
            alert('An error occurred during EPUB generation.');
        }
    });

    downloadBtn.addEventListener('click', () => {
        if (processedBlob) {
            downloadFile(processedBlob, downloadName);
        }
    });

    function escapeXml(unsafe) {
        return unsafe.replace(/[<>&'"]/g, function (c) {
            switch (c) {
                case '<': return '&lt;';
                case '>': return '&gt;';
                case '&': return '&amp;';
                case '\'': return '&apos;';
                case '"': return '&quot;';
            }
        });
    }

    function generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }
});
