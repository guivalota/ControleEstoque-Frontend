import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { provideAuthFake } from '../../testing/auth-fake';
import { EmpresaAtivaService } from '../../core/services/empresa-ativa.service';
import { VersionService } from '../../core/services/version.service';
import { SidebarComponent } from './sidebar.component';
import { ImobPerfil } from '../../core/models/imob-empresa.model';

describe('SidebarComponent (menu por modulos)', () => {
  let ultimo: ComponentFixture<SidebarComponent>;

  function criar(modulos: string[], perfil: ImobPerfil = 'admin') {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]), provideHttpClient(), provideHttpClientTesting(), provideAuthFake('admin'),
        { provide: VersionService, useValue: { carregar: () => undefined, versao: () => '' } }
      ]
    });
    const empresa = TestBed.inject(EmpresaAtivaService);
    empresa.empresas.set([{ id: 1, razaoSocial: 'X', cnpj: '', ativo: true, criadoEm: '', perfil, modulos }]);
    empresa.id.set(1);
    const fixture = TestBed.createComponent(SidebarComponent);
    fixture.detectChanges();
    ultimo = fixture;
    return fixture.nativeElement as HTMLElement;
  }

  const tem = (el: HTMLElement, rota: string) => !!el.querySelector(`a[href="${rota}"]`);

  it('so estoque: mostra Estoque e Core, esconde Imobilizado', () => {
    const el = criar(['estoque']);
    expect(tem(el, '/produtos')).toBeTrue();
    expect(tem(el, '/notas-fiscais')).toBeTrue();
    expect(tem(el, '/imobilizado')).toBeFalse();
    expect(tem(el, '/clientes')).toBeTrue();
    expect(tem(el, '/fornecedores')).toBeTrue();
    expect(tem(el, '/usuarios')).toBeTrue();
  });

  it('com producao: mostra o grupo Produção; sem o módulo, o grupo não aparece', () => {
    const el = criar(['estoque', 'producao']);
    expect(tem(el, '/producao')).toBeTrue();
    expect(tem(el, '/producao/ordens')).toBeTrue();
    expect(tem(el, '/producao/faccao')).toBeTrue();
    expect(tem(el, '/producao/relatorios')).toBeTrue();
    expect(tem(el, '/manual/producao')).toBeTrue();
    TestBed.resetTestingModule();
    const semModulo = criar(['estoque']);
    expect(tem(semModulo, '/producao')).toBeFalse();
    expect(tem(semModulo, '/manual/producao')).toBeFalse();
  });

  it('so imobilizado: esconde Estoque, mostra Imobilizado e Core', () => {
    const el = criar(['imobilizado']);
    expect(tem(el, '/produtos')).toBeFalse();
    expect(tem(el, '/pedidos-compra')).toBeFalse();
    expect(tem(el, '/imobilizado')).toBeTrue();
    expect(tem(el, '/clientes')).toBeTrue();
  });

  it('contador: esconde o Estoque, mantém Imobilizado e Core, sem Usuários/Configurações', () => {
    const el = criar(['estoque', 'imobilizado'], 'contador');
    expect(tem(el, '/produtos')).toBeFalse();
    expect(tem(el, '/notas-fiscais')).toBeFalse();
    expect(tem(el, '/imobilizado')).toBeTrue();
    expect(tem(el, '/clientes')).toBeFalse(); // a API responde 403 ao contador
    expect(tem(el, '/fornecedores')).toBeTrue(); // ele lê fornecedores (cadastro de bens)
    expect(tem(el, '/usuarios')).toBeFalse();
    expect(tem(el, '/configuracoes')).toBeFalse();
  });

  it('Configurações aparece ao admin mesmo sem nenhum módulo', () => {
    expect(tem(criar([]), '/configuracoes')).toBeTrue();
  });

  it('Configurações não aparece para operador/leitura nem sem acesso', () => {
    const el = criar(['estoque']);
    const empresa = TestBed.inject(EmpresaAtivaService);
    empresa.empresas.set([{ id: 1, razaoSocial: 'X', cnpj: '', ativo: true, criadoEm: '', perfil: 'operador', modulos: ['estoque'] }]);
    const fx = TestBed.createComponent(SidebarComponent);
    fx.detectChanges();
    expect(tem(fx.nativeElement as HTMLElement, '/configuracoes')).toBeFalse();
    expect(tem(el, '/configuracoes')).toBeTrue(); // render anterior (admin) permanece
    empresa.empresas.set([]);
    empresa.id.set(null);
    empresa.carregado.set(true);
    const fx2 = TestBed.createComponent(SidebarComponent);
    fx2.detectChanges();
    expect(tem(fx2.nativeElement as HTMLElement, '/configuracoes')).toBeFalse();
  });

  it('menu de empresa não tem Audit Logs (tela do super admin); Impressões fica para o admin', () => {
    const el = criar(['estoque']);
    expect(tem(el, '/admin/audit-logs')).toBeFalse();
    expect(tem(el, '/admin/impressoes')).toBeTrue();
  });

  it('sem acesso a empresa: esconde menu de dados, Clientes e Fornecedores', () => {
    criar(['estoque']);
    const empresa = TestBed.inject(EmpresaAtivaService);
    empresa.empresas.set([]);
    empresa.id.set(null);
    empresa.carregado.set(true);
    const fx = TestBed.createComponent(SidebarComponent);
    fx.detectChanges();
    const el = fx.nativeElement as HTMLElement;
    expect(tem(el, '/clientes')).toBeFalse();
    expect(tem(el, '/fornecedores')).toBeFalse();
    expect(tem(el, '/produtos')).toBeFalse();
    expect(tem(el, '/usuarios')).toBeFalse();
    expect(tem(el, '/manual')).toBeTrue();
  });

  it('sem modulos: aviso e apenas Core', () => {
    const el = criar([]);
    expect(el.textContent).toContain('Sem módulos disponíveis — fale com o administrador.');
    expect(tem(el, '/produtos')).toBeFalse();
    expect(tem(el, '/imobilizado')).toBeFalse();
    expect(tem(el, '/clientes')).toBeTrue();
  });

  it('Imobilizado é um grupo com subitens (Bens, Cadastros, Reavaliação) que abre e fecha', () => {
    const el = criar(['imobilizado']);
    for (const rota of ['/imobilizado/bens', '/imobilizado/inventarios', '/imobilizado/locais', '/imobilizado/grupos',
      '/imobilizado/reavaliacao/estados-conservacao', '/imobilizado/reavaliacao/pesos', '/imobilizado/reavaliacao/escalas']) {
      expect(tem(el, rota)).withContext(rota).toBeTrue();
    }
    const botao = el.querySelector('button[aria-controls="sub-imob"]') as HTMLButtonElement;
    const sub = el.querySelector('#sub-imob') as HTMLElement;
    expect(sub.classList.contains('aberto')).toBeFalse();
    botao.click();
    ultimo.detectChanges();
    expect(sub.classList.contains('aberto')).toBeTrue();
  });
});
