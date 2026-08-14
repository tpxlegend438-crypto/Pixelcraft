/**
 * PixelCraft AI Application Logic & UI Thread
 */

// Initialize Background Processing Web Worker
const imageWorker = new Worker('image-processor.js');

// DOM Elements
const landingPage = document.getElementById('landing-page');
const editorPage = document.getElementById('editor-page');
const sceneLoader = document.getElementById('scene-loader');
const sceneLoaderTitle = document.getElementById('scene-loader-title');
const sceneLoaderSub = document.getElementById('scene-loader-sub');

const goHomeBtn = document.getElementById('go-home-btn');
const getStartedBtn = document.getElementById('get-started-btn');
const changePhotoBtn = document.getElementById('change-photo-btn');
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');

const previewImg = document.getElementById('preview-img');
const eraseCanvas = document.getElementById('erase-canvas');
const downloadBtn = document.getElementById('download-btn');
const loader = document.getElementById('loader');
const loaderText = document.getElementById('loader-text');
const outDim = document.getElementById('out-dim');
const outSize = document.getElementById('out-size');

// AI Controls
const aiGenPrompt = document.getElementById('ai-gen-prompt');
const aiGenStyle = document.getElementById('ai-gen-style');
const aiCfEndpoint = document.getElementById('ai-cf-endpoint');
const aiCfKey = document.getElementById('ai-cf-key');
const btnRunAiGen = document.getElementById('btn-run-ai-gen');

const bgRemovalMode = document.getElementById('bg-removal-mode');
const bgThreshSlider = document.getElementById('bg-thresh-slider');
const bgThreshVal = document.getElementById('bg-thresh-val');
const bgReplacementType = document.getElementById('bg-replacement-type');
const bgColorGroup = document.getElementById('bg-color-group');
const bgSolidColor = document.getElementById('bg-solid-color');
const btnRunAiBg = document.getElementById('btn-run-ai-bg');

const eraseBrushSlider = document.getElementById('erase-brush-slider');
const eraseBrushVal = document.getElementById('erase-brush-val');
const btnClearMask = document.getElementById('btn-clear-mask');
const btnRunAiErase = document.getElementById('btn-run-ai-erase');
const btnRunAiStyle = document.getElementById('btn-run-ai-style');

let loadedImage = null;
let originalAspectRatio = 1;
let originalFileName = "pixelcraft_ai";

// Web Worker Response Handler
imageWorker.onmessage = function (e) {
    const { action, imageData, width, height } = e.data;

    if (action === 'inpaintComplete' || action === 'bgRemovalComplete') {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.putImageData(imageData, 0, 0);

        const newImg = new Image();
        newImg.onload = () => {
            loadedImage = newImg;
            if (action === 'inpaintComplete') {
                const eraseCtx = eraseCanvas.getContext('2d');
                eraseCtx.clearRect(0, 0, eraseCanvas.width, eraseCanvas.height);
            }
            hideLoader();
            processImage();
        };
        newImg.src = canvas.toDataURL('image/png');
    }
};

// UI View Switchers
function showSceneLoader(title, sub) {
    sceneLoaderTitle.textContent = title;
    sceneLoaderSub.textContent = sub;
    sceneLoader.classList.add('active');
}

function hideSceneLoader() { sceneLoader.classList.remove('active'); }

function showEditorView() {
    landingPage.classList.remove('active');
    setTimeout(() => {
        landingPage.style.display = 'none';
        editorPage.style.display = 'flex';
        getStartedBtn.style.display = 'none';
        changePhotoBtn.style.display = 'flex';
        setTimeout(() => editorPage.classList.add('active'), 20);
    }, 300);
}

function showLandingView() {
    editorPage.classList.remove('active');
    setTimeout(() => {
        editorPage.style.display = 'none';
        landingPage.style.display = 'flex';
        getStartedBtn.style.display = 'flex';
        changePhotoBtn.style.display = 'none';
        setTimeout(() => landingPage.classList.add('active'), 20);
    }, 300);
}

goHomeBtn.addEventListener('click', showLandingView);
getStartedBtn.addEventListener('click', () => fileInput.click());
changePhotoBtn.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('click', () => fileInput.click());

// Sidebar Navigation
const sidebarTabs = document.querySelectorAll('.sidebar-tab');
sidebarTabs.forEach(tab => {
    tab.addEventListener('click', () => {
        sidebarTabs.forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        
        tab.classList.add('active');
        const panelId = tab.dataset.tab;
        const panel = document.getElementById(panelId);
        if (panel) panel.classList.add('active');

        if (panelId === 'tab-ai-erase') {
            eraseCanvas.classList.add('active');
            syncEraseCanvasOverlay();
        } else {
            eraseCanvas.classList.remove('active');
        }
    });
});

// Interactive Object Mask Canvas
let isDrawingMask = false;
let eraseCtx = eraseCanvas.getContext('2d');

function syncEraseCanvasOverlay() {
    if (!previewImg.complete || previewImg.naturalWidth === 0) return;
    eraseCanvas.width = previewImg.clientWidth;
    eraseCanvas.height = previewImg.clientHeight;
    eraseCanvas.style.top = `${previewImg.offsetTop}px`;
    eraseCanvas.style.left = `${previewImg.offsetLeft}px`;
}

window.addEventListener('resize', syncEraseCanvasOverlay);

eraseCanvas.addEventListener('mousedown', (e) => { isDrawingMask = true; drawMaskStroke(e); });
eraseCanvas.addEventListener('mousemove', (e) => drawMaskStroke(e));
eraseCanvas.addEventListener('mouseup', () => { isDrawingMask = false; eraseCtx.beginPath(); });

