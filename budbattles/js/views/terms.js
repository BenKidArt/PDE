// TERMS PAGE: loads content/terms.<lang>.html (edit those files to change the text).
import { getLang } from '../i18n.js';

export async function renderTerms(root) {
  const res = await fetch(`content/terms.${getLang()}.html`);
  root.innerHTML = `<article class="card prose">${await res.text()}</article>`;
}
