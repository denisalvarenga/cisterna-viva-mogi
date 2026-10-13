# Cisterna Viva

Site estático (HTML + CSS + JS, sem build e sem dependências).

## Como executar
O service worker exige `http://`, então não abra o arquivo com duplo clique. Na pasta do projeto:

```
python3 -m http.server 8080
```
Abra http://localhost:8080. A primeira visita precisa de internet (fotos, fontes do Google, lista do IBGE); depois o app abre offline.

## Estrutura
- `index.html` — todas as telas (rotas por `#/inicio`, `#/calculadora`, `#/reservatorio`, `#/guias`, `#/apoio`, `#/fontes`).
- `css/styles.css` — identidade visual e responsividade.
- `js/data.js` — fotografias (com autoria), perfis de chuva, coeficientes, guias, dicas e fontes.
- `js/app.js` — calculadora, reservatório, busca de municípios (IBGE + cache), rotas.
- `assets/images/brand/` — marca oficial: `cisterna-viva-logo.png` (original, intacto) e `cisterna-viva-wordmark.png` (recorte do nome, feito a partir do original). Não substituir por SVG nem texto.
- `sw.js` — cache offline. **Troque `VERSION` a cada publicação.**
- `CREDITOS.md` — fotografias e licenças.

## Dados guardados no aparelho
`localStorage`: `cisterna-viva:v2` (preferências, reservatório) e `cisterna-viva:municipios:v2` (cópia da lista do IBGE, renovada após 7 dias).
