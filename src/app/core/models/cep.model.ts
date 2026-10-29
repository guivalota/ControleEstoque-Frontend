export interface CepResult {
  cep?: string;
  logradouro?: string;
  bairro?: string;
  municipio?: string;
  localidade?: string;
  uf?: string;
  /** O contrato atual do CEP não traz o IBGE; se vier, é aproveitado. */
  codigoIbge?: string;
  ibge?: string;
  erro?: boolean;
}
