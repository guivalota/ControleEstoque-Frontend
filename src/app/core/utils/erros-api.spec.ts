import { HttpErrorResponse } from '@angular/common/http';
import { ehUuid, lerErroApi, textoDoErro } from './erros-api';

const erro = (status: number, error: unknown) => new HttpErrorResponse({ status, error });

describe('lerErroApi', () => {
  it('lê { error } de regra de negócio', () => {
    expect(lerErroApi(erro(400, { error: 'CNPJ já cadastrado.' }), 'x'))
      .toEqual({ mensagem: 'CNPJ já cadastrado.', campos: {} });
  });

  it('mapeia errors do ASP.NET por campo em camelCase', () => {
    const r = lerErroApi(erro(400, { errors: { RazaoSocial: ['Obrigatório.', 'Muito curto.'], Cnpj: ['Inválido.'] } }), 'x');
    expect(r.mensagem).toBe('');
    expect(r.campos).toEqual({ razaoSocial: 'Obrigatório. Muito curto.', cnpj: 'Inválido.' });
  });

  it('403 e sem conexão têm mensagens próprias', () => {
    expect(lerErroApi(erro(403, {}), 'x').mensagem).toContain('permissão');
    expect(lerErroApi(erro(0, null), 'x').mensagem).toContain('conexão');
  });

  it('usa o fallback quando o corpo não é reconhecido', () => {
    expect(lerErroApi(erro(500, 'boom'), 'Falhou.').mensagem).toBe('Falhou.');
    expect(lerErroApi(undefined, 'Falhou.').mensagem).toBe('Falhou.');
  });

  it('textoDoErro junta os erros de campo quando não há mensagem e nunca devolve vazio', () => {
    expect(textoDoErro(lerErroApi(erro(400, { errors: { UsuarioId: ['Inválido.'] } }), 'x'), 'Falhou.')).toBe('Inválido.');
    expect(textoDoErro({ mensagem: '', campos: {} }, 'Falhou.')).toBe('Falhou.');
  });

  it('ehUuid valida o formato', () => {
    expect(ehUuid('3f2504e0-4f89-11d3-9a0c-0305e82c3301')).toBeTrue();
    expect(ehUuid('xyz')).toBeFalse();
    expect(ehUuid('3f2504e0-4f89-11d3-9a0c-0305e82c33')).toBeFalse();
  });
});
