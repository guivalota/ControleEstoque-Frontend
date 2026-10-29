import { FormControl } from '@angular/forms';
import { cnpjValidator, cnpjValido, formatarCnpj, mascararCnpj, normalizarCnpj } from './cnpj';

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

    it('ignora pontuação, limita a 14 caracteres e põe em maiúsculas', () => {
      expect(mascararCnpj('11.222.333/0001-81999')).toBe('11.222.333/0001-81');
      expect(mascararCnpj('12abc34501de35')).toBe('12.ABC.345/01DE-35');
      expect(mascararCnpj(null)).toBe('');
    });

    it('aceita letras nas 12 primeiras posições mas só dígitos nas 2 últimas', () => {
      expect(mascararCnpj('12ABC34501DEAB')).toBe('12.ABC.345/01DE');
      expect(mascararCnpj('12ABC34501DE3X5')).toBe('12.ABC.345/01DE-35');
    });
  });

  describe('alfanumérico', () => {
    it('valida o exemplo oficial da Receita (12.ABC.345/01DE-35), com e sem máscara/minúsculas', () => {
      expect(cnpjValido('12ABC34501DE35')).toBeTrue();
      expect(cnpjValido('12.ABC.345/01DE-35')).toBeTrue();
      expect(cnpjValido('12abc34501de35')).toBeTrue();
    });

    it('rejeita dígito verificador errado, letras nos dígitos verificadores e curto', () => {
      expect(cnpjValido('12ABC34501DE36')).toBeFalse();
      expect(cnpjValido('12ABC34501DEAB')).toBeFalse();
      expect(cnpjValido('12ABC34501DE3')).toBeFalse();
    });

    it('normalizarCnpj remove pontuação e põe em maiúsculas', () => {
      expect(normalizarCnpj('12.abc.345/01de-35')).toBe('12ABC34501DE35');
      expect(normalizarCnpj(undefined)).toBe('');
    });

    it('formatarCnpj formata alfanumérico', () => {
      expect(formatarCnpj('12abc34501de35')).toBe('12.ABC.345/01DE-35');
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
