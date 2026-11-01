export interface DeParaItem { antiga: string; nova: string }

export interface ResultadoDePara { aplicados: number; ignorados: number }

/** Estado da "virada" da renovação de etiquetas. */
export interface CodigoAnterior {
  /** `true` = virada feita: o código antigo some das telas e deixa de ser aceito na leitura. */
  oculto: boolean;
  bensComCodigoAnterior: number;
}
