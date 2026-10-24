import { FormControl } from '@angular/forms';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, UrlTree, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { dataAquisicaoValida, duasCasas, hojeIso, inteiro } from './validadores';
import { formatarData, formatarDataHora, formatarMoeda } from './imob-formato';
import { baixarBlob } from './download';
import { bemEditavel } from '../models/imob-bem.model';
import { provideHttpClient } from '@angular/common/http';
import { EmpresaAtivaService } from '../services/empresa-ativa.service';
import { escritaGuard } from '../guards/escrita.guard';
import { provideAuthFake } from '../../testing/auth-fake';

describe('validadores', () => {
  it('duasCasas', () => {
    expect(duasCasas(new FormControl(10.5))).toBeNull();
    expect(duasCasas(new FormControl(10.55))).toBeNull();
    expect(duasCasas(new FormControl(1234.56))).toBeNull();
    expect(duasCasas(new FormControl(10.555))).toEqual({ casas: true });
    expect(duasCasas(new FormControl(null))).toBeNull();
  });

  it('inteiro', () => {
    expect(inteiro(new FormControl(60))).toBeNull();
    expect(inteiro(new FormControl(60.5))).toEqual({ inteiro: true });
    expect(inteiro(new FormControl(null))).toBeNull();
  });

  describe('dataAquisicaoValida', () => {
    it('aceita datas entre 1900 e hoje', () => {
      expect(dataAquisicaoValida(new FormControl('1900-01-01'))).toBeNull();
      expect(dataAquisicaoValida(new FormControl('2024-03-10'))).toBeNull();
      expect(dataAquisicaoValida(new FormControl(hojeIso()))).toBeNull();
      expect(dataAquisicaoValida(new FormControl(''))).toBeNull();
    });

    it('rejeita antes de 1900, futuro e formato inválido', () => {
      expect(dataAquisicaoValida(new FormControl('1899-12-31'))).toEqual({ dataMinima: true });
      expect(dataAquisicaoValida(new FormControl('2999-01-01'))).toEqual({ dataFutura: true });
      expect(dataAquisicaoValida(new FormControl('10/03/2024'))).toEqual({ data: true });
      expect(dataAquisicaoValida(new FormControl('2024-13-45'))).toEqual({ data: true });
    });
  });
});

describe('formatadores de bem', () => {
  it('formatarMoeda em BRL', () => {
    expect(formatarMoeda(4500).replace(/\s/g, ' ')).toBe('R$ 4.500,00');
    expect(formatarMoeda(0.5).replace(/\s/g, ' ')).toBe('R$ 0,50');
    expect(formatarMoeda(null)).toBe('—');
  });

  it('formatarData converte yyyy-MM-dd para dd/MM/yyyy sem deslocar o dia', () => {
    expect(formatarData('2024-03-10')).toBe('10/03/2024');
    expect(formatarData('2024-01-01')).toBe('01/01/2024');
    expect(formatarData(null)).toBe('—');
    expect(formatarData('lixo')).toBe('—');
  });

  it('formatarDataHora converte um instante ISO e tolera valores inválidos', () => {
    expect(formatarDataHora('2026-10-22T14:03:11Z')).toMatch(/^\d{2}\/\d{2}\/\d{2,4} \d{2}:\d{2}$/);
    expect(formatarDataHora(null)).toBe('—');
    expect(formatarDataHora('x')).toBe('—');
  });
});

describe('bemEditavel', () => {
  it('baixado e vendido não são editáveis', () => {
    expect(bemEditavel('ativo')).toBeTrue();
    expect(bemEditavel('em_manutencao')).toBeTrue();
    expect(bemEditavel('extraviado')).toBeTrue();
    expect(bemEditavel('baixado')).toBeFalse();
    expect(bemEditavel('vendido')).toBeFalse();
  });
});

describe('baixarBlob', () => {
  it('dispara o download por um link temporário com o nome do arquivo', () => {
    const criar = spyOn(URL, 'createObjectURL').and.returnValue('blob:x');
    const clicar = spyOn(HTMLAnchorElement.prototype, 'click').and.callFake(function (this: HTMLAnchorElement) {
      expect(this.download).toBe('bens.csv');
      expect(this.href).toContain('blob:x');
    });
    baixarBlob(new Blob(['a']), 'bens.csv');
    expect(criar).toHaveBeenCalled();
    expect(clicar).toHaveBeenCalledTimes(1);
    expect(document.querySelector('a[download="bens.csv"]')).toBeNull();
  });
});

describe('escritaGuard', () => {
  const rodar = (role: 'admin' | 'operador' | 'leitura', perfil?: 'admin' | 'operador' | 'leitura') => {
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideAuthFake(role)] });
    if (perfil) {
      const empresa = TestBed.inject(EmpresaAtivaService);
      empresa.empresas.set([{ id: 1, razaoSocial: 'X', cnpj: '', ativo: true, criadoEm: '', perfil }]);
      empresa.id.set(1);
    }
    return TestBed.runInInjectionContext(() =>
      escritaGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot));
  };

  it('libera admin e operador', () => {
    expect(rodar('admin')).toBeTrue();
  });

  it('operador também', () => {
    expect(rodar('operador')).toBeTrue();
  });

  it('operador com perfil leitura na empresa ativa é redirecionado', () => {
    expect(rodar('operador', 'leitura') instanceof UrlTree).toBeTrue();
  });

  it('perfil na empresa nunca eleva a role global', () => {
    expect(rodar('leitura', 'admin') instanceof UrlTree).toBeTrue();
  });

  it('leitura é redirecionada para a lista de bens', () => {
    const res = rodar('leitura');
    expect(res instanceof UrlTree).toBeTrue();
    expect(TestBed.inject(Router).serializeUrl(res as UrlTree)).toBe('/imobilizado/bens');
  });
});
