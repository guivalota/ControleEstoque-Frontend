import { fimDoDiaLocalISO, inicioDoDiaLocalISO, intervaloInvertido } from './periodo';

describe('periodo (filtros de data no fuso do navegador)', () => {
  it('início e fim do dia são instantes do dia local', () => {
    const ini = new Date(inicioDoDiaLocalISO('2026-10-26')!);
    const fim = new Date(fimDoDiaLocalISO('2026-10-26')!);
    expect([ini.getFullYear(), ini.getMonth(), ini.getDate(), ini.getHours(), ini.getMinutes()]).toEqual([2026, 9, 26, 0, 0]);
    expect([fim.getDate(), fim.getHours(), fim.getMinutes(), fim.getSeconds()]).toEqual([26, 23, 59, 59]);
  });

  it('o resultado é ISO com hora explícita (Z)', () => {
    expect(inicioDoDiaLocalISO('2026-10-26')).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(fimDoDiaLocalISO('2026-10-26')).toMatch(/T.*Z$/);
  });

  it('vazio ou inválido não envia nada', () => {
    expect(inicioDoDiaLocalISO('')).toBeUndefined();
    expect(fimDoDiaLocalISO(undefined)).toBeUndefined();
    expect(fimDoDiaLocalISO('26/10/2026')).toBeUndefined();
  });

  it('detecta intervalo invertido', () => {
    expect(intervaloInvertido('2026-10-27', '2026-10-26')).toBeTrue();
    expect(intervaloInvertido('2026-10-26', '2026-10-26')).toBeFalse();
    expect(intervaloInvertido('', '2026-10-26')).toBeFalse();
  });
});
