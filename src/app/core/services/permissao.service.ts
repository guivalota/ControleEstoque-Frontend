import { Injectable, inject, computed } from '@angular/core';
import { AuthService } from './auth.service';
import { EmpresaAtivaService } from './empresa-ativa.service';
import { ImobPerfil } from '../models/imob-empresa.model';
import { Permissao } from '../models/permissoes';

/** Ações que o Operador-modelo não tem (usado só no modo legado, quando o servidor ainda não devolve `permissoes`). */
const ACOES_SENSIVEIS_LEGADO = new Set(['excluir', 'aprovar', 'rejeitar', 'encerrar', 'fechar', 'reabrir', 'estornar', 'de-para', 'codigo-anterior', 'eixos-criar']);

/** Telas contábeis: no modo legado só admin e contador alteram (operador só consulta). */
const CONTABIL_LEGADO = ['imobilizado.estados-conservacao.', 'imobilizado.reavaliacao-escalas.', 'imobilizado.reavaliacao-parametros.', 'imobilizado.depreciacao-previa.'];

/** Permissões administrativas do Core: no modo legado só o admin tem. */
const SO_ADMIN_LEGADO = [
  'core.acesso.', 'core.equipe.', 'core.empresa-credenciais.', 'core.empresa-email.', 'core.empresa-integracoes.',
  'core.empresa-notificacoes.', 'core.empresa-perfil.', 'core.empresa-configuracoes.', 'core.empresa-logo.editar', 'core.empresa-logo.excluir'
];

/** O que o contador de hoje faz além de consultar (Imobilizado contábil), no modo legado. */
const CONTADOR_LEGADO = new Set<string>([
  'imobilizado.categorias.criar', 'imobilizado.categorias.editar', 'imobilizado.depreciacao-previa.ver',
  'imobilizado.depreciacao-periodos.fechar', 'imobilizado.depreciacao-periodos.reabrir',
  'imobilizado.estados-conservacao.criar', 'imobilizado.estados-conservacao.editar', 'imobilizado.estados-conservacao.excluir',
  'imobilizado.estados-conservacao.padrao', 'imobilizado.reavaliacao-escalas.criar', 'imobilizado.reavaliacao-parametros.criar'
]);

@Injectable({ providedIn: 'root' })
export class PermissaoService {
  private auth = inject(AuthService);
  private empresa = inject(EmpresaAtivaService);

  role = computed(() => this.auth.currentUser()?.role);

  /** Super administrador: administra a plataforma e nunca acessa módulos de negócio (sem permissão de escrita em nada de empresa). */
  isSuperAdmin = computed(() => this.role() === 'superadmin');

  /**
   * Perfil efetivo na empresa ativa, como o servidor devolve em `perfil` (texto legado: admin, operador, leitura, contador).
   * Não recombinar com a role do token: a conta cliente tem role global `leitura`. Sem perfil informado vale a role global.
   * Superadmin não tem perfil de negócio. Hoje serve ao modo legado e aos aliases; o que vale é {@link pode}.
   */
  perfil = computed<ImobPerfil | undefined>(
    () => this.isSuperAdmin() ? undefined : this.empresa.ativa()?.perfil ?? (this.role() as ImobPerfil | undefined)
  );

  // ------------------------------------------------------------------ permissões dinâmicas (E25)

  /**
   * Permissões efetivas do usuário na empresa ativa, como o servidor informa (perfil ∩ módulos ligados e permitidos).
   * Nulo = servidor sem o campo (versão antiga): vale o modo legado por perfil.
   */
  permissoes = computed<ReadonlySet<string> | null>(() => {
    if (this.isSuperAdmin()) return new Set<string>();
    const lista = this.empresa.ativa()?.permissoes;
    return lista ? new Set(lista) : null;
  });

  /** Nome do perfil do usuário nesta empresa (ex.: "Cadastrador"), para mostrar na interface. */
  perfilNome = computed(() => this.empresa.ativa()?.perfilNome ?? null);

  /**
   * O usuário pode? Com uma lista, basta uma (OU). Super administrador nunca pode nada de empresa.
   * É lida dentro de `computed`/`effect`/templates: reage à troca de empresa e ao recarregamento do perfil.
   */
  pode(codigo: Permissao | readonly Permissao[]): boolean {
    if (this.isSuperAdmin()) return false;
    const lista: readonly Permissao[] = typeof codigo === 'string' ? [codigo] : codigo;
    const conjunto = this.permissoes();
    return conjunto ? lista.some(c => conjunto.has(c)) : lista.some(c => this.legado(c));
  }

