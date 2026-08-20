import {
  buildDreLines,
  readDreHeader,
  formatBrl,
  dreSign,
  dreAbs,
  commodityLabelPt,
  formatDateBrDre,
} from '@/lib/dre';

/**
 * PDF do DRE. Mesmo mecanismo do export da Tabela de Preços
 * (iframe + html2canvas), com a imagem final embutida em um PDF.
 */

function getDateStr(): string {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

export interface DrePdfOptions {
  outputs: Record<string, unknown> | null | undefined;
  warehouseName?: string | null;
  /** Sufixo do arquivo. */
  fileTag?: string;
}

export async function exportDrePdf({ outputs, warehouseName, fileTag }: DrePdfOptions) {
  const lines = buildDreLines(outputs);
  if (lines.length === 0) throw new Error('Sem resultado para exportar.');
  const head = readDreHeader(outputs);

  const now = new Date();
  const dateStr = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
  const logoUrl = `${window.location.origin}/logo-spasso.png`;

  const metaItems: [string, string][] = [
    ['Praça', warehouseName ?? head.warehouse ?? '—'],
    ['Commodity', commodityLabelPt(head.commodity)],
    ['Ticker', head.ticker ?? '-'],
    ['Data de negócio', formatDateBrDre(head.tradeDate)],
    ['Recepção do grão', formatDateBrDre(head.receptionDate)],
    ['Pagamento', formatDateBrDre(head.paymentDate)],
    ['Venda', formatDateBrDre(head.saleDate)],
    ...(head.futuresUsd != null ? ([['Futuros (US$)', head.futuresUsd.toFixed(4)]] as [string, string][]) : []),
    ...(head.exchangeRate != null ? ([['Câmbio', head.exchangeRate.toFixed(4)]] as [string, string][]) : []),
  ];

  const metaHtml = metaItems
    .map(([k, v]) => `<div class="meta-item"><span class="meta-k">${k}</span><span class="meta-v">${v}</span></div>`)
    .join('');

  const rowsHtml = lines
    .map((l) => {
      const cls =
        l.kind === 'total' ? 'row total' : l.kind === 'subtotal' ? 'row subtotal' : l.kind === 'cost' ? 'row cost' : 'row';
      const hint = l.hint ? ` <span class="hint">(${l.hint})</span>` : '';
      return `<div class="${cls}"><span class="label">${l.label}${hint}</span><span class="value">${dreSign(
        l.kind,
        l.value,
      )} R$ ${formatBrl(dreAbs(l.value))}</span></div>`;
    })
    .join('');

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    width: 1000px;
    font-family: -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    background: #ffffff; color: #1f2937; padding: 44px 48px;
  }
  .header { display: flex; align-items: center; justify-content: space-between; gap: 24px;
    padding-bottom: 20px; border-bottom: 3px solid #e5e7eb; margin-bottom: 24px; }
  .header .logo { height: 52px; object-fit: contain; }
  .header .title { flex: 1; text-align: center; font-size: 24px; font-weight: 800; color: #111827; letter-spacing: .5px; }
  .header .date { font-size: 15px; color: #6b7280; font-weight: 500; white-space: nowrap; }
  .meta { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px 20px; margin-bottom: 26px; }
  .meta-item { display: flex; flex-direction: column; background: #f8fafc; border: 1px solid #eef2f7; border-radius: 8px; padding: 8px 12px; }
  .meta-k { font-size: 11px; text-transform: uppercase; letter-spacing: .6px; color: #94a3b8; font-weight: 700; }
  .meta-v { font-size: 15px; color: #111827; font-weight: 600; }
  .dre { border: 1px solid #e5e7eb; border-radius: 10px; overflow: hidden; }
  .row { display: flex; justify-content: space-between; align-items: center;
    padding: 12px 18px; font-size: 16px; border-bottom: 1px solid #f1f5f9; }
  .row:last-child { border-bottom: none; }
  .row .value { font-variant-numeric: tabular-nums; font-weight: 600; }
  .row.cost .label { padding-left: 18px; color: #64748b; }
  .row.cost .value { color: #b91c1c; }
  .row.subtotal { background: #f8fafc; font-weight: 700; }
  .row.total { background: #16a34a; color: #ffffff; font-size: 19px; font-weight: 800; }
  .row.total .value { color: #ffffff; }
  .hint { font-size: 12px; color: #94a3b8; }
  .footer { margin-top: 22px; text-align: right; font-size: 12px; color: #9ca3af; }
</style></head><body>
  <div class="header">
    <img class="logo" src="${logoUrl}" alt="Grupo Spasso" crossorigin="anonymous" />
    <div class="title">SIMULAÇÃO DE PRECIFICAÇÃO — DRE</div>
    <div class="date">${dateStr}</div>
  </div>
  <div class="meta">${metaHtml}</div>
  <div class="dre">${rowsHtml}</div>
  <div class="footer">Documento gerado pela plataforma Spasso — valores em R$/saca.</div>
</body></html>`;

  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;left:-9999px;top:0;width:1000px;height:1px;border:none;';
  document.body.appendChild(iframe);

  try {
    const iframeDoc = iframe.contentDocument!;
    iframeDoc.open();
    iframeDoc.write(html);
    iframeDoc.close();

    await new Promise<void>((resolve) => {
      const img = iframeDoc.querySelector('img.logo') as HTMLImageElement | null;
      if (!img) { resolve(); return; }
      if (img.complete && img.naturalWidth > 0) { resolve(); return; }
      img.onload = () => resolve();
      img.onerror = () => resolve();
      setTimeout(() => resolve(), 2000);
    });

    const bodyEl = iframeDoc.body;
    iframe.style.height = `${bodyEl.scrollHeight}px`;
    await new Promise((r) => setTimeout(r, 100));

    const html2canvas = (await import('html2canvas')).default;
    const canvas = await html2canvas(bodyEl, {
      width: 1000,
      scale: 2,
      backgroundColor: '#ffffff',
      useCORS: true,
    });

    const { jsPDF } = await import('jspdf');
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const margin = 24;
    const maxW = pageW - margin * 2;
    const ratio = canvas.height / canvas.width;
    let renderW = maxW;
    let renderH = maxW * ratio;
    if (renderH > pageH - margin * 2) {
      renderH = pageH - margin * 2;
      renderW = renderH / ratio;
    }
    pdf.addImage(
      canvas.toDataURL('image/png'),
      'PNG',
      (pageW - renderW) / 2,
      margin,
      renderW,
      renderH,
    );
    const tag = (fileTag ?? head.ticker ?? 'simulacao').toString().replace(/[^\w-]+/g, '_');
    pdf.save(`dre_${tag}_${getDateStr()}.pdf`);
  } finally {
    document.body.removeChild(iframe);
  }
}
