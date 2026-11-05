import { Injectable, Provider, computed, signal } from '@angular/core';
import { AuthService } from '../core/services/auth.service';
import { PermissaoService } from '../core/services/permissao.service';
import { PERMISSOES } from '../core/models/permissoes';

export type RoleFake = 'admin' | 'operador' | 'leitura' | 'superadmin';

/** Ações que o Operador-modelo não tem. */
const ACOES_SENSIVEIS = new Set(['excluir', 'aprovar', 'rejeitar', 'encerrar', 'fechar', 'reabrir', 'estornar', 'de-para', 'codigo-anterior', 'eixos-criar', 'padrao']);
/** Permissões administrativas do Core: só o Administrador-modelo. */
const SO_ADMIN = [
  'core.acesso.', 'core.equipe.', 'core.empresa-credenciais.', 'core.empresa-email.', 'core.empresa-integracoes.',
  'core.empresa-notificacoes.', 'core.empresa-perfil.', 'core.empresa-configuracoes.', 'core.empresa-logo.editar', 'core.empresa-logo.excluir',
  'financeiro.cadastros.editar', 'financeiro.importacoes.', 'financeiro.aprovacao.'
];
/** Telas contábeis: o Operador-modelo só consulta. */
const CONTABIL = ['imobilizado.estados-conservacao.', 'imobilizado.reavaliacao-escalas.', 'imobilizado.reavaliacao-parametros.', 'imobilizado.depreciacao-previa.'];

/** O que o perfil comum "Contador" faz além de consultar o Imobilizado (contábil). */
const CONTADOR = new Set<string>([
  'imobilizado.categorias.criar', 'imobilizado.categorias.editar', 'imobilizado.depreciacao-previa.ver',
  'imobilizado.depreciacao-periodos.fechar', 'imobilizado.depreciacao-periodos.reabrir',
  'financeiro.relatorios.exportar', 'imobilizado.estados-conservacao.criar', 'imobilizado.estados-conservacao.editar', 'imobilizado.estados-conservacao.excluir',
  'imobilizado.estados-conservacao.padrao', 'imobilizado.reavaliacao-escalas.criar', 'imobilizado.reavaliacao-parametros.criar'
]);

/** Permissões dos perfis-modelo (só para os specs que não informam `permissoes` na empresa). */
function permissoesDoModelo(modelo: string | undefined): Set<string> {
  const todas = new Set<string>(PERMISSOES);
  if (modelo === 'admin') return todas;
  return new Set([...todas].filter(codigo => {
    if (SO_ADMIN.some(p => codigo.startsWith(p))) return false;
    const acao = codigo.slice(codigo.lastIndexOf('.') + 1);
    if (modelo === 'leitura') return acao === 'ver';
    if (modelo === 'contador') return (acao === 'ver' && !/^(estoque|producao)\.|^core\.clientes\./.test(codigo)) || CONTADOR.has(codigo);
    if (modelo === 'operador') return !ACOES_SENSIVEIS.has(acao) && !(acao !== 'ver' && CONTABIL.some(p => codigo.startsWith(p)));
    return false;
  }));
}

/**
 * Nos testes, `permissoes` da empresa ativa vale como no servidor; sem ela, vale o perfil-modelo da empresa (`perfil`) ou, sem empresa,
 * o papel do usuário fake. Assim os specs de tela continuam descrevendo "admin vê, leitura não" sem montar listas de permissões.
 */
@Injectable()
class PermissaoServiceFake extends PermissaoService {
  override permissoes = computed<ReadonlySet<string>>(() => {
    if (this.isSuperAdmin()) return new Set<string>();
    const ativa = this.empresa.ativa();
    if (ativa?.permissoes) return new Set(ativa.permissoes);
    return permissoesDoModelo(ativa?.perfil ?? this.role());
  });
}

/** Provider de teste: usuário logado com o papel informado (PermissaoService e guards leem daqui). */
export function provideAuthFake(role: RoleFake): Provider[] {
  const currentUser = signal({ role, nome: 'Fulano', email: 'fulano@x.com' });
  return [
    {
      provide: AuthService,
      useValue: {
        currentUser,
        isSuperAdmin: () => role === 'superadmin',
        precisaTrocarSenha: signal(false),
        destinoInicial: () => (role === 'superadmin' ? '/plataforma' : '/dashboard'),
        logout: () => undefined
      }
    },
    { provide: PermissaoService, useClass: PermissaoServiceFake }
  ];
}
