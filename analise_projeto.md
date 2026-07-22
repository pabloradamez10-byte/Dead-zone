# Análise Detalhada do Projeto: DeadZone Mobile (PWA)

Esta é uma análise técnica abrangente da arquitetura, estrutura, mecânicas de jogabilidade e oportunidades de evolução do **DeadZone Mobile**, um jogo de sobrevivência 2D desenvolvido com tecnologias web nativas (**HTML5 Canvas, CSS moderno e Vanilla JavaScript**) usando módulos ES6 e capacidades de **PWA (Progressive Web App)**.

---

## 1. Visão Geral do Projeto

O **DeadZone Mobile** é um port otimizado para web/mobile de um jogo de sobrevivência originalmente planejado/construído em Unity. Ele foi projetado para rodar diretamente no navegador, com foco em dispositivos móveis, permitindo a instalação nativa na tela inicial (homescreen) e funcionamento totalmente offline graças a um **Service Worker** integrado.

### Principais Características
* **Zero dependências externas robustas:** O jogo carrega apenas uma fonte do Google Fonts via CDN na primeira visita; de resto, utiliza apenas APIs nativas do ecossistema Web (Canvas 2D, LocalStorage, Pointer Events).
* **Foco em Mobile-First:** Controles otimizados por meio de um Joystick virtual flutuante e botões de ação circulares posicionados ergonomicamente.
* **Estética imersiva:** Paleta rústica (tons verde-musgo, ferrugem, osso), tipografia futurista/industrial (*Rajdhani* para HUD/títulos e *JetBrains Mono* para textos técnicos), simulando uma interface de sobrevivência pós-apocalíptica.

---

## 2. Estrutura do Código e Arquitetura

O projeto adota uma arquitetura modular baseada em **ES6 Modules (`import`/`export`)**, o que promove alta coesão e baixo acoplamento entre os diferentes subsistemas. Abaixo está a descrição detalhada das responsabilidades de cada arquivo:

### A. Núcleo e Ciclo de Jogo (Game Loop)
* **`index.html`**: Ponto de entrada. Declara a estrutura do Canvas, os Overlays (Menu Principal, Tela de Morte), o HUD (barras de status, joystick virtual, botões rápidos) e os painéis de Inventário e Crafting. Carrega o script principal como `type="module"`.
* **`js/main.js`**: Orquestrador central. Gerencia o ciclo de jogo (Game Loop) implementado via `requestAnimationFrame` com cálculo de delta time (`dt`) para garantir que a velocidade física/movimento seja independente da taxa de quadros (FPS) do dispositivo. Ele cuida do input de ataque, gerenciamento de estados (Menu -> Jogando -> Game Over), detecção de colisão simples (coleta de itens e ataques corpo-a-corpo) e renderização coordenada no Canvas.

### B. Entidades do Jogo (Atores)
* **`js/player.js` (`Player`)**: Representa o jogador. Armazena e atualiza os atributos físicos e de sobrevivência (Vida, Stamina, Fome, Sede) e estados especiais (Infecção por mordida e Sangramento). Regula o consumo de itens e o desgaste de fome/sede baseado em tempo decorrido.
* **`js/zombie.js` (`Zombie` e `ZombieSpawner`)**: 
  * A classe `Zombie` gerencia os três tipos de zumbis implementados (**Normal**, **Runner** e **Tank**), cada um com multiplicadores distintos de velocidade, vida, dano e raio de colisão. Implementa uma inteligência artificial básica (perseguição linear direcionada ao jogador quando este entra no `detectionRange` e ataque com cooldown discreto). Também contém uma mecânica de "grito" (`scream`) para alertar e atrair zumbis próximos.
  * A classe `ZombieSpawner` gerencia o nascimento de novos zumbis em um anel de distância (fora do campo visual imediato do jogador) limitando a quantidade máxima simultânea para evitar gargalos de processamento.

### C. Simulação de Ambiente e Economia de Itens
* **`js/world.js` (`DayNightCycle`)**: Controla o tempo de jogo e o ciclo dia/noite. Altera dinamicamente o `lightLevel` (usando uma curva cossoidal suave para transição entre o dia e a noite). O nível de luz afeta diretamente a escuridão do mapa e a agressividade do `ZombieSpawner` (gerando mais zumbis em intervalos mais curtos à noite).
* **`js/items.js` (`Inventory` e funções de utilidade)**: Define a lista de itens (`ITEM_DB`), tabela de saques (`LOOT_TABLE`) ponderada por probabilidades (`LOOT_WEIGHTS`) e receitas de criação (`RECIPES`). A classe `Inventory` encapsula o limite de slots, adição/remoção e verificação de itens, atuando como o modelo de dados para o inventário do jogador.

### D. Interface de Usuário (UI) e Persistência
* **`js/ui.js` (`Joystick`, `HUD`, `InventoryPanel`, `CraftPanel`)**: Isola a lógica visual do HTML/DOM do código de simulação do Canvas.
  * `Joystick` captura eventos de ponteiro nativos (`PointerEvents`), oferecendo suporte multiplataforma (mouse e touch) para calcular o vetor de movimento normalizado.
  * `HUD`, `InventoryPanel` e `CraftPanel` gerenciam o preenchimento de barras de progresso CSS, renderização de tabelas e atualização de caixas de diálogo dinamicamente.
* **`js/save.js`**: Fornece funções utilitárias para serializar o estado atual do jogador (posição, vida, inventário, kills) e do mundo (dia e hora) em uma string JSON e salvá-los no `localStorage` do navegador para persistência de progresso.

