import { jsPDF } from 'jspdf';
import logoSpasso from '@/assets/logo-spasso-pdf.png?inline';
import {
  buildDreLines,
  readDreHeader,
  formatBrl,
  dreSign,
  dreAbs,
  commodityLabelPt,
  formatDateBrDre,
} from '@/lib/dre';

function getDateStr(): string {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  requestAnimationFrame(() => {
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
}

export interface DrePdfOptions {
  outputs: Record<string, unknown> | null | undefined;
  warehouseName?: string | null;
  /** Sufixo do arquivo. */
  fileTag?: string;
}

/**
 * Gera o DRE diretamente no jsPDF. Não depende de um relatório montado no DOM,
 * iframe, carregamento de imagem ou html2canvas; por isso funciona igualmente
 * para o resultado visível da simulação e para outputs_json de uma linha.
 */
export async function exportDrePdf({ outputs, warehouseName, fileTag }: DrePdfOptions) {
  try {
    const lines = buildDreLines(outputs);
    if (lines.length === 0) throw new Error('Sem resultado para exportar.');

    const head = readDreHeader(outputs);
    const now = new Date();
    const displayDate = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 36;
    const contentWidth = pageWidth - margin * 2;

    pdf.setFillColor(255, 255, 255);
    pdf.rect(0, 0, pageWidth, pageHeight, 'F');
    pdf.addImage(logoSpasso, 'PNG', margin, 34, 94, 35);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(16);
    pdf.setTextColor(17, 24, 39);
    pdf.text('SIMULAÇÃO DE PRECIFICAÇÃO', pageWidth / 2, 55, { align: 'center' });
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(107, 114, 128);
    pdf.text(displayDate, pageWidth - margin, 55, { align: 'right' });
    pdf.setDrawColor(229, 231, 235);
    pdf.setLineWidth(2);
    pdf.line(margin, 82, pageWidth - margin, 82);

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
    const metaGap = 8;
    const metaWidth = (contentWidth - metaGap * 2) / 3;
    const metaHeight = 38;
    const metaTop = 98;

    metaItems.forEach(([label, value], index) => {
      const col = index % 3;
      const row = Math.floor(index / 3);
      const x = margin + col * (metaWidth + metaGap);
      const y = metaTop + row * (metaHeight + metaGap);
      pdf.setFillColor(248, 250, 252);
      pdf.setDrawColor(238, 242, 247);
      pdf.roundedRect(x, y, metaWidth, metaHeight, 4, 4, 'FD');
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(7);
      pdf.setTextColor(148, 163, 184);
      pdf.text(label.toUpperCase(), x + 8, y + 12);
      pdf.setFontSize(10);
      pdf.setTextColor(17, 24, 39);
      const fittedValue = pdf.splitTextToSize(value, metaWidth - 16)[0] ?? '-';
      pdf.text(fittedValue, x + 8, y + 28);
    });

    const metaRows = Math.ceil(metaItems.length / 3);
    let y = metaTop + metaRows * (metaHeight + metaGap) + 8;
    const rowHeight = 31;

    lines.forEach((line, index) => {
      const isTotal = line.kind === 'total';
      const isSubtotal = line.kind === 'subtotal';
      if (isTotal) {
        pdf.setFillColor(22, 163, 74);
      } else if (isSubtotal) {
        pdf.setFillColor(248, 250, 252);
      } else {
        pdf.setFillColor(255, 255, 255);
      }
      pdf.setDrawColor(229, 231, 235);
      pdf.rect(margin, y, contentWidth, rowHeight, index === 0 ? 'FD' : 'F');
      pdf.line(margin, y + rowHeight, pageWidth - margin, y + rowHeight);

      pdf.setFont('helvetica', isTotal || isSubtotal ? 'bold' : 'normal');
      pdf.setFontSize(isTotal ? 12 : 10);
      pdf.setTextColor(
        ...(isTotal ? ([255, 255, 255] as const) : line.kind === 'cost' ? ([100, 116, 139] as const) : ([31, 41, 55] as const)),
      );
      const labelX = margin + 12 + (line.kind === 'cost' ? 12 : 0);
      pdf.text(line.label, labelX, y + 20);
      if (line.hint) {
        const labelWidth = pdf.getTextWidth(line.label);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(8);
        pdf.setTextColor(isTotal ? 255 : 148, isTotal ? 255 : 163, isTotal ? 255 : 184);
        pdf.text(`(${line.hint})`, labelX + labelWidth + 6, y + 20);
      }

      pdf.setFont('helvetica', isTotal ? 'bold' : 'normal');
      pdf.setFontSize(isTotal ? 12 : 10);
      pdf.setTextColor(...(isTotal ? ([255, 255, 255] as const) : ([31, 41, 55] as const)));
      const value = `${dreSign(line.kind, line.value)} R$ ${formatBrl(dreAbs(line.value))}`;
      pdf.text(value, pageWidth - margin - 12, y + 20, { align: 'right' });
      y += rowHeight;
    });

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(156, 163, 175);
    pdf.text('Documento gerado pela plataforma Spasso - valores em R$/saca.', pageWidth - margin, y + 24, { align: 'right' });

    const tag = (fileTag ?? head.ticker ?? 'simulacao').toString().replace(/[^\w-]+/g, '_');
    downloadBlob(pdf.output('blob'), `simulacao_${tag}_${getDateStr()}.pdf`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Falha ao gerar PDF: ${message}`);
  }
}