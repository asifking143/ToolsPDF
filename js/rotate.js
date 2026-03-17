/**
 * Logic for Rotate PDF Tool
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
    
    const pagesOption = document.getElementById('pages-option');
    const rangeContainer = document.getElementById('range-input-container');
    const pageRangeInput = document.getElementById('page-range');
    const rotationDegreeSelect = document.getElementById('rotation-degree');

    let currentFile = null;
    let pdfDoc = null;
    let totalPages = 0;
    let processedBlob = null;
    let downloadName = 'rotated_pdf';

    // Toggle Range input based on pages option
    pagesOption.addEventListener('change', (e) => {
        if (e.target.value === 'custom') {
            rangeContainer.style.display = 'block';
        } else {
            rangeContainer.style.display = 'none';
        }
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
        downloadName = file.name.replace('.pdf', '_rotated.pdf');
        
        // Show loading while parsing PDF
        uploadArea.style.display = 'none';
        loadingOverlay.classList.add('active');

        try {
            const arrayBuffer = await file.arrayBuffer();
            const { PDFDocument } = PDFLib;
            pdfDoc = await PDFDocument.load(arrayBuffer);
            totalPages = pdfDoc.getPageCount();
            
            fileInfoDisplay.textContent = `${totalPages} pages • ${formatFileSize(file.size)}`;
            pageRangeInput.placeholder = `1-${Math.min(3, totalPages)}`;
            
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
        pagesOption.value = 'all';
        rangeContainer.style.display = 'none';
        
        uploadArea.style.display = 'block';
        toolSettings.style.display = 'none';
        resultActions.style.display = 'none';
    }

    cancelBtn.addEventListener('click', resetUI);
    resetBtn.addEventListener('click', resetUI);

    // Parse requested page range
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
                
                if (isNaN(start) || isNaN(end) || start < 1 || start > end) return null;
                end = Math.min(end, maxPages);
                
                for (let i = start; i <= end; i++) {
                    pages.add(i - 1); 
                }
            } else {
                const num = parseInt(trimmed);
                if (isNaN(num) || num < 1 || num > maxPages) return null;
                pages.add(num - 1);
            }
        }
        
        return Array.from(pages);
    }

    // Process Rotation
    processBtn.addEventListener('click', async () => {
        if (!pdfDoc) return;

        const option = pagesOption.value;
        const degree = parseInt(rotationDegreeSelect.value);
        loadingOverlay.classList.add('active');

        try {
            const { degrees } = PDFLib;
            let pagesToRotate = [];

            if (option === 'all') {
                for(let i = 0; i < totalPages; i++) pagesToRotate.push(i);
            } else {
                const rangeStr = pageRangeInput.value.trim();
                if (!rangeStr) {
                    alert('Please enter a page range.');
                    loadingOverlay.classList.remove('active');
                    return;
                }

                pagesToRotate = parsePageRange(rangeStr, totalPages);
                if (!pagesToRotate || pagesToRotate.length === 0) {
                    alert('Invalid page range format or numbers out of bounds.');
                    loadingOverlay.classList.remove('active');
                    return;
                }
            }

            const pages = pdfDoc.getPages();
            
            pagesToRotate.forEach(index => {
                if (pages[index]) {
                    // Add rotation to current rotation
                    const currentRotation = pages[index].getRotation().angle;
                    pages[index].setRotation(degrees(currentRotation + degree));
                }
            });

            const pdfBytes = await pdfDoc.save();
            processedBlob = new Blob([pdfBytes], { type: 'application/pdf' });

            loadingOverlay.classList.remove('active');
            toolSettings.style.display = 'none';
            resultActions.style.display = 'block';

        } catch (error) {
            console.error(error);
            loadingOverlay.classList.remove('active');
            alert('An error occurred while rotating the PDF.');
        }
    });

    downloadBtn.addEventListener('click', () => {
        if (processedBlob) {
            downloadFile(processedBlob, downloadName);
        }
    });
});
