import { chromium } from 'playwright';
import fs from 'fs';

const BASE = 'http://localhost:4200';
const results = [];
// CPFs válidos para testes (checksum correto, usados em rodízio)
const TEST_CPFS = ['52998224725', '86870286060', '11144477735', '37462678047'];
const TEST_CPF = TEST_CPFS[Math.floor(Date.now() / 60000) % TEST_CPFS.length];
const TEST_NOME = `Cliente Teste ${Date.now().toString().slice(-5)}`;

function log(id, status, note = '') {
  const line = `${status} ${id}${note ? ' — ' + note : ''}`;
  console.log(line);
  results.push({ id, status, note });
}

async function login(page, email = 'admin@estoque.com', senha = 'Admin@1234') {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
  await page.fill('input[formControlName="email"]', email);
  await page.fill('input[formControlName="senha"]', senha);
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/dashboard`, { timeout: 10000 });
  await page.waitForTimeout(500);
}

async function clearSession(page) {
  try {
    await page.evaluate(() => {
      localStorage.removeItem('ce_token');
      localStorage.removeItem('ce_refresh');
    });
  } catch {}
}

async function closeModal(page) {
  try {
    // Use Bootstrap's own close button to preserve JS state
    const cancelBtn = page.locator('.modal.show button[data-bs-dismiss="modal"]').first();
    if (await cancelBtn.count() > 0) {
      await cancelBtn.click();
      await page.waitForTimeout(700);
      return;
    }
    await page.keyboard.press('Escape');
    await page.waitForTimeout(700);
  } catch {}
}

const browser = await chromium.launch({ headless: false, slowMo: 120 });
const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
const page = await ctx.newPage();

// Collect console errors
const consoleErrors = [];
page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });

try {
  // ─── A01: Login válido ───────────────────────────────────────────────────
  await page.goto(`${BASE}/login`);
  await page.fill('input[formControlName="email"]', 'admin@estoque.com');
  await page.fill('input[formControlName="senha"]', 'Admin@1234');
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/dashboard`, { timeout: 8000 });
  log('A01', '✅', 'login válido → /dashboard');

  // ─── A02: Login inválido ────────────────────────────────────────────────
  await clearSession(page);
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
  await page.fill('input[formControlName="email"]', 'admin@estoque.com');
  await page.fill('input[formControlName="senha"]', 'senhaerrada');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2500);
  const currentUrl = page.url();
  if (currentUrl.includes('/login')) log('A02', '✅', 'permanece em /login com credenciais inválidas');
  else log('A02', '❌', `redirecionou para ${currentUrl}`);

  // ─── A03: Rota protegida sem sessão ────────────────────────────────────
  await clearSession(page);
  await page.goto(`${BASE}/dashboard`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  if (page.url().includes('/login')) log('A03', '✅', 'redireciona para /login sem sessão');
  else log('A03', '❌', `URL: ${page.url()}`);

  // ─── Relogar como admin ─────────────────────────────────────────────────
  await login(page);

  // ─── P16: Badge admin vermelho ──────────────────────────────────────────
  const badge = page.locator('.topbar .badge, header .badge').first();
  const badgeText = await badge.textContent();
  const badgeCls = await badge.getAttribute('class');
  if (badgeCls?.includes('bg-danger') && badgeText?.trim() === 'Admin')
    log('P16', '✅', `badge "${badgeText?.trim()}" bg-danger`);
  else log('P16', '⚠️', `badge="${badgeText?.trim()}" class="${badgeCls}"`);

  // ─── P17: Link Usuários na sidebar ─────────────────────────────────────
  const usuariosLink = page.locator('a[href*="/usuarios"], a[routerLink*="usuarios"]');
  const usuariosCount = await usuariosLink.count();
  if (usuariosCount > 0) log('P17', '✅', 'link Usuários presente na sidebar');
  else log('P17', '❌', 'link Usuários não encontrado');

  // ─── P18: Acesso /usuarios ──────────────────────────────────────────────
  await page.goto(`${BASE}/usuarios`);
  await page.waitForTimeout(1500);
  if (page.url().includes('/usuarios')) log('P18', '✅', '/usuarios carrega para admin');
  else log('P18', '❌', `redirecionou para ${page.url()}`);

  // ─── P19: Botões de ação visíveis (admin) ──────────────────────────────
  await page.goto(`${BASE}/produtos`);
  await page.waitForTimeout(1500);
  const btnNovo = await page.locator('button:has-text("Novo Produto")').count();
  const btnEditar = await page.locator('button[title="Editar"], button.btn-outline-secondary').first().isVisible().catch(() => false);
  const btnExcluir = await page.locator('button[title="Excluir"], button.btn-outline-danger').first().isVisible().catch(() => false);
  if (btnNovo > 0) log('P19', '✅', 'botão Novo Produto visível para admin');
  else log('P19', '❌', 'botão Novo Produto não encontrado');

  // ─── A04: Logout ────────────────────────────────────────────────────────
  const btnSair = page.locator('button:has-text("Sair")');
  await btnSair.click();
  await page.waitForURL(`${BASE}/login`, { timeout: 8000 });
  await page.waitForTimeout(500);
  const tokenAfterLogout = await page.evaluate(() => localStorage.getItem('ce_token'));
  if (page.url().includes('/login') && !tokenAfterLogout)
    log('A04', '✅', 'logout limpa token e redireciona para /login');
  else log('A04', '⚠️', `URL: ${page.url()} | token ainda presente: ${!!tokenAfterLogout}`);

  // ─── Relogar para testes restantes ─────────────────────────────────────
  await login(page);

  // ─── C01: Link Clientes na sidebar ─────────────────────────────────────
  const clientesLink = await page.locator('a[href*="/clientes"], a[routerLink*="clientes"]').count();
  if (clientesLink > 0) log('C01', '✅', 'link Clientes na sidebar');
  else log('C01', '❌', 'link Clientes não encontrado');

  // ─── C02: Listar clientes ───────────────────────────────────────────────
  await page.goto(`${BASE}/clientes`);
  await page.waitForTimeout(2000);
  const tabelaClientes = await page.locator('table').count();
  if (tabelaClientes > 0) log('C02', '✅', 'tabela de clientes renderizada');
  else log('C02', '❌', 'tabela não encontrada');

  // ─── C03: Criar cliente com CPF ─────────────────────────────────────────
  await page.click('button:has-text("Novo Cliente")');
  await page.waitForTimeout(800);
  const modalAberto = await page.locator('.modal.show, .modal[style*="block"]').count();
  if (modalAberto > 0) log('C03a', '✅', 'modal Novo Cliente abre');
  else log('C03a', '❌', 'modal não abriu');

  await page.fill('input[formControlName="cpfCnpj"]', TEST_CPF);
  await page.fill('input[formControlName="nome"]', TEST_NOME);
  await page.fill('input[formControlName="email"]', `${Date.now()}@teste.com`);
  await page.click('button:has-text("Salvar")');
  await page.waitForTimeout(2000);
  const modalFechado = await page.locator('.modal.show').count();
  if (modalFechado === 0) log('C03b', '✅', 'cliente CPF criado, modal fechou');
  else {
    const erroModal = await page.locator('.alert-danger').textContent().catch(() => '');
    log('C03b', '⚠️', `modal ainda aberto — erro: ${erroModal}`);
    await closeModal(page);
  }

  // ─── C04: Verificar formatação CPF na tabela ────────────────────────────
  await page.waitForTimeout(1000);
  const cpfFormatado = await page.locator('td.font-monospace').filter({ hasText: '.' }).first().textContent().catch(() => '');
  if (cpfFormatado.includes('.')) log('C04', '✅', `CPF/CNPJ formatado: "${cpfFormatado.trim()}"`);
  else log('C04', '⚠️', `CPF sem formatação: "${cpfFormatado.trim()}"`);

  // ─── C05: Validação CPF inválido ────────────────────────────────────────
  // Navigate fresh to reset any modal state
  await page.goto(`${BASE}/clientes`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  await page.click('button:has-text("Novo Cliente")');
  await page.waitForTimeout(700);
  await page.fill('input[formControlName="cpfCnpj"]', '1234567890'); // 10 digitos - invalido
  await page.fill('input[formControlName="nome"]', 'Invalido');
  await page.click('button:has-text("Salvar")');
  await page.waitForTimeout(500);
  const campoInvalido = await page.locator('.is-invalid').count();
  if (campoInvalido > 0) log('C05', '✅', 'validação CPF/CNPJ inválido exibe erro');
  else log('C05', '❌', 'sem feedback de validação');
  await closeModal(page);

  // ─── C06: Editar cliente ────────────────────────────────────────────────
  const btnEditarCliente = page.locator('button[title="Editar"]').first();
  if (await btnEditarCliente.count() > 0) {
    await btnEditarCliente.click();
    await page.waitForTimeout(700);
    const cpfDisabled = await page.locator('input[formControlName="cpfCnpj"]').isDisabled();
    if (cpfDisabled) log('C06', '✅', 'CPF/CNPJ desabilitado no editar');
    else log('C06', '❌', 'CPF/CNPJ ainda habilitado no editar');
    await closeModal(page);
  } else {
    log('C06', '⚠️', 'nenhum cliente para editar ainda');
  }

  // C07a: Toggle ativo so aparece no editar
  await page.click('button:has-text("Novo Cliente")');
  await page.waitForTimeout(600);
  const toggleCriar = await page.locator('#clienteAtivo').count();
  if (toggleCriar === 0) log('C07a', '✅', 'toggle ativo ausente no modo criar');
  else log('C07a', '❌', 'toggle ativo visivel indevidamente no criar');
  await closeModal(page);

  // ─── M01–M05: Movimentações form + isAjuste bug fix ─────────────────────
  await page.goto(`${BASE}/movimentacoes`);
  await page.waitForTimeout(1500);
  await page.click('button:has-text("Nova Movimentação")');
  await page.waitForTimeout(700);

  // M01: 4 tipos
  const radios = await page.locator('.modal input[type="radio"]').count();
  if (radios >= 4) log('M01', '✅', `${radios} radios de tipo visíveis`);
  else log('M01', '❌', `apenas ${radios} radios encontrados`);

  // M02: Seleciona Ajuste → motivo aparece
  await page.locator('#tipo_ajuste').click();
  await page.waitForTimeout(500);
  const motivoAjuste = await page.locator('select[formControlName="motivoAjuste"]').count();
  if (motivoAjuste > 0) log('M02', '✅', 'campo motivoAjuste aparece ao selecionar Ajuste');
  else log('M02', '❌', 'campo motivoAjuste não apareceu com Ajuste');

  // M03: Ajuste Saída → motivo aparece
  await page.locator('#tipo_ajuste_saida').click();
  await page.waitForTimeout(500);
  const motivoAjusteSaida = await page.locator('select[formControlName="motivoAjuste"]').count();
  if (motivoAjusteSaida > 0) log('M03', '✅', 'campo motivoAjuste aparece com Ajuste Saída');
  else log('M03', '❌', 'campo motivoAjuste não apareceu com Ajuste Saída');

  // M04: Troca para Entrada → motivo desaparece (bug fix test)
  await page.locator('#tipo_entrada').click();
  await page.waitForTimeout(600);
  const motivoDepoisEntrada = await page.locator('select[formControlName="motivoAjuste"]').count();
  if (motivoDepoisEntrada === 0) log('M04', '✅', 'motivoAjuste desaparece imediatamente ao trocar para Entrada');
  else log('M04', '❌', 'BUG: motivoAjuste ainda visível após trocar para Entrada');

  // M05: Troca para Saída → motivo desaparece
  await page.locator('#tipo_ajuste_saida').click();
  await page.waitForTimeout(400);
  await page.locator('#tipo_saida').click();
  await page.waitForTimeout(600);
  const motivoDepoisSaida = await page.locator('select[formControlName="motivoAjuste"]').count();
  if (motivoDepoisSaida === 0) log('M05', '✅', 'motivoAjuste desaparece ao trocar para Saída');
  else log('M05', '❌', 'BUG: motivoAjuste ainda visível após Saída');

  // Criar movimentação ajuste_saida para testar badge
  await page.locator('#tipo_ajuste_saida').click();
  await page.waitForTimeout(300);
  const prodSelect = page.locator('select[formControlName="produtoId"]');
  // Wait for products to load in select
  try {
    await page.waitForSelector('select[formControlName="produtoId"] option:nth-child(2)', { timeout: 5000 });
  } catch {}
  const prodOpts = await prodSelect.locator('option').count();
  if (prodOpts > 1) {
    await prodSelect.selectOption({ index: 1 });
    await page.fill('input[formControlName="quantidade"]', '1');
    await page.fill('input[formControlName="valorUnitario"]', '10');
    await page.click('button:has-text("Registrar")');
    await page.waitForTimeout(2500);
    // M09: Badge "Aj. Saída" na tabela
    const ajusteSaidaBadge = page.locator('.badge').filter({ hasText: 'Aj. Saída' });
    const ajusteCount = await ajusteSaidaBadge.count();
    if (ajusteCount > 0) log('M09', '✅', 'badge "Aj. Saída" encontrado na tabela');
    else {
      const allBadges = await page.locator('tbody .badge').allTextContents();
      const hasUnderscore = allBadges.some(b => b.includes('_'));
      if (hasUnderscore) log('M09', '❌', `badge com underscore na tabela: ${allBadges.filter(b=>b.includes('_')).join(', ')}`);
      else log('M09', '⚠️', `ajuste_saida ainda nao no BD — badges: ${allBadges.slice(0,5).join(', ')}`);
    }
  } else {
    log('M09', '⚠️', 'nenhum produto ativo disponivel no select — skipped');
    await closeModal(page);
  }

  // ─── CF04: Conferência — single GET /conferencia ─────────────────────────
  await page.goto(`${BASE}/conferencia`);
  await page.waitForTimeout(1500);

  const apiCalls = [];
  page.on('request', req => {
    if (req.url().includes('conferencia') || req.url().includes('saldo')) {
      apiCalls.push(req.url());
    }
  });

  await page.click('button:has-text("Visão Geral")');
  await page.waitForTimeout(3000);

  const saldoCalls = apiCalls.filter(u => u.includes('/saldo/'));
  const conferenciaCalls = apiCalls.filter(u => u.includes('/conferencia') && !u.includes('/conferencia/'));
  if (saldoCalls.length === 0 && conferenciaCalls.length > 0)
    log('CF04', '✅', `GET /conferencia usado (${conferenciaCalls.length} call); nenhuma chamada /saldo`);
  else if (saldoCalls.length > 0)
    log('CF04', '❌', `${saldoCalls.length} chamadas /saldo encontradas — endpoint antigo ainda em uso`);
  else
    log('CF04', '⚠️', `calls: conferencia=${conferenciaCalls.length}, saldo=${saldoCalls.length}`);

  // CF05: Colunas enriquecidas na visão geral
  const headers = await page.locator('thead th').allTextContents();
  const temEntradas = headers.some(h => h.includes('Entrada'));
  const temValor = headers.some(h => h.includes('Valor') || h.includes('Estoque'));
  if (temEntradas && temValor) log('CF05', '✅', `colunas: ${headers.join(' | ')}`);
  else log('CF05', '⚠️', `colunas: ${headers.join(' | ')}`);

  // ─── PR01: Campos estoqueMinimo no modal de Produto ──────────────────────
  await page.goto(`${BASE}/produtos`);
  await page.waitForTimeout(1500);
  await page.click('button:has-text("Novo Produto")');
  await page.waitForTimeout(700);
  const campoEstMin = await page.locator('input[formControlName="estoqueMinimo"]').count();
  const campoPontoRep = await page.locator('input[formControlName="pontoReposicao"]').count();
  if (campoEstMin > 0 && campoPontoRep > 0)
    log('PR01', '✅', 'campos estoqueMinimo e pontoReposicao presentes no modal');
  else
    log('PR01', '❌', `estoqueMinimo=${campoEstMin}, pontoReposicao=${campoPontoRep}`);

  // PR03: Coluna Est. Mín. na tabela
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  const colEstMin = await page.locator('th:has-text("Est. Mín")').count();
  if (colEstMin > 0) log('PR03', '✅', 'coluna "Est. Mín." na tabela de produtos');
  else log('PR03', '❌', 'coluna Est. Mín. não encontrada');

  // ─── D01: Dashboard badge ajuste_saida ───────────────────────────────────
  await page.goto(`${BASE}/dashboard`);
  await page.waitForTimeout(2000);
  const dashBadgeAjuste = page.locator('.badge').filter({ hasText: 'Aj. Saída' });
  const dashCount = await dashBadgeAjuste.count();
  if (dashCount > 0) {
    log('D01', '✅', 'badge "Aj. Saída" encontrado no dashboard');
  } else {
    const allDashBadges = await page.locator('tbody .badge').allTextContents();
    if (allDashBadges.length === 0) {
      log('D01', '⚠️', 'sem movimentações no dashboard para verificar badge');
    } else {
      // Verify no badge contains underscore (tipoLabel is working for known types)
      const badgesWithUnderscore = allDashBadges.filter(b => b.includes('_'));
      if (badgesWithUnderscore.length > 0)
        log('D01', '❌', `badges com underscore (tipoLabel falhando): ${badgesWithUnderscore.join(', ')}`);
      else
        log('D01', '✅', `tipoLabel funciona — badges sem underscore: ${allDashBadges.slice(0,5).map(b=>b.trim()).join(', ')}`);
    }
  }

  // ─── R06: Console errors ─────────────────────────────────────────────────
  const relevantErrors = consoleErrors.filter(e =>
    !e.includes('favicon') && !e.includes('net::ERR') && !e.includes('404')
  );
  if (relevantErrors.length === 0) log('R06', '✅', 'nenhum erro no console do browser');
  else log('R06', '⚠️', `${relevantErrors.length} erro(s): ${relevantErrors.slice(0, 2).join(' | ')}`);

} catch (err) {
  console.error('ERRO NO SCRIPT:', err.message);
  results.push({ id: 'SCRIPT', status: '❌', note: err.message });
} finally {
  await browser.close();
}

// ─── Relatório final ─────────────────────────────────────────────────────────
console.log('\n─────────────────────────────────────────');
console.log('RESULTADO DOS TESTES');
console.log('─────────────────────────────────────────');
const passed = results.filter(r => r.status === '✅').length;
const failed = results.filter(r => r.status === '❌').length;
const warn   = results.filter(r => r.status === '⚠️').length;
console.log(`✅ ${passed}  ❌ ${failed}  ⚠️ ${warn}  Total: ${results.length}`);
console.log('─────────────────────────────────────────');
results.forEach(r => console.log(`${r.status} ${r.id}  ${r.note}`));

// Salva JSON para atualização do TESTES_UI.md
fs.writeFileSync('verify-results.json', JSON.stringify(results, null, 2));
console.log('\nResultados salvos em verify-results.json');
