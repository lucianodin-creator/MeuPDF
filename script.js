const { PDFDocument } = PDFLib;
let pdfBytes, pdfDocJs, pageNum = 1, pad = null;
let pctX = 0.5, pctY = 0.5;

const sigModal = document.getElementById('sig-modal'), sigCanvas = document.getElementById('sig-canvas');
const draggable = document.getElementById('draggable-sig');

function openSignature() {
    if (!pdfBytes) { alert("Selecione seu PDF!"); return; }
    sigModal.style.display = 'flex';
    setTimeout(() => {
        const ratio = Math.max(window.devicePixelRatio || 1, 1);
        sigCanvas.width = sigCanvas.offsetWidth * ratio;
        sigCanvas.height = sigCanvas.offsetHeight * ratio;
        sigCanvas.getContext("2d").setTransform(ratio, 0, 0, ratio, 0, 0);
        if (!pad) pad = new SignaturePad(sigCanvas, { penColor: 'black' });
        else pad.clear();
    }, 300);
}

function applySignature() {
    if(pad.isEmpty()) return;
    document.getElementById('sig-preview').src = pad.toDataURL();
    draggable.style.display = 'block';
    draggable.style.transform = 'translate3d(10px, 10px, 0)';
    sigModal.style.display = 'none';
}

draggable.addEventListener("touchmove", (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    const wrapper = document.getElementById('pdf-wrapper');
    const rect = wrapper.getBoundingClientRect();
    let x = touch.clientX - rect.left - 75; 
    let y = touch.clientY - rect.top - 25;
    draggable.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    pctX = (touch.clientX - rect.left) / rect.width;
    pctY = (touch.clientY - rect.top) / rect.height;
}, { passive: false });

async function savePDF() {
    if (!pdfBytes) return;
    const doc = await PDFDocument.load(pdfBytes);
    const page = doc.getPages()[0];
    const { width, height } = page.getSize();
    const sigImg = await doc.embedPng(document.getElementById('sig-preview').src);
    const sigW = 150; 
    const sigH = (sigImg.height / sigImg.width) * sigW;

    page.drawImage(sigImg, {
        x: (width * pctX) - (sigW / 2),
        y: height - (height * pctY) - (sigH / 2),
        width: sigW,
        height: sigH,
    });

    const savedBytes = await doc.save();
    const blob = new Blob([savedBytes], { type: 'application/pdf' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
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
    const page = await pdfDocJs.getPage(pageNum);
    const canvas = document.getElementById('pdf-render');
    const vp = page.getViewport({scale: 1.5});
    canvas.width = vp.width; canvas.height = vp.height;
    await page.render({canvasContext: canvas.getContext('2d'), viewport: vp}).promise;
}
