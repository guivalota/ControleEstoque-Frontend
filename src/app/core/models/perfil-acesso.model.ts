/** Perfil de acesso da empresa (E25, DSG-27): conjunto de permissões que a empresa monta e atribui aos usuários. */
export interface PerfilAcesso {
  id: number;
  nome: string;
  descricao?: string | null;
  /** Perfil-modelo criado com a empresa (Administrador, Operador, Leitura): não se exclui. */
  sistema: boolean;
  /** `administrador` | `operador` | `leitura` nos modelos; nulo nos perfis próprios. */
  modelo?: string | null;
  /** Administrador: tem tudo, não é editável e vem com lista vazia. */
  todasPermissoes: boolean;
  ativo: boolean;
  usuarios: number;
  totalPermissoes: number;
}

export interface PerfilAcessoDetalhe extends PerfilAcesso {
  permissoes: string[];
}

export interface SalvarPerfilAcesso {
  nome: string;
  descricao?: string | null;
  permissoes: string[];
  /** Só na criação: copia as permissões de outro perfil. */
  copiarDeId?: number | null;
}

export interface CatalogoPermissao {
  codigo: string;
  acao: string;
  rotulo: string;
  descricao: string;
  sensivel: boolean;
  dependeDe?: string | null;
  essencial: boolean;
}

export interface CatalogoRecurso {
  recurso: string;
  rotulo: string;
  permissoes: CatalogoPermissao[];
}

export interface CatalogoModulo {
  modulo: string;
  recursos: CatalogoRecurso[];
}

export interface CatalogoPermissoes {
  modulos: CatalogoModulo[];
}

export const ROTULO_MODULO: Record<string, string> = {
  core: 'Cadastros e empresa',
  estoque: 'Estoque',
  imobilizado: 'Imobilizado',
  producao: 'Produção'
};
