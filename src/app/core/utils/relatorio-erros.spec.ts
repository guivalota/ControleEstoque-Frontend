import { relatorioErrosCsv } from './relatorio-erros';

describe('relatorioErrosCsv', () => {
  it('gera CSV com BOM, cabeçalho e linhas separadas por ;', async () => {
    const blob = relatorioErrosCsv([
      { linha: 12, plaqueta: '6369', campo: 'categoria', mensagem: 'Categoria não encontrada.' },
      { linha: 40, plaqueta: null, campo: 'linha', mensagem: 'Colunas a mais.' }
    ]);
    const texto = await blob.text();
    // o decodificador remove o BOM do texto; confere os bytes EF BB BF
    expect(Array.from(new Uint8Array(await blob.slice(0, 3).arrayBuffer()))).toEqual([0xEF, 0xBB, 0xBF]);
    expect(texto.split('\r\n')).toEqual([
      'linha;plaqueta;campo;mensagem',
      '12;6369;categoria;Categoria não encontrada.',
      '40;;linha;Colunas a mais.',
      ''
    ]);
  });

  it('protege ponto e vírgula, aspas e quebras de linha', async () => {
    const texto = await relatorioErrosCsv([{ linha: 1, plaqueta: 'A;1', campo: 'descricao', mensagem: 'Tem "aspas"\ne quebra' }]).text();
    expect(texto).toContain('"A;1";descricao;"Tem ""aspas""\ne quebra"');
  });
});
