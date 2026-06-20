/**
 * CredGestor — Vendor Bundle (IIFE)
 * Importa todas as dependências que antes vinham via CDN
 * e as expõe como globais (window.*) para compatibilidade.
 *
 * Build: npx esbuild src/vendor.js --bundle --format=iife --outfile=dist-renderer/vendor.bundle.js
 */

// ── Chart.js ──
import { Chart, registerables } from 'chart.js';
Chart.register(...registerables);
window.Chart = Chart;

// ── Lucide Icons ──
import { createIcons, icons } from 'lucide';
// Wrapper: CDN version auto-detected icons, npm version requires explicit {icons}
const lucideCreateIcons = (opts = {}) => createIcons({ icons, ...opts });
window.lucide = { createIcons: lucideCreateIcons, icons, ...icons };

// ── SheetJS-compatible XLSX (patched fork; keeps window.XLSX API) ──
import * as XLSX from '@e965/xlsx';
window.XLSX = XLSX;

// ── jsPDF ──
import { jsPDF } from 'jspdf';
// CDN expõe como window.jspdf.jsPDF — manter compatibilidade
window.jspdf = { jsPDF };

// ── JSZip ──
import JSZip from 'jszip';
window.JSZip = JSZip;

// ── FileSaver ──
import { saveAs } from 'file-saver';
window.saveAs = saveAs;

console.log('[Vendor] Todas as dependências carregadas localmente (sem CDN).');
