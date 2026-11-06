import { ImobCampoCustomizado, TipoCampoCustomizado } from '../models/imob-campo-customizado.model';

/** Campos ativos que valem para a categoria (sem categoria no campo = todas). */
export function camposDaCategoria(campos: readonly ImobCampoCustomizado[], categoriaId: number | null): ImobCampoCustomizado[] {
  return campos.filter(c => c.ativo && (c.categoriaId === null || c.categoriaId === undefined || c.categoriaId === categoriaId));
}

const NUMERO = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 6 });

/** Texto para exibir um valor gravado: data em dd/MM/aaaa, número com vírgula; o resto como está. */
export function formatarValorCampo(tipo: TipoCampoCustomizado, valor: string | null | undefined): string {
  if (valor === null || valor === undefined || valor === '') return '—';
  if (tipo === 'data') {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor);
    return m ? `${m[3]}/${m[2]}/${m[1]}` : valor;
  }
  if (tipo === 'numero') {
    const n = Number(valor);
    return Number.isFinite(n) ? NUMERO.format(n) : valor;
  }
  return valor;
}

/** Valor para preencher o controle do formulário a partir do que o servidor guardou (data já vem aaaa-MM-dd; número vira com vírgula). */
export function valorParaEdicao(tipo: TipoCampoCustomizado, valor: string | null | undefined): string {
  if (valor === null || valor === undefined) return '';
  return tipo === 'numero' ? valor.replace('.', ',') : valor;
}

/** Erro de preenchimento no cliente (o servidor repete a regra); `null` se está tudo certo. */
export function erroDoValorCampo(campo: ImobCampoCustomizado, valor: string | null | undefined): string | null {
  const v = (valor ?? '').trim();
  if (v === '') return null;
  if (campo.tipo === 'numero' && !/^-?\d{1,3}(\.\d{3})*([,.]\d+)?$|^-?\d+([,.]\d+)?$/.test(v)) return 'Informe um número (ex.: 1234,56).';
  if (campo.tipo === 'data' && !/^\d{4}-\d{2}-\d{2}$|^\d{2}\/\d{2}\/\d{4}$/.test(v)) return 'Informe uma data válida.';
  if (campo.tipo === 'lista' && !campo.opcoes.some(o => o.toLowerCase() === v.toLowerCase())) return 'Escolha uma das opções.';
  if (campo.tipo === 'texto' && v.length > 500) return 'Máximo de 500 caracteres.';
  return null;
}
