import { Marked } from 'marked';

const escapar = (texto: string) => texto
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Instância própria: HTML cru dentro do markdown vira texto (o `[innerHTML]` ainda sanitiza a saída). */
const marked = new Marked({
  gfm: true,
  renderer: {
    html: ({ text }) => escapar(text)
  }
});

export function renderizarMarkdown(md: string | null | undefined): string {
  return md ? (marked.parse(md, { async: false }) as string) : '';
}
