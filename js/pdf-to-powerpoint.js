/**
 * Logic for PDF to PowerPoint Tool
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
    const progressBar = document.getElementById('progress-bar');
    const extractMethod = document.getElementById('extract-method');
    
    let currentFile = null;
    let pdfDocument = null;
    let totalPages = 0;
    let processedBlob = null;
    let downloadName = 'presentation.pptx';

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
        downloadName = file.name.replace('.pdf', '.pptx');
        
        uploadArea.style.display = 'none';
        loadingOverlay.classList.add('active');
        progressText.textContent = 'Loading PDF...';
        progressBar.style.width = '0%';

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

        loadingOverlay.classList.add('active');
        const method = extractMethod.value;

        try {
            // Using PptxGenJS
            let pptx = new PptxGenJS();
            // Try to match standard slide size, let's use default 16:9 for now

            for (let i = 1; i <= totalPages; i++) {
                // Update Progress
                const percent = Math.round(((i - 1) / totalPages) * 100);
                progressText.textContent = `Processing page ${i} of ${totalPages} (${percent}%)`;
                progressBar.style.width = `${percent}%`;

                const page = await pdfDocument.getPage(i);
                
                let slide = pptx.addSlide();

                if (method === 'images') {
                    // Render page to canvas and add as image
                    const scale = 2.0; // high res
                    const viewport = page.getViewport({ scale: scale });

                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    canvas.width = viewport.width;
                    canvas.height = viewport.height;
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);

                    await page.render({ canvasContext: ctx, viewport: viewport }).promise;

                    const dataUrl = canvas.toDataURL('image/png');
                    
                    slide.addImage({ data: dataUrl, x: 0, y: 0, w: '100%', h: '100%' });
                } else {
                    // Experimental text extraction
                    const textContent = await page.getTextContent();
                    
                    // Add page header as a title just in case
                    slide.addText(`Page ${i}`, { x: 0.5, y: 0.5, fontSize: 14, color: '888888' });
                    
                    let lastY = -1;
                    let lineBuffer = '';
                    let yPos = 1.0;
                    
                    textContent.items.forEach(item => {
                        if (lastY !== -1 && Math.abs(item.transform[5] - lastY) > 5) {
                            if (lineBuffer.trim()) {
                                slide.addText(lineBuffer.trim(), { x: 0.5, y: yPos, fontSize: 12, w: '90%' });
                                yPos += 0.4;
                            }
                            lineBuffer = '';
                        }
                        lineBuffer += item.str + ' ';
                        lastY = item.transform[5];
                    });
                    
                    if (lineBuffer.trim()) {
                        slide.addText(lineBuffer.trim(), { x: 0.5, y: yPos, fontSize: 12, w: '90%' });
                    }
                }
            }

            progressText.textContent = 'Writing PPTX File...';
            progressBar.style.width = '100%';

            // Generate Blob via write API
            const outputType = 'blob'; 
            processedBlob = await pptx.write(outputType);

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
});
