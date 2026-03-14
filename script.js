const { PDFDocument } = PDFLib;
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';

let pdfBytes, pdfDocJs, pad = null, shouldDuplicate = false;
const sigModal = document.getElementById('sig-modal'), sigCanvas = document.getElementById('sig-canvas');
const container = document.getElementById('pdf-main-container'), draggable = document.getElementById('draggable-sig');
const sigPreview = document.getElementById('sig-preview'), btnDupli = document.getElementById('btn-duplicate');

function openSignature() {
    if (!container.querySelector('.page-wrapper')) return alert("Selecione um PDF!");
    sigModal.style.display = 'flex';
    // No Firefox, precisamos de um tempo maior para o layout estabilizar
    setTimeout(setupCanvas, 400);
}

function setupCanvas() {
    const rect = sigCanvas.parentElement.getBoundingClientRect();
    const ratio = Math.max(window.devicePixelRatio || 1, 2);
    
    // Configuração específica para evitar transbordo no Firefox
    sigCanvas.width = rect.width * ratio;
    sigCanvas.height = rect.height * ratio;
    
    const ctx = sigCanvas.getContext("2d");
    ctx.scale(ratio, ratio);
    
    if (pad) pad.off();
    pad = new SignaturePad(sigCanvas, { 
        penColor: 'black',
        backgroundColor: 'rgba(255, 255, 255, 0)'
    });
    pad.clear();
}

document.getElementById('btn-confirm-sig').onclick = function() {
    if (!pad || pad.isEmpty()) return alert("Assine primeiro!");
    sigPreview.src = pad.toDataURL();
    draggable.style.display = 'block';
    const firstPage = container.querySelector('.page-wrapper');
    if (firstPage) {
        firstPage.appendChild(draggable);
        draggable.style.left = "20px"; draggable.style.top = "20px";
    }
    closeModal();
};

function closeModal() { sigModal.style.display = 'none'; }

btnDupli.onclick = function(e) {
    e.stopPropagation();
    shouldDuplicate = !shouldDuplicate;
    this.innerText = shouldDuplicate ? "PÁG: TODAS (ATIVO)" : "PÁG: ÚNICA (OFF)";
    this.style.background = shouldDuplicate ? "#27ae60" : "#d35400";
};

// Arraste e Redimensionamento corrigido
let isResizing = false;
draggable.addEventListener("touchstart", (e) => { 
    isResizing = (e.target.id === 'resizer'); 
}, {passive: true});

draggable.addEventListener("touchmove", (e) => {
    e.preventDefault();
    const parent = draggable.parentElement;
    if (!parent) return;
    const rect = parent.getBoundingClientRect();
    const touch = e.touches[0];

    if (isResizing) {
        const dRect = draggable.getBoundingClientRect();
        draggable.style.width = Math.max(50, touch.clientX - dRect.left) + "px";
        draggable.style.height = Math.max(30, touch.clientY - dRect.top) + "px";
    } else {
        let x = touch.clientX - rect.left - (draggable.offsetWidth / 2);
        let y = touch.clientY - rect.top - (draggable.offsetHeight / 2);
        draggable.style.left = x + "px";
        draggable.style.top = y + "px";
    }
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
    if(!pdfBytes || !sigPreview.src) return alert("Assine antes!");
    try {
        const doc = await PDFDocument.load(pdfBytes);
        const sigImg = await doc.embedPng(sigPreview.src);
        const pages = doc.getPages();
        const wrapper = container.querySelector('.page-wrapper');
        
        const relX = parseFloat(draggable.style.left) / wrapper.offsetWidth;
        const relY = parseFloat(draggable.style.top) / wrapper.offsetHeight;
        const relW = draggable.offsetWidth / wrapper.offsetWidth;
        const relH = draggable.offsetHeight / wrapper.offsetHeight;

        const limit = shouldDuplicate ? pages.length : 1;
        for (let i = 0; i < limit; i++) {
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
        const blob = new Blob([bytes], {type: 'application/pdf'});
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = "moraes_assinado.pdf"; 
        link.click();
    } catch (err) { alert("Erro ao salvar: " + err.message); }
}
