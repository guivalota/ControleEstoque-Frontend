import { CatalogoPermissao, CatalogoPermissoes } from '../models/perfil-acesso.model';
import { alternarPermissao, colunasDoModulo, indexarCatalogo, rotuloDaAcao } from './perfil-matriz';

const p = (codigo: string, extra: Partial<CatalogoPermissao> = {}): CatalogoPermissao => ({
  codigo, acao: codigo.split('.')[2], rotulo: codigo, descricao: codigo, sensivel: false, essencial: false, ...extra
});

const catalogo: CatalogoPermissoes = {
  modulos: [{
    modulo: 'estoque',
    recursos: [{
      recurso: 'produtos', rotulo: 'Produtos',
      permissoes: [
        p('estoque.produtos.ver'),
        p('estoque.produtos.criar', { dependeDe: 'estoque.produtos.ver' }),
        p('estoque.produtos.excluir', { dependeDe: 'estoque.produtos.ver', sensivel: true }),
        p('estoque.produtos.gerar-grade', { dependeDe: 'estoque.produtos.criar' })
      ]
    }, {
      recurso: 'lotes', rotulo: 'Lotes',
      permissoes: [p('estoque.lotes.ver', { essencial: true }), p('estoque.lotes.criar', { dependeDe: 'estoque.lotes.ver' })]
    }]
  }]
};
const indice = indexarCatalogo(catalogo);

describe('perfil-matriz', () => {
  it('marcar uma ação marca o que ela exige, em cadeia', () => {
    const r = alternarPermissao(new Set(), indice, 'estoque.produtos.gerar-grade', true);

    expect([...r].sort()).toEqual(['estoque.produtos.criar', 'estoque.produtos.gerar-grade', 'estoque.produtos.ver']);
  });

  it('desmarcar uma ação remove também as que dependiam dela', () => {
    const todas = new Set(['estoque.produtos.ver', 'estoque.produtos.criar', 'estoque.produtos.gerar-grade', 'estoque.produtos.excluir']);

    const r = alternarPermissao(todas, indice, 'estoque.produtos.criar', false);

    expect([...r].sort()).toEqual(['estoque.produtos.excluir', 'estoque.produtos.ver']);
  });

  it('desmarcar o "ver" derruba tudo do recurso', () => {
    const todas = new Set(['estoque.produtos.ver', 'estoque.produtos.criar', 'estoque.produtos.excluir']);

    expect(alternarPermissao(todas, indice, 'estoque.produtos.ver', false).size).toBe(0);
  });

  it('permissão essencial nunca sai, nem por dependência', () => {
    const s = new Set(['estoque.lotes.ver', 'estoque.lotes.criar']);

    expect(alternarPermissao(s, indice, 'estoque.lotes.ver', false).has('estoque.lotes.ver')).toBeTrue();
    expect(alternarPermissao(s, indice, 'estoque.lotes.ver', false).size).toBe(2); // nada muda: a essencial trava o que depende dela
  });

  it('não altera o conjunto recebido', () => {
    const s = new Set(['estoque.produtos.ver']);
    alternarPermissao(s, indice, 'estoque.produtos.criar', true);

    expect(s.size).toBe(1);
  });

  it('colunas: ações de todos os recursos, na ordem em que surgem', () => {
    expect(colunasDoModulo(catalogo.modulos[0].recursos)).toEqual(['ver', 'criar', 'excluir', 'gerar-grade']);
  });

  it('rotula a ação em português legível', () => {
    expect(rotuloDaAcao('gerar-grade')).toBe('Gerar grade');
  });
});