function drawMaskStroke(e) {
    if (!isDrawingMask || !eraseCanvas.classList.contains('active')) return;
    const rect = eraseCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    eraseCtx.lineWidth = parseInt(eraseBrushSlider.value);
    eraseCtx.lineCap = 'round';
    eraseCtx.lineJoin = 'round';
    eraseCtx.strokeStyle = 'rgba(239, 68, 68, 0.7)';

    eraseCtx.lineTo(x, y);
    eraseCtx.stroke();
    eraseCtx.beginPath();
    eraseCtx.moveTo(x, y);
}

btnClearMask.addEventListener('click', () => {
    eraseCtx.clearRect(0, 0, eraseCanvas.width, eraseCanvas.height);
});

// AI Generation API (Cloudflare Workers API `saurav-z/free-image-generation-api`)
btnRunAiGen.addEventListener('click', async () => {
    const promptText = aiGenPrompt.value.trim();
    if (!promptText) return alert("Please enter an image prompt.");

    const style = aiGenStyle.value;
    const fullPrompt = `${promptText}, ${style} style, 8k high resolution`;
    showLoader("Connecting to AI Worker...");

    try {
        const endpoint = aiCfEndpoint.value.trim();
        const apiKey = aiCfKey.value.trim();
        let blob = null;

        if (endpoint !== '') {
            const headers = { 'Content-Type': 'application/json' };
            if (apiKey) headers['x-api-key'] = apiKey;

            const res = await fetch(endpoint, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({ prompt: fullPrompt, key: apiKey })
            });

            if (!res.ok) throw new Error(`Worker returned error: ${res.status}`);
            blob = await res.blob();
        } else {
            const pollUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(fullPrompt)}?width=1024&height=1024&nologo=true`;
            const res = await fetch(pollUrl);
            blob = await res.blob();
        }

        const dataUrl = await readFileAsDataURL(blob);
        const img = new Image();
        img.onload = () => {
            loadedImage = img;
            originalAspectRatio = img.naturalWidth / img.naturalHeight;
            hideLoader();
            processImage();
        };
        img.src = dataUrl;
    } catch (err) {
        alert("AI Generation Error: " + err.message);
        hideLoader();
    }
});

// AI Object Erase Action via Web Worker
btnRunAiErase.addEventListener('click', () => {
    if (!loadedImage) return;
    showLoader("Erasing object in background thread...");

    let imgCanvas = document.createElement('canvas');
    imgCanvas.width = loadedImage.naturalWidth;
    imgCanvas.height = loadedImage.naturalHeight;
    let imgCtx = imgCanvas.getContext('2d');
    imgCtx.drawImage(loadedImage, 0, 0);

    let maskCanvas = document.createElement('canvas');
    maskCanvas.width = loadedImage.naturalWidth;
    maskCanvas.height = loadedImage.naturalHeight;
    let maskCtx = maskCanvas.getContext('2d');
    maskCtx.drawImage(eraseCanvas, 0, 0, maskCanvas.width, maskCanvas.height);

    const imgData = imgCtx.getImageData(0, 0, imgCanvas.width, imgCanvas.height);
    const maskData = maskCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);

    // Send heavy calculation to Web Worker
    imageWorker.postMessage({
        action: 'inpaint',
        imgData: imgData,
        maskData: maskData,
        width: imgCanvas.width,
        height: imgCanvas.height
    });
});

// AI Background Removal via Web Worker
btnRunAiBg.addEventListener('click', () => {
    if (!loadedImage) return;
    showLoader("Isolating background in background thread...");

    let canvas = document.createElement('canvas');
    canvas.width = loadedImage.naturalWidth;
    canvas.height = loadedImage.naturalHeight;
    let ctx = canvas.getContext('2d');
    ctx.drawImage(loadedImage, 0, 0);

    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    imageWorker.postMessage({
        action: 'removeBg',
        imgData: imgData,
        mode: bgRemovalMode.value,
        threshold: parseInt(bgThreshSlider.value) / 100,
        width: canvas.width,
        height: canvas.height
    });
});

// File Loader
fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) handleFile(e.target.files[0]);
});

async function handleFile(file) {
    showSceneLoader("Reading file...", "Preparing studio");
    try {
        const dataUrl = await readFileAsDataURL(file);
        const img = new Image();
        img.onload = () => {
            loadedImage = img;
            originalAspectRatio = img.naturalWidth / img.naturalHeight;
            showEditorView();
            hideSceneLoader();
            processImage();
        };
        img.src = dataUrl;
    } catch (e) {
        alert("Error loading file.");
        hideSceneLoader();
    }
}

function readFileAsDataURL(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.readAsDataURL(file);
    });
}

function processImage() {
    if (!loadedImage) return;

    let canvas = document.createElement('canvas');
    canvas.width = loadedImage.naturalWidth;
    canvas.height = loadedImage.naturalHeight;
    let ctx = canvas.getContext('2d');
    ctx.drawImage(loadedImage, 0, 0);

    canvas.toBlob((blob) => {
        const blobUrl = URL.createObjectURL(blob);
        previewImg.src = blobUrl;
        downloadBtn.href = blobUrl;
        downloadBtn.download = "pixelcraft_output.png";
        downloadBtn.style.display = 'flex';
        outDim.textContent = `${canvas.width} × ${canvas.height} px`;
        outSize.textContent = `${(blob.size / 1024).toFixed(1)} KB`;
        setTimeout(syncEraseCanvasOverlay, 100);
    });
}

function showLoader(txt) { loaderText.textContent = txt; loader.style.display = 'flex'; }
function hideLoader() { loader.style.display = 'none'; }