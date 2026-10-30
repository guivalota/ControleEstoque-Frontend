import { FaixaEdicao, MAX_FAIXAS, notaDaEscala, validarFaixas } from './escala-faixas';

const f = (de: number | null, ate: number | null, nota: number | null): FaixaEdicao => ({ de, ate, nota });

describe('validarFaixas', () => {
  it('aceita uma escala contínua que começa em 0 e termina sem limite', () => {
    const r = validarFaixas([f(0, 5, 4), f(5, 6, 5), f(6, null, 6)]);
    expect(r.valida).toBeTrue();
    expect(r.geral).toEqual([]);
  });

  it('aceita uma única faixa [0, ∞)', () => {
    expect(validarFaixas([f(0, null, 10)]).valida).toBeTrue();
  });

  it('exige ao menos uma faixa', () => {
    const r = validarFaixas([]);
    expect(r.valida).toBeFalse();
    expect(r.geral[0]).toContain('ao menos uma faixa');
  });

  it('a primeira deve começar em 0', () => {
    const r = validarFaixas([f(1, null, 3)]);
    expect(r.porLinha[0].join(' ')).toContain('começar em 0');
  });

  it('detecta lacuna entre faixas', () => {
    const r = validarFaixas([f(0, 5, 4), f(6, null, 5)]);
    expect(r.valida).toBeFalse();
    expect(r.porLinha[1].join(' ')).toContain('Lacuna');
    expect(r.porLinha[0]).toEqual([]);
  });

  it('detecta sobreposição entre faixas', () => {
    const r = validarFaixas([f(0, 5, 4), f(4, null, 5)]);
    expect(r.porLinha[1].join(' ')).toContain('Sobreposição');
  });

  it('só a última pode ficar sem limite superior', () => {
    const r = validarFaixas([f(0, null, 4), f(5, null, 5)]);
    expect(r.porLinha[0].join(' ')).toContain('Só a última');
  });

  it('a última deve ficar sem limite superior', () => {
    const r = validarFaixas([f(0, 5, 4), f(5, 9, 5)]);
    expect(r.porLinha[1].join(' ')).toContain('última faixa deve ficar sem limite');
  });

  it('o término deve ser maior que o início', () => {
    const r = validarFaixas([f(0, 0, 4), f(0, null, 5)]);
    expect(r.porLinha[0].join(' ')).toContain('maior que o início');
  });

  it('nota de 0 a 10 e obrigatória; início obrigatório', () => {
    expect(validarFaixas([f(0, null, 11)]).porLinha[0].join(' ')).toContain('entre 0 e 10');
    expect(validarFaixas([f(0, null, -1)]).valida).toBeFalse();
    expect(validarFaixas([f(0, null, 0)]).valida).toBeTrue();
    expect(validarFaixas([f(0, null, 10)]).valida).toBeTrue();
    expect(validarFaixas([f(0, null, null)]).porLinha[0].join(' ')).toContain('Informe a nota');
    expect(validarFaixas([f(null, null, 1)]).porLinha[0].join(' ')).toContain('Informe o início');
  });

  it('limita a 100 faixas', () => {
    const faixas = Array.from({ length: MAX_FAIXAS + 1 }, (_, i) => f(i, i === MAX_FAIXAS ? null : i + 1, 1));
    expect(validarFaixas(faixas).geral.join(' ')).toContain('No máximo 100');
  });
});

describe('notaDaEscala', () => {
  const vf = [f(0, 5, 4), f(5, 6, 5), f(6, null, 6)];

  it('usa faixas semiabertas [de, ate): o limite inferior entra, o superior não', () => {
    expect(notaDaEscala(vf, 0)).toBe(4);
    expect(notaDaEscala(vf, 4.99)).toBe(4);
    expect(notaDaEscala(vf, 5)).toBe(5);
    expect(notaDaEscala(vf, 6)).toBe(6);
    expect(notaDaEscala(vf, 15)).toBe(6);
  });

  it('valor negativo conta como 0', () => {
    expect(notaDaEscala(vf, -3)).toBe(4);
  });

  it('sem faixa que contenha o valor devolve null', () => {
    expect(notaDaEscala([f(1, null, 3)], 0)).toBeNull();
  });
});
