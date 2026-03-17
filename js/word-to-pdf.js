/**
 * Logic for Word to PDF Tool
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
    
    let currentFile = null;
    let processedBlob = null;
    let downloadName = 'converted_document.pdf';

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
        if (!file || !file.name.endsWith('.docx')) {
            alert('Please select a valid DOCX file. Legacy .doc files are not supported in-browser natively.');
            return;
        }

        currentFile = file;
        fileNameDisplay.textContent = file.name;
        fileInfoDisplay.textContent = formatFileSize(file.size);
        downloadName = file.name.replace('.docx', '.pdf');
        
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
        progressText.textContent = 'Parsing Word Document...';

        try {
            const arrayBuffer = await currentFile.arrayBuffer();

            // 1. Convert DOCX to HTML using Mammoth
            const result = await mammoth.convertToHtml({arrayBuffer: arrayBuffer});
            const html = result.value;
            const messages = result.messages;
            
            if(messages.length > 0) {
                 console.warn("Mammoth warnings:", messages);
            }

            renderContainer.innerHTML = html;
            // Temporarily show it so html2pdf can calculate dimensions properly, but hide it off-screen
            renderContainer.style.display = 'block';
            renderContainer.style.position = 'absolute';
            renderContainer.style.left = '-9999px';

            progressText.textContent = 'Generating PDF Layout...';

            // 2. Convert HTML to PDF using html2pdf.js
            const opt = {
                margin:       1,
                filename:     downloadName,
                image:        { type: 'jpeg', quality: 0.98 },
                html2canvas:  { scale: 2 },
                jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
            };

            const pdfWorker = html2pdf().from(renderContainer).set(opt);
            
            // Output as blob
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
            alert('An error occurred during conversion. The document may be too complex or an unsupported format.');
        }
    });

    downloadBtn.addEventListener('click', () => {
        if (processedBlob) {
            downloadFile(processedBlob, downloadName);
        }
    });
});
