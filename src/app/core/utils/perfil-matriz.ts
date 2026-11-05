import { CatalogoPermissao, CatalogoPermissoes, CatalogoRecurso } from '../models/perfil-acesso.model';

/** Todas as permissões do catálogo, por código. */
export function indexarCatalogo(c: CatalogoPermissoes | null): Map<string, CatalogoPermissao> {
  const mapa = new Map<string, CatalogoPermissao>();
  for (const m of c?.modulos ?? []) for (const r of m.recursos) for (const p of r.permissoes) mapa.set(p.codigo, p);
  return mapa;
}

/**
 * Marca ou desmarca uma permissão respeitando as dependências do catálogo: marcar acrescenta o que ela exige
 * (ex.: `criar` exige `ver`); desmarcar remove também o que dependia dela. Permissões essenciais nunca saem.
 */
export function alternarPermissao(
  atuais: ReadonlySet<string>, indice: ReadonlyMap<string, CatalogoPermissao>, codigo: string, marcar: boolean
): Set<string> {
  const novas = new Set(atuais);
  if (marcar) {
    let c: string | null | undefined = codigo;
    while (c && indice.has(c) && !novas.has(c)) { novas.add(c); c = indice.get(c)!.dependeDe; }
    return novas;
  }
  if (indice.get(codigo)?.essencial) return novas;
  const sair = new Set([codigo]);
  let mudou = true;
  while (mudou) {
    mudou = false;
    for (const [cod, p] of indice) {
      if (!sair.has(cod) && p.dependeDe && sair.has(p.dependeDe)) { sair.add(cod); mudou = true; }
    }
  }
  for (const cod of sair) if (!indice.get(cod)?.essencial) novas.delete(cod);
  return novas;
}

/** Colunas da matriz de um módulo: as ações que aparecem em algum recurso, na ordem em que surgem. */
export function colunasDoModulo(recursos: readonly CatalogoRecurso[]): string[] {
  const colunas: string[] = [];
  for (const r of recursos) for (const p of r.permissoes) if (!colunas.includes(p.acao)) colunas.push(p.acao);
  return colunas;
}

/** "gerar-grade" → "Gerar grade". */
export function rotuloDaAcao(acao: string): string {
  const t = acao.replace(/-/g, ' ');
  return t.charAt(0).toUpperCase() + t.slice(1);
}
