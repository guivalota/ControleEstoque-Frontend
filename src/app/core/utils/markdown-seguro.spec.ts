import { renderizarMarkdown } from './markdown-seguro';

describe('renderizarMarkdown', () => {
  it('renderiza negrito e listas', () => {
    const html = renderizarMarkdown('- **Base** = a − b\n- outra');
    expect(html).toContain('<strong>Base</strong>');
    expect(html).toContain('<li>');
  });

  it('não deixa HTML cru passar', () => {
    const html = renderizarMarkdown('oi <script>alert(1)</script> <img src=x onerror=alert(1)>');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('<img');
  });

  it('vazio devolve string vazia', () => {
    expect(renderizarMarkdown(null)).toBe('');
  });
});
