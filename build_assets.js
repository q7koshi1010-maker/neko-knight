// assets/*.svg を読み、data URI 化して assets.js を生成する。
// 使い方: node build_assets.js
const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, 'assets');

// ファイル名 -> ARTキー
const MAP = {
  'cat_knight_idle.svg':'catIdle', 'cat_knight_walk.svg':'catWalk',
  'cat_knight_attack.svg':'catAttack', 'cat_knight_guard.svg':'catGuard',
  'dog_knight_idle.svg':'dogIdle', 'dog_knight_walk.svg':'dogWalk', 'dog_knight_attack.svg':'dogAttack', 'dog_knight_guard.svg':'dogGuard',
  'seal_mage_idle.svg':'sealIdle', 'seal_mage_walk.svg':'sealWalk', 'seal_mage_attack.svg':'sealAttack', 'seal_mage_guard.svg':'sealGuard',
  'penguin_idle.svg':'pengIdle', 'penguin_walk.svg':'pengWalk', 'penguin_attack.svg':'pengAttack', 'penguin_guard.svg':'pengGuard',
  'panda_idle.svg':'pandaIdle', 'panda_walk.svg':'pandaWalk', 'panda_attack.svg':'pandaAttack', 'panda_guard.svg':'pandaGuard',
  'rabbit_idle.svg':'rabbitIdle', 'rabbit_walk.svg':'rabbitWalk', 'rabbit_attack.svg':'rabbitAttack', 'rabbit_guard.svg':'rabbitGuard',
  'cheetah_idle.svg':'cheetahIdle', 'cheetah_walk.svg':'cheetahWalk', 'cheetah_attack.svg':'cheetahAttack', 'cheetah_guard.svg':'cheetahGuard',
  'weapon_gun.svg':'wpnGun', 'weapon_axe.svg':'wpnAxe', 'weapon_bat.svg':'wpnBat', 'player_bullet.svg':'bulletShot',
  'weapon_wand.svg':'wpnWand', 'weapon_hammer.svg':'wpnHammer', 'weapon_bow.svg':'wpnBow',
  'wand_shot.svg':'wpnWandShot', 'arrow.svg':'wpnArrow',
  'village_house.svg':'villageHouse', 'village_smith.svg':'villageSmith', 'village_hills.svg':'villageHills',
  'village_waterfall.svg':'villageWaterfall', 'village_ground.svg':'villageGround',
  'item_apple.svg':'itemApple', 'item_candy.svg':'itemCandy', 'helmet.svg':'gearHelmet',
  'star.svg':'star', 'heart.svg':'heart',
  'shark.svg':'shark', 'bat.svg':'bat', 'ghost.svg':'ghost',
  'flame_demon.svg':'flameDemon', 'mage.svg':'mage', 'cloud_enemy.svg':'cloudEnemy',
  'reaper.svg':'reaper', 'fireball.svg':'fireball', 'magic_bolt.svg':'magicBolt',
  'bg_hills.svg':'bgHills', 'bg_bushes.svg':'bgBushes', 'ground_tile.svg':'groundTile',
  'deco_cloud.svg':'decoCloud', 'signpost_goal.svg':'signpost'
};

const out = {};
let missing = [];
for (const [file, key] of Object.entries(MAP)) {
  const fp = path.join(dir, file);
  if (!fs.existsSync(fp)) { missing.push(file); continue; }
  let svg = fs.readFileSync(fp, 'utf8').trim();
  // 余分な XML 宣言があれば除去（data URI では不要）
  svg = svg.replace(/^<\?xml[^>]*\?>\s*/, '');
  const b64 = Buffer.from(svg, 'utf8').toString('base64');
  out[key] = 'data:image/svg+xml;base64,' + b64;
}

const js = 'window.ART = ' + JSON.stringify(out, null, 0) + ';\n';
fs.writeFileSync(path.join(__dirname, 'assets.js'), js);
console.log('assets.js を生成:', Object.keys(out).length, '件');
if (missing.length) console.log('未作成(プレースホルダ表示):', missing.join(', '));
