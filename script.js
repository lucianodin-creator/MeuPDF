const { PDFDocument } = PDFLib;
let pdfBytes, pdfDocJs, pad = null;
let pctX = 0, pctY = 0, shouldDuplicate = false;

const sigModal = document.getElementById('sig-modal'), sigCanvas = document.getElementById('sig-canvas');
const draggable = document.getElementById('draggable-sig'), resizer = document.getElementById('resizer');

function openSignature() {
    if (!pdfBytes) { alert("Selecione seu PDF!"); return; }
    sigModal.style.display = 'flex';
    setTimeout(resizeCanvas, 100);
}

function resizeCanvas() {
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    sigCanvas.width = sigCanvas.offsetWidth * ratio;
    sigCanvas.height = sigCanvas.offsetHeight * ratio;
    sigCanvas.getContext("2d").setTransform(ratio, 0, 0, ratio, 0, 0);
    if (!pad) pad = new SignaturePad(sigCanvas, { penColor: 'black' });
    else pad.clear();
}

function applySignature() {
    if(pad.isEmpty()) return;
    document.getElementById('sig-preview').src = pad.toDataURL();
    draggable.style.display = 'block';
    draggable.style.left = "20px"; draggable.style.top = "20px";
    sigModal.style.display = 'none';
}

function closeModal() { sigModal.style.display = 'none'; }

function duplicateSig() {
    shouldDuplicate = !shouldDuplicate;
    document.getElementById('btn-duplicate').style.background = shouldDuplicate ? "#27ae60" : "#2980b9";
}

// LÓGICA DE ARRASTAR (No corpo da caixa)
draggable.addEventListener("touchmove", (e) => {
    if (e.target.id === 'resizer' || e.target.closest('#btn-duplicate')) return;
    e.preventDefault();
    const touch = e.touches[0];
    const wrapper = document.getElementById('pdf-wrapper');
    const rect = wrapper.getBoundingClientRect();

    let x = touch.clientX - rect.left - (draggable.offsetWidth / 2);
    let y = touch.clientY - rect.top - (draggable.offsetHeight / 2);

    x = Math.max(0, Math.min(x, rect.width - draggable.offsetWidth));
    y = Math.max(0, Math.min(y, rect.height - draggable.offsetHeight));

    draggable.style.left = x + "px";
    draggable.style.top = y + "px";
    pctX = (x + (draggable.offsetWidth / 2)) / rect.width;
    pctY = (y + (draggable.offsetHeight / 2)) / rect.height;
}, { passive: false });

// LÓGICA DE REDIMENSIONAR (Apenas no Triângulo)
resizer.addEventListener("touchmove", (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    const rect = draggable.getBoundingClientRect();
    
    let newWidth = touch.clientX - rect.left;
    let newHeight = touch.clientY - rect.top;

    if (newWidth > 50) draggable.style.width = newWidth + "px";
    if (newHeight > 30) draggable.style.height = newHeight + "px";
}, { passive: false });

async function savePDF() {
    if (!pdfBytes) return;
    const doc = await PDFDocument.load(pdfBytes);
    const allPages = doc.getPages();
    const pagesToSign = shouldDuplicate ? allPages : [allPages[0]];
    const sigImg = await doc.embedPng(document.getElementById('sig-preview').src);
    const wrapper = document.getElementById('pdf-wrapper');

    const relW = draggable.offsetWidth / wrapper.offsetWidth;
    const relH = draggable.offsetHeight / wrapper.offsetHeight;

    pagesToSign.forEach(page => {
        const { width, height } = page.getSize();
        const finalW = width * relW;
        const finalH = height * relH;

        page.drawImage(sigImg, {
            x: (width * pctX) - (finalW / 2),
            y: height - (height * pctY) - (finalH / 2),
            width: finalW, height: finalH,
        });
    });

    const savedBytes = await doc.save();
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([savedBytes], { type: 'application/pdf' }));
    link.download = "contrato_assinado.pdf";
    link.click();
}

document.getElementById('file-in').onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    pdfBytes = await file.arrayBuffer();
    pdfDocJs = await pdfjsLib.getDocument({data: pdfBytes}).promise;
    render();
};

async function render() {
    const page = await pdfDocJs.getPage(1);
    const canvas = document.getElementById('pdf-render');
    const vp = page.getViewport({scale: 1.5});
    canvas.width = vp.width; canvas.height = vp.height;
    await page.render({canvasContext: canvas.getContext('2d'), viewport: vp}).promise;
}
