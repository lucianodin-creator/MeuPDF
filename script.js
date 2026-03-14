const { PDFDocument } = PDFLib;
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';

let pdfBytes, pdfDocJs, pad = null;
const sigModal = document.getElementById('sig-modal');
const container = document.getElementById('pdf-main-container'), draggable = document.getElementById('draggable-sig');
const sigPreview = document.getElementById('sig-preview'), btnDupli = document.getElementById('btn-duplicate');

function openSignature() {
    if (!container.querySelector('.page-wrapper')) return alert("Abra um PDF primeiro!");
    sigModal.style.display = 'flex';
    
    // CORREÇÃO: Recria o canvas do zero para evitar janelas cortadas
    const canvasContainer = document.getElementById('sig-canvas-container');
    canvasContainer.innerHTML = '<canvas id="sig-canvas"></canvas>';
    const canvas = document.getElementById('sig-canvas');
    
    const rect = canvasContainer.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    canvas.getContext("2d").scale(ratio, ratio);
    
    pad = new SignaturePad(canvas, { penColor: 'black' });
}

function closeModal() { sigModal.style.display = 'none'; }

// Duplicação baseada no texto do botão (mais seguro)
btnDupli.onclick = function(e) {
    e.stopPropagation();
    if (this.innerText.includes("ÚNICA")) {
        this.innerText = "PÁG: TODAS";
        this.style.background = "#27ae60";
    } else {
        this.innerText = "PÁG: ÚNICA";
        this.style.background = "#d35400";
    }
};

document.getElementById('btn-confirm-sig').onclick = function() {
    if (!pad || pad.isEmpty()) return alert("Assine primeiro!");
    sigPreview.src = pad.toDataURL();
    draggable.style.display = 'block';
    
    const firstPage = container.querySelector('.page-wrapper');
    if (firstPage) {
        firstPage.appendChild(draggable);
        draggable.style.left = "20px";
        draggable.style.top = "20px";
    }
    closeModal();
};

// Lógica de Arraste (simplificada para evitar conflitos no Firefox)
draggable.addEventListener("touchmove", (e) => {
    e.preventDefault();
    const parent = draggable.parentElement;
    if (!parent) return;
    const rect = parent.getBoundingClientRect();
    const touch = e.touches[0];
    
    const x = touch.clientX - rect.left - (draggable.offsetWidth / 2);
    const y = touch.clientY - rect.top - (draggable.offsetHeight / 2);
    
    draggable.style.left = Math.max(0, Math.min(x, rect.width - draggable.offsetWidth)) + "px";
    draggable.style.top = Math.max(0, Math.min(y, rect.height - draggable.offsetHeight)) + "px";
}, { passive: false });

document.getElementById('file-in').onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
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
    if(!pdfBytes || !sigPreview.src) return alert("Falta a assinatura!");
    const doc = await PDFDocument.load(pdfBytes);
    const sigImg = await doc.embedPng(sigPreview.src);
    const pages = doc.getPages();
    const wrapper = container.querySelector('.page-wrapper');
    
    const relX = parseFloat(draggable.style.left) / wrapper.offsetWidth;
    const relY = parseFloat(draggable.style.top) / wrapper.offsetHeight;
    const relW = draggable.offsetWidth / wrapper.offsetWidth;
    const relH = draggable.offsetHeight / wrapper.offsetHeight;

    // Verifica o estado atual do botão para decidir a duplicação
    const isMulti = btnDupli.innerText.includes("TODAS");
    const total = isMulti ? pages.length : 1;

    for (let i = 0; i < total; i++) {
        const p = pages[i];
        const { width, height } = p.getSize();
        p.drawImage(sigImg, {
            x: width * relX,
            y: height - (height * relY) - (height * relH),
            width: width * relW,
            height: height * relH
        });
    }
    
    const bytes = await doc.save();
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([bytes], {type: 'application/pdf'}));
    link.download = "moraes_shop_assinado.pdf";
    link.click();
}
