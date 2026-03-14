const { PDFDocument } = PDFLib;
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';

let pdfBytes, pdfDocJs, pad = null;
let pctX = 0, pctY = 0, shouldDuplicate = false;

const sigModal = document.getElementById('sig-modal');
const sigCanvas = document.getElementById('sig-canvas');
const container = document.getElementById('pdf-main-container');
const draggable = document.getElementById('draggable-sig');
const sigPreview = document.getElementById('sig-preview');

function openSignature() {
    if (!pdfBytes) return alert("Abra um PDF primeiro!");
    sigModal.style.display = 'flex';
    setTimeout(setupCanvas, 300);
}

function setupCanvas() {
    const rect = sigCanvas.parentElement.getBoundingClientRect();
    sigCanvas.width = rect.width;
    sigCanvas.height = rect.height;
    if (pad) pad.off();
    pad = new SignaturePad(sigCanvas, { penColor: 'black' });
    pad.clear();
}

// BOTÃO CONFIRMAR
document.getElementById('btn-confirm-sig').onclick = function() {
    if (!pad || pad.isEmpty()) return alert("Assine primeiro!");
    
    const dataUrl = pad.toDataURL();
    sigPreview.src = dataUrl;
    
    // Mostra a assinatura e reseta posição
    draggable.style.display = 'block';
    draggable.style.left = "50px";
    draggable.style.top = "100px";
    
    // Garante que a assinatura fique visível por cima de tudo
    container.appendChild(draggable); 
    
    sigModal.style.display = 'none';
};

function closeModal() { sigModal.style.display = 'none'; }

document.getElementById('btn-duplicate').onclick = function(e) {
    e.stopPropagation();
    shouldDuplicate = !shouldDuplicate;
    this.style.background = shouldDuplicate ? "#27ae60" : "#2980b9";
};

// ARRASTE E REDIMENSIONAMENTO
let isResizing = false;
draggable.addEventListener("touchstart", (e) => { isResizing = (e.target.id === 'resizer'); });

draggable.addEventListener("touchmove", (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    const rect = container.getBoundingClientRect();

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

// ABRIR PDF
document.getElementById('file-in').onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
        pdfBytes = await file.arrayBuffer();
        pdfDocJs = await pdfjsLib.getDocument({data: pdfBytes}).promise;
        container.innerHTML = ""; // Limpa tudo
        container.appendChild(draggable); // Recoloca a assinatura escondida
        draggable.style.display = 'none';

        for (let i = 1; i <= pdfDocJs.numPages; i++) {
            const page = await pdfDocJs.getPage(i);
            const wrapper = document.createElement('div');
            wrapper.className = 'page-wrapper';
            const canvas = document.createElement('canvas');
            const vp = page.getViewport({scale: 1.0});
            canvas.width = vp.width; canvas.height = vp.height;
            await page.render({canvasContext: canvas.getContext('2d'), viewport: vp}).promise;
            wrapper.appendChild(canvas);
            container.appendChild(wrapper);
        }
    } catch (err) { alert("Erro: " + err.message); }
};

// SALVAR PDF
async function savePDF() {
    if(!pdfBytes || !sigPreview.src) return alert("Falta o PDF ou a Assinatura!");
    
    const doc = await PDFDocument.load(pdfBytes);
    const sigImg = await doc.embedPng(sigPreview.src);
    const pages = shouldDuplicate ? doc.getPages() : [doc.getPages()[0]];
    
    // Pega a primeira folha para referência de escala
    const firstPageWrapper = container.querySelector('.page-wrapper');
    const rect = firstPageWrapper.getBoundingClientRect();
    
    // Calcula posição relativa ao container de rolagem
    const dRect = draggable.getBoundingClientRect();
    const wRect = firstPageWrapper.getBoundingClientRect();
    
    const relX = (dRect.left - wRect.left + (dRect.width / 2)) / wRect.width;
    const relY = (dRect.top - wRect.top + (dRect.height / 2)) / wRect.height;
    const relW = dRect.width / wRect.width;
    const relH = dRect.height / wRect.height;

    pages.forEach(page => {
        const { width, height } = page.getSize();
        const finalW = width * relW;
        const finalH = height * relH;
        page.drawImage(sigImg, {
            x: (width * relX) - (finalW / 2),
            y: height - (height * relY) - (finalH / 2),
            width: finalW, height: finalH
        });
    });

    const bytes = await doc.save();
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([bytes], {type: 'application/pdf'}));
    link.download = "contrato_final.pdf"; link.click();
}
