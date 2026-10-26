export interface ImobLocal {
  id: number;
  nome: string;
  codigo?: string | null;
  localPaiId?: number | null;
  ativo: boolean;
  criadoEm: string;
}

export interface ImobLocalArvore {
  id: number;
  nome: string;
  codigo?: string | null;
  localPaiId?: number | null;
  ativo: boolean;
  filhos: ImobLocalArvore[];
}

export interface CriarImobLocal { nome: string; codigo?: string; localPaiId?: number | null; }
export interface AtualizarImobLocal extends CriarImobLocal { ativo: boolean; }
