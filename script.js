const { PDFDocument } = PDFLib;
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';

let pdfBytes, pdfDocJs, pad = null;
let pctX = 0, pctY = 0, shouldDuplicate = false;

const sigModal = document.getElementById('sig-modal'), sigCanvas = document.getElementById('sig-canvas');
const container = document.getElementById('pdf-main-container');

// Elemento da assinatura
const draggable = document.createElement('div');
draggable.id = 'draggable-sig';
draggable.innerHTML = `
    <button id="btn-duplicate" type="button"><svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M13 0H6a2 2 0 0 0-2 2 2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h7a2 2 0 0 0 2-2 2 2 0 0 0 2-2V2a2 2 0 0 0-2-2zM6 1h7a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1z"/></svg></button>
    <img id="sig-preview" style="width:100%; height:100%; pointer-events:none; object-fit:contain;">
    <div id="resizer"></div>`;

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

window.addEventListener("resize", () => { if (sigModal.style.display === 'flex') setupCanvas(); });

// FUNÇÃO CONFIRMAR REESCRITA (CORREÇÃO CHROME/FIREFOX)
document.getElementById('btn-confirm-sig').onclick = function(e) {
    e.preventDefault();
    if (!pad || pad.isEmpty()) {
        alert("Assine antes de confirmar!");
        return;
    }

    try {
        const dataUrl = pad.toDataURL();
        document.getElementById('sig-preview').src = dataUrl;

        // Procura a primeira página renderizada
        const firstPage = container.querySelector('.page-wrapper');
        
        if (!firstPage) {
            alert("Erro: O PDF ainda não foi carregado na tela.");
            return;
        }

        // Adiciona a assinatura na tela
        firstPage.appendChild(draggable);
        draggable.style.display = 'block';
        draggable.style.left = "50px"; 
        draggable.style.top = "50px";

        // Fecha o modal
        sigModal.style.display = 'none';
        console.log("Assinatura aplicada com sucesso.");
    } catch (err) {
        alert("Erro ao confirmar: " + err.message);
    }
};

function closeModal() { sigModal.style.display = 'none'; }

// Botão Duplicar
draggable.querySelector('#btn-duplicate').onclick = function(e) {
    e.stopPropagation();
    shouldDuplicate = !shouldDuplicate;
    this.style.background = shouldDuplicate ? "#27ae60" : "#2980b9";
};

// Arraste e Redimensionamento
let isResizing = false;
draggable.addEventListener("touchstart", (e) => { isResizing = (e.target.id === 'resizer'); });

draggable.addEventListener("touchmove", (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    const wrapper = draggable.parentElement;
    if(!wrapper) return;
    const rect = wrapper.getBoundingClientRect();

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
    pctX = (parseInt(draggable.style.left) + (draggable.offsetWidth / 2)) / rect.width;
    pctY = (parseInt(draggable.style.top) + (draggable.offsetHeight / 2)) / rect.height;
}, { passive: false });

// Abrir PDF
document.getElementById('file-in').onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
        pdfBytes = await file.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({data: pdfBytes});
        pdfDocJs = await loadingTask.promise;
        container.innerHTML = "";
        
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
    } catch (err) {
        alert("Erro no PDF: " + err.message);
    }
};

async function savePDF() {
    if(!pdfBytes || !document.getElementById('sig-preview').src) return alert("Assine primeiro!");
    const doc = await PDFDocument.load(pdfBytes);
    const sigImg = await doc.embedPng(document.getElementById('sig-preview').src);
    const allPages = doc.getPages();
    const pagesToSign = shouldDuplicate ? allPages : [allPages[0]];
    const refRect = document.querySelector('.page-wrapper').getBoundingClientRect();
    const relW = draggable.offsetWidth / refRect.width, relH = draggable.offsetHeight / refRect.height;

    pagesToSign.forEach(page => {
        const { width, height } = page.getSize();
        const finalW = width * relW, finalH = height * relH;
        page.drawImage(sigImg, {
            x: (width * pctX) - (finalW / 2),
            y: height - (height * pctY) - (finalH / 2),
            width: finalW, height: finalH
        });
    });
    const bytes = await doc.save();
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([bytes], {type: 'application/pdf'}));
    link.download = "contrato_assinado.pdf"; link.click();
}
