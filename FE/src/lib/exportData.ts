/**
 * Shared CSV / PDF export helpers for the reporting screens.
 *
 * All three reports previously hand-rolled their own CSV escaping and inline
 * PDF stylesheet; this keeps the output format consistent and the pages short.
 */

export type ExportAlign = 'left' | 'right' | 'center';

export type ExportColumn = {
  header: string;
  align?: ExportAlign;
};

function escapeCsvCell(value: unknown): string {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // Give the browser a tick to start the download before releasing the URL.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadCsv(options: {
  filename: string;
  columns: Array<string | ExportColumn>;
  rows: Array<Array<string | number>>;
  /** Optional bold summary row appended at the bottom. */
  totalsRow?: Array<string | number>;
}) {
  const { filename, columns, rows, totalsRow } = options;
  const headers = columns.map((column) => (typeof column === 'string' ? column : column.header));

  const lines = [
    headers.map(escapeCsvCell).join(','),
    ...rows.map((row) => row.map(escapeCsvCell).join(',')),
  ];
  if (totalsRow) lines.push(totalsRow.map(escapeCsvCell).join(','));

  triggerDownload(new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' }), filename);
}

const PDF_STYLES = `
html, body { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: Arial, Helvetica, sans-serif; color: #1f2937; margin: 18px; }
.report { padding: 10px; background: #fff; }
.report-header { margin-bottom: 20px; border-bottom: 2px solid #e5e7eb; padding-bottom: 12px; }
.report-header h1 { margin: 0 0 6px; font-size: 20px; }
.report-header p { margin: 0; font-size: 12px; color: #6b7280; }
table { border-collapse: collapse; width: 100%; table-layout: auto; }
th, td { padding: 9px 12px; border: 1px solid #e5e7eb; vertical-align: middle; word-break: break-word; font-size: 12px; }
th { background: #f3f4f6; font-weight: 700; text-align: left; }
tfoot td { font-weight: 700; background: #f9fafb; }
.text-right { text-align: right; }
.text-center { text-align: center; }
`;

/**
 * Render a simple table to PDF via html2pdf. The library is imported lazily so
 * it stays out of the initial bundle.
 */
export async function downloadPdfTable(options: {
  filename: string;
  title: string;
  subtitle?: string;
  columns: Array<string | ExportColumn>;
  rows: Array<Array<string | number>>;
  totalsRow?: Array<string | number>;
}) {
  const { filename, title, subtitle, columns, rows, totalsRow } = options;

  const normalized = columns.map((column) =>
    typeof column === 'string' ? { header: column, align: 'left' as ExportAlign } : column
  );
  const alignClass = (align?: ExportAlign) =>
    align === 'right' ? ' class="text-right"' : align === 'center' ? ' class="text-center"' : '';

  const head = normalized
    .map((column) => `<th${alignClass(column.align)}>${column.header}</th>`)
    .join('');
  const body = rows
    .map(
      (row) =>
        `<tr>${row
          .map((cell, index) => `<td${alignClass(normalized[index]?.align)}>${cell}</td>`)
          .join('')}</tr>`
    )
    .join('');
  const foot = totalsRow
    ? `<tfoot><tr>${totalsRow
        .map((cell, index) => `<td${alignClass(normalized[index]?.align)}>${cell}</td>`)
        .join('')}</tr></tfoot>`
    : '';

  const html = `
    <div class="report">
      <div class="report-header">
        <h1>${title}</h1>
        ${subtitle ? `<p>${subtitle}</p>` : ''}
        <p>Generated ${new Date().toLocaleString('en-PH')}</p>
      </div>
      <table>
        <thead><tr>${head}</tr></thead>
        <tbody>${body}</tbody>
        ${foot}
      </table>
    </div>
  `;

  const container = document.createElement('div');
  container.style.background = '#fff';
  container.innerHTML = `<style>${PDF_STYLES}</style>${html}`;
  document.body.appendChild(container);

  try {
    const module = await import('html2pdf.js');
    const html2pdf = (module as any).default || module;
    await html2pdf()
      .from(container)
      .set({
        margin: 10,
        filename,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      })
      .save();
  } finally {
    document.body.removeChild(container);
  }
}
