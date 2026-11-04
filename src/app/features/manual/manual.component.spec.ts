import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { provideAuthFake } from '../../testing/auth-fake';
import { EmpresaAtivaService } from '../../core/services/empresa-ativa.service';
import { ManualComponent } from './manual.component';

describe('ManualComponent (abas por módulo)', () => {
  const MD_ESTOQUE = '# Manual do Usuário\n\n## 1. Introdução\n\ntexto do estoque\n';
  const MD_PRODUCAO = '# Manual da Produção\n\n## 1. Sobre o módulo\n\ntexto\n\n## 2. Quem pode\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n## 3. Conceitos\n\nx\n\n## 4. Ciclo\n\ny\n';

  function criar(modulos: string[], modulo: string | null, perfil: 'admin' | 'contador' = 'admin') {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]), provideHttpClient(), provideHttpClientTesting(), provideAuthFake('admin'),
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap(modulo ? { modulo } : {})) } }
      ]
    });
    const empresa = TestBed.inject(EmpresaAtivaService);
    empresa.empresas.set([{ id: 1, razaoSocial: 'X', cnpj: '', ativo: true, criadoEm: '', perfil, modulos }]);
    empresa.id.set(1);
    const fixture = TestBed.createComponent(ManualComponent);
    fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    return { fixture, http, el: fixture.nativeElement as HTMLElement };
  }

  const abas = (el: HTMLElement) => Array.from(el.querySelectorAll('.nav-tabs a')).map(a => a.textContent!.trim());

  it('só Estoque: sem abas e carrega o manual geral', () => {
    const { fixture, http, el } = criar(['estoque'], null);
    http.expectOne('docs/manual-usuario.md').flush(MD_ESTOQUE);
    fixture.detectChanges();
    expect(abas(el)).toEqual([]);
    expect(el.querySelector('.manual-content')!.textContent).toContain('texto do estoque');
    http.verify();
  });

  it('com Produção: mostra as duas abas e abre a da URL', () => {
    const { fixture, http, el } = criar(['estoque', 'producao'], 'producao');
    http.expectOne('docs/manual-producao.md').flush(MD_PRODUCAO);
    fixture.detectChanges();
    expect(abas(el)).toEqual(['Estoque', 'Produção']);
    expect(el.querySelector('.nav-link.active')!.textContent).toContain('Produção');
    expect(el.querySelector('.manual-content h1')!.textContent).toContain('Manual da Produção');
    http.verify();
  });

  it('com Produção e sem módulo na URL: abre o Estoque', () => {
    const { fixture, http, el } = criar(['estoque', 'producao'], null);
    http.expectOne('docs/manual-usuario.md').flush(MD_ESTOQUE);
    fixture.detectChanges();
    expect(el.querySelector('.nav-link.active')!.textContent).toContain('Estoque');
  });

  it('URL de módulo não contratado cai no Estoque e não baixa o manual da Produção', () => {
    const { fixture, http, el } = criar(['estoque'], 'producao');
    http.expectNone('docs/manual-producao.md');
    http.expectOne('docs/manual-usuario.md').flush(MD_ESTOQUE);
    fixture.detectChanges();
    expect(abas(el)).toEqual([]);
    expect(el.querySelector('.manual-content')!.textContent).toContain('texto do estoque');
  });

  it('perfil contador não vê a aba da Produção mesmo com o módulo', () => {
    const { fixture, http, el } = criar(['estoque', 'producao'], 'producao', 'contador');
    http.expectOne('docs/manual-usuario.md').flush(MD_ESTOQUE);
    fixture.detectChanges();
    expect(abas(el)).toEqual([]);
  });

  it('monta o índice de seções e a tabela responsiva', () => {
    const { fixture, http, el } = criar(['estoque', 'producao'], 'producao');
    http.expectOne('docs/manual-producao.md').flush(MD_PRODUCAO);
    fixture.detectChanges();
    const botoes = Array.from(el.querySelectorAll('nav button')).map(b => b.textContent!.trim());
    expect(botoes).toEqual(['1. Sobre o módulo', '2. Quem pode', '3. Conceitos', '4. Ciclo']);
    expect(el.querySelectorAll('.manual-content h2').length).toBe(4);
    expect(el.querySelector('.manual-content .table-responsive table.table')).not.toBeNull();
  });

  it('erro ao baixar o arquivo mostra o aviso', () => {
    const { fixture, http, el } = criar(['estoque'], null);
    http.expectOne('docs/manual-usuario.md').flush('x', { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();
    expect(el.querySelector('.alert-danger')!.textContent).toContain('Não foi possível carregar o manual');
  });
});
