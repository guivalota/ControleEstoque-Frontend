export interface CorteItem {
  variacaoId: number | null;
  variacaoSku: string | null;
  porCamada: number;
  esperadas: number;
  cortadas: number;
  /** Esperadas − cortadas (nunca negativa): perda de contagem registrada. */
  perdidas: number;
}

export interface Corte {
  id: number;
  materialId: number;
  materialSku: string;
  materialNome: string;
  unidadeCodigo: string;
  usado: number;
  retalho: number;
  /** Usado − retalho: o que de fato saiu do estoque. */
  consumido: number;
  camadas: number;
  observacao: string | null;
  usuarioNome: string | null;
  criadoEm: string;
  itens: CorteItem[];
  pecasCortadas: number;
  pecasPerdidas: number;
  consumoTeorico: number;
  consumoPrevisto: number;
  perdaPrevistaPercentual: number | null;
  perdaRealPercentual: number | null;
  aproveitamentoPercentual: number | null;
  /** Previsto − consumido: positivo = gastou menos que o previsto; negativo = gastou a mais. */
  sobra: number;
}

export interface RegistrarCorteRequest {
  materialId: number;
  usado: number;
  retalho: number;
  camadas: number;
  observacao: string | null;
  itens: { variacaoId: number | null; porCamada: number; cortadas: number }[];
}
