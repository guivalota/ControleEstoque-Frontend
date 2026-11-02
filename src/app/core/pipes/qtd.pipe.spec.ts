import { formatarQuantidade, QtdPipe, stepDaUnidade } from './qtd.pipe';

describe('QtdPipe / formatarQuantidade', () => {
  it('mostra inteiros sem casas', () => {
    expect(formatarQuantidade(12)).toBe('12');
    expect(formatarQuantidade('12.000')).toBe('12');
  });

  it('usa vírgula e corta zeros à direita', () => {
    expect(formatarQuantidade(12.35)).toBe('12,35');
    expect(formatarQuantidade(0.5)).toBe('0,5');
    expect(formatarQuantidade('70.250')).toBe('70,25');
  });

  it('arredonda além de 3 casas', () => {
    expect(formatarQuantidade(1.23456)).toBe('1,235');
  });

  it('agrupa milhares', () => {
    expect(formatarQuantidade(1234567.5)).toBe('1.234.567,5');
  });

  it('trata vazio, nulo e lixo', () => {
    expect(formatarQuantidade(null)).toBe('');
    expect(formatarQuantidade(undefined)).toBe('');
    expect(formatarQuantidade('')).toBe('');
    expect(formatarQuantidade('abc')).toBe('');
    expect(formatarQuantidade(0)).toBe('0');
  });

  it('o pipe delega para a função', () => {
    expect(new QtdPipe().transform(3.5)).toBe('3,5');
  });
});

describe('stepDaUnidade', () => {
  it('0 casas é inteiro', () => expect(stepDaUnidade(0)).toBe('1'));
  it('1 a 3 casas', () => {
    expect(stepDaUnidade(1)).toBe('0.1');
    expect(stepDaUnidade(2)).toBe('0.01');
    expect(stepDaUnidade(3)).toBe('0.001');
  });
  it('limita a 3 casas', () => expect(stepDaUnidade(7)).toBe('0.001'));
  it('sem unidade conhecida aceita qualquer valor', () => {
    expect(stepDaUnidade(null)).toBe('any');
    expect(stepDaUnidade(undefined)).toBe('any');
  });
});
