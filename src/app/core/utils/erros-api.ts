import { HttpErrorResponse } from '@angular/common/http';

export interface ErroApi {
  /** Mensagem geral (regra de negócio ou falha). Vazia quando só há erros de campo. */
  mensagem: string;
  /** Erros de validação por campo, com a chave em camelCase (ex.: razaoSocial). */
  campos: Record<string, string>;
}

/** Interpreta `{ error }` (regra de negócio) e o formato `errors` do ASP.NET (validação por campo). */
export function lerErroApi(err: unknown, fallback: string): ErroApi {
  const e = err as HttpErrorResponse;
  const corpo = e?.error as { error?: unknown; errors?: Record<string, string[]> } | null | undefined;

  if (e?.status === 0) return { mensagem: 'Sem conexão com o servidor.', campos: {} };
  if (e?.status === 403) return { mensagem: 'Você não tem permissão para esta ação.', campos: {} };

  if (corpo && typeof corpo === 'object') {
    if (typeof corpo.error === 'string' && corpo.error) return { mensagem: corpo.error, campos: {} };
    if (corpo.errors && typeof corpo.errors === 'object') {
      const campos: Record<string, string> = {};
      for (const [chave, msgs] of Object.entries(corpo.errors)) {
        const nome = chave.charAt(0).toLowerCase() + chave.slice(1);
        campos[nome] = (Array.isArray(msgs) ? msgs : [String(msgs)]).join(' ');
      }
      return { mensagem: '', campos };
    }
  }
  return { mensagem: fallback, campos: {} };
}
