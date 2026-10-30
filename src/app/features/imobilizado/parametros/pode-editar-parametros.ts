import { PermissaoService } from '../../../core/services/permissao.service';

/**
 * Quem edita os parâmetros da reavaliação (estados de conservação, pesos e escalas VP/VF):
 * admin e contador (matriz US-19-19; perfil efetivo na empresa ativa). O servidor é a autoridade real.
 */
export function podeEditarParametros(permissao: PermissaoService): boolean {
  return permissao.imobCanParametrizar();
}
