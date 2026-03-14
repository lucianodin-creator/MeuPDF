const { PDFDocument } = PDFLib;
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';

let pdfBytes, pdfDocJs, pad = null, shouldDuplicate = false;
const sigModal = document.getElementById('sig-modal'), sigCanvas = document.getElementById('sig-canvas');
const container = document.getElementById('pdf-main-container'), draggable = document.getElementById('draggable-sig');
const sigPreview = document.getElementById('sig-preview'), btnDupli = document.getElementById('btn-duplicate');

function openSignature() {
    if (!container.querySelector('.page-wrapper')) return alert("Selecione um PDF primeiro!");
    sigModal.style.display = 'flex';
    // Força o ajuste do canvas após o modal aparecer
    setTimeout(setupCanvas, 200);
}

function setupCanvas() {
    const ratio = Math.max(window.devicePixelRatio || 1, 2);
    const rect = sigCanvas.parentElement.getBoundingClientRect();
    
    // Define o tamanho real baseado no espaço disponível na tela (vertical ou horizontal)
    sigCanvas.width = rect.width * ratio;
    sigCanvas.height = rect.height * ratio;
    sigCanvas.style.width = rect.width + "px";
    sigCanvas.style.height = rect.height + "px";
    
    const ctx = sigCanvas.getContext("2d");
    ctx.scale(ratio, ratio);
    
    if (pad) pad.off();
    pad = new SignaturePad(sigCanvas, { penColor: 'black', minWidth: 1, maxWidth: 3 });
    pad.clear();
}

function clearSig() { if(pad) pad.clear(); }
function closeModal() { sigModal.style.display = 'none'; }

document.getElementById('btn-confirm-sig').onclick = function() {
    if (!pad || pad.isEmpty()) return alert("Assinatura vazia!");
    const dataUrl = pad.toDataURL();
    
    // Proteção contra erro de elemento nulo
    if (sigPreview) {
        sigPreview.src = dataUrl;
        draggable.style.display = 'block';
        const firstPage = container.querySelector('.page-wrapper');
        if (firstPage) {
            firstPage.appendChild(draggable);
            draggable.style.left = "20px";
            draggable.style.top = "20px";
        }
        closeModal();
    }
};

btnDupli.onclick = function(e) {
    e.stopPropagation();
    shouldDuplicate = !shouldDuplicate;
    this.innerText = shouldDuplicate ? "PÁG: TODAS (ATIVO)" : "PÁG: ÚNICA (OFF)";
    this.style.background = shouldDuplicate ? "#27ae60" : "#d35400";
};

// Logica de Arraste Otimizada
let isResizing = false;
draggable.addEventListener("touchstart", (e) => { isResizing = (e.target.id === 'resizer'); }, {passive: true});
draggable.addEventListener("touchmove", (e) => {
    e.preventDefault();
    const parentPage = draggable.parentElement;
    if (!parentPage) return;
    const rect = parentPage.getBoundingClientRect();
    const touch = e.touches[0];

    if (isResizing) {
        const dRect = draggable.getBoundingClientRect();
        draggable.style.width = Math.max(50, touch.clientX - dRect.left) + "px";
        draggable.style.height = Math.max(30, touch.clientY - dRect.top) + "px";
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
    const reader = new FileReader();
    reader.onload = async function() {
        pdfBytes = this.result;
        pdfDocJs = await pdfjsLib.getDocument({data: pdfBytes}).promise;
        container.innerHTML = "";
        for (let i = 1; i <= pdfDocJs.numPages; i++) {
            const page = await pdfDocJs.getPage(i);
            const wrapper = document.createElement('div');
            wrapper.className = 'page-wrapper';
            const canvas = document.createElement('canvas');
            const viewport = page.getViewport({scale: 1.0});
            const scale = (container.clientWidth * 0.98) / viewport.width;
            const vp = page.getViewport({scale});
            canvas.width = vp.width; canvas.height = vp.height;
            await page.render({canvasContext: canvas.getContext('2d'), viewport: vp}).promise;
            wrapper.appendChild(canvas);
            container.appendChild(wrapper);
        }
    };
    reader.readAsArrayBuffer(file);
};

// SALVAMENTO COM LOOP DE SEGURANÇA
async function savePDF() {
    if(!pdfBytes || !sigPreview.src) return alert("Assine antes de salvar!");
    
    try {
        const doc = await PDFDocument.load(pdfBytes);
        const sigImg = await doc.embedPng(sigPreview.src);
        const pages = doc.getPages();
        const firstWrapper = container.querySelector('.page-wrapper');
        
        // Coordenadas proporcionais
        const relX = parseFloat(draggable.style.left) / firstWrapper.offsetWidth;
        const relY = parseFloat(draggable.style.top) / firstWrapper.offsetHeight;
        const relW = draggable.offsetWidth / firstWrapper.offsetWidth;
        const relH = draggable.offsetHeight / firstWrapper.offsetHeight;

        const loopLimit = shouldDuplicate ? pages.length : 1;

        for (let i = 0; i < loopLimit; i++) {
            const page = pages[i];
            const { width, height } = page.getSize();
            page.drawImage(sigImg, {
                x: width * relX,
                y: height - (height * relY) - (height * relH),
                width: width * relW,
                height: height * relH
            });
        }

        const bytes = await doc.save();
        const blob = new Blob([bytes], {type: 'application/pdf'});
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = "PDF_Assinado_Moraes.pdf";
        link.click();
    } catch (err) {
        alert("Erro ao gravar PDF: " + err.message);
    }
}
