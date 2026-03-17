/**
 * Logic for Specific PDF to JPG Tool
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
    
    const qualitySelect = document.getElementById('image-quality');

    let currentFile = null;
    let pdfDocument = null;
    let totalPages = 0;
    let processedBlob = null;
    let downloadName = 'converted_jpgs.zip';

    // Handle Drag & Drop Events
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

    // Handle Click Upload
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
        downloadName = file.name.replace('.pdf', '_JPGs.zip');
        
        // Show loading while parsing PDF
        uploadArea.style.display = 'none';
        loadingOverlay.classList.add('active');
        progressText.textContent = 'Loading PDF...';
        progressBar.style.width = '0%';

        try {
            const arrayBuffer = await file.arrayBuffer();
            const typedarray = new Uint8Array(arrayBuffer);

            // Load via pdf.js
            pdfDocument = await pdfjsLib.getDocument({ data: typedarray }).promise;
            totalPages = pdfDocument.numPages;
            
            fileInfoDisplay.textContent = `${totalPages} pages • ${formatFileSize(file.size)}`;
            
            loadingOverlay.classList.remove('active');
            toolSettings.style.display = 'block';
        } catch (error) {
            console.error(error);
            loadingOverlay.classList.remove('active');
            alert('Error reading PDF file. It might be encrypted or corrupted.');
            resetUI();
        }
    }

    function resetUI() {
        currentFile = null;
        pdfDocument = null;
        totalPages = 0;
        processedBlob = null;
        fileInput.value = '';
        qualitySelect.value = '2';
        
        uploadArea.style.display = 'block';
        toolSettings.style.display = 'none';
        resultActions.style.display = 'none';
    }

    cancelBtn.addEventListener('click', resetUI);
    resetBtn.addEventListener('click', resetUI);

    // Process PDF to JPGs
    processBtn.addEventListener('click', async () => {
        if (!pdfDocument) return;

        const scale = parseFloat(qualitySelect.value);
        const format = 'image/jpeg';
        const extension = 'jpg';

        loadingOverlay.classList.add('active');
        progressText.textContent = 'Preparing...';
        progressBar.style.width = '0%';

        try {
            const zip = new JSZip();

            for (let i = 1; i <= totalPages; i++) {
                // Update Progress
                const percent = Math.round(((i - 1) / totalPages) * 100);
                progressText.textContent = `Converting page ${i} of ${totalPages} (${percent}%)`;
                progressBar.style.width = `${percent}%`;

                const page = await pdfDocument.getPage(i);
                const viewport = page.getViewport({ scale: scale });

                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = viewport.width;
                canvas.height = viewport.height;

                // For JPEG, we need white background
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);

                const renderContext = {
                    canvasContext: ctx,
                    viewport: viewport
                };

                await page.render(renderContext).promise;

                // Get image data
                const dataUrl = canvas.toDataURL(format, 0.9); // 0.9 quality for JPG
                const base64Data = dataUrl.split(',')[1];
                
                // Add to ZIP
                zip.file(`page_${i}.${extension}`, base64Data, {base64: true});
            }

            progressText.textContent = 'Zipping files...';
            progressBar.style.width = '100%';

            // Generate ZIP
            processedBlob = await zip.generateAsync({type: 'blob'});

            loadingOverlay.classList.remove('active');
            toolSettings.style.display = 'none';
            resultActions.style.display = 'block';

        } catch (error) {
            console.error(error);
            loadingOverlay.classList.remove('active');
            alert('An error occurred during conversion.');
        }
    });

    downloadBtn.addEventListener('click', () => {
        if (processedBlob) {
            downloadFile(processedBlob, downloadName);
        }
    });
});
