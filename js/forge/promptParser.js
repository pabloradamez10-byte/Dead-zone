export const KEYWORDS = {
  weapon: {
    sword: ["espada","sword","katana","lamina","blade","sabre"],
    axe: ["machado","axe","machadinha"],
    hammer: ["martelo","hammer","malho"],
    gun: ["arma","pistola","rifle","gun","blaster","fuzil","laser","phaser","shotgun"],
    shield: ["escudo","shield","buckler"]
  },
  prop: {
    crate: ["caixa","crate","caixote","box"],
    barrel: ["barril","barrel","tonel"],
    chest: ["bau","baú","chest","tesouro"],
    potion: ["pocao","poção","potion","frasco","elixir","garrafa","bottle"],
    coin: ["moeda","coin","ouro","gold"],
    gem: ["gema","gem","cristal","crystal","diamante"],
    lantern: ["lanterna","lamp","tocha","torch","light"]
  },
  nature: {
    tree_pine: ["pinheiro","pine","conifer","abeto"],
    tree_oak: ["arvore","árvore","tree","carvalho","oak","birch"],
    rock: ["pedra","rocha","rock","stone","boulder","pedregulho"],
    bush: ["arbusto","bush","moita","mato"],
    cactus: ["cacto","cactus","cactos"],
    mushroom: ["cogumelo","mushroom","fungo"]
  },
  structure: {
    house: ["casa","house","cabana","hut","moradia","choupana","bruxa","witch"],
    tower: ["torre","tower","watchtower","farol"],
    pillar: ["pilar","coluna","pillar","column"],
    wall: ["muro","parede","wall","barricada"],
    bridge: ["ponte","bridge"]
  },
  character: {
    human: ["personagem","humano","humana","player","survivor","humanoide","character","human"],
    robot: ["robo","robô","robot","droid","android","mech"],
    zombie: ["zumbi","zombie","infected","morto","walker","deadzone","mutante","tank","runner"],
    monster: ["monstro","monster","criatura","beast","ogro","demon"]
  },
  vehicle: {
    car: ["carro","car","veiculo","veículo","automovel","jeep","truck"],
    spaceship: ["nave","spaceship","foguete","rocket","ship","ufo","shuttle"]
  }
};

const COLOR_WORDS = {
  "#b5451b": ["ferrugem","rust","enferrujado","vermelho","red"],
  "#8a9a3c": ["verde","green","musgo","toxic","veneno"],
  "#e8e2d0": ["osso","bone","branco","white","bege"],
  "#7fd8ff": ["gelo","ice","azul","blue","frio","neve","snow"],
  "#ffcc33": ["dourado","gold","amarelo","yellow","ouro"],
  "#2b5a2b": ["floresta","forest","selva","natureza"],
  "#ff2a00": ["lava","fogo","fire","magma","inferno"],
  "#00fff0": ["cyber","neon","futurista","future","sci-fi","plasma"],
  "#8c6239": ["madeira","wood","carvalho","oak","tronco"],
  "#4a4a4a": ["metal","metalico","aço","iron","dark"]
};

export const CATEGORY_FALLBACKS = {
  weapon: "sword",
  prop: "crate",
  nature: "rock",
  structure: "house",
  character: "human",
  vehicle: "car"
};

export function normalize(text){
  return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
}

export function parsePrompt(promptRaw){
  const raw = (promptRaw||"").trim();
  const text = normalize(raw);
  let foundCategory = "prop";
  let foundType = "crate";
  let confidence = 0;

  outer:
  for(const [cat, types] of Object.entries(KEYWORDS)){
    for(const [type, words] of Object.entries(types)){
      for(const w of words){
        const wn = normalize(w);
        if(text.includes(wn)){
          foundCategory = cat;
          foundType = type;
          confidence++;
          break outer;
        }
      }
    }
  }
  // if not found, second pass weaker?
  if(confidence===0 && text.length>0){
    // pick random based on some heuristics
    if(text.includes("zumbi")||text.includes("dead")){
      foundCategory="character"; foundType="zombie";
    } else if(text.length<12){
      // short -> weapon
      foundCategory="weapon"; foundType="sword";
    }
  }

  // detect colors
  let detectedColors = [];
  for(const [hex, words] of Object.entries(COLOR_WORDS)){
    for(const w of words){
      if(text.includes(normalize(w))){
        detectedColors.push(hex);
      }
    }
  }
  if(detectedColors.length===0) detectedColors=null;

  // detect material hints
  const hints = {
    wood: text.includes("madeira")||text.includes("wood")||text.includes("tronco"),
    metal: text.includes("metal")||text.includes("ferro")||text.includes("steel")||text.includes("ferrugem"),
    organic: text.includes("carne")||text.includes("mutante")||text.includes("flesh"),
    crystall: text.includes("cristal")||text.includes("gem"),
    rusty: text.includes("enferrujado")||text.includes("rust")||text.includes("velho"),
    icy: text.includes("gelo")||text.includes("ice")||text.includes("neve"),
    glowing: text.includes("brilho")||text.includes("glow")||text.includes("plasma")||text.includes("laser")||text.includes("neon")
  };

  // size hint
  let scaleHint = 1;
  if(text.includes("grande")||text.includes("big")||text.includes("giant")||text.includes("enorme")) scaleHint=1.7;
  if(text.includes("pequeno")||text.includes("small")||text.includes("tiny")||text.includes("mini")) scaleHint=0.6;

  return {
    raw,
    text,
    category: foundCategory,
    type: foundType,
    colors: detectedColors,
    hints,
    scaleHint
  };
}

export function listAllKeywords(){
  let lines=[];
  for(const [cat, types] of Object.entries(KEYWORDS)){
    lines.push(`[${cat.toUpperCase()}]`);
    for(const [type, words] of Object.entries(types)){
      lines.push(`  ${type}: ${words.join(", ")}`);
    }
  }
  lines.push("\n[COR] use palavras como: ferrugem, verde, osso, gelo, ouro, madeira, lava, cyber, etc");
  lines.push("[TAMANHO] grande/pequeno, [ESTILO] voxel, low poly, futurista, viking, bruxa, pirata");
  return lines.join("\n");
}
