import { ImobCampoCustomizado } from '../models/imob-campo-customizado.model';
import { camposDaCategoria, erroDoValorCampo, formatarValorCampo, valorParaEdicao } from './campo-customizado';

const campo = (extra: Partial<ImobCampoCustomizado> = {}): ImobCampoCustomizado => ({
  id: 1, nome: 'Cor', tipo: 'texto', obrigatorio: false, opcoes: [], categoriaId: null, ativo: true, ordem: 0, bensComValor: 0, ...extra
});

describe('campo-customizado', () => {
  describe('camposDaCategoria', () => {
    it('traz os ativos sem categoria e os da categoria escolhida', () => {
      const todos = [
        campo({ id: 1 }), campo({ id: 2, categoriaId: 7 }), campo({ id: 3, categoriaId: 8 }), campo({ id: 4, ativo: false })
      ];
      expect(camposDaCategoria(todos, 7).map(c => c.id)).toEqual([1, 2]);
      expect(camposDaCategoria(todos, null).map(c => c.id)).toEqual([1]);
    });
  });

  describe('formatarValorCampo', () => {
    it('data vira dd/MM/aaaa, número usa vírgula, texto e lista ficam como estão', () => {
      expect(formatarValorCampo('data', '2026-03-10')).toBe('10/03/2026');
      expect(formatarValorCampo('numero', '1234.5')).toBe('1.234,5');
      expect(formatarValorCampo('numero', '12.5')).toBe('12,5');
      expect(formatarValorCampo('texto', 'Azul')).toBe('Azul');
      expect(formatarValorCampo('lista', 'Usado')).toBe('Usado');
    });

    it('vazio mostra traço e valor que não bate com o tipo volta como veio', () => {
      expect(formatarValorCampo('texto', '')).toBe('—');
      expect(formatarValorCampo('texto', null)).toBe('—');
      expect(formatarValorCampo('data', 'lixo')).toBe('lixo');
      expect(formatarValorCampo('numero', 'abc')).toBe('abc');
    });
  });

  describe('valorParaEdicao', () => {
    it('número vai com vírgula; o resto como está', () => {
      expect(valorParaEdicao('numero', '12.5')).toBe('12,5');
      expect(valorParaEdicao('data', '2026-03-10')).toBe('2026-03-10');
      expect(valorParaEdicao('texto', null)).toBe('');
    });
  });

  describe('erroDoValorCampo', () => {
    it('vazio nunca é erro (obrigatoriedade é outra regra)', () => {
      expect(erroDoValorCampo(campo({ tipo: 'numero' }), '  ')).toBeNull();
      expect(erroDoValorCampo(campo({ tipo: 'data' }), null)).toBeNull();
    });

    it('número aceita ponto e vírgula e milhar; recusa letras', () => {
      const n = campo({ tipo: 'numero' });
      for (const ok of ['12', '12,5', '12.5', '1.234,56', '-3,5']) expect(erroDoValorCampo(n, ok)).withContext(ok).toBeNull();
      for (const ruim of ['abc', '12x', '1,2,3']) expect(erroDoValorCampo(n, ruim)).withContext(ruim).toContain('número');
    });

    it('data aceita aaaa-MM-dd e dd/MM/aaaa', () => {
      const d = campo({ tipo: 'data' });
      expect(erroDoValorCampo(d, '2026-03-10')).toBeNull();
      expect(erroDoValorCampo(d, '10/03/2026')).toBeNull();
      expect(erroDoValorCampo(d, 'ontem')).toContain('data');
    });

    it('lista só aceita opção (sem diferenciar caixa) e texto limita 500', () => {
      const l = campo({ tipo: 'lista', opcoes: ['Novo', 'Usado'] });
      expect(erroDoValorCampo(l, 'usado')).toBeNull();
      expect(erroDoValorCampo(l, 'Quebrado')).toContain('opções');
      expect(erroDoValorCampo(campo(), 'x'.repeat(501))).toContain('500');
    });
  });
});
