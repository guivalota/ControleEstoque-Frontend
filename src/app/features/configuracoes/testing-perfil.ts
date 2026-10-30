import { EmpresaPerfil, EmpresaPerfilOpcoes } from '../../core/models/empresa-perfil.model';

/** Dados de teste do perfil da empresa (somente specs). */
export const perfilBase = (extra: Partial<EmpresaPerfil> = {}): EmpresaPerfil => ({
  empresaId: 1, razaoSocial: 'Acme Ltda', cnpj: '11222333000181', nomeFantasia: 'Acme', telefone: null,
  emailContato: null, site: null, cep: null, logradouro: null, numero: null, complemento: null, bairro: null,
  municipio: null, uf: null, codigoIbge: null, inscricaoEstadual: 'ISENTO', inscricaoMunicipal: null, cnae: '4751201',
  regimeTributario: 'simples_nacional', serieNfe: 1, ambienteNfe: 'homologacao', temLogo: false,
  logoAtualizadoEm: null, atualizadoEm: null, ...extra
});

export const opcoesBase: EmpresaPerfilOpcoes = {
  regimesTributarios: [{ codigo: 'simples_nacional', nome: 'Simples Nacional' }, { codigo: 'mei', nome: 'MEI' }],
  ambientesNfe: [{ codigo: 'homologacao', nome: 'Homologação' }, { codigo: 'producao', nome: 'Produção' }],
  ufs: ['SP', 'RJ'], logoTamanhoMaximoBytes: 1048576, logoDimensaoMaximaPx: 2000
};
