import { gerarSequencia, lerListaPlaquetas, sugerirSequencia, validarPlaquetas } from './imob-replicacao';

describe('imob-replicacao', () => {
  describe('sugerirSequencia', () => {
    it('mantém prefixo e largura e começa no número seguinte', () => {
      expect(sugerirSequencia('CAD-007')).toEqual({ prefixo: 'CAD-', numeroInicial: 8, largura: 3 });
    });

    it('plaqueta só numérica não tem prefixo', () => {
      expect(sugerirSequencia('0099')).toEqual({ prefixo: '', numeroInicial: 100, largura: 4 });
    });

    it('plaqueta sem número vira prefixo com hífen', () => {
      expect(sugerirSequencia('MESA')).toEqual({ prefixo: 'MESA-', numeroInicial: 1, largura: 0 });
    });
  });

  describe('gerarSequencia', () => {
    it('aplica prefixo e zeros à esquerda', () => {
      expect(gerarSequencia({ prefixo: 'CAD-', numeroInicial: 8, largura: 4, quantidade: 3 }))
        .toEqual(['CAD-0008', 'CAD-0009', 'CAD-0010']);
    });

    it('sem largura usa só o número', () => {
      expect(gerarSequencia({ prefixo: '', numeroInicial: 99, largura: 0, quantidade: 2 })).toEqual(['99', '100']);
    });

    it('quantidade inválida gera lista vazia', () => {
      expect(gerarSequencia({ prefixo: 'A', numeroInicial: 1, largura: 0, quantidade: 0 })).toEqual([]);
    });
  });

  describe('lerListaPlaquetas', () => {
    it('separa por linha, vírgula e ponto e vírgula e ignora vazias', () => {
      expect(lerListaPlaquetas('A-1\n A-2 ,A-3;;\n\n')).toEqual(['A-1', 'A-2', 'A-3']);
    });
  });

  describe('validarPlaquetas', () => {
    it('aceita lista válida', () => {
      expect(validarPlaquetas(['A-1', 'A-2'])).toBeNull();
    });

    it('recusa vazia, repetida (sem diferenciar caixa), longa e acima de 500', () => {
      expect(validarPlaquetas([])).toContain('ao menos uma');
      expect(validarPlaquetas(['a-1', 'A-1'])).toContain('repetidas');
      expect(validarPlaquetas(['x'.repeat(51)])).toContain('50');
      expect(validarPlaquetas(Array.from({ length: 501 }, (_, i) => `P-${i}`))).toContain('500');
    });
  });
});
