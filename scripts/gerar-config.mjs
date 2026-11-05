// Gera apiUrl (environment.prod.ts) e CSP connect-src (index.html) a partir de UMA fonte:
// variável de ambiente API_URL; se ausente, o arquivo config/api-url.txt.
// Falha com mensagem clara se a URL for inválida. Uso: node scripts/gerar-config.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');

export function origemValida(bruto) {
  let url;
  try { url = new URL((bruto ?? '').trim()); } catch { return null; }
  if (url.protocol !== 'https:') return null;
  if (url.pathname !== '/' || url.search || url.hash || url.username) return null;
  return url.origin;
}

export function aplicar(origem, prod, html) {
  const novoProd = prod.replace(/apiUrl:\s*'[^']*'/, `apiUrl: '${origem}'`);
  const novoHtml = html.replace(/connect-src 'self'[^"]*"/, `connect-src 'self' ${origem}"`);
  if (novoProd === prod && !prod.includes(`'${origem}'`)) throw new Error('apiUrl não encontrado em environment.prod.ts');
  if (!novoHtml.includes(`connect-src 'self' ${origem}"`)) throw new Error('connect-src não encontrado em index.html');
  return { prod: novoProd, html: novoHtml };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const arquivoUrl = join(raiz, 'config', 'api-url.txt');
  const bruto = process.env.API_URL?.trim() || readFileSync(arquivoUrl, 'utf8');
  const origem = origemValida(bruto);
  if (!origem) {
    console.error(`API_URL inválida: "${bruto.trim()}". Use uma origem https sem caminho (ex.: https://api.exemplo.com).`);
    process.exit(1);
  }
  const caminhoProd = join(raiz, 'src', 'environments', 'environment.prod.ts');
  const caminhoHtml = join(raiz, 'src', 'index.html');
  const r = aplicar(origem, readFileSync(caminhoProd, 'utf8'), readFileSync(caminhoHtml, 'utf8'));
  writeFileSync(caminhoProd, r.prod);
  writeFileSync(caminhoHtml, r.html);
  console.log(`API_URL = ${origem} (environment.prod.ts e CSP atualizados)`);
}
