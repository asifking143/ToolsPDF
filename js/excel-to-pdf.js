/**
 * Logic for Excel to PDF Tool
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
    const renderContainer = document.getElementById('render-container');
    const orientationSelect = document.getElementById('orientation');
    
    let currentFile = null;
    let processedBlob = null;
    let downloadName = 'converted_spreadsheet.pdf';

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

    function handleFile(file) {
        if (!file || (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls') && !file.name.endsWith('.csv'))) {
            alert('Please select a valid Excel or CSV file.');
            return;
        }

        currentFile = file;
        fileNameDisplay.textContent = file.name;
        fileInfoDisplay.textContent = formatFileSize(file.size);
        
        // Strip extension
        const baseName = file.name.substring(0, file.name.lastIndexOf('.'));
        downloadName = (baseName || 'spreadsheet') + '.pdf';
        
        uploadArea.style.display = 'none';
        toolSettings.style.display = 'block';
    }

    function resetUI() {
        currentFile = null;
        processedBlob = null;
        fileInput.value = '';
        renderContainer.innerHTML = '';
        
        uploadArea.style.display = 'block';
        toolSettings.style.display = 'none';
        resultActions.style.display = 'none';
    }

    cancelBtn.addEventListener('click', resetUI);
    resetBtn.addEventListener('click', resetUI);

    processBtn.addEventListener('click', async () => {
        if (!currentFile) return;

        loadingOverlay.classList.add('active');
        progressText.textContent = 'Parsing Spreadsheet...';

        try {
            const arrayBuffer = await currentFile.arrayBuffer();

            // 1. Read Workbook with SheetJS
            const wb = XLSX.read(arrayBuffer, { type: 'array' });
            
            renderContainer.innerHTML = '';
            
            // Convert each sheet to HTML table
            wb.SheetNames.forEach((sheetName) => {
                const ws = wb.Sheets[sheetName];
                const htmlStr = XLSX.utils.sheet_to_html(ws, { id: "data-table" });
                
                // Wrap in a styled container
                const sheetDiv = document.createElement('div');
                sheetDiv.innerHTML = `<h3>Sheet: ${sheetName}</h3>` + htmlStr;
                
                // Add class to the generated table for styling
                const table = sheetDiv.querySelector("table");
                if(table) table.className = "excel-table-container";
                
                renderContainer.appendChild(sheetDiv);
                
                // Page break between sheets
                const br = document.createElement('div');
                br.style.pageBreakAfter = 'always';
                renderContainer.appendChild(br);
            });

            // Temporarily show it so html2pdf can calculate dimensions properly
            renderContainer.style.display = 'block';
            renderContainer.style.position = 'absolute';
            renderContainer.style.left = '-9999px';

            progressText.textContent = 'Generating PDF View...';

            const orientation = orientationSelect.value; // 'portrait' or 'landscape'

            // 2. Convert HTML to PDF using html2pdf.js
            const opt = {
                margin:       0.5,
                filename:     downloadName,
                image:        { type: 'jpeg', quality: 0.98 },
                html2canvas:  { scale: 2 },
                jsPDF:        { unit: 'in', format: 'letter', orientation: orientation }
            };

            const pdfWorker = html2pdf().from(renderContainer).set(opt);
            
            const pdfBlob = await pdfWorker.outputPdf('blob');
            processedBlob = pdfBlob;

            // Hide container again
            renderContainer.style.display = 'none';
            renderContainer.innerHTML = '';

            loadingOverlay.classList.remove('active');
            toolSettings.style.display = 'none';
            resultActions.style.display = 'block';

        } catch (error) {
            console.error(error);
            loadingOverlay.classList.remove('active');
            renderContainer.style.display = 'none';
            alert('An error occurred during conversion. The file may be corrupt or too complex.');
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
