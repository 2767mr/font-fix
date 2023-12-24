function openFile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;

    input.onchange = async function () {
        const files = Array.from(input.files);
        await convertFiles(files);
    };
    input.click();
}

async function convertFiles(files) {
    const images = await Promise.all(files.map(async f => [await convertBlobToImage(f), f.name]));

    const inputCanvas = document.createElement('canvas');
    const inputCtx = inputCanvas.getContext('2d');
    const outputCanvas = document.createElement('canvas');
    const outputCtx = outputCanvas.getContext('2d');

    for (const [image, name] of images) {
        fixImage(inputCanvas, inputCtx, outputCanvas, outputCtx, image, name);
    }
}

/**
 * @param {HTMLCanvasElement} inputCanvas 
 * @param {CanvasRenderingContext2D } inputCtx 
 * @param {HTMLImageElement} image 
 */
function fixImage(inputCanvas, inputCtx, outputCanvas, outputCtx, image, name) {
    const nextPowerOfTwo = (num) => Math.pow(2, Math.ceil(Math.log2(num)));
    inputCanvas.width = image.width;
    inputCanvas.height = image.height;
    outputCanvas.width = nextPowerOfTwo(image.width);
    outputCanvas.height = nextPowerOfTwo(image.height);

    inputCtx.clearRect(0, 0, inputCanvas.width, inputCanvas.height);
    outputCtx.clearRect(0, 0, outputCanvas.width, outputCanvas.height);
    inputCtx.drawImage(image, 0, 0);

    const imageData = inputCtx.getImageData(0, 0, inputCanvas.width, inputCanvas.height);
    const totalheight = findLowestLine(imageData, inputCanvas.width, inputCanvas.height) + 1;
    const lineHeight = findLineHeight(imageData, inputCanvas.width, inputCanvas.height, totalheight, name);
    fixIcons(imageData, inputCanvas, lineHeight, outputCtx, inputCanvas.width, inputCanvas.height, outputCanvas.width, outputCanvas.height);
    download(outputCanvas, name);
}

function download(outputCanvas, name) {
    let downloadLink = document.createElement('a');
    downloadLink.setAttribute('download', name);
    let dataURL = outputCanvas.toDataURL('image/png');
    let url = dataURL.replace(/^data:image\/png/, 'data:application/octet-stream');
    downloadLink.setAttribute('href', url);
    downloadLink.click();
}

function findLineHeight(imageData, width, height, totalheight, name) {
    const predefined = {
        "icons.png": 16,
        "icons-small.png": 14,
        "icons-keyboard.png": 16,
        "icons-gamepad.png": 16,
        "icons-items.png": 16,
        "icons-buff.png": 8,
        "icons-buff-large.png": 16,
        "languages.png": 16,
        "hall-fetica-bold-red.png": 16,
        "hall-fetica-bold-green.png": 16,
        "hall-fetica-bold-purple.png": 16,
        "hall-fetica-bold-grey.png": 16,
        "hall-fetica-small-orange.png": 13,
        "tiny-orange.png": 7,
        "hall-fetica-small-purple.png": 13,
        "hall-fetica-small-grey.png": 13,
        "tiny-grey.png": 7,
        "hall-fetica-small-red.png": 13,
        "tiny-red.png": 7,
        "hall-fetica-small-green.png": 13,
        "tiny-green.png": 7,
        "hall-fetica-bold.png": 16,
        "hall-fetica-small.png": 13,
        "tiny.png": 7,
    };

    if (predefined[name]) {
        return predefined[name];
    }

    const pixelData = imageData.data;
    const pixelWidth = width * 4; // 4 bytes per pixel (RGBA)
    for (let y = 2; y < height; y++) {
        const lineStart = y * pixelWidth;
        const lineEnd = lineStart + pixelWidth;

        let color = null;
        let found = true;

        for (let i = lineStart; i < lineEnd; i += 4) {
            const alpha = pixelData[i + 3];
            if (alpha === 0) {
                continue;
            }

            if (color === null) {
                color = [pixelData[i], pixelData[i + 1], pixelData[i + 2]];
            } else if (color[0] !== pixelData[i] || color[1] !== pixelData[i + 1] || color[2] !== pixelData[i + 2]) {
                found = false;
                break;
            }
        }

        if (found && color && (totalheight % (y + 1)) === 0) {
            return y + 1;
        }
    }

    return -1;
}

function findLowestLine(imageData, width, height) {
    const pixelData = imageData.data;
    const pixelWidth = width * 4; // 4 bytes per pixel (RGBA)
    for (let y = height - 1; y >= 0; y--) {
        const lineStart = y * pixelWidth;
        const lineEnd = lineStart + pixelWidth;

        for (let i = lineStart; i < lineEnd; i += 4) {
            const alpha = pixelData[i + 3];

            if (alpha !== 0) {
                return y;
            }
        }
    }

    return -1; // No non-transparent pixels found
}

function convertBlobToImage(blob) {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = function () {
            URL.revokeObjectURL(url);
            resolve(img);
        };
        img.onerror = function () {
            URL.revokeObjectURL(url);
            reject(new Error('Failed to load image'));
        };
        img.src = url;
    });
}

function drawImageOnCanvas(imageFile) {
    const img = new Image();

    img.onload = function () {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
    };

    img.src = URL.createObjectURL(imageFile);
    return canvas;
}

function fixIcons(imageData, image, lineHeight, outputCtx, inputWidth, inputHeight, outputWidth, outputHeight) {
    const pixelData = imageData.data;
    const pixelWidth = inputWidth * 4; // 4 bytes per pixel (RGBA)

    let nextX = 0;
    let nextY = 0;

    for (let y = lineHeight - 1; y < inputHeight; y += lineHeight) {
        const lineStart = y * pixelWidth;

        let startX = -1;
        for (let x = 0; x < inputWidth; x++) {
            const alpha = pixelData[lineStart + x * 4 + 3];
            if (alpha === 0) {
                if (startX !== -1) {
                    const width = x - startX;

                    if (nextX + width >= outputWidth) {
                        nextX = 0;
                        nextY += lineHeight;
                    }

                    if (nextY + lineHeight >= outputHeight) {
                        throw new Error("Symbols don't fit");
                    }

                    outputCtx.drawImage(image, startX, y - lineHeight + 1, width, lineHeight, nextX, nextY, width, lineHeight);

                    nextX += width + 2;
                    startX = -1;
                }
            } else if (startX === -1) {
                startX = x;
            }
        }
    }
}

window.openFile = openFile;
