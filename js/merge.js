/**
 * Logic for Merge PDF Tool
 */

document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const fileInputMore = document.getElementById('file-input-more');
    const uploadArea = document.getElementById('upload-area');
    const fileListArea = document.getElementById('file-list');
    const sortableList = document.getElementById('sortable-list');
    const actionBar = document.getElementById('action-bar');
    const processBtn = document.getElementById('process-btn');
    const downloadBtn = document.getElementById('download-btn');
    const resetBtn = document.getElementById('reset-btn');
    const resultActions = document.getElementById('result-actions');
    const loadingOverlay = document.getElementById('loading-overlay');

    let processedBlob = null;
    let filesArray = [];

    // Initialize Sortable for drag-and-drop reordering
    let sortable = new Sortable(sortableList, {
        animation: 150,
        ghostClass: 'sortable-ghost',
        onEnd: function() {
            // Update filesArray based on new DOM order
            const newArray = [];
            const items = sortableList.querySelectorAll('.file-item');
            items.forEach(item => {
                const id = item.getAttribute('data-id');
                const fileObj = filesArray.find(f => f.id === id);
                if(fileObj) newArray.push(fileObj);
            });
            filesArray = newArray;
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
        const files = dt.files;
        handleFiles(files);
    }

    // Handle Click Upload
    fileInput.addEventListener('change', function() {
        handleFiles(this.files);
    });

    fileInputMore.addEventListener('change', function() {
        handleFiles(this.files);
    });

    function handleFiles(files) {
        const newFiles = Array.from(files).filter(file => file.type === 'application/pdf');
        
        if (newFiles.length === 0 && filesArray.length === 0) {
            alert('Please select valid PDF files.');
            return;
        }

        newFiles.forEach(file => {
            const id = 'file_' + Math.random().toString(36).substr(2, 9);
            filesArray.push({ id, file });
            renderFileItem(id, file);
        });

        if (filesArray.length > 0) {
            uploadArea.style.display = 'none';
            fileListArea.style.display = 'block';
            actionBar.style.display = 'flex';
        }
    }

    function renderFileItem(id, file) {
        const div = document.createElement('div');
        div.className = 'file-item';
        div.setAttribute('data-id', id);
        div.innerHTML = `
            <div class="file-info">
                <i class="fa-solid fa-bars" style="cursor: grab; color: var(--color-text-muted);"></i>
                <i class="fa-solid fa-file-pdf"></i>
                <div>
                    <strong style="display:block;">${file.name}</strong>
                    <span style="font-size:0.8rem; color: var(--color-text-muted);">${formatFileSize(file.size)}</span>
                </div>
            </div>
            <i class="fa-solid fa-trash remove-file" title="Remove" onclick="removeFile('${id}')"></i>
        `;
        sortableList.appendChild(div);
    }

    // Global remove function attached to window
    window.removeFile = function(id) {
        filesArray = filesArray.filter(f => f.id !== id);
        const item = document.querySelector(`.file-item[data-id="${id}"]`);
        if (item) item.remove();

        if (filesArray.length === 0) {
            resetUI();
        }
    };

    function resetUI() {
        filesArray = [];
        processedBlob = null;
        sortableList.innerHTML = '';
        uploadArea.style.display = 'block';
        fileListArea.style.display = 'none';
        actionBar.style.display = 'none';
        resultActions.style.display = 'none';
        fileInput.value = '';
        fileInputMore.value = '';
    }

    resetBtn.addEventListener('click', resetUI);

    // Process PDF Merge logic using pdf-lib
    processBtn.addEventListener('click', async () => {
        if (filesArray.length < 2) {
            alert('Please select at least 2 PDF files to merge.');
            return;
        }

        loadingOverlay.classList.add('active');

        try {
            const { PDFDocument } = PDFLib;
            const mergedPdf = await PDFDocument.create();

            for (const item of filesArray) {
                const arrayBuffer = await item.file.arrayBuffer();
                const pdf = await PDFDocument.load(arrayBuffer);
                const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
                copiedPages.forEach((page) => mergedPdf.addPage(page));
            }

            const pdfBytes = await mergedPdf.save();
            processedBlob = new Blob([pdfBytes], { type: 'application/pdf' });

            loadingOverlay.classList.remove('active');
            fileListArea.style.display = 'none';
            resultActions.style.display = 'block';

        } catch (error) {
            console.error(error);
            loadingOverlay.classList.remove('active');
            alert('An error occurred while merging PDFs. Some files might be encrypted or corrupted.');
        }
    });

    downloadBtn.addEventListener('click', () => {
        if (processedBlob) {
            downloadFile(processedBlob, 'merged_ToolsPDF.pdf');
        }
    });

});
