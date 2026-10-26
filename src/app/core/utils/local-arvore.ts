import { ImobLocalArvore } from '../models/imob-local.model';

export interface OpcaoLocal {
  id: number;
  nome: string;
  codigo?: string | null;
  ativo: boolean;
  nivel: number;
}

/**
 * Achata a árvore em ordem de exibição (pré-ordem). Com `excluirId`, omite esse local e toda a
 * sua subárvore (evita escolher o próprio local ou um descendente como pai).
 */
export function achatarArvore(arvore: ImobLocalArvore[], excluirId: number | null = null): OpcaoLocal[] {
  const saida: OpcaoLocal[] = [];
  const visitar = (nos: ImobLocalArvore[], nivel: number) => {
    for (const no of nos) {
      if (no.id === excluirId) continue;
      saida.push({ id: no.id, nome: no.nome, codigo: no.codigo, ativo: no.ativo, nivel });
      visitar(no.filhos ?? [], nivel + 1);
    }
  };
  visitar(arvore, 0);
  return saida;
}

/** Localiza um nó na árvore pelo id. */
export function acharNo(arvore: ImobLocalArvore[], id: number): ImobLocalArvore | null {
  for (const no of arvore) {
    if (no.id === id) return no;
    const filho = acharNo(no.filhos ?? [], id);
    if (filho) return filho;
  }
  return null;
}
