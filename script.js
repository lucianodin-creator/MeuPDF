const { PDFDocument } = PDFLib;
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';

let pdfBytes, pdfDocJs, pad = null;
const sigModal = document.getElementById('sig-modal'), sigCanvas = document.getElementById('sig-canvas');
const container = document.getElementById('pdf-main-container'), draggable = document.getElementById('draggable-sig');
const sigPreview = document.getElementById('sig-preview'), btnDupli = document.getElementById('btn-duplicate');

function openSignature() {
    if (!container.querySelector('.page-wrapper')) return alert("Selecione um PDF!");
    sigModal.style.display = 'flex';
    
    // Limpeza e Redimensionamento Forçado
    const ratio = window.devicePixelRatio || 1;
    const rect = sigCanvas.parentElement.getBoundingClientRect();
    sigCanvas.width = rect.width * ratio;
    sigCanvas.height = rect.height * ratio;
    sigCanvas.getContext("2d").scale(ratio, ratio);
    
    if (pad) pad.off();
    pad = new SignaturePad(sigCanvas, { penColor: 'black' });
}

function closeModal() { sigModal.style.display = 'none'; }

btnDupli.onclick = function() {
    const isSingle = this.innerText.includes("SÓ NESTA");
    this.innerText = isSingle ? "APLICAR: TODAS PÁGS" : "APLICAR: SÓ NESTA";
    this.style.background = isSingle ? "#27ae60" : "#e67e22";
};

document.getElementById('btn-confirm-sig').onclick = function() {
    if (!pad || pad.isEmpty()) return alert("Assine primeiro!");
    sigPreview.src = pad.toDataURL();
    draggable.style.display = 'block';
    const firstPage = container.querySelector('.page-wrapper');
    if (firstPage) firstPage.appendChild(draggable);
    closeModal();
};

// Arraste Universal
draggable.addEventListener("touchmove", (e) => {
    e.preventDefault();
    const parent = draggable.parentElement;
    const rect = parent.getBoundingClientRect();
    const touch = e.touches[0];
    draggable.style.left = (touch.clientX - rect.left - draggable.offsetWidth/2) + "px";
    draggable.style.top = (touch.clientY - rect.top - draggable.offsetHeight/2) + "px";
}, { passive: false });

document.getElementById('file-in').onchange = async (e) => {
    const file = e.target.files[0];
    pdfBytes = await file.arrayBuffer();
    pdfDocJs = await pdfjsLib.getDocument({data: pdfBytes}).promise;
    container.innerHTML = "";
    for (let i = 1; i <= pdfDocJs.numPages; i++) {
        const page = await pdfDocJs.getPage(i);
        const wrapper = document.createElement('div');
        wrapper.className = 'page-wrapper';
        const canvas = document.createElement('canvas');
        const vp = page.getViewport({scale: container.clientWidth / page.getViewport({scale:1}).width * 0.95});
        canvas.width = vp.width; canvas.height = vp.height;
        await page.render({canvasContext: canvas.getContext('2d'), viewport: vp}).promise;
        wrapper.appendChild(canvas);
        container.appendChild(wrapper);
    }
};

async function savePDF() {
    if(!pdfBytes || !sigPreview.src) return alert("Erro: Faltam dados!");
    const doc = await PDFDocument.load(pdfBytes);
    const sigImg = await doc.embedPng(sigPreview.src);
    const pages = doc.getPages();
    const wrapper = container.querySelector('.page-wrapper');
    
    const relX = parseFloat(draggable.style.left) / wrapper.offsetWidth;
    const relY = parseFloat(draggable.style.top) / wrapper.offsetHeight;
    const relW = draggable.offsetWidth / wrapper.offsetWidth;
    const relH = draggable.offsetHeight / wrapper.offsetHeight;

    const applyAll = btnDupli.innerText.includes("TODAS");
    const count = applyAll ? pages.length : 1;

    for (let i = 0; i < count; i++) {
        const p = pages[i];
        const { width, height } = p.getSize();
        p.drawImage(sigImg, {
            x: width * relX,
            y: height - (height * relY) - (height * relH),
            width: width * relW, height: height * relH
        });
    }
    const bytes = await doc.save();
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([bytes], {type: 'application/pdf'}));
    link.download = "moraes_final.pdf";
    link.click();
}
