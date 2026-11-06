import { dividirParcelas, hojeIso, mesAtual, primeiroDiaDoMes, somarMeses, ultimoDiaDoMes } from './financeiro-datas';

describe('financeiro-datas', () => {
  describe('somarMeses', () => {
    it('mantém o dia e usa o último dia nos meses curtos, sem acumular desvio', () => {
      expect(somarMeses('2026-01-31', 0)).toBe('2026-01-31');
      expect(somarMeses('2026-01-31', 1)).toBe('2026-02-28');
      expect(somarMeses('2026-01-31', 2)).toBe('2026-03-31');
      expect(somarMeses('2028-01-30', 1)).toBe('2028-02-29');
      expect(somarMeses('2026-05-15', 3)).toBe('2026-08-15');
    });

    it('vira o ano', () => {
      expect(somarMeses('2026-11-10', 2)).toBe('2027-01-10');
      expect(somarMeses('2026-12-31', 14)).toBe('2028-02-29');
    });

    it('devolve o texto original se não for uma data', () => {
      expect(somarMeses('', 1)).toBe('');
    });
  });

  describe('dividirParcelas', () => {
    it('divide igualmente e a última absorve os centavos', () => {
      expect(dividirParcelas(100, 3)).toEqual([33.33, 33.33, 33.34]);
      expect(dividirParcelas(90, 3)).toEqual([30, 30, 30]);
      expect(dividirParcelas(0.07, 7)).toEqual([0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01]);
    });

    it('a soma fecha exatamente no total', () => {
      for (const [total, n] of [[1000, 7], [99.99, 60], [10, 3], [1234.56, 12], [0.1, 3]] as const) {
        const parcelas = dividirParcelas(total, n);
        expect(parcelas.length).toBe(n);
        expect(Math.round(parcelas.reduce((a, b) => a + b, 0) * 100)).toBe(Math.round(total * 100));
      }
    });

    it('não divide quando o total é pequeno demais ou o número de parcelas é inválido', () => {
      expect(dividirParcelas(0.02, 3)).toEqual([]);
      expect(dividirParcelas(100, 0)).toEqual([]);
    });
  });

  it('hojeIso, mesAtual, primeiroDiaDoMes e ultimoDiaDoMes', () => {
    const d = new Date(2026, 1, 5);
    expect(hojeIso(d)).toBe('2026-02-05');
    expect(mesAtual(d)).toBe('2026-02');
    expect(primeiroDiaDoMes('2026-02-17')).toBe('2026-02-01');
    expect(ultimoDiaDoMes('2026-02')).toBe('2026-02-28');
    expect(ultimoDiaDoMes('2028-02')).toBe('2028-02-29');
    expect(ultimoDiaDoMes('2026-12')).toBe('2026-12-31');
  });
});
