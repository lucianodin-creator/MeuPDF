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
    // Começa no topo do PDF para facilitar o início do arraste
    draggable.style.left = "0px";
    draggable.style.top = "0px";
    draggable.style.transform = "none"; 
    sigModal.style.display = 'none';
}

// ARRASTE ULTRA-PRECISO PARA CELULAR
draggable.addEventListener("touchmove", (e) => {
    e.preventDefault(); // Impede a tela de rolar junto
    const touch = e.touches[0];
    const wrapper = document.getElementById('pdf-wrapper');
    const rect = wrapper.getBoundingClientRect();

    // Calcula a posição ignorando o scroll da página (PageX/Y)
    // Centraliza o quadro no seu dedo
    let x = touch.pageX - (rect.left + window.scrollX) - (draggable.offsetWidth / 2);
    let y = touch.pageY - (rect.top + window.scrollY) - (draggable.offsetHeight / 2);

    // Trava para não sair das bordas da folha
    x = Math.max(0, Math.min(x, rect.width - draggable.offsetWidth));
    y = Math.max(0, Math.min(y, rect.height - draggable.offsetHeight));

    // Move a janela fisicamente
    draggable.style.left = x + "px";
    draggable.style.top = y + "px";

    // Guarda a posição para o PDF final (em porcentagem)
    pctX = (x + (draggable.offsetWidth / 2)) / rect.width;
    pctY = (y + (draggable.offsetHeight / 2)) / rect.height;
}, { passive: false });

async function savePDF() {
    if (!pdfBytes) return;
    const doc = await PDFDocument.load(pdfBytes);
    const page = doc.getPages()[0];
    const { width, height } = page.getSize();
    const sigImg = await doc.embedPng(document.getElementById('sig-preview').src);

    const sigW = 150; 
    const sigH = (sigImg.height / sigImg.width) * sigW;

    // A mágica da inversão do eixo Y (conforme sua análise)
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
