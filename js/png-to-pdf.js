/**
 * Logic for PNG to PDF Tool
 */

document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const uploadArea = document.getElementById('upload-area');
    const toolSettings = document.getElementById('tool-settings');
    const fileNameDisplay = document.getElementById('file-name-display');
    const cancelBtn = document.getElementById('cancel-btn');
    const processBtn = document.getElementById('process-btn');
    const downloadBtn = document.getElementById('download-btn');
    const resetBtn = document.getElementById('reset-btn');
    const resultActions = document.getElementById('result-actions');
    const loadingOverlay = document.getElementById('loading-overlay');
    
    const orientationSelect = document.getElementById('orientation');
    const marginSelect = document.getElementById('margin');

    let currentFiles = [];
    let processedBlob = null;
    let downloadName = 'converted_images.pdf';

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
        const files = Array.from(dt.files).filter(f => f.type.includes('png'));
        if(files.length > 0) handleFiles(files);
        else alert('Please upload only PNG files.');
    }

    fileInput.addEventListener('change', function() {
        if (this.files.length > 0) {
            handleFiles(Array.from(this.files));
        }
    });

    function handleFiles(files) {
        currentFiles = files;
        fileNameDisplay.textContent = `${files.length} PNG file(s) selected`;
        uploadArea.style.display = 'none';
        toolSettings.style.display = 'block';
    }

    function resetUI() {
        currentFiles = [];
        processedBlob = null;
        fileInput.value = '';
        
        uploadArea.style.display = 'block';
        toolSettings.style.display = 'none';
        resultActions.style.display = 'none';
    }

    cancelBtn.addEventListener('click', resetUI);
    resetBtn.addEventListener('click', resetUI);

    processBtn.addEventListener('click', async () => {
        if (currentFiles.length === 0) return;

        loadingOverlay.classList.add('active');

        try {
            const pdfDoc = await PDFLib.PDFDocument.create();
            const margin = parseInt(marginSelect.value);
            const orientation = orientationSelect.value;
            
            // Standard A4 dimensions
            const A4_WIDTH = 595.28;
            const A4_HEIGHT = 841.89;

            for (let i = 0; i < currentFiles.length; i++) {
                const file = currentFiles[i];
                const arrayBuffer = await file.arrayBuffer();
                
                let pdfImage;
                try {
                    pdfImage = await pdfDoc.embedPng(arrayBuffer);
                } catch(e) {
                    console.error("Not a PNG", e);
                    continue; 
                }
                
                const imgDims = pdfImage.scale(1);
                
                let pageW = A4_WIDTH;
                let pageH = A4_HEIGHT;

                if (orientation === 'landscape') {
                    pageW = A4_HEIGHT;
                    pageH = A4_WIDTH;
                } else if (orientation === 'auto') {
                    if (imgDims.width > imgDims.height) {
                        pageW = A4_HEIGHT;
                        pageH = A4_WIDTH;
                    }
                }

                const page = pdfDoc.addPage([pageW, pageH]);

                const drawAreaW = pageW - (margin * 2);
                const drawAreaH = pageH - (margin * 2);

                const scaleFactor = Math.min(drawAreaW / imgDims.width, drawAreaH / imgDims.height);
                const scaledW = imgDims.width * scaleFactor;
                const scaledH = imgDims.height * scaleFactor;

                const x = margin + (drawAreaW - scaledW) / 2;
                const y = margin + (drawAreaH - scaledH) / 2;

                page.drawImage(pdfImage, {
                    x: x,
                    y: y,
                    width: scaledW,
                    height: scaledH
                });
            }

            const pdfBytes = await pdfDoc.save();
            processedBlob = new Blob([pdfBytes], { type: 'application/pdf' });

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

    function downloadFile(blob, filename) {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
    }
});
