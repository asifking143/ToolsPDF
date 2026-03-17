/**
 * Logic for PDF to XML Tool
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
    const xmlPreview = document.getElementById('xml-preview');
    
    let currentFile = null;
    let pdfDocument = null;
    let totalPages = 0;
    let processedBlob = null;
    let downloadName = 'extracted_data.xml';

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
        downloadName = file.name.replace('.pdf', '.xml');
        
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
        xmlPreview.textContent = '';
        
        uploadArea.style.display = 'block';
        toolSettings.style.display = 'none';
        resultActions.style.display = 'none';
    }

    cancelBtn.addEventListener('click', resetUI);
    resetBtn.addEventListener('click', resetUI);

    processBtn.addEventListener('click', async () => {
        if (!pdfDocument) return;

        loadingOverlay.classList.add('active');

        try {
            let xmlContent = `<?xml version="1.0" encoding="UTF-8"?>\n<Document name="${escapeXml(currentFile.name)}">\n`;

            for (let i = 1; i <= totalPages; i++) {
                progressText.textContent = `Processing page ${i} of ${totalPages}...`;
                const page = await pdfDocument.getPage(i);
                const textContent = await page.getTextContent();
                
                xmlContent += `  <Page number="${i}">\n`;
                
                let lastY = -1;
                let lineBuffer = '';
                
                textContent.items.forEach(item => {
                    if (lastY !== -1 && Math.abs(item.transform[5] - lastY) > 5) {
                        if (lineBuffer.trim()) {
                            xmlContent += `    <TextLine>${escapeXml(lineBuffer.trim())}</TextLine>\n`;
                        }
                        lineBuffer = '';
                    }
                    lineBuffer += item.str + ' ';
                    lastY = item.transform[5];
                });
                
                if (lineBuffer.trim()) {
                    xmlContent += `    <TextLine>${escapeXml(lineBuffer.trim())}</TextLine>\n`;
                }

                xmlContent += `  </Page>\n`;
            }

            xmlContent += `</Document>`;

            processedBlob = new Blob([xmlContent], { type: 'application/xml;charset=utf-8' });
            
            xmlPreview.textContent = xmlContent.substring(0, 1000) + (xmlContent.length > 1000 ? '\n\n... (preview truncated)' : '');

            loadingOverlay.classList.remove('active');
            toolSettings.style.display = 'none';
            resultActions.style.display = 'block';

        } catch (error) {
            console.error(error);
            loadingOverlay.classList.remove('active');
            alert('An error occurred during extraction.');
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
});
