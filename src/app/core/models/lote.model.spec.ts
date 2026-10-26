import { diasParaVencer, situacaoLote } from './lote.model';

describe('lote.model', () => {
  const hoje = '2026-10-24';

  it('calcula dias para vencer sem depender de fuso', () => {
    expect(diasParaVencer('2026-10-24', hoje)).toBe(0);
    expect(diasParaVencer('2026-11-23', hoje)).toBe(30);
    expect(diasParaVencer('2026-10-20', hoje)).toBe(-4);
    expect(diasParaVencer(null, hoje)).toBeNull();
  });

  it('classifica a situação da validade', () => {
    expect(situacaoLote(null, 30, hoje)).toBe('sem_validade');
    expect(situacaoLote('2026-10-23', 30, hoje)).toBe('vencido');
    expect(situacaoLote('2026-10-24', 30, hoje)).toBe('vencendo');
    expect(situacaoLote('2026-11-23', 30, hoje)).toBe('vencendo');
    expect(situacaoLote('2026-11-24', 30, hoje)).toBe('ok');
  });
});
