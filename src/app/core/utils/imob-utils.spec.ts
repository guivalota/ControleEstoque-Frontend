import { FormControl, FormGroup } from '@angular/forms';
import { montarParams } from './http-params';
import { formatarPercentual, formatarVidaUtil, rotuloResponsavel } from './imob-formato';
import { acharNo, achatarArvore } from './local-arvore';
import { aplicarErroNoForm } from './erros-api';
import { ImobLocalArvore } from '../models/imob-local.model';

const no = (id: number, nome: string, filhos: ImobLocalArvore[] = [], ativo = true): ImobLocalArvore =>
  ({ id, nome, codigo: null, localPaiId: null, ativo, filhos });

describe('montarParams', () => {
  it('ignora undefined, null e vazio e converte tipos para texto', () => {
    const p = montarParams({ busca: 'abc', vazio: '', nulo: null, indef: undefined, ativo: false, page: 2 });
    expect(p.keys().sort()).toEqual(['ativo', 'busca', 'page']);
    expect(p.get('ativo')).toBe('false');
    expect(p.get('page')).toBe('2');
  });
});

describe('formatarVidaUtil', () => {
  it('formata meses e anos', () => {
    expect(formatarVidaUtil(120)).toBe('120 meses (10 anos)');
    expect(formatarVidaUtil(12)).toBe('12 meses (1 ano)');
    expect(formatarVidaUtil(18)).toBe('18 meses (1 ano e 6 meses)');
    expect(formatarVidaUtil(25)).toBe('25 meses (2 anos e 1 mês)');
    expect(formatarVidaUtil(6)).toBe('6 meses');
    expect(formatarVidaUtil(1)).toBe('1 mês');
  });

  it('devolve vazio para valores ausentes', () => {
    expect(formatarVidaUtil(null)).toBe('');
    expect(formatarVidaUtil(NaN)).toBe('');
  });
});

describe('formatarPercentual', () => {
  it('usa vírgula decimal e até 2 casas', () => {
    expect(formatarPercentual(10)).toBe('10%');
    expect(formatarPercentual(12.5)).toBe('12,5%');
    expect(formatarPercentual(0.25)).toBe('0,25%');
    expect(formatarPercentual(null)).toBe('');
  });
});

describe('rotuloResponsavel', () => {
  it('mostra nome (matrícula) quando há matrícula', () => {
    expect(rotuloResponsavel({ nome: 'Ana', matricula: 'M1' })).toBe('Ana (M1)');
    expect(rotuloResponsavel({ nome: 'Ana', matricula: null })).toBe('Ana');
  });
});

describe('local-arvore', () => {
  const arvore = [no(1, 'Matriz', [no(3, 'Andar 1', [no(4, 'Sala 101')]), no(5, 'Andar 2')]), no(2, 'Filial')];

  it('achata em pré-ordem com o nível', () => {
    expect(achatarArvore(arvore).map(o => `${o.nivel}:${o.nome}`))
      .toEqual(['0:Matriz', '1:Andar 1', '2:Sala 101', '1:Andar 2', '0:Filial']);
  });

  it('omite o local excluído e toda a sua subárvore', () => {
    expect(achatarArvore(arvore, 3).map(o => o.id)).toEqual([1, 5, 2]);
    expect(achatarArvore(arvore, 1).map(o => o.id)).toEqual([2]);
  });

  it('acha um nó em qualquer profundidade', () => {
    expect(acharNo(arvore, 4)?.nome).toBe('Sala 101');
    expect(acharNo(arvore, 99)).toBeNull();
  });
});

describe('aplicarErroNoForm', () => {
  const novoForm = () => new FormGroup({ nome: new FormControl(''), codigo: new FormControl('') });

  it('aplica erros por campo e não devolve mensagem geral', () => {
    const f = novoForm();
    const msg = aplicarErroNoForm(f, { mensagem: '', campos: { nome: 'Obrigatório.' } });
    expect(msg).toBe('');
    expect(f.get('nome')?.errors?.['servidor']).toBe('Obrigatório.');
  });

  it('associa { error } ao campo cujo termo aparece, respeitando a ordem da lista', () => {
    const f = novoForm();
    const msg = aplicarErroNoForm(f, { mensagem: 'O código já é usado por outro local.', campos: {} },
      { codigo: ['código'], nome: ['nome'] });
    expect(msg).toBe('');
    expect(f.get('codigo')?.errors?.['servidor']).toContain('código');
    expect(f.get('nome')?.errors).toBeNull();
  });

  it('mantém a mensagem geral quando nenhum campo é citado', () => {
    const f = novoForm();
    const texto = 'A alteração criaria um ciclo na hierarquia de locais.';
    expect(aplicarErroNoForm(f, { mensagem: texto, campos: {} }, { codigo: ['código'], nome: ['nome'] })).toBe(texto);
  });
});
