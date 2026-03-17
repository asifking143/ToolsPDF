/**
 * Logic for Text to PDF Tool
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
    const fontSelect = document.getElementById('font-family');
    
    let processedBlob = null;
    let downloadName = 'document.pdf';

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
        if (!file || !file.name.endsWith('.txt')) {
            alert('Please select a valid .txt file.');
            return;
        }

        const reader = new FileReader();
        reader.onload = function(e) {
            textInputArea.value = e.target.result;
            
            fileNameDisplay.textContent = file.name;
            fileInfoDisplay.textContent = formatFileSize(file.size);
            
            const baseName = file.name.substring(0, file.name.lastIndexOf('.'));
            downloadName = (baseName || 'document') + '.pdf';
            
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
        downloadName = 'document.pdf';
        
        uploadArea.style.display = 'block';
        toolSettings.style.display = 'none';
        resultActions.style.display = 'none';
    }

    // Direct paste initiation
    textInputArea.addEventListener('input', () => {
        if(uploadArea.style.display !== 'none' && textInputArea.value.trim() !== '') {
            uploadArea.style.display = 'none';
            toolSettings.style.display = 'block';
            fileNameDisplay.textContent = 'pasted_text.txt';
            fileInfoDisplay.textContent = 'Manual Input';
        }
    });

    cancelBtn.addEventListener('click', resetUI);
    resetBtn.addEventListener('click', resetUI);

    processBtn.addEventListener('click', async () => {
        const txt = textInputArea.value;
        if (!txt.trim()) return;

        loadingOverlay.classList.add('active');

        try {
            // Apply font
            renderContainer.style.fontFamily = fontSelect.value;
            // Escape HTML and retain line breaks
            renderContainer.innerHTML = escapeHtml(txt);

            renderContainer.style.display = 'block';
            renderContainer.style.position = 'absolute';
            renderContainer.style.left = '-9999px';

            const opt = {
                margin:       1,
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
            alert('An error occurred during rendering.');
        }
    });

    downloadBtn.addEventListener('click', () => {
        if (processedBlob) {
            downloadFile(processedBlob, downloadName);
        }
    });

    function escapeHtml(unsafe) {
        return unsafe
             .replace(/&/g, "&amp;")
             .replace(/</g, "&lt;")
             .replace(/>/g, "&gt;")
             .replace(/"/g, "&quot;")
             .replace(/'/g, "&#039;");
    }
});
