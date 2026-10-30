/** Modelos do cofre, integrações, e-mail da empresa e destinatários (E17, US-17-05..09). Nenhuma resposta traz segredo. */

export type CredencialTipo = 'senha' | 'token' | 'certificado' | 'outra';

export interface Credencial {
  id: string;
  tipo: CredencialTipo;
  rotulo: string;
  definida: boolean;
  /** Sempre "********" (tamanho fixo); null se revogada. */
  mascara: string | null;
  versao: number;
  atualizadoEm: string | null;
  atualizadoPorId: string | null;
  atualizadoPorNome: string | null;
  revogadaEm: string | null;
}

export type IntegracaoTipo = 'fiscal' | 'bancaria' | 'governo' | 'outra';
export type IntegracaoAmbiente = 'homologacao' | 'producao';
export type IntegracaoStatus = 'nao_testada' | 'ok' | 'falha';

export interface Integracao {
  id: string;
  tipo: IntegracaoTipo;
  provedor: string;
  ambiente: IntegracaoAmbiente;
  parametros: Record<string, string> | null;
  ativo: boolean;
  status: IntegracaoStatus;
  ultimoTesteEm: string | null;
  ultimoTesteResultado: string | null;
  credencial: Credencial | null;
  atualizadoEm: string | null;
}

/** Documento completo de POST/PUT. `segredo` é write-only: omitido/null mantém o do cofre. */
export interface SalvarIntegracaoRequest {
  tipo: IntegracaoTipo;
  provedor: string;
  ambiente: IntegracaoAmbiente;
  parametros: Record<string, string> | null;
  credencialTipo: CredencialTipo | null;
  segredo: string | null;
  ativo: boolean;
}

export interface TesteIntegracaoResultado {
  status: 'ok' | 'falha';
  resultado: string;
  testadoEm: string;
}

export type EmailSeguranca = 'STARTTLS' | 'SSL';

export interface EmailSenhaInfo {
  definida: boolean;
  mascara: string | null;
  atualizadaEm: string | null;
  atualizadaPorNome: string | null;
}

export interface EmailEmpresa {
  configurado: boolean;
  host: string | null;
  porta: number | null;
  seguranca: EmailSeguranca | null;
  usuario: string | null;
  senha: EmailSenhaInfo | null;
  remetenteNome: string | null;
  remetenteEmail: string | null;
  ativo: boolean;
  verificadoEm: string | null;
  atualizadoEm: string | null;
  usandoEmailProprio: boolean;
}

export interface SalvarEmailEmpresaRequest {
  host: string;
  porta: number;
  seguranca: EmailSeguranca;
  usuario: string | null;
  /** Write-only: omitida/null mantém a senha do cofre. */
  senha: string | null;
  remetenteNome: string;
  remetenteEmail: string;
  ativo: boolean;
}

export interface TesteEmailResultado {
  sucesso: boolean;
  erro: string | null;
  verificadoEm: string | null;
}

export interface DestinatarioNotificacao {
  tipo: 'usuario' | 'email';
  usuarioId: string | null;
  nome: string | null;
  email: string;
  ativo: boolean;
  elegivel: boolean;
}

export interface EventoNotificacao {
  codigo: string;
  nome: string;
  descricao: string;
  modulo: string;
  usandoPadrao: boolean;
  destinatarios: DestinatarioNotificacao[];
}

export interface NotificacoesResponse { eventos: EventoNotificacao[]; }

export type DestinatarioRequest =
  | { usuarioId: string; ativo: boolean }
  | { email: string; ativo: boolean };

export interface SalvarNotificacoesRequest {
  eventos: { evento: string; destinatarios: DestinatarioRequest[] }[];
}
