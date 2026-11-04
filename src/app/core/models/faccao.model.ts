export type StatusRemessa = 'aberta' | 'parcial' | 'concluida';

export const ROTULO_STATUS_REMESSA: Record<StatusRemessa, string> = {
  aberta: 'Aberta',
  parcial: 'Retorno parcial',
  concluida: 'Concluída'
};

export interface RemessaItem {
  variacaoId: number | null;
  variacaoSku: string | null;
  enviadas: number;
  boas: number;
  defeituosas: number;
  /** Enviadas − boas − defeituosas: o que ainda está em poder do terceirizado. */
  emPoder: number;
}

export interface RemessaMaterial {
  materialId: number;
  materialSku: string;
  materialNome: string;
  unidadeCodigo: string;
  enviado: number;
  devolvido: number;
  emPoder: number;
}

export interface Retorno {
  id: number;
  criadoEm: string;
  usuarioNome: string | null;
  observacao: string | null;
  valorPagar: number;
  encerrou: boolean;
  itens: RemessaItem[];
}

export interface Remessa {
  id: number;
  numero: number;
  ordemId: number;
  ordemNumero: number;
  produtoNome: string;
  /** Custos indiretos por peça da ficha da ordem (sugestão no retorno). */
  fichaCustosIndiretos: number;
  fornecedorId: number;
  fornecedorNome: string;
  status: StatusRemessa;
  valorPeca: number;
  prazoRetorno: string | null;
  observacao: string | null;
  criadoEm: string;
  usuarioNome: string | null;
  pecasEnviadas: number;
  pecasBoas: number;
  pecasDefeituosas: number;
  pecasEmPoder: number;
  perdidas: number;
  valorPagar: number;
  atrasada: boolean;
  diasEmAberto: number;
  itens: RemessaItem[];
  materiais: RemessaMaterial[];
  retornos: Retorno[];
}

export interface EnviarFaccaoRequest {
  ordemId: number;
  fornecedorId: number;
  valorPeca: number;
  prazoRetorno: string | null;
  observacao: string | null;
  itens: { variacaoId: number | null; quantidade: number }[];
  materiais: { materialId: number; quantidade: number }[];
}

export interface ReceberFaccaoRequest {
  encerrar: boolean;
  /** Custos indiretos por peça; omitido = o da ficha da ordem; 0 = não considerar. */
  custosIndiretosPorPeca?: number | null;
  observacao: string | null;
  itens: { variacaoId: number | null; boas: number; defeituosas: number }[];
  materiais: { materialId: number; devolvido: number }[];
}

export interface RetornoRegistrado {
  remessaConcluida: boolean;
  ordemConcluida: boolean;
  valorPagar: number;
  perdidas: number;
  remessa: Remessa;
}

export interface Oficina {
  fornecedorId: number;
  fornecedorNome: string;
  remessasAbertas: number;
  remessasAtrasadas: number;
  pecasEmPoder: number;
  valorAPagar: number;
}
