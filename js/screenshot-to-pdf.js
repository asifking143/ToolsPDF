/**
 * Logic for Screenshot to PDF Tool
 */

document.addEventListener('DOMContentLoaded', () => {
    const startCaptureBtn = document.getElementById('start-capture-btn');
    const retakeBtn = document.getElementById('retake-btn');
    const savePdfBtn = document.getElementById('save-pdf-btn');
    const downloadBtn = document.getElementById('download-btn');
    const resetBtn = document.getElementById('reset-btn');
    
    const captureStage = document.getElementById('capture-stage');
    const previewStage = document.getElementById('preview-stage');
    const resultActions = document.getElementById('result-actions');
    const loadingOverlay = document.getElementById('loading-overlay');
    
    const canvas = document.getElementById('preview-canvas');
    const ctx = canvas.getContext('2d');
    const previewImage = document.getElementById('preview-image');

    let capturedDataUrl = null;
    let processedBlob = null;

    async function startCapture() {
        try {
            const displayMediaOptions = {
                video: {
                    cursor: "always"
                },
                audio: false
            };
            
            const stream = await navigator.mediaDevices.getDisplayMedia(displayMediaOptions);
            const video = document.createElement('video');
            video.srcObject = stream;
            
            // Wait for video metadata to load so dimensions are known
            video.onloadedmetadata = () => {
                video.play();
                
                // Give a short delay to ensure stream is rendering
                setTimeout(() => {
                    canvas.width = video.videoWidth;
                    canvas.height = video.videoHeight;
                    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                    
                    // Stop tracks immediately after capture
                    let tracks = stream.getTracks();
                    tracks.forEach(track => track.stop());
                    
                    capturedDataUrl = canvas.toDataURL('image/png');
                    previewImage.src = capturedDataUrl;
                    
                    captureStage.style.display = 'none';
                    previewStage.style.display = 'block';
                }, 500);
            };
            
        } catch(err) {
            console.error("Error capturing screen: ", err);
            if (err.name === 'NotAllowedError') {
                 // User cancelled
                 return;
            }
            alert("Unable to capture screen. Ensure your browser supports this feature and permissions are granted.");
        }
    }

    startCaptureBtn.addEventListener('click', startCapture);
    
    retakeBtn.addEventListener('click', () => {
        captureStage.style.display = 'block';
        previewStage.style.display = 'none';
        capturedDataUrl = null;
    });

    resetBtn.addEventListener('click', () => {
        captureStage.style.display = 'block';
        previewStage.style.display = 'none';
        resultActions.style.display = 'none';
        capturedDataUrl = null;
        processedBlob = null;
    });

    savePdfBtn.addEventListener('click', async () => {
        if (!capturedDataUrl) return;

        loadingOverlay.classList.add('active');

        try {
            const pdfDoc = await PDFLib.PDFDocument.create();
            
            // Convert DataURL to ArrayBuffer
            const fetchRes = await fetch(capturedDataUrl);
            const arrayBuffer = await fetchRes.arrayBuffer();
            
            const pdfImage = await pdfDoc.embedPng(arrayBuffer);
            const imgDims = pdfImage.scale(1);
            
            // Auto match dimensions to image (make it a perfect fit)
            const page = pdfDoc.addPage([imgDims.width, imgDims.height]);
            page.drawImage(pdfImage, {
                x: 0,
                y: 0,
                width: imgDims.width,
                height: imgDims.height
            });

            const pdfBytes = await pdfDoc.save();
            processedBlob = new Blob([pdfBytes], { type: 'application/pdf' });

            loadingOverlay.classList.remove('active');
            previewStage.style.display = 'none';
            resultActions.style.display = 'block';

        } catch (error) {
            console.error(error);
            loadingOverlay.classList.remove('active');
            alert('An error occurred while generating the PDF.');
        }
    });

    downloadBtn.addEventListener('click', () => {
        if (processedBlob) {
            const date = new Date();
            const timestamp = date.getTime();
            downloadFile(processedBlob, `screenshot_${timestamp}.pdf`);
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
