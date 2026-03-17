/**
 * Logic for Add Page Numbers Tool
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
    
    const positionSelect = document.getElementById('number-position');
    const formatSelect = document.getElementById('number-format');
    const startNumberInput = document.getElementById('start-number');
    const startPageInput = document.getElementById('start-page');

    let currentFile = null;
    let pdfDoc = null;
    let totalPages = 0;
    let processedBlob = null;
    let downloadName = 'numbered_pdf';

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
        downloadName = file.name.replace('.pdf', '_numbered.pdf');
        
        uploadArea.style.display = 'none';
        loadingOverlay.classList.add('active');

        try {
            const arrayBuffer = await file.arrayBuffer();
            const { PDFDocument } = PDFLib;
            pdfDoc = await PDFDocument.load(arrayBuffer);
            totalPages = pdfDoc.getPageCount();
            
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
        pdfDoc = null;
        totalPages = 0;
        processedBlob = null;
        fileInput.value = '';
        
        uploadArea.style.display = 'block';
        toolSettings.style.display = 'none';
        resultActions.style.display = 'none';
    }

    cancelBtn.addEventListener('click', resetUI);
    resetBtn.addEventListener('click', resetUI);

    // Process Page Numbers
    processBtn.addEventListener('click', async () => {
        if (!pdfDoc) return;

        const pos = positionSelect.value;
        const formatStr = formatSelect.value;
        const startNumber = parseInt(startNumberInput.value) || 1;
        const startPageIdx = (parseInt(startPageInput.value) || 1) - 1;

        loadingOverlay.classList.add('active');

        try {
            const { rgb } = PDFLib;
            // PDFLib comes with 14 Standard Fonts
            const font = await pdfDoc.embedStandardFont(PDFLib.StandardFonts.Helvetica);
            const fontSize = 12;
            const margin = 30;

            const pages = pdfDoc.getPages();

            let currentNumber = startNumber;

            for (let i = startPageIdx; i < totalPages; i++) {
                const page = pages[i];
                const { width, height } = page.getSize();
                
                // Format text e.g. "{n} of {t}" -> "1 of 5"
                const text = formatStr
                    .replace('{n}', currentNumber.toString())
                    .replace('{t}', totalPages.toString());

                const textWidth = font.widthOfTextAtSize(text, fontSize);
                const textHeight = font.heightAtSize(fontSize);

                let x = margin;
                let y = margin;

                // Calculate x position
                if (pos.includes('center')) {
                    x = (width - textWidth) / 2;
                } else if (pos.includes('right')) {
                    x = width - margin - textWidth;
                } else if (pos.includes('left')) {
                    x = margin;
                }

                // Calculate y position
                if (pos.includes('top')) {
                    y = height - margin - textHeight;
                } else {
                    y = margin;
                }

                // Draw text
                page.drawText(text, {
                    x,
                    y,
                    size: fontSize,
                    font: font,
                    color: rgb(0, 0, 0)
                });

                currentNumber++;
            }

            const pdfBytes = await pdfDoc.save();
            processedBlob = new Blob([pdfBytes], { type: 'application/pdf' });

            loadingOverlay.classList.remove('active');
            toolSettings.style.display = 'none';
            resultActions.style.display = 'block';

        } catch (error) {
            console.error(error);
            loadingOverlay.classList.remove('active');
            alert('An error occurred while adding page numbers.');
        }
    });

    downloadBtn.addEventListener('click', () => {
        if (processedBlob) {
            downloadFile(processedBlob, downloadName);
        }
    });
});
