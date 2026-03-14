const { PDFDocument } = PDFLib;
// Configuração vital do Worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';

let pdfData, pad;
const view = document.getElementById('main-view');
const drag = document.getElementById('sig-drag');
const res = document.getElementById('sig-res');
const tag = document.getElementById('sig-tag');

function showPad() {
    if (!view.hasChildNodes()) return alert("Abra um PDF primeiro.");
    document.getElementById('modal-sig').style.display = 'flex';
    const c = document.getElementById('canv');
    const ratio = window.devicePixelRatio || 1;
    c.width = c.offsetWidth * ratio;
    c.height = c.offsetHeight * ratio;
    c.getContext("2d").scale(ratio, ratio);
    pad = new SignaturePad(c);
}

function closePad() { document.getElementById('modal-sig').style.display = 'none'; }

function applySig() {
    if (pad.isEmpty()) return alert("Assine primeiro.");
    res.src = pad.toDataURL();
    drag.style.display = 'block';
    const p1 = view.querySelector('.page-box');
    if (p1) {
        p1.appendChild(drag);
        drag.style.left = "10px";
        drag.style.top = "10px";
    }
    closePad();
}

tag.onclick = function(e) {
    e.stopPropagation();
    const isAll = this.innerText.includes("TODAS");
    this.innerText = isAll ? "PÁGINA: ÚNICA" : "PÁGINA: TODAS";
    this.style.background = isAll ? "#f39c12" : "#2ecc71";
};

drag.addEventListener("touchmove", (e) => {
    e.preventDefault();
    const r = drag.parentElement.getBoundingClientRect();
    const t = e.touches[0];
    drag.style.left = (t.clientX - r.left - 75) + "px";
    drag.style.top = (t.clientY - r.top - 30) + "px";
}, { passive: false });

document.getElementById('pdf-file').onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
        pdfData = await file.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({data: pdfData});
        const pdf = await loadingTask.promise;
        view.innerHTML = "";
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const div = document.createElement('div');
            div.className = 'page-box';
            const c = document.createElement('canvas');
            const vp = page.getViewport({scale: (view.clientWidth * 0.9) / page.getViewport({scale:1}).width});
            c.width = vp.width; c.height = vp.height;
            await page.render({canvasContext: c.getContext('2d'), viewport: vp}).promise;
            div.appendChild(c);
            view.appendChild(div);
        }
    } catch (err) {
        alert("Erro ao carregar PDF: " + err.message);
    }
};

async function savePdf() {
    if (!pdfData || !res.src) return alert("Faltam dados.");
    const doc = await PDFDocument.load(pdfData);
    const img = await doc.embedPng(res.src);
    const pages = doc.getPages();
    const p1 = view.querySelector('.page-box');
    
    const rx = parseFloat(drag.style.left) / p1.offsetWidth;
    const ry = parseFloat(drag.style.top) / p1.offsetHeight;
    const rw = drag.offsetWidth / p1.offsetWidth;
    const rh = drag.offsetHeight / p1.offsetHeight;

    const count = tag.innerText.includes("TODAS") ? pages.length : 1;
    for (let i = 0; i < count; i++) {
        const p = pages[i];
        const { width, height } = p.getSize();
        p.drawImage(img, {
            x: width * rx, y: height - (height * ry) - (height * rh),
            width: width * rw, height: height * rh
        });
    }
    const b = await doc.save();
    const l = document.createElement('a');
    l.href = URL.createObjectURL(new Blob([b], {type: 'application/pdf'}));
    l.download = "meupdf_final.pdf";
    l.click();
}
