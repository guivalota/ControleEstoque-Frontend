import { ImobConferenciaEvento } from '../models/imob-leitura.model';
import { formatarMoeda } from './imob-formato';

/** Rótulo de cada campo do histórico da conferência (E28 / DSG-30 R3). */
export const ROTULO_CAMPO_EVENTO: Record<string, string> = {
  encontrado: 'Encontrado',
  estado_id: 'Estado de conservação',
  valor_mercado: 'Valor de mercado',
  departamento_id: 'Departamento encontrado',
  local_lido_id: 'Local da leitura',
  observacao: 'Observação',
  foto_adicionada: 'Foto adicionada',
  foto_removida: 'Foto removida'
};

export const ROTULO_ORIGEM_CONFERENCIA: Record<string, string> = { app: 'App', web: 'Web', csv: 'CSV' };

export function rotuloCampoEvento(campo: string): string {
  return ROTULO_CAMPO_EVENTO[campo] ?? campo;
}

/** Um valor do histórico em texto legível: nome (estado, departamento, local), moeda, Sim/Não ou o próprio texto. */
export function valorEvento(campo: string, valor?: string | null, nome?: string | null): string {
  if (valor === null || valor === undefined || valor === '') return '—';
  switch (campo) {
    case 'encontrado': return valor === 'true' ? 'Sim' : 'Não';
    case 'valor_mercado': {
      const n = Number(valor);
      return Number.isFinite(n) ? formatarMoeda(n) : valor;
    }
    case 'estado_id':
    case 'departamento_id':
    case 'local_lido_id': return nome || `#${valor}`;
    default: return valor;
  }
}

/** "Estado de conservação: — → Bom". Foto adicionada/removida mostra só o nome do arquivo. */
export function textoEvento(e: ImobConferenciaEvento): string {
  if (e.campo === 'foto_adicionada') return `Foto adicionada: ${valorEvento(e.campo, e.valorNovo)}`;
  if (e.campo === 'foto_removida') return `Foto removida: ${valorEvento(e.campo, e.valorAnterior)}`;
  const antes = valorEvento(e.campo, e.valorAnterior, e.valorAnteriorNome);
  const depois = valorEvento(e.campo, e.valorNovo, e.valorNovoNome);
  return `${rotuloCampoEvento(e.campo)}: ${antes} → ${depois}`;
}
