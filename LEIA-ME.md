# DeadZone Mobile — PWA

Versão web do mesmo jogo, jogável direto no navegador e instalável como app
(ícone na tela inicial, funciona offline). Sem dependências externas além de
uma fonte do Google Fonts (carregada via CDN, só precisa de internet na
primeira visita).

## Como rodar localmente

Service workers **não funcionam** abrindo o `index.html` direto com
`file://` — precisa de um servidor HTTP, mesmo que local.

Com Python instalado:
```bash
cd DeadZonePWA
python3 -m http.server 8000
```
Depois abra `http://localhost:8000` no navegador (ou no celular, usando o IP
da sua máquina na mesma rede Wi-Fi, ex: `http://192.168.0.10:8000`).

Ou com Node:
```bash
npx serve DeadZonePWA
```

## Como instalar como app no celular

1. Suba a pasta num host qualquer com HTTPS (GitHub Pages, Netlify, Vercel,
   Cloudflare Pages — todos têm plano grátis e servem estático direto de uma
   pasta).
2. Abra a URL no Chrome (Android) ou Safari (iOS).
3. Android: menu → "Adicionar à tela inicial" / vai aparecer um prompt de
   instalação automático.
   iOS: botão de compartilhar → "Adicionar à Tela de Início".
4. O ícone abre em tela cheia, sem barra de navegador, e funciona offline
   depois da primeira visita (o service worker cacheia tudo).

## Sistemas implementados (equivalentes à versão Unity)

| Sistema | Arquivo | Equivalente Unity |
|---|---|---|
| Movimento + joystick virtual | `js/ui.js` (`Joystick`) + `js/player.js` | `PlayerMovement.cs` + `FloatingJoystick.cs` |
| Vida / stamina / fome / sede | `js/player.js` | `PlayerStats.cs` |
| Infecção (vira zumbi em 120s) | `js/player.js` | `InfectionSystem.cs` |
| Sangramento | `js/player.js` | `BleedingSystem.cs` |
| Inventário | `js/items.js` (`Inventory`) | `Inventory.cs` |
| Crafting | `js/items.js` (`RECIPES`, `craft()`) | `CraftingSystem.cs` |
| IA de zumbi (persegue, ataca) | `js/zombie.js` | `ZombieAI.cs` |
| Tipos de zumbi (normal/runner/tank) | `js/zombie.js` | `ZombieStats.cs` |
| Spawner com raio e limite | `js/zombie.js` (`ZombieSpawner`) | `ZombieSpawner.cs` |
| Loot ao matar zumbi | `js/items.js` (`rollLoot`) + `main.js` | `LootTable.cs` / `ItemDrop.cs` |
| Ciclo dia/noite (afeta spawn) | `js/world.js` | `DayNightCycle.cs` |
| Save/load | `js/save.js` (localStorage) | `SaveSystem.cs` |
| HUD (barras, infecção, kills) | `js/ui.js` (`HUD`) | `UIManager.cs` |
| Menu principal / tela de morte | `index.html` + `main.js` | `MainMenu.cs` |

## Diferenças conscientes em relação à versão Unity

- **Sem arma de fogo** nesta versão (só melee) pra manter o escopo enxuto;
  dá pra portar o `Gun.cs` como um `Gun` similar em `js/` se você quiser —
  o raycast vira um teste de distância + direção simples em 2D.
- **Câmera segue o player** centralizando o mundo no canvas, ao invés de
  cenas fixas com Ground/Tilemap.
- **Escuridão noturna** é um gradiente radial ao redor do player (fica
  praticamente cego longe da luz), no lugar da `Light2D`/`Directional Light`
  da Unity.
- Estilo visual: paleta rústica verde-musgo/ferrugem, tipografia Rajdhani
  (títulos/HUD) + JetBrains Mono (textos), pra remeter a apocalipse rural em
  vez do visual genérico de painel escuro.

## Limitações conhecidas / próximos passos

- Não testei em dispositivo real — só revisei a sintaxe (`node --check` em
  todos os `.js` e validação do `manifest.json`). Roda em qualquer navegador
  moderno com Canvas 2D e Service Worker, mas teste no seu celular antes de
  confiar 100%.
- O dano de infecção/sangramento é probabilístico por ataque recebido (15%
  e 8% de chance), não por tempo de exposição — mais fácil de balancear no
  código depois, se quiser.
- Sem persistência de mundo (posição dos zumbis, itens no chão não são
  salvos) — só o estado do jogador e o relógio dia/noite são salvos. Dá pra
  estender `save.js` se quiser salvar isso também.
