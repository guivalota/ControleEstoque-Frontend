import { agruparHistorico, formatarValorHistorico, nomeUsuarioHistorico, rotuloCampoHistorico } from './historico-formato';
import { ImobBemHistorico } from '../models/imob-bem.model';

const entrada = (id: number, extra: Partial<ImobBemHistorico> = {}): ImobBemHistorico => ({
  id, campo: 'descricao', valorAnterior: 'a', valorNovo: 'b', usuarioId: 'u-1', usuarioNome: 'Maria',
  criadoEm: '2026-10-22T14:03:11Z', ...extra
});

describe('rotuloCampoHistorico', () => {
  it('traduz os campos conhecidos', () => {
    expect(rotuloCampoHistorico('local_id')).toBe('Local');
    expect(rotuloCampoHistorico('categoria_id')).toBe('Categoria');
    expect(rotuloCampoHistorico('responsavel_id')).toBe('Responsável');
    expect(rotuloCampoHistorico('valor_aquisicao')).toBe('Valor de aquisição');
    expect(rotuloCampoHistorico('valor_residual')).toBe('Valor residual');
    expect(rotuloCampoHistorico('vida_util_meses')).toBe('Vida útil (meses)');
    expect(rotuloCampoHistorico('numero_serie')).toBe('Nº de série');
    expect(rotuloCampoHistorico('numero_documento_aquisicao')).toBe('Documento de aquisição');
    expect(rotuloCampoHistorico('fornecedor_nome')).toBe('Fornecedor');
    expect(rotuloCampoHistorico('data_aquisicao')).toBe('Data de aquisição');
    expect(rotuloCampoHistorico('observacao')).toBe('Observação');
    expect(rotuloCampoHistorico('plaqueta')).toBe('Plaqueta');
    expect(rotuloCampoHistorico('descricao')).toBe('Descrição');
  });

  it('campos desconhecidos (ex.: status futuro) viram texto legível', () => {
    expect(rotuloCampoHistorico('status')).toBe('Status');
    expect(rotuloCampoHistorico('centro_de_custo')).toBe('Centro de custo');
    expect(rotuloCampoHistorico('')).toBe('—');
  });
});

describe('formatarValorHistorico', () => {
  it('null, undefined e vazio viram "—"', () => {
    expect(formatarValorHistorico('descricao', null)).toBe('—');
    expect(formatarValorHistorico('descricao', undefined)).toBe('—');
    expect(formatarValorHistorico('descricao', '  ')).toBe('—');
    expect(formatarValorHistorico('local_id', null, null)).toBe('—');
  });

  it('referências usam o nome e caem para #id sem descrição', () => {
    expect(formatarValorHistorico('local_id', '7', 'Sala 101')).toBe('Sala 101');
    expect(formatarValorHistorico('responsavel_id', '12', 'Ana Souza')).toBe('Ana Souza');
    expect(formatarValorHistorico('categoria_id', '3', null)).toBe('#3');
    expect(formatarValorHistorico('local_id', '9', '  ')).toBe('#9');
  });

  it('valores monetários em BRL', () => {
    expect(formatarValorHistorico('valor_aquisicao', '1500.00').replace(/\s/g, ' ')).toBe('R$ 1.500,00');
    expect(formatarValorHistorico('valor_residual', '0.5').replace(/\s/g, ' ')).toBe('R$ 0,50');
    expect(formatarValorHistorico('valor_residual', 'abc')).toBe('abc');
  });

  it('datas em dd/MM/yyyy', () => {
    expect(formatarValorHistorico('data_aquisicao', '2024-03-10')).toBe('10/03/2024');
  });

  it('texto e inteiros passam como vieram', () => {
    expect(formatarValorHistorico('descricao', 'Notebook Dell')).toBe('Notebook Dell');
    expect(formatarValorHistorico('vida_util_meses', '60')).toBe('60');
    expect(formatarValorHistorico('plaqueta', 'NB-0001')).toBe('NB-0001');
  });

  it('só trata como descrição os campos de referência', () => {
    expect(formatarValorHistorico('descricao', 'x', 'ignorada')).toBe('x');
  });
});

describe('nomeUsuarioHistorico', () => {
  it('usa o nome; sem nome, o id abreviado', () => {
    expect(nomeUsuarioHistorico({ usuarioId: 'abc', usuarioNome: 'Maria' })).toBe('Maria');
    expect(nomeUsuarioHistorico({ usuarioId: '3f2b9a52-1111-2222-3333-444455556666', usuarioNome: null })).toBe('Usuário 3f2b9a52');
    expect(nomeUsuarioHistorico({ usuarioId: '3f2b9a52-1111', usuarioNome: '  ' })).toBe('Usuário 3f2b9a52');
    expect(nomeUsuarioHistorico({ usuarioId: '', usuarioNome: null })).toBe('Usuário desconhecido');
  });
});

describe('agruparHistorico', () => {
  it('agrupa entradas consecutivas do mesmo usuário e instante', () => {
    const grupos = agruparHistorico([
      entrada(3, { campo: 'local_id' }), entrada(2, { campo: 'descricao' }), entrada(1, { campo: 'plaqueta' })
    ]);
    expect(grupos.length).toBe(1);
    expect(grupos[0].entradas.map(e => e.id)).toEqual([3, 2, 1]);
    expect(grupos[0].usuario).toBe('Maria');
    expect(grupos[0].id).toBe(3);
  });

  it('separa por instante e por usuário, preservando a ordem', () => {
    const grupos = agruparHistorico([
      entrada(5, { criadoEm: '2026-10-22T14:03:11Z' }),
      entrada(4, { criadoEm: '2026-10-22T14:03:11Z', usuarioId: 'u-2', usuarioNome: 'João' }),
      entrada(3, { criadoEm: '2026-10-21T10:00:00Z' }),
      entrada(2, { criadoEm: '2026-10-21T10:00:00Z' })
    ]);
    expect(grupos.map(g => g.entradas.map(e => e.id))).toEqual([[5], [4], [3, 2]]);
    expect(grupos.map(g => g.usuario)).toEqual(['Maria', 'João', 'Maria']);
  });

  it('lista vazia gera nenhum grupo', () => {
    expect(agruparHistorico([])).toEqual([]);
  });
});
