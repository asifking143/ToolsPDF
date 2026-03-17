/**
 * Logic for Split PDF Tool
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
    
    const radioModes = document.querySelectorAll('input[name="split_mode"]');
    const rangeContainer = document.getElementById('range-input-container');
    const pageRangeInput = document.getElementById('page-range');

    let currentFile = null;
    let pdfDoc = null;
    let totalPages = 0;
    let processedBlob = null;
    let downloadName = 'split_pdf';

    // Toggle Range input based on mode
    radioModes.forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (e.target.value === 'extract') {
                rangeContainer.style.display = 'block';
            } else {
                rangeContainer.style.display = 'none';
            }
        });
    });

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
        
        // Show loading while parsing PDF
        uploadArea.style.display = 'none';
        loadingOverlay.classList.add('active');

        try {
            const arrayBuffer = await file.arrayBuffer();
            const { PDFDocument } = PDFLib;
            pdfDoc = await PDFDocument.load(arrayBuffer);
            totalPages = pdfDoc.getPageCount();
            
            fileInfoDisplay.textContent = `${totalPages} pages • ${formatFileSize(file.size)}`;
            pageRangeInput.placeholder = `1-${Math.min(5, totalPages)}, ${totalPages}`;
            
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
        pdfDoc = null;
        totalPages = 0;
        processedBlob = null;
        fileInput.value = '';
        pageRangeInput.value = '';
        
        uploadArea.style.display = 'block';
        toolSettings.style.display = 'none';
        resultActions.style.display = 'none';
    }

    cancelBtn.addEventListener('click', resetUI);
    resetBtn.addEventListener('click', resetUI);

    // Parse requested page range (e.g. "1-3, 5, 7-9")
    function parsePageRange(rangeStr, maxPages) {
        const pages = new Set();
        const parts = rangeStr.split(',');
        
        for (const part of parts) {
            const trimmed = part.trim();
            if (!trimmed) continue;
            
            if (trimmed.includes('-')) {
                let [start, end] = trimmed.split('-');
                start = parseInt(start);
                end = parseInt(end);
                
                if (isNaN(start) || isNaN(end) || start < 1 || start > end) return null; // Invalid range
                end = Math.min(end, maxPages);
                
                for (let i = start; i <= end; i++) {
                    pages.add(i - 1); // PDFLib is 0-indexed
                }
            } else {
                const num = parseInt(trimmed);
                if (isNaN(num) || num < 1 || num > maxPages) return null; // Invalid number
                pages.add(num - 1);
            }
        }
        
        return Array.from(pages).sort((a, b) => a - b);
    }

    // Process Split
    processBtn.addEventListener('click', async () => {
        if (!pdfDoc) return;

        const mode = document.querySelector('input[name="split_mode"]:checked').value;
        loadingOverlay.classList.add('active');

        try {
            const { PDFDocument } = PDFLib;

            if (mode === 'extract') {
                const rangeStr = pageRangeInput.value.trim();
                let pagesToExtract = [];

                if (!rangeStr) {
                    alert('Please enter a page range.');
                    loadingOverlay.classList.remove('active');
                    return;
                }

                pagesToExtract = parsePageRange(rangeStr, totalPages);
                if (!pagesToExtract || pagesToExtract.length === 0) {
                    alert('Invalid page range format or numbers out of bounds.');
                    loadingOverlay.classList.remove('active');
                    return;
                }

                // Create a new document with extracted pages
                const newPdf = await PDFDocument.create();
                const copiedPages = await newPdf.copyPages(pdfDoc, pagesToExtract);
                copiedPages.forEach((page) => newPdf.addPage(page));
                
                const pdfBytes = await newPdf.save();
                processedBlob = new Blob([pdfBytes], { type: 'application/pdf' });
                downloadName = `${downloadName}_extracted.pdf`;

            } else if (mode === 'all') {
                // Return ZIP of all split pages
                const zip = new JSZip();
                
                for (let i = 0; i < totalPages; i++) {
                    const newPdf = await PDFDocument.create();
                    const [copiedPage] = await newPdf.copyPages(pdfDoc, [i]);
                    newPdf.addPage(copiedPage);
                    const pdfBytes = await newPdf.save();
                    zip.file(`${downloadName}_page_${i + 1}.pdf`, pdfBytes);
                }
                
                const zipContent = await zip.generateAsync({ type: 'blob' });
                processedBlob = zipContent;
                downloadName = `${downloadName}_split.zip`;
            }

            loadingOverlay.classList.remove('active');
            toolSettings.style.display = 'none';
            resultActions.style.display = 'block';

        } catch (error) {
            console.error(error);
            loadingOverlay.classList.remove('active');
            alert('An error occurred while splitting the PDF.');
        }
    });

    downloadBtn.addEventListener('click', () => {
        if (processedBlob) {
            downloadFile(processedBlob, downloadName);
        }
    });
});
