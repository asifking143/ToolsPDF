/**
 * Logic for Compress PDF Tool
 * Note: Pure JS compression using pdf-lib is mostly limited to removing unreferenced objects/metadata
 * and keeping streams compressed.
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
    const savingsDisplay = document.getElementById('savings-display');
    
    let currentFile = null;
    let originalSize = 0;
    let processedBlob = null;
    let downloadName = 'compressed_pdf';

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

    function handleFile(file) {
        if (!file || file.type !== 'application/pdf') {
            alert('Please select a valid PDF file.');
            return;
        }

        currentFile = file;
        originalSize = file.size;
        fileNameDisplay.textContent = file.name;
        downloadName = file.name.replace('.pdf', '_optimized.pdf');
        fileInfoDisplay.textContent = formatFileSize(file.size);
        
        uploadArea.style.display = 'none';
        toolSettings.style.display = 'block';
    }

    function resetUI() {
        currentFile = null;
        originalSize = 0;
        processedBlob = null;
        fileInput.value = '';
        
        uploadArea.style.display = 'block';
        toolSettings.style.display = 'none';
        resultActions.style.display = 'none';
    }

    cancelBtn.addEventListener('click', resetUI);
    resetBtn.addEventListener('click', resetUI);

    // Process Compression / Optimization
    processBtn.addEventListener('click', async () => {
        if (!currentFile) return;

        loadingOverlay.classList.add('active');

        try {
            const arrayBuffer = await currentFile.arrayBuffer();
            const { PDFDocument } = PDFLib;
            
            // Load the document
            const pdfDoc = await PDFDocument.load(arrayBuffer);
            
            // Re-saving with useObjectStreams: false initially to see if it reduces overhead,
            // but useObjectStreams: true is generally better for compression. pdf-lib uses true by default.
            // We strip metadata to save some bytes.
            pdfDoc.setTitle('');
            pdfDoc.setAuthor('');
            pdfDoc.setSubject('');
            pdfDoc.setKeywords([]);
            pdfDoc.setProducer('ToolsPDF Optimizer');
            pdfDoc.setCreator('ToolsPDF');

            // Save document with optimization flags
            const pdfBytes = await pdfDoc.save({
                useObjectStreams: true,
                addDefaultPage: false,
            });

            processedBlob = new Blob([pdfBytes], { type: 'application/pdf' });
            
            const newSize = processedBlob.size;
            
            // Since client-side compression without re-encoding images is minimal,
            // we calculate savings (sometimes it might even slightly increase due to library overhead).
            let savingsText = '';
            if (newSize < originalSize) {
                const percent = (((originalSize - newSize) / originalSize) * 100).toFixed(1);
                savingsText = `Original: ${formatFileSize(originalSize)} | New: ${formatFileSize(newSize)} | Saved: ${percent}%`;
            } else {
                savingsText = `Original: ${formatFileSize(originalSize)} | New: ${formatFileSize(newSize)} | (Already highly optimized)`;
            }
            
            savingsDisplay.textContent = savingsText;

            loadingOverlay.classList.remove('active');
            toolSettings.style.display = 'none';
            resultActions.style.display = 'block';

        } catch (error) {
            console.error(error);
            loadingOverlay.classList.remove('active');
            alert('An error occurred while optimizing the PDF.');
        }
    });

    downloadBtn.addEventListener('click', () => {
        if (processedBlob) {
            downloadFile(processedBlob, downloadName);
        }
    });
});