  /** Tem alguma permissão que termina na ação (ex.: `criar`)? Alimenta os aliases genéricos. */
  private temAlgumaAcao(acao: string): boolean {
    const conjunto = this.permissoes();
    if (!conjunto) return false;
    for (const c of conjunto) if (c.endsWith('.' + acao)) return true;
    return false;
  }

  /**
   * Modo legado (servidor antigo, sem `permissoes`): reproduz o que os quatro perfis fixos faziam. Só admin é completo;
   * é uma aproximação deliberada e some quando o servidor novo estiver em todo lugar (US-25-07).
   */
  private legado(codigo: string): boolean {
    const perfil = this.perfil();
    if (perfil === 'admin') return true;
    if (SO_ADMIN_LEGADO.some(p => codigo.startsWith(p))) return false;
    const acao = codigo.slice(codigo.lastIndexOf('.') + 1);
    const modulo = codigo.slice(0, codigo.indexOf('.'));
    if (perfil === 'leitura') return acao === 'ver';
    if (perfil === 'operador' && acao !== 'ver' && CONTABIL_LEGADO.some(p => codigo.startsWith(p))) return false;
    if (perfil === 'contador' && codigo.startsWith('core.clientes.')) return false;
    if (perfil === 'operador') return !ACOES_SENSIVEIS_LEGADO.has(acao);
    if (perfil === 'contador') return (acao === 'ver' && modulo !== 'estoque' && modulo !== 'producao') || CONTADOR_LEGADO.has(codigo);
    return false;
  }

  // ------------------------------------------------------------------ aliases (compatibilidade; as telas migram para pode())

  /** Alguma permissão de criar (ou, no modo legado, admin e operador). */
  canCreate = computed(() =>
    this.permissoes() ? this.temAlgumaAcao('criar') : this.perfil() === 'admin' || this.perfil() === 'operador');
  canEdit = this.canCreate;

  /** Alguma permissão de excluir (ou, no modo legado, só admin). */
  canDelete = computed(() => this.permissoes() ? this.temAlgumaAcao('excluir') : this.perfil() === 'admin');

  /** Pode gerir a equipe da empresa (ou, no modo legado, admin). */
  canManageUsers = computed(() => this.pode('core.equipe.ver'));

  /** Perfil contador (modo legado): lê o Imobilizado e cuida dos parâmetros contábeis, sem Estoque. */
  isContador = computed(() => this.perfil() === 'contador');

  /** Algum módulo de negócio (`estoque`, `imobilizado`, `producao`): o usuário tem alguma tela de consulta dele? */
  podeUsarModulo(modulo: 'estoque' | 'imobilizado' | 'producao'): boolean {
    if (this.isSuperAdmin()) return false;
    const conjunto = this.permissoes();
    if (conjunto) {
      for (const c of conjunto) if (c.startsWith(modulo + '.') && c.endsWith('.ver')) return true;
      return false;
    }
    // modo legado: o contador não usa o Estoque nem a Produção
    return modulo === 'imobilizado' || !this.isContador();
  }

  /** Estoque (módulo e telas). */
  podeUsarEstoque = computed(() => this.podeUsarModulo('estoque'));

  /** Clientes (Core). */
  podeUsarClientes = computed(() => this.pode('core.clientes.ver'));

  imobCanEditCategorias = computed(() => this.pode(['imobilizado.categorias.criar', 'imobilizado.categorias.editar']));
  imobCanPreviaDepreciacao = computed(() => this.pode('imobilizado.depreciacao-previa.ver'));
  imobCanFecharDepreciacao = computed(() => this.pode(['imobilizado.depreciacao-periodos.fechar', 'imobilizado.depreciacao-periodos.reabrir']));
  imobCanParametrizar = computed(() => this.pode(['imobilizado.reavaliacao-parametros.criar', 'imobilizado.reavaliacao-escalas.criar', 'imobilizado.estados-conservacao.editar']));

  /** Imobilizado: mesmo perfil efetivo da empresa ativa. */
  perfilImob = this.perfil;

  imobCanCreate = computed(() => this.permissoes() ? this.pode(['imobilizado.bens.criar', 'imobilizado.locais.criar']) : this.canCreate());
  imobCanEdit = this.imobCanCreate;
  imobCanDelete = computed(() => this.permissoes() ? this.pode(['imobilizado.bens.excluir', 'imobilizado.locais.excluir']) : this.canDelete());
}
