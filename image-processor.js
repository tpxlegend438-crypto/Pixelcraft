/**
 * Off-Thread Web Worker for Fast Non-Blocking Image Operations
 */

self.onmessage = function (e) {
    const { action, imgData, maskData, mode, threshold, width, height } = e.data;

    if (action === 'inpaint') {
        const resultData = applyTeleaInpaint(imgData, maskData, width, height);
        self.postMessage({ action: 'inpaintComplete', imageData: resultData, width, height });
    } else if (action === 'removeBg') {
        const resultData = applyBgRemoval(imgData, mode, threshold, width, height);
        self.postMessage({ action: 'bgRemovalComplete', imageData: resultData, width, height });
    }
};

/**
 * Fast Telea Inpainting Algorithm on Background Thread
 */
function applyTeleaInpaint(imgData, maskData, w, h) {
    const data = imgData.data;
    const mask = maskData.data;

    for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
            const idx = (y * w + x) * 4;
            if (mask[idx + 3] > 50) { // Erase target pixel
                let rSum = 0, gSum = 0, bSum = 0, count = 0;

                for (let dy = -3; dy <= 3; dy++) {
                    for (let dx = -3; dx <= 3; dx++) {
                        const ny = y + dy;
                        const nx = x + dx;
                        if (ny >= 0 && ny < h && nx >= 0 && nx < w) {
                            const nIdx = (ny * w + nx) * 4;
                            if (mask[nIdx + 3] <= 50) {
                                rSum += data[nIdx];
                                gSum += data[nIdx + 1];
                                bSum += data[nIdx + 2];
                                count++;
                            }
                        }
                    }
                }

                if (count > 0) {
                    data[idx] = rSum / count;
                    data[idx + 1] = gSum / count;
                    data[idx + 2] = bSum / count;
                }
            }
        }
    }
    return imgData;
}

/**
 * Background Saliency Removal on Background Thread
 */
function applyBgRemoval(imgData, mode, threshold, width, height) {
    const data = imgData.data;
    const cx = width / 2;
    const cy = height / 2;
    const maxDist = Math.sqrt(cx * cx + cy * cy);

    for (let i = 0; i < data.length; i += 4) {
        const x = (i / 4) % width;
        const y = Math.floor((i / 4) / width);

        const r = data[i], g = data[i + 1], b = data[i + 2];
        const distFromCenter = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2) / maxDist;
        const isBorder = (x < 10 || x > width - 10 || y < 10 || y > height - 10);

        const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        if ((lum > (1.0 - threshold) || lum < (threshold * 0.3) || isBorder) && distFromCenter > 0.35) {
            data[i + 3] = 0; // Make pixel transparent
        }
    }
    return imgData;
}