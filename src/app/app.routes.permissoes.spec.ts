import { Route, Routes } from '@angular/router';
import { routes } from './app.routes';
import { PERMISSOES } from './core/models/permissoes';

function achatar(rotas: Routes, pai = ''): { caminho: string; rota: Route }[] {
  return rotas.flatMap(r => {
    const caminho = [pai, r.path].filter(Boolean).join('/');
    return [{ caminho, rota: r }, ...(r.children ? achatar(r.children, caminho) : [])];
  });
}

describe('rotas × catálogo de permissões', () => {
  const todas = achatar(routes);
  const comPermissao = todas.filter(x => x.rota.data?.['permissao']);

  it('toda rota com data.permissao usa códigos do catálogo', () => {
    expect(comPermissao.length).toBeGreaterThan(40);
    for (const { caminho, rota } of comPermissao) {
      const exigida = rota.data!['permissao'] as string | string[];
      for (const codigo of Array.isArray(exigida) ? exigida : [exigida])
        expect((PERMISSOES as readonly string[]).includes(codigo)).withContext(`${caminho}: ${codigo}`).toBeTrue();
    }
  });

  it('rota com data.permissao tem o permissaoGuard (senão a regra não vale)', () => {
    for (const { caminho, rota } of comPermissao)
      expect(rota.canActivate?.length ?? 0).withContext(caminho).toBeGreaterThan(0);
  });
});
