/**
 * Logic for Edit PDF Metadata
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
    
    const inputTitle = document.getElementById('meta-title');
    const inputAuthor = document.getElementById('meta-author');
    const inputSubject = document.getElementById('meta-subject');
    const inputKeywords = document.getElementById('meta-keywords');
    const inputCreator = document.getElementById('meta-creator');
    const inputProducer = document.getElementById('meta-producer');

    let currentFile = null;
    let pdfDoc = null;
    let processedBlob = null;
    let downloadName = 'updated_pdf';

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
        downloadName = file.name;
        
        uploadArea.style.display = 'none';
        loadingOverlay.classList.add('active');

        try {
            const arrayBuffer = await file.arrayBuffer();
            const { PDFDocument } = PDFLib;
            pdfDoc = await PDFDocument.load(arrayBuffer);
            
            // Populate fields with existing metadata
            inputTitle.value = pdfDoc.getTitle() || '';
            inputAuthor.value = pdfDoc.getAuthor() || '';
            inputSubject.value = pdfDoc.getSubject() || '';
            inputCreator.value = pdfDoc.getCreator() || 'ToolsPDF Editor';
            inputProducer.value = pdfDoc.getProducer() || 'ToolsPDF';
            
            const keywords = pdfDoc.getKeywords();
            if (keywords && Array.isArray(keywords)) {
                inputKeywords.value = keywords.join(', ');
            } else if (keywords) {
                inputKeywords.value = keywords;
            } else {
                inputKeywords.value = '';
            }
            
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
        processedBlob = null;
        fileInput.value = '';
        
        inputTitle.value = '';
        inputAuthor.value = '';
        inputSubject.value = '';
        inputKeywords.value = '';
        inputCreator.value = '';
        inputProducer.value = '';
        
        uploadArea.style.display = 'block';
        toolSettings.style.display = 'none';
        resultActions.style.display = 'none';
    }

    cancelBtn.addEventListener('click', resetUI);
    resetBtn.addEventListener('click', resetUI);

    // Process Update
    processBtn.addEventListener('click', async () => {
        if (!pdfDoc) return;

        loadingOverlay.classList.add('active');

        try {
            pdfDoc.setTitle(inputTitle.value);
            pdfDoc.setAuthor(inputAuthor.value);
            pdfDoc.setSubject(inputSubject.value);
            pdfDoc.setCreator(inputCreator.value);
            pdfDoc.setProducer(inputProducer.value);
            
            const keywordsValue = inputKeywords.value.trim();
            if (keywordsValue) {
                const keywordsArray = keywordsValue.split(',').map(kw => kw.trim()).filter(kw => kw);
                pdfDoc.setKeywords(keywordsArray);
            } else {
                pdfDoc.setKeywords([]); // remove
            }

            const pdfBytes = await pdfDoc.save();
            processedBlob = new Blob([pdfBytes], { type: 'application/pdf' });

            loadingOverlay.classList.remove('active');
            toolSettings.style.display = 'none';
            resultActions.style.display = 'block';

        } catch (error) {
            console.error(error);
            loadingOverlay.classList.remove('active');
            alert('An error occurred while updating properties.');
        }
    });

    downloadBtn.addEventListener('click', () => {
        if (processedBlob) {
            downloadFile(processedBlob, downloadName);
        }
    });
});
