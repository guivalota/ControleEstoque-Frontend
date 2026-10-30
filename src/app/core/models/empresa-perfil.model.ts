export type RegimeTributario = 'simples_nacional' | 'lucro_presumido' | 'lucro_real' | 'mei';
export type AmbienteNfe = 'homologacao' | 'producao';

/** Campos editáveis do perfil (o PUT recebe o documento completo; ausente/vazio limpa o campo). */
export interface EmpresaPerfilEditavel {
  nomeFantasia: string | null;
  telefone: string | null;
  emailContato: string | null;
  site: string | null;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  municipio: string | null;
  uf: string | null;
  codigoIbge: string | null;
  inscricaoEstadual: string | null;
  inscricaoMunicipal: string | null;
  cnae: string | null;
  regimeTributario: RegimeTributario | null;
  serieNfe: number | null;
  ambienteNfe: AmbienteNfe | null;
}

export interface EmpresaPerfil extends EmpresaPerfilEditavel {
  empresaId: number;
  razaoSocial: string;
  cnpj: string;
  temLogo: boolean;
  logoAtualizadoEm: string | null;
  atualizadoEm: string | null;
}

export interface OpcaoCodigoNome { codigo: string; nome: string; }

export interface EmpresaPerfilOpcoes {
  regimesTributarios: OpcaoCodigoNome[];
  ambientesNfe: OpcaoCodigoNome[];
  ufs: string[];
  logoTamanhoMaximoBytes: number;
  logoDimensaoMaximaPx: number;
}

export type AreaConfig = 'perfil' | 'endereco' | 'fiscal' | 'logo' | 'credencial' | 'integracao' | 'email' | 'notificacao';

export const AREAS_CONFIG: { codigo: AreaConfig; nome: string }[] = [
  { codigo: 'perfil', nome: 'Perfil' },
  { codigo: 'endereco', nome: 'Endereço' },
  { codigo: 'fiscal', nome: 'Fiscal' },
  { codigo: 'logo', nome: 'Logo' },
  { codigo: 'credencial', nome: 'Credenciais' },
  { codigo: 'integracao', nome: 'Integrações' },
  { codigo: 'email', nome: 'E-mail' },
  { codigo: 'notificacao', nome: 'Notificações' }
];

export interface ConfigEvento {
  id: number;
  area: string;
  acao: string;
  campo: string | null;
  detalhe: string | null;
  atorUsuarioId: string | null;
  atorNome: string | null;
  criadoEm: string;
}

export interface ConfiguracaoResumo {
  empresaId: number;
  razaoSocial: string;
  cnpj: string;
  nomeFantasia: string | null;
  estado: 'completo' | 'incompleto';
  pendencias: ('contato' | 'endereco' | 'fiscal')[];
  temLogo: boolean;
  emailVerificado: boolean;
  integracoes: number;
  perfilAtualizadoEm: string | null;
}
