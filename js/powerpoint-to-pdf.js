/**
 * Logic for PowerPoint to PDF Tool
 * Uses JSZip to unpack the PPTX, read slide XML files, extract <a:t> text nodes, 
 * format into basic HTML, and convert to PDF using html2pdf.
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
    let downloadName = 'converted_presentation.pdf';

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
        if (!file || !file.name.endsWith('.pptx')) {
            alert('Please select a valid PPTX file. Legacy .ppt files are not supported.');
            return;
        }

        currentFile = file;
        fileNameDisplay.textContent = file.name;
        fileInfoDisplay.textContent = formatFileSize(file.size);
        
        const baseName = file.name.substring(0, file.name.lastIndexOf('.'));
        downloadName = (baseName || 'presentation') + '.pdf';
        
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
        progressText.textContent = 'Decompressing Presentation...';

        try {
            const zip = new JSZip();
            const contents = await zip.loadAsync(currentFile);
            
            // Find all slide XML files
            const slideFiles = [];
            for (let [filename, file] of Object.entries(contents.files)) {
                if (filename.startsWith('ppt/slides/slide') && filename.endsWith('.xml')) {
                    slideFiles.push(filename);
                }
            }
            
            if (slideFiles.length === 0) {
                throw new Error("No slides found in the document.");
            }

            // PPTX slides often are named slide1.xml, slide2.xml... Sort them properly
            slideFiles.sort((a, b) => {
                const numA = parseInt(a.match(/slide(\d+)\.xml/)[1]);
                const numB = parseInt(b.match(/slide(\d+)\.xml/)[1]);
                return numA - numB;
            });

            renderContainer.innerHTML = '<h1 style="text-align:center; padding: 20px;">' + (currentFile.name) + '</h1>';

            const parser = new DOMParser();

            for (let i = 0; i < slideFiles.length; i++) {
                progressText.textContent = `Parsing Slide ${i + 1} of ${slideFiles.length}...`;
                
                const slideXmlStr = await contents.file(slideFiles[i]).async('string');
                const xmlDoc = parser.parseFromString(slideXmlStr, "text/xml");
                
                // Extract all <a:t> tags (OpenXML Drawing text nodes)
                const textNodes = xmlDoc.getElementsByTagName('a:t');
                
                const slideDiv = document.createElement('div');
                slideDiv.style.border = '1px solid #ddd';
                slideDiv.style.padding = '40px';
                slideDiv.style.marginBottom = '20px';
                slideDiv.style.pageBreakInside = 'avoid';
                
                let slideHtml = `<h3 style="color: #666; border-bottom: 1px solid #ccc; padding-bottom: 10px;">Slide ${i + 1}</h3><ul>`;
                
                let textFound = false;
                for (let t = 0; t < textNodes.length; t++) {
                    const text = textNodes[t].textContent;
                    if (text && text.trim().length > 0) {
                        slideHtml += `<li style="margin-bottom: 8px;">${escapeHtml(text)}</li>`;
                        textFound = true;
                    }
                }
                
                if (!textFound) {
                    slideHtml += '<li><i>[No text extracted or image-only slide]</i></li>';
                }
                
                slideHtml += '</ul>';
                slideDiv.innerHTML = slideHtml;
                renderContainer.appendChild(slideDiv);
            }

            // Temporarily show it
            renderContainer.style.display = 'block';
            renderContainer.style.position = 'absolute';
            renderContainer.style.left = '-9999px';

            progressText.textContent = 'Generating PDF...';

            // Convert HTML to PDF using html2pdf.js
            const opt = {
                margin:       0.5,
                filename:     downloadName,
                image:        { type: 'jpeg', quality: 0.98 },
                html2canvas:  { scale: 2 },
                jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
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
            alert('An error occurred during extraction. The file may be corrupt or not a valid PPTX format.');
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
