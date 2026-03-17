/**
 * Logic for PDF to Images Tool
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
    const progressBar = document.getElementById('progress-bar');
    const conversionProgressText = document.getElementById('conversion-progress');
    
    const formatSelect = document.getElementById('format-select');
    const scaleSelect = document.getElementById('scale-select');

    let currentFile = null;
    let pdfDocument = null;
    let totalPages = 0;
    let processedBlob = null;
    let downloadName = 'pdf_images';

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
        downloadName = file.name.replace('.pdf', '');
        
        uploadArea.style.display = 'none';
        loadingOverlay.classList.add('active');
        conversionProgressText.textContent = "Loading PDF Document...";
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
        progressBar.style.width = '0%';
        
        uploadArea.style.display = 'block';
        toolSettings.style.display = 'none';
        resultActions.style.display = 'none';
    }

    cancelBtn.addEventListener('click', resetUI);
    resetBtn.addEventListener('click', resetUI);

    // Process PDF to Images
    processBtn.addEventListener('click', async () => {
        if (!pdfDocument) return;

        const format = formatSelect.value;
        const scale = parseFloat(scaleSelect.value);
        const ext = format === 'image/jpeg' ? 'jpg' : 'png';

        loadingOverlay.classList.add('active');
        toolSettings.style.display = 'none';
        conversionProgressText.textContent = `Converting page 1 of ${totalPages}...`;
        progressBar.style.width = '0%';

        try {
            const zip = new JSZip();
            const folder = zip.folder(`${downloadName}_images`);

            // Offscreen canvas for rendering
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            for (let i = 1; i <= totalPages; i++) {
                conversionProgressText.textContent = `Converting page ${i} of ${totalPages}...`;
                progressBar.style.width = `${(i / totalPages) * 100}%`;

                const page = await pdfDocument.getPage(i);
                const viewport = page.getViewport({ scale: scale });

                canvas.width = viewport.width;
                canvas.height = viewport.height;

                // Render page
                const renderContext = {
                    canvasContext: ctx,
                    viewport: viewport
                };

                await page.render(renderContext).promise;

                // Get Blob representation
                const blob = await new Promise(resolve => {
                    canvas.toBlob(resolve, format, 0.95);
                });

                // Add to zip
                const fileName = `page_${i.toString().padStart(3, '0')}.${ext}`;
                folder.file(fileName, blob);
            }

            conversionProgressText.textContent = "Compressing to ZIP file...";
            
            const zipContent = await zip.generateAsync({ type: 'blob' });
            processedBlob = zipContent;
            downloadName = `${downloadName}_images.zip`;

            loadingOverlay.classList.remove('active');
            resultActions.style.display = 'block';

        } catch (error) {
            console.error(error);
            loadingOverlay.classList.remove('active');
            alert('An error occurred during conversion.');
            toolSettings.style.display = 'block';
        }
    });

    downloadBtn.addEventListener('click', () => {
        if (processedBlob) {
            downloadFile(processedBlob, downloadName);
        }
    });
});
