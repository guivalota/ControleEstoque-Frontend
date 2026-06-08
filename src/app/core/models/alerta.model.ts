import { ConferenciaResult } from './conferencia.model';

export interface AlertaEstoqueBaixoResponse {
  totalAbaixoDoMinimo: number;
  emailEnviado: boolean;
  produtos: ConferenciaResult[];
}
