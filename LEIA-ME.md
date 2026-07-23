# FORGE 3D — Gerador Autônomo e Gratuito de Assets 3D para Jogos

**Site 100% local, sem API, sem servidor, offline, ilimitado.**  
Transformação do projeto DeadZone Mobile em um laboratório procedural de geração de assets game-ready.

> Digite "espada futurista plasma", "árvore pinheiro neve", "zumbi tank deadzone" e receba instantaneamente um modelo 3D pronto para Unity/Godot/Blender.

---

## 🚀 Como rodar

Service workers + importmaps precisam de HTTP (não `file://`).

```bash
cd Dead-zone
python3 -m http.server 8000
# abra http://localhost:8000
```

Ou `npx serve .`

Instalável como PWA: hospede em GitHub Pages / Netlify / Vercel, abra no celular e "Adicionar à tela inicial".

---

## 🎮 O que gera?

**Categorias:**
- **Arma**: espada, machado, martelo, pistola/laser/blaster, escudo
- **Prop**: caixa, barril, baú tesouro, poção, moeda, gema, lanterna
- **Natureza**: árvore carvalho, pinheiro, pedra/rocha, arbusto, cacto, cogumelo
- **Estrutura**: casa bruxa, torre, pilar, muro/barricada, ponte
- **Personagem**: humano low poly, robô, zumbi DeadZone (tank/runner), monstro
- **Veículo**: carro, nave espacial

Todos com variações de:
- **Seed determinístico**: mesmo prompt + mesmo seed = mesmo asset sempre (ótimo para versionar)
- **Complexidade 1-10**: controla poly count, detalhes extras
- **Estilo**: Low Poly, Voxel cúbico, Smooth stylized, Flat toon
- **Paleta**: auto (detectada pelo prompt), DeadZone (ferrugem), Floresta, Gelo, Lava, Tóxico, Ouro, Cyber neon

### Parser que entende PT-BR
Exemplos que funcionam:
- `espada longa rúnica enferrujada cabo osso`
- `pistola laser plasma neon futurista`
- `árvore pinheiro baixa neve`
- `pedra grande musgo irregular`
- `baú pirata ouro dourado`
- `casa bruxa madeira torta telhado caindo`
- `zumbi tank mutante carne exposição`
- `poção cura brilhante verde frasco vidro`
- `nave espacial pequena asas plasma`

Palavras detectadas: material (madeira, metal, osso, cristal), estado (enferrujado, velho), cor (verde, azul, gelo, lava, ouro, neon), tamanho (grande/pequeno), emissão (plasma, glow, neon, laser).

---

## 🧠 Como é Autônomo e Grátis?

**Nenhuma chamada externa para gerar.** Não usa OpenAI, Meshy, Luma ou Tripo. Todo modelo é construído via:

1. **Procedural Builders** (`js/forge/generators.js`): cada asset é um `THREE.Group` montado com primitivas (Box, Cylinder, Icosahedron, Cone) + distorção de vértices com noise + RNG seedado `mulberry32`.
2. **Gramática semântica leve** (`promptParser.js`): dicionário PT/EN mapeia keywords → gerador + hints de cor/material.
3. **WebGL local** com Three.js 0.160 (via CDN apenas para engine de render). Depois do primeiro load, funciona offline (service worker cacheia código).
4. **Exportadores 100% cliente**: `GLTFExporter` → `.GLB`, `OBJExporter` → `.OBJ`, `STLExporter` → `.STL`, + screenshot PNG.

Compatível direto com: **Unity (arrasta GLB), Unreal, Godot 4 (import GLB), Blender, etc.** Pivô centralizado, base em Y=0, escala ~1.6m normalizada, UVs automáticas, materiais PBR Standard (roughness/metalness + emissive se houver "glow").

---

## 📁 Estrutura

```
index.html
css/style.css  → UI dark tech com Geist font
js/forge/
  main.js           → Three scene, orbit controls, UI binding, biblioteca localStorage
  generators.js     → 28 funções createXXX(rng, opts) => THREE.Group
  promptParser.js   → parsePrompt() + KEYWORDS + COLOR_WORDS
  utils.js          → RNG, paletas, distortGeometry, centeredGroup, countStats
  exporter.js       → GLB/OBJ/STL/screenshot
manifest.json       → PWA FORGE3D
service-worker.js   → cache offline, ignora CDN three
```

**Quer adicionar um novo gerador?**

Edite `generators.js`:
```js
export function createMeuAsset(rng, opts){
  const G = new THREE.Group();
  // use rng.range(), rng.pick(), opts.palette, opts.complexity, opts.style
  // retorne G
}
```
E registre em `GENERATOR_MAP`.

---

## 🎁 Funcionalidades

- Gerar asset único ou **Pack com 9 variações** (seed random + variações)
- Biblioteca persistida em `localStorage` (thumbnail webp, filtro, clique para recarregar, clique direito para deletar)
- Stats live: verts/tris/meshes/kb
- Wireframe, auto-rotação, reset câmera
- Screenshot PNG direto do canvas 3D
- PWA instalável, funciona offline após primeira visita

## 🔜 Próximos passos (opcional)

- Voxelização real via array 3D + greedy meshing
- Rigging automático para personagens (mixamo skeleton simplificado)
- Pack exporter ZIP com vários GLBs
- Texture atlas procedural (canvas noise)

---

Feito a partir do DNA do **DeadZone Mobile PWA** — mantém a estética pós-apocalíptica, mas agora como fábrica infinita de conteúdo para jogos.
