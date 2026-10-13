# Créditos de fotografia — Cisterna Viva

Todas as fotografias vêm do **Pexels** e são usadas sob a [Licença Pexels](https://www.pexels.com/license/): uso gratuito, inclusive em sites e apps, com modificação permitida. Atribuição não é obrigatória, mas é feita aqui e na tela "Fontes e créditos". Restrições da licença: não vender cópias sem alteração, não sugerir endosso de pessoas ou marcas, não usar como marca.

As imagens **não estão no projeto**: o navegador as baixa da CDN do Pexels (`images.pexels.com`) e o service worker guarda uma cópia depois da primeira visita. Se uma imagem não carregar, a interface mostra um bloco de cor com aviso.

Acesso às páginas em 12/10/2026. Descrição e autoria foram lidas nas páginas originais; **a localização só é afirmada quando a página a informa**.

| Uso no site | Foto | Autoria | Página | Observação |
|---|---|---|---|---|
| Destaque inicial e passo "Guarde" | Três reservatórios verdes ao lado de uma casa de fazenda | Magda Ehlers | https://www.pexels.com/photo/13772681/ | Local não informado. |
| Passo "Capte" | Gotas de chuva escorrendo de uma calha | Zeynep Sude Emek | https://www.pexels.com/photo/20113440/ | Local não informado. |
| Reserva (não usada na tela inicial) | Chuva escorrendo de telha ondulada | Nguyễn Hữu Nhã | https://www.pexels.com/photo/9586507/ | Long Khánh, Vietnã. |
| Passo "Faça render" | Plantas regadas em estufa no Brasil | Melquizedeque Almeida | https://www.pexels.com/photo/30619296/ | Brasil. |
| Seção "Apoio público" | Vista aérea de vilarejo rural em Alagoas | Silvio Fotografias | https://www.pexels.com/photo/36921845/ | Alagoas. |
| Guia "Fossa séptica" | Estrada de terra vermelha em área rural | Michael Antonio Dias | https://www.pexels.com/photo/37068279/ | Palmital (SP). Foto de contexto rural, não mostra uma fossa. |
| Guia "Filtro de barro" | Água sendo servida de uma jarra em um copo | cottonbro studio | https://www.pexels.com/photo/6857798/ | Foto ilustrativa; não mostra um filtro de barro. |
| Guia "SODIS" | Três garrafas plásticas transparentes com água | Suzy Hazelwood | https://www.pexels.com/photo/2479095/ | Foto ilustrativa; não mostra o processo SODIS. |

## Pendências recomendadas
- Não encontrei, com as ferramentas disponíveis, fotos específicas de **cisterna de placas**, **fossa séptica** ou **filtro de barro**. Se tiver fotos próprias ou de acervos públicos (por exemplo Wikimedia Commons), substitua as entradas em `js/data.js` (objeto `PHOTOS`).
- Para funcionar 100% offline desde a primeira visita, baixe as fotos, otimize (WebP/JPEG, até ~1600 px), coloque em `img/` e aponte `PHOTOS` para os caminhos locais.

## Outros dados
- Municípios: API de Localidades do IBGE (https://servicodados.ibge.gov.br/api/docs/localidades), com cópia no navegador.
- Os guias de saneamento são resumos orientativos, **sem revisão profissional documentada**.
