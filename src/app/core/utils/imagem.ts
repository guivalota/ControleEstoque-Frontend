/** Redução de foto no navegador antes de enviar (E27): celular gera 4–8 MB; 1600 px em JPEG basta para identificar o bem. */

export const LADO_MAXIMO_PX = 1600;
/** Abaixo disto e dentro do lado máximo, a foto vai como está. */
export const LIMITE_SEM_REDUZIR_BYTES = 1_000_000;
const QUALIDADE_JPEG = 0.85;

export function dimensoesReduzidas(largura: number, altura: number, maximo = LADO_MAXIMO_PX): { largura: number; altura: number } {
  const maior = Math.max(largura, altura);
  if (maior <= maximo) return { largura, altura };
  const fator = maximo / maior;
  return { largura: Math.max(1, Math.round(largura * fator)), altura: Math.max(1, Math.round(altura * fator)) };
}

function nomeJpg(nome: string): string {
  const base = nome.replace(/\.[^./\\]+$/, '');
  return `${base || 'foto'}.jpg`;
}

/**
 * Devolve o mesmo arquivo se já está pequeno (ou se o navegador não consegue decodificar); senão, uma cópia em JPEG com o
 * maior lado limitado a 1600 px (orientação do EXIF aplicada, fundo branco para PNG com transparência).
 */
export async function reduzirImagem(arquivo: File): Promise<File> {
  if (!/^image\/(jpeg|png|webp)$/.test(arquivo.type)) return arquivo;
  try {
    const bitmap = await createImageBitmap(arquivo);
    const { largura, altura } = dimensoesReduzidas(bitmap.width, bitmap.height);
    const mudouTamanho = largura !== bitmap.width;
    if (!mudouTamanho && arquivo.size <= LIMITE_SEM_REDUZIR_BYTES) { bitmap.close(); return arquivo; }

    const canvas = document.createElement('canvas');
    canvas.width = largura;
    canvas.height = altura;
    const ctx = canvas.getContext('2d');
    if (!ctx) { bitmap.close(); return arquivo; }
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, largura, altura);
    ctx.drawImage(bitmap, 0, 0, largura, altura);
    bitmap.close();

    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', QUALIDADE_JPEG));
    if (!blob || (!mudouTamanho && blob.size >= arquivo.size)) return arquivo;
    return new File([blob], nomeJpg(arquivo.name), { type: 'image/jpeg', lastModified: arquivo.lastModified });
  } catch {
    return arquivo; // formato que o navegador não decodifica: o servidor decide
  }
}
