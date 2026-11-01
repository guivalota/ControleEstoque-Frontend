import {
  cruzarComCadastro, erroInventarioEmAndamento, parsearDePara, validarDePara
} from './renovacao-etiquetas';

describe('renovacao-etiquetas', () => {
  it('lê ; , e tab, com/sem cabeçalho, ignorando vazias e fazendo trim', () => {
    const p = parsearDePara('﻿antiga;nova\r\n 1001 ; A-1 \n\n1002,A-2\n"1003"\tA-3');
    expect(p.map(x => [x.linha, x.antiga, x.nova])).toEqual([[2, '1001', 'A-1'], [4, '1002', 'A-2'], [5, '1003', 'A-3']]);
    expect(parsearDePara('1001;A-1').length).toBe(1);
  });

  it('detecta erros locais e bloqueia', () => {
    const v = validarDePara(parsearDePara(`1;A\n1;B\n2;A\n3;3\n4;\n${'x'.repeat(51)};Z`));
    expect(v.antigasRepetidas).toBe(2);
    expect(v.novasRepetidas).toBe(2);
    expect(v.iguais).toBe(1);
    expect(v.vazias).toBe(1);
    expect(v.excesso).toBe(1);
    expect(v.bloqueado).toBeTrue();
  });

  it('arquivo válido não bloqueia; vazio bloqueia; >5000 avisa', () => {
    expect(validarDePara(parsearDePara('1;A\n2;B')).bloqueado).toBeFalse();
    expect(validarDePara([]).bloqueado).toBeTrue();
    const muitos = Array.from({ length: 5001 }, (_, i) => `${i};N${i}`).join('\n');
    expect(validarDePara(parsearDePara(muitos)).excedeLimite).toBeTrue();
  });

  it('cruza com o cadastro', () => {
    const pares = parsearDePara('1;A\n2;B\n3;C\n4;D\n5;E');
    const r = cruzarComCadastro(pares, [
      { plaqueta: '1' }, { plaqueta: 'B', plaquetaAnterior: '2' }, { plaqueta: '3' }, { plaqueta: 'C' }, { plaqueta: 'Z', plaquetaAnterior: '5' }
    ]);
    expect([...r.porLinha.values()]).toEqual(['ok', 'ja_aplicado', 'nova_em_uso', 'antiga_nao_encontrada', 'antiga_ja_substituida']);
  });

  it('reconhece a mensagem de inventário em andamento', () => {
    expect(erroInventarioEmAndamento('Há inventário em andamento nesta empresa.')).toBeTrue();
    expect(erroInventarioEmAndamento('Antiga não encontrada')).toBeFalse();
  });
});
