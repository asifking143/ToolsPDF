/**
 * Logic for PDF Viewer Tool
 */

document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const uploadArea = document.getElementById('upload-area');
    const loadingOverlay = document.getElementById('loading-overlay');
    const viewerContainer = document.getElementById('pdf-viewer-container');
    const viewerControls = document.getElementById('viewer-controls');
    
    const zoomInBtn = document.getElementById('zoom-in');
    const zoomOutBtn = document.getElementById('zoom-out');
    const closeBtn = document.getElementById('close-viewer');

    let currentScale = 1.2;
    let pdfDocument = null;

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

        uploadArea.style.display = 'none';
        loadingOverlay.classList.add('active');
        
        // Reset viewer container
        viewerContainer.innerHTML = '';
        currentScale = 1.2;

        try {
            const arrayBuffer = await file.arrayBuffer();
            const typedarray = new Uint8Array(arrayBuffer);

            // Load via pdf.js
            pdfDocument = await pdfjsLib.getDocument({ data: typedarray }).promise;
            
            await renderAllPages();

            loadingOverlay.classList.remove('active');
            dropZone.style.padding = '0';
            dropZone.style.border = 'none';
            viewerContainer.style.display = 'flex';
            viewerControls.style.display = 'flex';

        } catch (error) {
            console.error(error);
            loadingOverlay.classList.remove('active');
            alert('Error reading PDF file. It might be encrypted or corrupted.');
            resetUI();
        }
    }

    async function renderAllPages() {
        viewerContainer.innerHTML = ''; // clear

        for (let i = 1; i <= pdfDocument.numPages; i++) {
            const page = await pdfDocument.getPage(i);
            const viewport = page.getViewport({ scale: currentScale });

            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.className = 'pdf-page-container';
            canvas.width = viewport.width;
            canvas.height = viewport.height;

            const renderContext = {
                canvasContext: ctx,
                viewport: viewport
            };

            viewerContainer.appendChild(canvas);
            await page.render(renderContext).promise;
        }
    }

    function resetUI() {
        pdfDocument = null;
        fileInput.value = '';
        viewerContainer.innerHTML = '';
        
        dropZone.style.padding = '60px 40px';
        dropZone.style.border = '1px dashed var(--color-border)';
        
        uploadArea.style.display = 'block';
        viewerContainer.style.display = 'none';
        viewerControls.style.display = 'none';
    }

    closeBtn.addEventListener('click', resetUI);

    zoomInBtn.addEventListener('click', async () => {
        if (!pdfDocument || currentScale > 2.5) return;
        currentScale += 0.3;
        loadingOverlay.classList.add('active');
        loadingOverlay.querySelector('h3').textContent = 'Zooming...';
        await renderAllPages();
        loadingOverlay.classList.remove('active');
    });

    zoomOutBtn.addEventListener('click', async () => {
        if (!pdfDocument || currentScale < 0.6) return;
        currentScale -= 0.3;
        loadingOverlay.classList.add('active');
        loadingOverlay.querySelector('h3').textContent = 'Zooming...';
        await renderAllPages();
        loadingOverlay.classList.remove('active');
    });

});
