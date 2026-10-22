import { ImobBemHistorico } from '../models/imob-bem.model';
import { formatarData, formatarMoeda } from './imob-formato';

const ROTULOS: Record<string, string> = {
  criacao: 'Cadastro',
  exclusao: 'Exclusão',
  plaqueta: 'Plaqueta',
  descricao: 'Descrição',
  categoria_id: 'Categoria',
  local_id: 'Local',
  responsavel_id: 'Responsável',
  data_aquisicao: 'Data de aquisição',
  valor_aquisicao: 'Valor de aquisição',
  valor_residual: 'Valor residual',
  vida_util_meses: 'Vida útil (meses)',
  fornecedor_nome: 'Fornecedor',
  numero_documento_aquisicao: 'Documento de aquisição',
  numero_serie: 'Nº de série',
  observacao: 'Observação'
};

const REFERENCIAS = new Set(['categoria_id', 'local_id', 'responsavel_id']);
const VALORES = new Set(['valor_aquisicao', 'valor_residual']);

/** Rótulo amigável do campo; campos desconhecidos (ex.: status, futuros) viram "Campo x y". */
export function rotuloCampoHistorico(campo: string): string {
  if (ROTULOS[campo]) return ROTULOS[campo];
  const texto = campo.replace(/_/g, ' ').trim();
  return texto ? texto.charAt(0).toUpperCase() + texto.slice(1) : '—';
}

/**
 * Valor pronto para exibir: referências pelo nome (`descricao`, com fallback "#id"), valores em BRL,
 * datas em dd/MM/yyyy e ausente/vazio como "—".
 */
export function formatarValorHistorico(campo: string, valor: string | null | undefined, descricao?: string | null): string {
  if (valor === null || valor === undefined || valor.trim() === '') return '—';
  if (REFERENCIAS.has(campo)) return descricao?.trim() || `#${valor}`;
  if (VALORES.has(campo)) {
    const n = Number(valor);
    return Number.isFinite(n) ? formatarMoeda(n) : valor;
  }
  if (campo === 'data_aquisicao') return formatarData(valor);
  return valor;
}

/** Nome do usuário ou, se ele não existir mais no cadastro, o id abreviado. */
export function nomeUsuarioHistorico(e: Pick<ImobBemHistorico, 'usuarioId' | 'usuarioNome'>): string {
  const nome = e.usuarioNome?.trim();
  if (nome) return nome;
  return e.usuarioId ? `Usuário ${e.usuarioId.slice(0, 8)}` : 'Usuário desconhecido';
}

export interface GrupoHistorico {
  /** Id da primeira entrada: chave estável e única para o `track` da lista. */
  id: number;
  chave: string;
  criadoEm: string;
  usuario: string;
  entradas: ImobBemHistorico[];
}

/**
 * Agrupa entradas consecutivas do mesmo usuário e do mesmo instante (uma edição gera uma entrada
 * por campo). A lista vem do mais recente para o mais antigo e a ordem é preservada.
 */
export function agruparHistorico(itens: ImobBemHistorico[]): GrupoHistorico[] {
  const grupos: GrupoHistorico[] = [];
  for (const e of itens) {
    const chave = `${e.usuarioId}|${e.criadoEm}`;
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.chave === chave) ultimo.entradas.push(e);
    else grupos.push({ id: e.id, chave, criadoEm: e.criadoEm, usuario: nomeUsuarioHistorico(e), entradas: [e] });
  }
  return grupos;
}
