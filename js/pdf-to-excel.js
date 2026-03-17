/**
 * Logic for PDF to Excel Tool
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
    
    let currentFile = null;
    let pdfDocument = null;
    let totalPages = 0;
    let processedBlob = null;
    let downloadName = 'extracted_data.xlsx';

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
        downloadName = file.name.replace('.pdf', '.xlsx');
        
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
            const wb = XLSX.utils.book_new();

            // We will create one sheet per page or combine them. Let's combine into one big data array for simplicity.
            let globalDataArray = [];

            for (let i = 1; i <= totalPages; i++) {
                progressText.textContent = `Analyzing grid on page ${i} of ${totalPages}...`;
                const page = await pdfDocument.getPage(i);
                const textContent = await page.getTextContent();
                
                // Group items by Y coordinate to form rows
                const rows = {};
                
                textContent.items.forEach(item => {
                    // Round Y to nearest 5 to compensate for slight misalignments
                    const y = Math.round(item.transform[5] / 5) * 5; 
                    if (!rows[y]) rows[y] = [];
                    // Store text and X position
                    rows[y].push({ text: item.str, x: item.transform[4] });
                });

                // Sort rows top to bottom (Y descending in PDF coordinate space)
                const sortedY = Object.keys(rows).map(Number).sort((a, b) => b - a);

                globalDataArray.push([`--- Page ${i} ---`]); // Page separator in Excel

                sortedY.forEach(y => {
                    // Sort items in row left to right
                    const rowItems = rows[y].sort((a, b) => a.x - b.x);
                    
                    const rowArray = rowItems.map(item => item.text.trim());
                    
                    // Only add if there is actual content
                    if (rowArray.join('').trim() !== '') {
                        globalDataArray.push(rowArray);
                    }
                });
                globalDataArray.push([]); // blank line between pages
            }

            progressText.textContent = 'Generating Excel Workbook...';
            const ws = XLSX.utils.aoa_to_sheet(globalDataArray);
            XLSX.utils.book_append_sheet(wb, ws, "Extracted Data");

            // Generate Blob
            const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
            processedBlob = new Blob([wbout], { type: 'application/octet-stream' });

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
