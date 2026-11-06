/** Metadados de um anexo do Core (foto, laudo...). O conteúdo vem de rota própria, como blob. */
export interface Anexo {
  id: number;
  nomeArquivo: string;
  contentType: string;
  /** Bytes. */
  tamanho: number;
  criadoEm: string;
  criadoPorNome?: string | null;
}

/** Regras das fotos do bem (iguais às do servidor, que é quem decide). */
export const FOTO_BEM_MAX_POR_BEM = 5;
export const FOTO_BEM_MAX_BYTES = 5 * 1024 * 1024;
export const FOTO_BEM_TIPOS = 'image/jpeg,image/png,image/webp';
