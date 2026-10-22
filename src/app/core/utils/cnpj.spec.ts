import { FormControl } from '@angular/forms';
import { cnpjValidator, cnpjValido, formatarCnpj, mascararCnpj } from './cnpj';

describe('cnpj utils', () => {
  describe('cnpjValido', () => {
    it('aceita CNPJs válidos com e sem máscara', () => {
      expect(cnpjValido('11.222.333/0001-81')).toBeTrue();
      expect(cnpjValido('11222333000181')).toBeTrue();
      expect(cnpjValido('00.000.000/0001-91')).toBeTrue();
    });

    it('rejeita dígito verificador errado', () => {
      expect(cnpjValido('11.222.333/0001-82')).toBeFalse();
      expect(cnpjValido('11.222.333/0001-71')).toBeFalse();
    });

    it('rejeita tamanho errado, CPF e sequências repetidas', () => {
      expect(cnpjValido('')).toBeFalse();
      expect(cnpjValido(null)).toBeFalse();
      expect(cnpjValido('123.456.789-09')).toBeFalse();
      expect(cnpjValido('11111111111111')).toBeFalse();
    });
  });

  describe('mascararCnpj', () => {
    it('aplica a máscara progressivamente', () => {
      expect(mascararCnpj('1')).toBe('1');
      expect(mascararCnpj('112')).toBe('11.2');
      expect(mascararCnpj('112223334')).toBe('11.222.333/4');
      expect(mascararCnpj('11222333000181')).toBe('11.222.333/0001-81');
    });

    it('ignora não dígitos e limita a 14 dígitos', () => {
      expect(mascararCnpj('ab11.222x333/0001-81999')).toBe('11.222.333/0001-81');
      expect(mascararCnpj(null)).toBe('');
    });
  });

  describe('formatarCnpj', () => {
    it('formata 14 dígitos e preserva outros valores', () => {
      expect(formatarCnpj('11222333000181')).toBe('11.222.333/0001-81');
      expect(formatarCnpj('123')).toBe('123');
      expect(formatarCnpj(null)).toBe('');
    });
  });

  describe('cnpjValidator', () => {
    it('vazio passa (required cuida disso); inválido falha; válido passa', () => {
      expect(cnpjValidator(new FormControl(''))).toBeNull();
      expect(cnpjValidator(new FormControl('11.222.333/0001-82'))).toEqual({ cnpj: true });
      expect(cnpjValidator(new FormControl('11.222.333/0001-81'))).toBeNull();
    });
  });
});