### E. Distribuição (PWA)
* **`manifest.json`**: Configura o jogo como aplicativo web instalável, definindo ícones, cor de fundo, orientação da tela (idealmente livre ou retrato/paisagem) e o modo de exibição `standalone` (oculta a barra do navegador).
* **`service-worker.js`**: Intercepta requisições de rede para servir arquivos essenciais (HTML, CSS, JS, Ícones e Fontes) diretamente do cache offline, garantindo que o jogo inicie instantaneamente mesmo sem acesso à internet.

---

## 3. Análise da Engine Gráfica e Renderização

Diferente de engines prontas (Phaser, PixiJS), o **DeadZone Mobile** desenha tudo diretamente na API do **Canvas 2D**, o que exige boas práticas de performance para renderização estável em telas de alta densidade de pixels (Retina/AMOLED):

1. **Suporte a High-DPI (`devicePixelRatio`)**: O arquivo `main.js` redimensiona o Canvas multiplicando sua largura e altura pelo fator de densidade física do display e aplicando uma escala proporcional via `ctx.setTransform`. Isso impede que as linhas e fontes fiquem embaçadas em telas modernas de celulares.
2. **Câmera Baseada em Translação**: Em vez de mover o mundo real, o Canvas utiliza coordenadas absolutas para as entidades e centraliza a câmera na coordenada do jogador (`camera.x` e `camera.y`). As posições de desenho no ecrã são traduzidas por:
   $$\text{ScreenX} = \text{WorldX} - \text{CameraX} + \frac{\text{ScreenWidth}}{2}$$
   Isso permite simular um mundo potencialmente infinito com baixo esforço geométrico.
3. **Efeito de Iluminação Dinâmica**: A escuridão noturna é representada por um **gradiente radial dinâmico** centrado no jogador. O raio interno permanece transparente (representando a visão próxima ou uma lanterna de 360º), enquanto as bordas externas misturam-se com um tom escuro/esverdeado proporcional ao nível de escuridão calculado pelo `DayNightCycle`.

---

## 4. Pontos Fortes do Projeto

1. **Desempenho Extremo**: Por não carregar bibliotecas ou frameworks pesados, o tamanho total do download inicial do jogo é inferior a **50 KB** (excluindo ícones e fontes). A inicialização e o uso de CPU/memória são mínimos.
2. **Excelente UX Mobile**: O uso de `PointerEvents` evita o atraso de 300ms de toque clássico e funciona de maneira uniforme em iOS e Android. Áreas seguras (`safe-area-inset`) no CSS impedem que entalhes (notches) ou barras nativas de navegação cubram os botões de ação ou os indicadores do HUD.
3. **Equilíbrio de Loop de Sobrevivência**: As mecânicas de fome e sede exercem pressão constante no jogador, criando uma sinergia natural com a necessidade de coletar recursos dos zumbis mortos e fabricar kits médicos/ataduras.
4. **Acoplamento Inteligente**: A separação entre as classes de dados físicas (`Player`, `Zombie`) e de interface (`HUD`, `InventoryPanel`) facilita testes automatizados e substituições de interface no futuro (ex: migrar a UI de DOM/HTML para renderização direta no Canvas).

---

## 5. Próximos Passos e Oportunidades de Melhoria

Para expandir o **DeadZone Mobile** de um excelente protótipo para um jogo completo altamente engajador, recomendam-se as seguintes melhorias técnicas:

### Curto Prazo (Otimizações & Polimento)
* **Persistência do Mundo**: Atualmente, ao salvar o jogo, os zumbis ativos e os itens jogados no chão são perdidos. Estender o `save.js` e o `main.js` para registrar as coordenadas e tipos dos itens e inimigos ativos no mapa traria maior imersão.
* **Retorno Sonoro (SFX/BGM)**: Implementar efeitos sonoros básicos usando a **Web Audio API** (sons de passos, golpes de faca/melee, gemidos de zumbis e alertas de pouca vida). Sendo nativa, ela não compromete a performance e funciona de forma síncrona.
* **Sistema de Feedback de Dano (Floating Numbers / Screenshake)**: Adicionar pequenos textos flutuantes vermelhos no Canvas ao causar/receber dano, bem como um leve tremor de câmera (*screenshake*) quando o jogador for atacado.

### Médio Prazo (Novas Mecânicas)
* **Obstáculos e Colisões Estáticas**: Introduzir estruturas no mapa (árvores, ruínas de bases, cercas). Isso exigiria:
  * Um algoritmo básico de resolução de colisão por círculo/retângulo no movimento do jogador e zumbis.
  * Ajustes na IA dos zumbis (atualmente linear) para contornar obstáculos ou destruí-los.
* **Armas de Fogo e Sistema de Mira**: Implementar armas de fogo (pistola, rifle) com munição limitada. Para controle móvel, poderia ser adicionado um segundo joystick de mira/disparo à direita (estilo *Twin-Stick Shooter*).
* **Construção de Bases (Fortificação)**: Como já existe um item de "Reforço de Base" criado a partir de madeira nas receitas de Crafting, seria incrível permitir que o jogador posicionasse barreiras físicas no mapa usando coordenadas do Canvas para atrasar ou se proteger de hordas de zumbis.

### Longo Prazo (Arquitetura & Escalabilidade)
* **Mundo Baseado em Chunks ou Tilemap**: Para substituir o grid genérico por biomas e estradas reais, permitindo uma exploração rica e cenários fixos (como casas de suprimento abandonadas).
* **Object Pooling (Agrupamento de Objetos)**: O spawner cria novas instâncias de `Zombie` e as deleta do array constantemente, o que aciona o Coletor de Lixo (Garbage Collector) do JavaScript, gerando microgargalos periódicos. Implementar um pool para reaproveitar instâncias inativas de zumbis melhorará drasticamente a consistência do framerate em dispositivos de baixo custo.
