const { PDFDocument } = PDFLib;
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';

let pdfBytes, pdfDocJs, pad = null, shouldDuplicate = false;
const sigModal = document.getElementById('sig-modal'), sigCanvas = document.getElementById('sig-canvas');
const container = document.getElementById('pdf-main-container'), draggable = document.getElementById('draggable-sig');
const sigPreview = document.getElementById('sig-preview'), btnDupli = document.getElementById('btn-duplicate');

function openSignature() {
    if (!container.querySelector('.page-wrapper')) return alert("Abra um PDF primeiro!");
    sigModal.style.display = 'flex';
    setTimeout(setupCanvas, 300);
}

function setupCanvas() {
    const rect = sigCanvas.parentElement.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    sigCanvas.width = rect.width * ratio;
    sigCanvas.height = rect.height * ratio;
    sigCanvas.getContext("2d").setTransform(ratio, 0, 0, ratio, 0, 0);
    if (pad) pad.off();
    pad = new SignaturePad(sigCanvas, { penColor: 'black' });
    pad.clear();
}

document.getElementById('btn-confirm-sig').onclick = function() {
    if (!pad || pad.isEmpty()) return alert("Assine primeiro!");
    sigPreview.src = pad.toDataURL();
    draggable.style.display = 'block';
    const firstPage = container.querySelector('.page-wrapper');
    if (firstPage) {
        firstPage.appendChild(draggable);
        draggable.style.left = "50px";
        draggable.style.top = "50px";
    }
    sigModal.style.display = 'none';
};

function closeModal() { sigModal.style.display = 'none'; }

// Controle do Botão Duplicar
btnDupli.onclick = function(e) {
    e.stopPropagation();
    shouldDuplicate = !shouldDuplicate;
    this.innerText = shouldDuplicate ? "PÁG: TODAS (ON)" : "PÁG: ÚNICA (OFF)";
    this.style.background = shouldDuplicate ? "#27ae60" : "#3498db";
    console.log("Status da duplicação:", shouldDuplicate);
};

// Arraste e Redimensionamento
let isResizing = false;
draggable.addEventListener("touchstart", (e) => { isResizing = (e.target.id === 'resizer'); });

draggable.addEventListener("touchmove", (e) => {
    e.preventDefault();
    const parentPage = draggable.parentElement;
    if (!parentPage || parentPage === container) return;
    const rect = parentPage.getBoundingClientRect();
    const touch = e.touches[0];

    if (isResizing) {
        const dRect = draggable.getBoundingClientRect();
        draggable.style.width = Math.max(40, touch.clientX - dRect.left) + "px";
        draggable.style.height = Math.max(20, touch.clientY - dRect.top) + "px";
    } else {
        let x = touch.clientX - rect.left - (draggable.offsetWidth / 2);
        let y = touch.clientY - rect.top - (draggable.offsetHeight / 2);
        draggable.style.left = Math.max(0, Math.min(x, rect.width - draggable.offsetWidth)) + "px";
        draggable.style.top = Math.max(0, Math.min(y, rect.height - draggable.offsetHeight)) + "px";
    }
}, { passive: false });

document.getElementById('file-in').onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
        pdfBytes = await file.arrayBuffer();
        pdfDocJs = await pdfjsLib.getDocument({data: pdfBytes}).promise;
        container.innerHTML = "";
        for (let i = 1; i <= pdfDocJs.numPages; i++) {
            const page = await pdfDocJs.getPage(i);
            const wrapper = document.createElement('div');
            wrapper.className = 'page-wrapper';
            const canvas = document.createElement('canvas');
            const viewport = page.getViewport({scale: 1.0});
            const scale = (container.clientWidth * 0.95) / viewport.width;
            const vp = page.getViewport({scale});
            canvas.width = vp.width; canvas.height = vp.height;
            await page.render({canvasContext: canvas.getContext('2d'), viewport: vp}).promise;
            wrapper.appendChild(canvas);
            container.appendChild(wrapper);
        }
    } catch (err) { alert("Erro ao carregar: " + err); }
};

// SALVAR - LÓGICA DE DUPLICAÇÃO CORRIGIDA
async function savePDF() {
    if(!pdfBytes || !sigPreview.src) return alert("Falta a assinatura!");
    
    const doc = await PDFDocument.load(pdfBytes);
    const sigImg = await doc.embedPng(sigPreview.src);
    const allPages = doc.getPages();
    const firstWrapper = container.querySelector('.page-wrapper');
    
    // Proporções baseadas na primeira folha
    const relX = parseFloat(draggable.style.left) / firstWrapper.offsetWidth;
    const relY = parseFloat(draggable.style.top) / firstWrapper.offsetHeight;
    const relW = draggable.offsetWidth / firstWrapper.offsetWidth;
    const relH = draggable.offsetHeight / firstWrapper.offsetHeight;

    // Decisão final: uma ou todas?
    const totalPages = allPages.length;
    const loopCount = shouldDuplicate ? totalPages : 1;

    for (let i = 0; i < loopCount; i++) {
        const page = allPages[i];
        const { width, height } = page.getSize();
        
        page.drawImage(sigImg, {
            x: width * relX,
            y: height - (height * relY) - (height * relH),
            width: width * relW,
            height: height * relH
        });
    }

    const bytes = await doc.save();
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([bytes], {type: 'application/pdf'}));
    link.download = "PDF_Assinado.pdf"; 
    link.click();
}
