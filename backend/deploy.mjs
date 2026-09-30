#!/usr/bin/env node
/*
 * Deploy do backend (Apps Script) — Casa Fuerte Misión Social.
 *
 * O que faz:
 *   1) clasp push -f   -> sobe Code.gs + appsscript.json para o projeto Apps Script
 *   2) clasp deploy -i <DEPLOYMENT_ID> -> republica a MESMA Web App (mantém a URL /exec)
 *
 * Pré-requisitos (feitos UMA vez — ver SETUP.md):
 *   - npm run login            (clasp login — autoriza sua conta Google)
 *   - .clasp.json presente     (com o scriptId do projeto)
 *   - .deploy.json presente    (com { "deploymentId": "AKfyc..." }) — NÃO versionado
 *
 * Uso no dia a dia:  npm run deploy
 */
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

function fail(msg) {
  console.error('\n❌ ' + msg + '\n');
  process.exit(1);
}
function run(cmd) {
  console.log('▶ ' + cmd);
  execSync(cmd, { stdio: 'inherit' });
}

// 1) Checagens
if (!existsSync('.clasp.json')) {
  fail('.clasp.json não encontrado. Rode a configuração inicial (ver SETUP.md, passo "clasp clone/create" ou preencha o scriptId).');
}
if (!existsSync('.deploy.json')) {
  fail('.deploy.json não encontrado. Crie-o com:\n   { "deploymentId": "SEU_DEPLOYMENT_ID" }\n(pegue o Deployment ID em Apps Script → Implementar → Gestionar implementaciones).');
}

let deploymentId;
try {
  deploymentId = JSON.parse(readFileSync('.deploy.json', 'utf8')).deploymentId;
} catch (e) {
  fail('.deploy.json inválido (não é JSON válido).');
}
if (!deploymentId || deploymentId.startsWith('SEU_') || deploymentId.startsWith('COLE_')) {
  fail('deploymentId ausente/placeholder em .deploy.json. Coloque o ID real da implementação.');
}

// 2) Push + redeploy
try {
  run('clasp push -f');
  run(`clasp deploy -i ${deploymentId} -d "auto-deploy $(date -u +%Y-%m-%dT%H:%M:%SZ)"`);
  console.log('\n✅ Deploy concluído. A URL /exec da Web App permanece a mesma.\n');
} catch (e) {
  fail('Falha no deploy. Se disse "User has not enabled the Apps Script API", ative em https://script.google.com/home/usersettings e tente de novo. Se disse credencial/login, rode: npm run login');
}
