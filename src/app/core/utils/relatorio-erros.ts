import { ErroImportacao } from '../models/imob-importacao.model';

const celula = (v: string | number | null | undefined) => {
  const t = String(v ?? '');
  return /[";\r\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
};

/** CSV (`;`, UTF-8 com BOM para o Excel) com os erros de importação, gerado no navegador. */
export function relatorioErrosCsv(erros: ErroImportacao[]): Blob {
  const linhas = ['linha;plaqueta;campo;mensagem',
    ...erros.map(e => [e.linha, e.plaqueta, e.campo, e.mensagem].map(celula).join(';'))];
  return new Blob(['\uFEFF' + linhas.join('\r\n') + '\r\n'], { type: 'text/csv;charset=utf-8' });
}
