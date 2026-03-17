/**
 * Logic for Markdown to PDF Tool
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
    const renderContainer = document.getElementById('render-container');
    const textInputArea = document.getElementById('text-input');
    
    let processedBlob = null;
    let downloadName = 'markdown.pdf';

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
        if (!file || (!file.name.endsWith('.md') && !file.name.endsWith('.markdown'))) {
            alert('Please select a valid Markdown file.');
            return;
        }

        const reader = new FileReader();
        reader.onload = function(e) {
            textInputArea.value = e.target.result;
            
            fileNameDisplay.textContent = file.name;
            fileInfoDisplay.textContent = formatFileSize(file.size);
            
            const baseName = file.name.substring(0, file.name.lastIndexOf('.'));
            downloadName = (baseName || 'markdown') + '.pdf';
            
            uploadArea.style.display = 'none';
            toolSettings.style.display = 'block';
        };
        reader.readAsText(file);
    }

    function resetUI() {
        processedBlob = null;
        fileInput.value = '';
        textInputArea.value = '';
        renderContainer.innerHTML = '';
        downloadName = 'markdown.pdf';
        
        uploadArea.style.display = 'block';
        toolSettings.style.display = 'none';
        resultActions.style.display = 'none';
    }

    // Direct paste
    textInputArea.addEventListener('input', () => {
        if(uploadArea.style.display !== 'none' && textInputArea.value.trim() !== '') {
            uploadArea.style.display = 'none';
            toolSettings.style.display = 'block';
            fileNameDisplay.textContent = 'pasted_markdown.md';
            fileInfoDisplay.textContent = 'Manual Input';
        }
    });

    cancelBtn.addEventListener('click', resetUI);
    resetBtn.addEventListener('click', resetUI);

    processBtn.addEventListener('click', async () => {
        const markdownCode = textInputArea.value;
        if (!markdownCode.trim()) return;

        loadingOverlay.classList.add('active');

        try {
            // Convert MD to HTML via marked.js
            const htmlContent = marked.parse(markdownCode);
            renderContainer.innerHTML = htmlContent;
            
            renderContainer.style.display = 'block';
            renderContainer.style.position = 'absolute';
            renderContainer.style.left = '-9999px';
            renderContainer.style.width = '800px';

            const opt = {
                margin:       [0.5, 0.5, 0.5, 0.5],
                filename:     downloadName,
                image:        { type: 'jpeg', quality: 0.98 },
                html2canvas:  { scale: 2 },
                jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
            };

            const pdfWorker = html2pdf().from(renderContainer).set(opt);
            const pdfBlob = await pdfWorker.outputPdf('blob');
            processedBlob = pdfBlob;

            renderContainer.style.display = 'none';
            renderContainer.innerHTML = '';

            loadingOverlay.classList.remove('active');
            toolSettings.style.display = 'none';
            resultActions.style.display = 'block';

        } catch (error) {
            console.error(error);
            loadingOverlay.classList.remove('active');
            renderContainer.style.display = 'none';
            alert('An error occurred during Markdown rendering.');
        }
    });

    downloadBtn.addEventListener('click', () => {
        if (processedBlob) {
            downloadFile(processedBlob, downloadName);
        }
    });

    // Helper
    window.formatFileSize = function(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };
});
