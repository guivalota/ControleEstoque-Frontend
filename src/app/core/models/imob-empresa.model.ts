export interface ImobEmpresa {
  id: number;
  razaoSocial: string;
  nomeFantasia?: string | null;
  cnpj: string;
  ativo: boolean;
  criadoEm: string;
  /** Perfil efetivo do usuário nesta empresa (menor entre a role global e o vínculo). */
  perfil?: ImobPerfil;
  /** Códigos dos módulos contratados/liberados para a empresa (ex.: `estoque`, `imobilizado`). */
  modulos?: string[];
}

/** `contador` NÃO é um degrau da escada admin > operador > leitura: é um conjunto de permissões (matriz em DSG-14, US-19-19). */
export type ImobPerfil = 'admin' | 'contador' | 'operador' | 'leitura';

export const PERFIS_IMOB: ImobPerfil[] = ['admin', 'contador', 'operador', 'leitura'];

export const ROTULO_PERFIL: Record<ImobPerfil, string> = {
  admin: 'Administrador',
  contador: 'Contador',
  operador: 'Operador',
  leitura: 'Somente leitura'
};

/** Texto de ajuda dos seletores de perfil (equipe e vínculos). */
export const AJUDA_PERFIS =
  'Administrador: tudo, inclusive equipe e configurações. Contador: lê todo o Imobilizado, parametriza categorias, estados, pesos e escalas e fecha/reabre a depreciação; não cadastra bens, não faz conferência nem OS, não gere equipe e não acessa o Estoque. Operador: cadastros e operação do dia a dia. Somente leitura: apenas consulta.';

export interface ImobUsuarioEmpresa {
  usuarioId: string;
  nome: string;
  email: string;
  ativo: boolean;
  criadoEm: string;
  /** Role global do usuário (teto do perfil). */
  role?: ImobPerfil;
  /** Perfil gravado no vínculo. */
  perfil?: ImobPerfil;
  /** Códigos dos módulos contratados/liberados para a empresa (ex.: `estoque`, `imobilizado`). */
  modulos?: string[];
  /** O que vale de fato: o menor entre `role` e `perfil`. */
  perfilEfetivo?: ImobPerfil;
}

export interface CriarImobEmpresa {
  razaoSocial: string;
  nomeFantasia?: string;
  cnpj: string;
}

export interface AtualizarImobEmpresa extends CriarImobEmpresa {
  ativo: boolean;
}
