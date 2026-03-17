/**
 * Logic for Image to PDF Tool
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
        const newFiles = Array.from(files).filter(file => file.type.startsWith('image/'));
        
        if (newFiles.length === 0 && filesArray.length === 0) {
            alert('Please select valid image files (JPG, PNG, etc).');
            return;
        }

        newFiles.forEach(file => {
            const id = 'file_' + Math.random().toString(36).substr(2, 9);
            const previewUrl = URL.createObjectURL(file);
            filesArray.push({ id, file, url: previewUrl });
            renderFileItem(id, file, previewUrl);
        });

        if (filesArray.length > 0) {
            uploadArea.style.display = 'none';
            fileListArea.style.display = 'block';
            actionBar.style.display = 'flex';
        }
    }

    function renderFileItem(id, file, url) {
        const div = document.createElement('div');
        div.className = 'file-item';
        div.setAttribute('data-id', id);
        div.innerHTML = `
            <div class="file-info-img">
                <i class="fa-solid fa-bars" style="cursor: grab; color: var(--color-text-muted); margin-right: 15px;"></i>
                <img src="${url}" class="image-preview" alt="preview">
                <div>
                    <strong style="display:block;">${file.name}</strong>
                    <span style="font-size:0.8rem; color: var(--color-text-muted);">${formatFileSize(file.size)}</span>
                </div>
            </div>
            <i class="fa-solid fa-trash remove-file" title="Remove" onclick="removeFile('${id}')"></i>
        `;
        sortableList.appendChild(div);
    }

    // Global remove function
    window.removeFile = function(id) {
        const fileObj = filesArray.find(f => f.id === id);
        if (fileObj) URL.revokeObjectURL(fileObj.url);
        
        filesArray = filesArray.filter(f => f.id !== id);
        const item = document.querySelector(`.file-item[data-id="${id}"]`);
        if (item) item.remove();

        if (filesArray.length === 0) {
            resetUI();
        }
    };

    function resetUI() {
        filesArray.forEach(f => URL.revokeObjectURL(f.url));
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

    // Creates PDF from images
    processBtn.addEventListener('click', async () => {
        if (filesArray.length === 0) return;

        const orientation = document.querySelector('input[name="orientation"]:checked').value;
        loadingOverlay.classList.add('active');

        try {
            const { PDFDocument } = PDFLib;
            const pdfDoc = await PDFDocument.create();

            for (const item of filesArray) {
                const arrayBuffer = await item.file.arrayBuffer();
                let image;
                
                // Embed image based on type
                if (item.file.type === 'image/jpeg' || item.file.type === 'image/jpg') {
                    image = await pdfDoc.embedJpg(arrayBuffer);
                } else if (item.file.type === 'image/png') {
                    image = await pdfDoc.embedPng(arrayBuffer);
                } else {
                    // For unsupported like webp/gif, we would need to draw them to a canvas first and convert to PNG/JPG.
                    // For simplicity, we create a canvas and draw the image.
                    const img = new Image();
                    img.src = item.url;
                    await new Promise((resolve) => { img.onload = resolve; });
                    const canvas = document.createElement('canvas');
                    canvas.width = img.width;
                    canvas.height = img.height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0);
                    const pngUrl = canvas.toDataURL('image/png');
                    const pngBuffer = await fetch(pngUrl).then(res => res.arrayBuffer());
                    image = await pdfDoc.embedPng(pngBuffer);
                }

                const imgDims = image.scale(1);
                let pageWidth, pageHeight;

                // A4 dimensions at 72 PPI (approx 595.28 x 841.89)
                const A4_WIDTH = 595.28;
                const A4_HEIGHT = 841.89;

                if (orientation === 'auto') {
                    pageWidth = imgDims.width;
                    pageHeight = imgDims.height;
                } else if (orientation === 'portrait') {
                    pageWidth = A4_WIDTH;
                    pageHeight = A4_HEIGHT;
                } else {
                    pageWidth = A4_HEIGHT;
                    pageHeight = A4_WIDTH;
                }

                const page = pdfDoc.addPage([pageWidth, pageHeight]);

                // Calculate scaling to fit image inside page
                const scaleX = pageWidth / imgDims.width;
                const scaleY = pageHeight / imgDims.height;
                const scaleToFit = Math.min(scaleX, scaleY);
                
                let renderWidth = imgDims.width;
                let renderHeight = imgDims.height;

                // If orientation is not auto, fit within page while maintaining aspect ratio
                if (orientation !== 'auto') {
                    // Only scale down if image is larger than page, otherwise keep original size centered
                    if (scaleToFit < 1) {
                        renderWidth = imgDims.width * scaleToFit;
                        renderHeight = imgDims.height * scaleToFit;
                    }
                }

                // Center the image
                const x = (pageWidth - renderWidth) / 2;
                const y = (pageHeight - renderHeight) / 2;

                page.drawImage(image, {
                    x: x,
                    y: y,
                    width: renderWidth,
                    height: renderHeight,
                });
            }

            const pdfBytes = await pdfDoc.save();
            processedBlob = new Blob([pdfBytes], { type: 'application/pdf' });

            loadingOverlay.classList.remove('active');
            fileListArea.style.display = 'none';
            resultActions.style.display = 'block';

        } catch (error) {
            console.error(error);
            loadingOverlay.classList.remove('active');
            alert('An error occurred while creating the PDF.');
        }
    });

    downloadBtn.addEventListener('click', () => {
        if (processedBlob) {
            downloadFile(processedBlob, 'images_to_pdf_ToolsPDF.pdf');
        }
    });
});
