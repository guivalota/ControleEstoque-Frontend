import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { GradeCadastroComponent } from './grade-cadastro.component';
import { GradeEixo } from '../../core/models/grade.model';
import { provideAuthFake } from '../../testing/auth-fake';

const val = (id: number, eixoId: number, codigo: string, nome: string, ordem: number, ativo = true) => ({ id, eixoId, codigo, nome, ordem, ativo });

const EIXOS = (): GradeEixo[] => [
  { id: 1, codigo: 'tamanho', nome: 'Tamanho', ordem: 1, ativo: true, valores: [val(10, 1, 'P', 'P', 1), val(11, 1, 'M', 'M', 2)] },
  { id: 2, codigo: 'cor', nome: 'Cor', ordem: 2, ativo: true, valores: [val(20, 2, 'MAR', 'Marrom', 10), val(21, 2, 'PRE', 'Preto', 10, false)] }
];

describe('GradeCadastroComponent', () => {
  let fixture: ComponentFixture<GradeCadastroComponent>;
  let comp: GradeCadastroComponent;
  let ctrl: HttpTestingController;
  const el = () => fixture.nativeElement as HTMLElement;

  function montar(role: 'admin' | 'operador' | 'leitura' = 'admin') {
    TestBed.configureTestingModule({
      imports: [GradeCadastroComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideAuthFake(role)]
    });
    ctrl = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(GradeCadastroComponent);
    comp = fixture.componentInstance;
    fixture.detectChanges();
    ctrl.expectOne('/api/v1/grade/eixos').flush(EIXOS());
    fixture.detectChanges();
  }

  const botao = (texto: string) => Array.from(el().querySelectorAll('button')).find(b => b.textContent?.trim() === texto) as HTMLButtonElement | undefined;

  afterEach(() => ctrl.verify());

  it('lista os eixos e os valores, com os inativos marcados', () => {
    montar();
    const texto = el().textContent!;
    expect(texto).toContain('Marrom');
    expect(texto).toContain('Preto');
    expect(texto).toContain('Inativo');
    expect(comp.eixos().length).toBe(2);
  });

  it('cria um valor novo no eixo, com a próxima ordem', () => {
    montar();
    const cor = comp.eixos()[1];
    comp.nv(cor.id).codigo = 'VER';
    comp.nv(cor.id).nome = 'Verde';
    comp.adicionarValor(cor);
    const req = ctrl.expectOne('/api/v1/grade/eixos/2/valores');
    expect(req.request.body).toEqual({ codigo: 'VER', nome: 'Verde', ordem: 11 });
    req.flush(val(22, 2, 'VER', 'Verde', 11));
    expect(comp.eixos()[1].valores.map(v => v.nome)).toContain('Verde');
    expect(comp.nv(2).nome).toBe('');
  });

  it('não envia valor sem código ou nome', () => {
    montar();
    comp.adicionarValor(comp.eixos()[0]);
    expect(comp.erro()).toContain('código e o nome');
  });

  it('renomeia um valor', () => {
    montar();
    comp.editar({ tipo: 'valor', id: 20, nome: 'Marrom' });
    comp.editarNome('Marrom escuro');
    comp.salvarNome();
    const req = ctrl.expectOne('/api/v1/grade/valores/20');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ nome: 'Marrom escuro' });
    req.flush(val(20, 2, 'MAR', 'Marrom escuro', 10));
    expect(comp.editando()).toBeNull();
    expect(comp.eixos()[1].valores.some(v => v.nome === 'Marrom escuro')).toBeTrue();
  });

  it('inativa e reativa um valor', () => {
    montar();
    comp.alternarValor(comp.eixos()[1].valores[0]);
    const req = ctrl.expectOne('/api/v1/grade/valores/20');
    expect(req.request.body).toEqual({ ativo: false });
    req.flush(val(20, 2, 'MAR', 'Marrom', 10, false));
    expect(comp.eixos()[1].valores.find(v => v.id === 20)!.ativo).toBeFalse();
  });

  it('reordena renumerando 1..n quando há ordens repetidas', () => {
    montar();
    const cor = comp.eixos()[1]; // Marrom e Preto, os dois com ordem 10
    comp.mover(cor, cor.valores[1], -1);
    const r1 = ctrl.expectOne(r => r.url === '/api/v1/grade/valores/21');
    const r0 = ctrl.expectOne(r => r.url === '/api/v1/grade/valores/20');
    expect(r1.request.body).toEqual({ ordem: 1 });
    expect(r0.request.body).toEqual({ ordem: 2 });
    r1.flush(val(21, 2, 'PRE', 'Preto', 1, false));
    r0.flush(val(20, 2, 'MAR', 'Marrom', 2));
    expect(comp.eixos()[1].valores.map(v => v.nome)).toEqual(['Preto', 'Marrom']);
  });

  it('cria um eixo (admin)', () => {
    montar();
    comp.novoEixo = { codigo: 'acabamento', nome: 'Acabamento' };
    comp.adicionarEixo();
    const req = ctrl.expectOne('/api/v1/grade/eixos');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ codigo: 'acabamento', nome: 'Acabamento', ordem: 3 });
    req.flush({ id: 3, codigo: 'acabamento', nome: 'Acabamento', ordem: 3, ativo: true, valores: [] });
    expect(comp.eixos().length).toBe(3);
  });

  it('mostra o erro do servidor, como código repetido', () => {
    montar();
    const cor = comp.eixos()[1];
    comp.nv(cor.id).codigo = 'MAR';
    comp.nv(cor.id).nome = 'Outro';
    comp.adicionarValor(cor);
    ctrl.expectOne('/api/v1/grade/eixos/2/valores').flush({ error: 'Já existe um valor com este código.' }, { status: 400, statusText: 'Bad Request' });
    fixture.detectChanges();
    expect(el().querySelector('#erro-grade')!.textContent).toContain('Já existe um valor');
  });

  it('operador cadastra valores mas não mexe em eixos', () => {
    montar('operador');
    expect(botao('Adicionar valor')).toBeTruthy();
    expect(botao('Criar eixo')).toBeUndefined();
    expect(Array.from(el().querySelectorAll('.card-header button')).length).toBe(0);
  });

  it('leitura só consulta', () => {
    montar('leitura');
    expect(botao('Adicionar valor')).toBeUndefined();
    expect(botao('Renomear')).toBeUndefined();
    expect(el().textContent).toContain('Marrom');
  });
});
