/* ネコの騎士のぼうけん — 横スクロールアクション エンジン
   ART は assets.js が window.ART = { key: dataURI } で提供。未定義キーは
   カラーのプレースホルダで描画されるので、アートが無くても動作する。        */
(() => {
'use strict';

// ---------- サウンド簡易呼び出し ----------
const snd = n => { if(window.GameAudio) GameAudio.play(n); };
const music = f => { if(window.GameAudio) GameAudio.music(f); };
const unlockAudio = () => { if(window.GameAudio) GameAudio.unlock(); };

// ---------- 定数 ----------
const WORLD_H = 540;              // 仮想ワールドの高さ（描画はこれをスケール）
const GRAV = 2200;               // 重力 (px/s^2)
const MOVE = 320;                // 移動速度
const JUMP_V = 780;              // ジャンプ初速
const BOOT_JUMP_V = 900;         // ジャンプ靴を履いた時の高いジャンプ初速
const MAX_FALL = 1200;
const HELMET_MAX = 1;            // ヘルメット1個が受け止められるダメージ回数（1回でこわれる）
const BOOT_COST = 40;            // ジャンプ靴の値段（買い切り）
const HELMET_COST = 10;          // 使いすてヘルメット1個の値段
const BOMB_COST = 100;           // 使いすて爆弾1個の値段
const BOMB_DMG = 2;              // 爆弾1回の攻撃力（＝ふつうの攻撃2回分）
const BOMB_RANGE = 170;          // 爆弾の効果はんい（プレイヤーからの半径）
const COYOTE = 0.09;             // 地面を離れてもジャンプ可能な猶予
const JUMP_BUF = 0.10;           // ジャンプ入力の先行受付
const TILE = 60;                 // 地面の基準タイル
const GROUND_Y = WORLD_H - 90;   // 地面の上面

// ---------- キャンバス ----------
const cv = document.getElementById('cv');
const ctx = cv.getContext('2d');
const MIN_VW = 940;              // 最低でも見える横幅（世界座標）
let VW = 960, VH = WORLD_H, scale = 1, dpr = 1, originY = 0;
function resize(){
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  // 0サイズ（非表示ペイン等）でも NaN/Infinity にならないようフォールバック
  const w = cv.clientWidth || 960, h = cv.clientHeight || 540;
  cv.width = Math.max(1, Math.round(w*dpr)); cv.height = Math.max(1, Math.round(h*dpr));
  // まず高さフィット。横が狭すぎる（縦長）なら横フィットに切替え、上下センタリング。
  let s = cv.height/WORLD_H;
  if(!(s>0)) s = 1;
  if(cv.width/s < MIN_VW) s = cv.width/MIN_VW;
  if(!(s>0)) s = 1;
  scale = s;
  originY = Math.max(0, (cv.height - WORLD_H*scale)/2);  // 上下の余白（デバイスpx）
  VH = WORLD_H; VW = cv.width/scale;
  if(!isFinite(VW) || VW<=0) VW = MIN_VW;
}
// 表示サイズ（CSSの実寸）と内部解像度(cv.width/height)がズレていたら作り直す。
// iPad/スマホは回転・アドレスバー開閉・PWA起動直後などで、間違ったサイズで一度だけ
// resize が走ると、以降そのままCSSに引き伸ばされて“横伸び”する。毎フレーム比べて直す。
function fitCanvas(){
  const d = Math.min(window.devicePixelRatio || 1, 2);
  const bw = Math.max(1, Math.round((cv.clientWidth  || 960) * d));
  const bh = Math.max(1, Math.round((cv.clientHeight || 540) * d));
  if(bw !== cv.width || bh !== cv.height) resize();   // ズレているときだけ（＝毎フレームcanvasを消さない）
}
window.addEventListener('resize', fitCanvas);
window.addEventListener('orientationchange', ()=>{ fitCanvas(); setTimeout(fitCanvas, 300); });
if(window.ResizeObserver){ try{ new ResizeObserver(fitCanvas).observe(cv); }catch(e){} }

// ---------- アセット読み込み ----------
const IMG = {};              // key -> HTMLImageElement (loaded)
const PLACE = {              // フォールバック色
  catIdle:'#fdfdfb', catWalk:'#fdfdfb', catAttack:'#fdfdfb', catGuard:'#fdfdfb', star:'#ffd23f',
  dogIdle:'#fdfbf5', dogWalk:'#fdfbf5', dogAttack:'#fdfbf5', dogGuard:'#fdfbf5',
  sealIdle:'#f4f6fb', sealWalk:'#f4f6fb', sealAttack:'#f4f6fb', sealGuard:'#f4f6fb',
  pengIdle:'#1a1a1a', pengWalk:'#1a1a1a', pengAttack:'#1a1a1a', pengGuard:'#1a1a1a',
  pandaIdle:'#fafafa', pandaWalk:'#fafafa', pandaAttack:'#fafafa', pandaGuard:'#fafafa',
  rabbitIdle:'#fdfdfb', rabbitWalk:'#fdfdfb', rabbitAttack:'#fdfdfb', rabbitGuard:'#fdfdfb',
  cheetahIdle:'#ffd21e', cheetahWalk:'#ffd21e', cheetahAttack:'#ffd21e', cheetahGuard:'#ffd21e',
  wpnGun:'#7a1f1f', wpnAxe:'#3a3a3a', wpnBat:'#b8bcc4', bulletShot:'#ffcf3f',
  wpnWand:'#ffee00', wpnHammer:'#b8bcc4', wpnBow:'#b58a5c', wpnWandShot:'#ffec3d', wpnArrow:'#b8bcc4',
  knightSword:'#2b2b2b', knightShield:'#9aa0ab',
  heart:'#ff5d73', shark:'#8fb8c9', bat:'#a98bd0', ghost:'#f4f6fb',
  flameDemon:'#2b2b33', mage:'#5b4a8a', cloudEnemy:'#c9cdd6', reaper:'#1f2028',
  fireball:'#ff8a1e', magicBolt:'#7cc7ff', bgHills:'#9fd07f', bgBushes:'#7cbf6a',
  groundTile:'#c69a5e', decoCloud:'#ffffff', signpost:'#ffd23f',
  itemApple:'#ff1a1a', itemCandy:'#ff2ad4', gearHelmet:'#e8c9a8',
  villageHouse:'#f2c9a4', villageSmith:'#8a8a8a', villageHills:'#7fe00c',
  villageWaterfall:'#a9ebe0', villageGround:'#7fe00c'
};
function loadArt(){
  const ART = window.ART || {};
  const keys = Object.keys(PLACE);
  let pending = 0;
  keys.forEach(k => {
    if (ART[k]){
      pending++;
      const im = new Image();
      im.onload = ()=>{ IMG[k]=im; if(--pending===0) ready(); };
      im.onerror = ()=>{ if(--pending===0) ready(); };
      im.src = ART[k];
    }
  });
  if (pending===0) ready();
}
let started=false;
function ready(){
  document.getElementById('loading').style.display='none';
  if(!started){ started=true; requestAnimationFrame(loop); }
}

// ---------- セーブデータ（星の貯金・解放キャラ・選択キャラ） ----------
const SAVE = {
  stars: Math.max(0, parseInt(localStorage.getItem('nekoStars')||'0',10)||0),
  unlocked: (()=>{ try{ const a=JSON.parse(localStorage.getItem('nekoUnlocked')||'["cat"]'); return Array.isArray(a)&&a.length?a:['cat']; }catch(e){ return ['cat']; } })(),
  char: localStorage.getItem('nekoChar')||'cat',
  cleared1: localStorage.getItem('nekoCleared1')==='1',   // ステージ1クリア済み
  cleared2: localStorage.getItem('nekoCleared2')==='1',   // ステージ2クリア済み
  cleared3: localStorage.getItem('nekoCleared3')==='1',   // ステージ3クリア済み
  cleared4: localStorage.getItem('nekoCleared4')==='1',   // ステージ4クリア済み
  weapon: localStorage.getItem('nekoWeapon')||'sword',    // 装備中の武器
  weapons: (()=>{ try{ const a=JSON.parse(localStorage.getItem('nekoWeapons')||'["sword"]'); return Array.isArray(a)&&a.length?a:['sword']; }catch(e){ return ['sword']; } })(),
  boots: localStorage.getItem('nekoBoots')==='1',                                  // ジャンプ靴（高ジャンプ＋二段ジャンプ）を持っている
  helmets: Math.max(0, parseInt(localStorage.getItem('nekoHelmets')||'0',10)||0),  // 使いすてヘルメットの在庫数（もっている総数）
  helmetOn: localStorage.getItem('nekoHelmetOn')==='1',                            // いまヘルメットを1つ装備しているか（同時に装備できるのは1つだけ）
  bombs: Math.max(0, parseInt(localStorage.getItem('nekoBombs')||'0',10)||0),      // 使いすて爆弾の在庫数（もっている総数）
  bombOn: localStorage.getItem('nekoBombOn')==='1'                                 // いま爆弾を1つ装備しているか（ステージには1つだけ持ち込める）
};
function saveData(){
  localStorage.setItem('nekoStars', String(SAVE.stars));
  localStorage.setItem('nekoUnlocked', JSON.stringify(SAVE.unlocked));
  localStorage.setItem('nekoChar', SAVE.char);
  localStorage.setItem('nekoCleared1', SAVE.cleared1?'1':'0');
  localStorage.setItem('nekoCleared2', SAVE.cleared2?'1':'0');
  localStorage.setItem('nekoCleared3', SAVE.cleared3?'1':'0');
  localStorage.setItem('nekoCleared4', SAVE.cleared4?'1':'0');
  localStorage.setItem('nekoWeapon', SAVE.weapon);
  localStorage.setItem('nekoWeapons', JSON.stringify(SAVE.weapons));
  localStorage.setItem('nekoBoots', SAVE.boots?'1':'0');
  localStorage.setItem('nekoHelmets', String(SAVE.helmets));
  localStorage.setItem('nekoHelmetOn', SAVE.helmetOn?'1':'0');
  localStorage.setItem('nekoBombs', String(SAVE.bombs));
  localStorage.setItem('nekoBombOn', SAVE.bombOn?'1':'0');
}
if(SAVE.helmetOn && SAVE.helmets<=0) SAVE.helmetOn=false;   // 在庫ゼロなら装備解除
if(SAVE.bombOn && SAVE.bombs<=0) SAVE.bombOn=false;         // 在庫ゼロなら装備解除

// ---------- プレイアブル・キャラクター定義 ----------
const CHARS = {
  cat:    {name:'ネコの騎士',        cost:0,   ds:104, keys:{idle:'catIdle', walk:'catWalk', attack:'catAttack', guard:'catGuard'}},
  dog:    {name:'イヌの騎士',        cost:15,  ds:104, keys:{idle:'dogIdle', walk:'dogWalk', attack:'dogAttack', guard:'dogGuard'}},
  seal:   {name:'アザラシの魔法使い', cost:25,  ds:110, keys:{idle:'sealIdle',walk:'sealWalk',attack:'sealAttack',guard:'sealGuard'}},
  penguin:{name:'ペンギン',          cost:150, ds:106, keys:{idle:'pengIdle',walk:'pengWalk',attack:'pengAttack',guard:'pengGuard'}},
  panda:  {name:'パンダ',            cost:115, ds:108, keys:{idle:'pandaIdle',walk:'pandaWalk',attack:'pandaAttack',guard:'pandaGuard'}},
  rabbit: {name:'ウサギ',            cost:130, ds:112, jump:1.5, desc:'ジャンプ力が1.5ばい', keys:{idle:'rabbitIdle',walk:'rabbitWalk',attack:'rabbitAttack',guard:'rabbitGuard'}},
  cheetah:{name:'チーター',          cost:130, ds:108, speed:1.7, desc:'足が1.7ばい はやい', keys:{idle:'cheetahIdle',walk:'cheetahWalk',attack:'cheetahAttack',guard:'cheetahGuard'}}
};
const CHAR_ORDER = ['cat','dog','seal','penguin','panda','rabbit','cheetah'];
if(!CHARS[SAVE.char] || SAVE.unlocked.indexOf(SAVE.char)<0) SAVE.char='cat';
function curChar(){ return CHARS[SAVE.char]||CHARS.cat; }

// ---------- 武器（装備で攻撃が変わる。単体で購入可）----------
const WEAPONS = {
  none:  {name:'そうびなし',   cost:0,  ranged:false, reach:44, dmg:1, knock:8,  sprite:null},  // 素手（武器を外す）
  sword: {name:'けん',        cost:0,  ranged:false, reach:60, dmg:1, knock:12, sprite:null},
  gun:   {name:'じゅう',      cost:80, ranged:true,  dmg:1, sprite:'wpnGun'},          // 遠くから撃てる
  axe:   {name:'おの',        cost:50, ranged:false, reach:80, dmg:2, knock:16, sprite:'wpnAxe'},
  bat:   {name:'金ぞくバット', cost:50, ranged:false, reach:66, dmg:1, knock:40, sprite:'wpnBat'},
  // ステッキ：遠くへ魔法の星をうつ（ふつうの連射）
  wand:  {name:'ステッキ',    cost:60, ranged:true,  dmg:1, cd:0.30, shot:'wpnWandShot', shotSpd:560, shotW:30, shotH:30, shotLife:1.4, sprite:'wpnWand'},
  // ハンマー：近接。強くて大きくふきとばす（少し重い）
  hammer:{name:'ハンマー',    cost:50, ranged:false, reach:72, dmg:2, knock:46, cd:0.5, sprite:'wpnHammer'},
  // 弓矢：遠くの敵をうてる。ただし1秒に1回だけ
  bow:   {name:'弓矢',        cost:70, ranged:true,  dmg:2, cd:1.0, shot:'wpnArrow', shotSpd:780, shotW:48, shotH:14, shotLife:1.7, sprite:'wpnBow'}
};
const WEAPON_ORDER = ['none','sword','gun','axe','bat','wand','hammer','bow'];
function weaponOwned(id){ return WEAPONS[id] && (WEAPONS[id].cost===0 || SAVE.weapons.indexOf(id)>=0); }
// 装備中の武器が無効なら「けん」に戻す（cost0の武器は常に所持扱い）
if(!weaponOwned(SAVE.weapon)) SAVE.weapon='sword';
function curWeapon(){ return WEAPONS[SAVE.weapon]||WEAPONS.sword; }
function bootsEquipped(){ return !!SAVE.boots; }   // ジャンプ靴：高ジャンプ＋二段ジャンプ
function helmetWorn(){ return SAVE.helmetOn && SAVE.helmets>0; }   // ヘルメットを1つ装備中か
function bombEquipped(){ return SAVE.bombOn && SAVE.bombs>0; }     // 爆弾を1つ装備中か（ステージに持ち込める）

// スプライト描画（ロード済みなら画像、無ければ角丸プレースホルダ）
function drawSprite(key,x,y,w,h,flip){
  const im=IMG[key];
  ctx.save();
  ctx.translate(x+w/2, y+h/2);
  if(flip) ctx.scale(-1,1);
  if(im){ ctx.drawImage(im,-w/2,-h/2,w,h); }
  else {
    ctx.fillStyle=PLACE[key]||'#888';
    ctx.strokeStyle='#4a3728'; ctx.lineWidth=3;
    roundRect(-w/2,-h/2,w,h,10); ctx.fill(); ctx.stroke();
    ctx.fillStyle='#4a3728';
    ctx.beginPath(); ctx.arc(-w*0.12,-h*0.08,3,0,7); ctx.arc(w*0.12,-h*0.08,3,0,7); ctx.fill();
  }
  ctx.restore();
}
function roundRect(x,y,w,h,r){
  ctx.beginPath();
  ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath();
}

// SVG（正方形 viewBox）を縦横比を保ったまま等倍で描く。
// cx=中心X, refY=基準Y（bottom:足の接地線 / center:中心）, size=正方形の一辺。
// 元絵は足の底が viewBox の 122/128 付近にあるため、bottom時はその分だけ下に伸ばす。
const FEET = 122/128;
function drawSpriteSquare(key,cx,refY,size,align,flip){
  const topY = (align==='center') ? refY - size/2 : refY - size*FEET;
  const im=IMG[key];
  ctx.save();
  ctx.translate(cx, topY+size/2);
  if(flip) ctx.scale(-1,1);
  if(im){ ctx.drawImage(im,-size/2,-size/2,size,size); }
  else {
    ctx.fillStyle=PLACE[key]||'#888'; ctx.strokeStyle='#4a3728'; ctx.lineWidth=3;
    roundRect(-size*0.34,-size*0.4,size*0.68,size*0.8,10); ctx.fill(); ctx.stroke();
    ctx.fillStyle='#4a3728';
    ctx.beginPath(); ctx.arc(-size*0.1,-size*0.1,3,0,7); ctx.arc(size*0.1,-size*0.1,3,0,7); ctx.fill();
  }
  ctx.restore();
}

// ---------- 入力 ----------
const key = {left:false,right:false,jump:false,atk:false,guard:false};
let jumpBuf=0;
const KEYMAP={ArrowLeft:'left',KeyA:'left',ArrowRight:'right',KeyD:'right',
  ArrowUp:'jump',KeyW:'jump',Space:'jump',KeyJ:'atk',KeyZ:'atk',
  KeyK:'guard',ArrowDown:'guard',KeyS:'guard'};
addEventListener('keydown',e=>{
  if(e.code==='KeyP'){ togglePause(); }
  if(e.code==='KeyM'){ toggleMuteUI(); return; }
  if(e.code==='KeyR'){ retry(); return; }
  if(e.code==='KeyB'){ tryBomb(); return; }        // 爆弾を使う
  const k=KEYMAP[e.code]; if(!k) return; e.preventDefault();
  if(k==='jump' && !key.jump) jumpBuf=JUMP_BUF;
  if(k==='atk' && !key.atk) tryAttack();
  key[k]=true;
});
addEventListener('keyup',e=>{ const k=KEYMAP[e.code]; if(k){ key[k]=false; e.preventDefault(); }});
// タッチ
function bindTouch(){
  document.querySelectorAll('#touch .btn').forEach(b=>{
    const k=b.dataset.k;
    const on=e=>{ e.preventDefault();
      if(k==='jump'){ if(!key.jump) jumpBuf=JUMP_BUF; key.jump=true; }
      else if(k==='atk'){ if(!key.atk) tryAttack(); key.atk=true; }
      else if(k==='bomb'){ tryBomb(); }
      else key[k]=true; };
    const off=e=>{ e.preventDefault(); if(k!=='bomb') key[k]=false; };
    b.addEventListener('touchstart',on,{passive:false});
    b.addEventListener('touchend',off,{passive:false});
    b.addEventListener('touchcancel',off,{passive:false});
    b.addEventListener('mousedown',on); b.addEventListener('mouseup',off);
    b.addEventListener('mouseleave',off);
  });
  if('ontouchstart' in window) document.getElementById('touch').style.display='block';
  updateBombBtn();
}
// 💣ボタンは「爆弾を装備しているとき」だけ表示する
function updateBombBtn(){
  const b=document.getElementById('bBomb');
  if(b) b.style.display = bombEquipped() ? 'flex' : 'none';
}
// 爆弾を使う：まわりの敵に「2回分ダメージ」の爆発。1個つかうと消える（ステージ中はもう持てない）。
function tryBomb(){
  if(state!=='play' || !pl || pl.dead) return;
  if(!bombEquipped()) return;
  SAVE.bombs=Math.max(0, SAVE.bombs-1); SAVE.bombOn=false; saveData(); updateBombBtn();
  const cx=pl.x+pl.w/2, cy=pl.y+pl.h/2;
  pl.inv=Math.max(pl.inv,1.0);   // 爆発の瞬間〜直後は自分は無敵（爆弾で自分は傷つかない）
  // 効果はんい内の敵すべてに2ダメージ（ボスにも当たる）。生き残りは外へふきとばして接触を防ぐ。
  enemies.forEach(e=>{ if(e.dead) return;
    const ex=e.x+e.w/2, ey=e.y+e.h/2;
    if(Math.hypot(ex-cx,ey-cy) <= BOMB_RANGE + Math.max(e.w,e.h)/2){
      const away = ex<cx?-1:1;
      damageEnemy(e, BOMB_DMG, away);
      if(!e.dead && !e.boss){ e.x += away*40; if(e.charging) e.charging=false; if(e.vx) e.vx=-e.vx*0.4; }
    }
  });
  // 爆発エフェクト（オレンジの粒＋白リング＋画面ゆれ）
  shake=Math.max(shake,16); snd('boss');
  bombFx.push({x:cx,y:cy,r:10,life:0.45,max:0.45});
  for(let i=0;i<26;i++){ const a=(Math.PI*2*i)/26, sp=180+Math.random()*260;
    particles.push({x:cx,y:cy,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-60,life:0.6+Math.random()*0.3,
      c:['#ff6b1a','#ffd23f','#ff3b3b','#ffffff'][i%4],r:5}); }
}

// ---------- シーン／レベル定義 ----------
// solids: 実体の矩形 {x,y,w,h}。地面のすきま（穴）は矩形を置かないことで表現。
let solids=[], enemies=[], items=[], projectiles=[], particles=[], floaters=[];
let bombFx=[];                             // 爆弾の爆発リング演出
let pshots=[];                             // プレイヤーの弾（銃）
let decor=[], gates=[];                    // decor=装飾スプライト, gates=移動口/ショップ
let goal=null, boss=null, npc=null, levelW=0;
let vertical=false;                        // 縦スクロールのステージ（ステージ4）か
let scene='village';                       // 'village' | 'stage'
let stageNum=1;                            // 1 | 2（ステージ番号＝難易度）
let smith=null, hint='';                   // かじ屋ゾーン, 画面下ヒント
function hard(){ return stageNum>=2; }      // ステージ2以上は強敵モード
function ex(){ return stageNum>=3; }        // ステージ3はさらに強化（超モード）

function G(x,w,y=GROUND_Y){ solids.push({x,y,w,h:WORLD_H-y+80,ground:true}); }
function P(x,y,w){ solids.push({x,y,w,h:22,plat:true}); } // 浮遊足場
function clearScene(){ solids=[]; enemies=[]; items=[]; projectiles=[]; particles=[]; pshots=[];
  floaters=[]; decor=[]; gates=[]; boss=null; goal=null; smith=null; hint=''; bombFx=[]; }

// ---- むら（拠点シーン）----
function buildVillage(){
  clearScene(); scene='village'; vertical=false;
  G(-300, 3900);                 // 平らな草地
  levelW = 3550;
  // 装飾（家2軒・かじ屋・丘）※滝は削除
  decor.push({sprite:'villageHouse', x:180, y:GROUND_Y-300, w:245, h:300});   // 大きい家
  decor.push({sprite:'villageHouse', x:470, y:GROUND_Y-215, w:176, h:215});   // 小さい家
  decor.push({sprite:'villageSmith', x:1180, y:GROUND_Y-262, w:250, h:262, smith:true});
  // かじ屋ショップのゾーン（建物の前）
  smith = {x:1200, y:GROUND_Y-120, w:210, h:120};
  // 出発ゲート（右）→ 冒険1・2（2はステージ1クリアで解放）
  gates.push({x:1950, y:GROUND_Y-160, w:80, h:160, to:'stage', stage:1, spawnX:120, label:'ぼうけん1へ'});
  gates.push({x:2350, y:GROUND_Y-160, w:80, h:160, to:'stage', stage:2, spawnX:120,
    label:'ぼうけん2へ', need:'cleared1', lockMsg:'ステージ1を クリアすると あそべる！'});
  gates.push({x:2800, y:GROUND_Y-160, w:80, h:160, to:'stage', stage:3, spawnX:120,
    label:'ぼうけん3へ', need:'cleared2', lockMsg:'ステージ2を クリアすると あそべる！'});
  gates.push({x:3200, y:GROUND_Y-160, w:80, h:160, to:'stage', stage:4, spawnX:700,
    label:'ぼうけん4へ（上へ）', need:'cleared3', lockMsg:'ステージ3を クリアすると あそべる！'});
  // 装飾雲（丘の頂上より上＝青空の高いところに浮かべる）
  for(let i=0;i<7;i++) floaters.push({x:i*380+120, y:30+Math.random()*70, w:130+Math.random()*60});
}

function buildStage(n){
  if(n===4){ buildStage4(); return; }
  clearScene(); scene='stage'; vertical=false; stageNum=(n===3?3:(n===2?2:1));
  const S2 = hard();
  const starRow=(x,c,y=GROUND_Y-70,dx=70)=>{ for(let i=0;i<c;i++) items.push({t:'star',x:x+i*dx,y,r:20,got:false,bob:Math.random()*6}); };

  // ---- 地形（穴あきの地面）----
  G(-200, 1500);
  G(1400, 900);
  P(1560, GROUND_Y-160, 180);
  G(2500, 1400);
  P(2760, GROUND_Y-170, 160);
  P(3020, GROUND_Y-300, 160);
  G(4050, 1500);
  P(4300, GROUND_Y-180, 200);
  G(5750, 1500);
  P(6000, GROUND_Y-200, 170);
  G(7150, 2100);                 // ボスアリーナ
  levelW = 9100;

  // ---- 星 ----
  starRow(500,5); starRow(1560,3,GROUND_Y-210); starRow(2760,3,GROUND_Y-220);
  starRow(3020,3,GROUND_Y-350); starRow(3300,4); starRow(4300,3,GROUND_Y-230);
  starRow(4700,5); starRow(6000,3,GROUND_Y-250); starRow(6400,4); starRow(5000,4,GROUND_Y-260);

  // ---- 回復・無敵アイテム（1ステージにつき各1個まで）----
  items.push({t:'apple', x: S2?4300:4700, y:GROUND_Y-70, r:26, got:false, bob:Math.random()*6});  // リンゴ（両ステージ1個）
  if(S2) items.push({t:'candy', x:5600, y:GROUND_Y-80, r:28, got:false, bob:Math.random()*6});      // キャンディはステージ2のみ

  if(stageNum===1){
    // ===== ステージ1 =====
    spawn('shark',   900, 'ground', {patrol:[700,1300]});
    spawn('bat',    1650, 'air',    {cx:1650,range:180,amp:70,y:GROUND_Y-260});
    spawn('shark',  2900, 'ground', {patrol:[2550,3350]});
    spawn('bat',    3100, 'air',    {cx:3100,range:150,amp:80,y:GROUND_Y-280});
    spawn('ghost',  3500, 'air',    {y:GROUND_Y-200});
    spawn('flameDemon', 4550,'ground',{});
    spawn('ghost',  4800, 'air',    {y:GROUND_Y-230});
    spawn('cloudEnemy',5100,'sky',  {x:5100,y:120,drop:2.4});
    spawn('bat',    6050, 'air',    {cx:6050,range:170,amp:70,y:GROUND_Y-250});
    spawn('mage',   6700, 'ground', {hp:2});
    spawn('flameDemon', 6950,'ground',{});
  } else if(stageNum===2){
    // ===== ステージ2（敵が多く・強い）=====
    spawn('shark',   800, 'ground', {patrol:[600,1300]});
    spawn('shark',  1150, 'ground', {patrol:[700,1300]});
    spawn('bat',    1550, 'air',    {cx:1550,range:200,amp:90,y:GROUND_Y-250});
    spawn('ghost',  1750, 'air',    {y:GROUND_Y-180});
    spawn('flameDemon', 2000,'ground',{});
    spawn('shark',  2900, 'ground', {patrol:[2550,3350]});
    spawn('bat',    2800, 'air',    {cx:2800,range:170,amp:80,y:GROUND_Y-300});
    spawn('bat',    3150, 'air',    {cx:3150,range:150,amp:90,y:GROUND_Y-320});
    spawn('ghost',  3450, 'air',    {y:GROUND_Y-210});
    spawn('ghost',  3650, 'air',    {y:GROUND_Y-260});
    spawn('flameDemon', 4200,'ground',{});
    spawn('mage',   4550, 'ground', {hp:4});
    spawn('cloudEnemy',4900,'sky',  {x:4900,y:110,drop:1.8});
    spawn('ghost',  5000, 'air',    {y:GROUND_Y-230});
    spawn('cloudEnemy',5600,'sky',  {x:5600,y:130,drop:1.8});
    spawn('bat',    6000, 'air',    {cx:6000,range:200,amp:80,y:GROUND_Y-260});
    spawn('flameDemon', 6300,'ground',{});
    spawn('mage',   6650, 'ground', {hp:4});
    spawn('flameDemon', 6950,'ground',{});
    spawn('shark',  7000, 'ground', {patrol:[6600,7100]});
  } else {
    // ===== ステージ3（さらに敵が多く・強い。配置もステージ2と別）=====
    spawn('shark',   700, 'ground', {patrol:[550,1250]});
    spawn('shark',  1050, 'ground', {patrol:[700,1400]});
    spawn('flameDemon', 1300,'ground',{});
    spawn('bat',    1500, 'air',    {cx:1500,range:220,amp:100,y:GROUND_Y-240});
    spawn('ghost',  1700, 'air',    {y:GROUND_Y-160});
    spawn('mage',   1950, 'ground', {hp:5});
    spawn('cloudEnemy',2250,'sky',  {x:2250,y:100,drop:1.4});
    spawn('bat',    2650, 'air',    {cx:2650,range:200,amp:90,y:GROUND_Y-300});
    spawn('shark',  2900, 'ground', {patrol:[2550,3350]});
    spawn('bat',    3050, 'air',    {cx:3050,range:180,amp:100,y:GROUND_Y-330});
    spawn('ghost',  3300, 'air',    {y:GROUND_Y-210});
    spawn('flameDemon', 3450,'ground',{});
    spawn('ghost',  3600, 'air',    {y:GROUND_Y-270});
    spawn('mage',   3950, 'ground', {hp:5});
    spawn('flameDemon', 4200,'ground',{});
    spawn('cloudEnemy',4450,'sky',  {x:4450,y:110,drop:1.4});
    spawn('ghost',  4650, 'air',    {y:GROUND_Y-240});
    spawn('shark',  4750, 'ground', {patrol:[4200,4950]});
    spawn('mage',   5050, 'ground', {hp:6});
    spawn('bat',    5300, 'air',    {cx:5300,range:210,amp:90,y:GROUND_Y-270});
    spawn('flameDemon', 5550,'ground',{});
    spawn('cloudEnemy',5850,'sky',  {x:5850,y:130,drop:1.4});
    spawn('ghost',  5950, 'air',    {y:GROUND_Y-250});
    spawn('mage',   6350, 'ground', {hp:6});
    spawn('flameDemon', 6550,'ground',{});
    spawn('bat',    6750, 'air',    {cx:6750,range:200,amp:90,y:GROUND_Y-260});
    spawn('flameDemon', 6950,'ground',{});
    spawn('shark',  7050, 'ground', {patrol:[6600,7150]});
  }

  // ---- ボス（死神）----
  boss = mkEnemy('reaper', 8200, GROUND_Y-170, 150,170);
  boss.hp=stageNum===3?22:(stageNum===2?15:8); boss.maxhp=boss.hp; boss.boss=true; boss.state='idle'; boss.t=1.2;
  boss.arena=[7300,8900]; boss.active=false; boss.face=-1;
  boss.ds=stageNum===3?240:(stageNum===2?230:210); boss.dal='bottom';
  enemies.push(boss);

  // ---- ゴール看板（ボス撃破で有効化）→ むらへ帰るとクリア ----
  goal = {x:8800,y:GROUND_Y-150,w:90,h:150,active:false};
  // ※ステージ中の「むらへ戻る」ゲートは誤発動防止のため廃止。ポーズ画面から戻れる。

  // ---- 装飾雲 ----
  for(let i=0;i<14;i++) floaters.push({x:i*700+Math.random()*300,y:40+Math.random()*160,
    w:150+Math.random()*90, s:8+Math.random()*10});

  npc=null;
}

// ===== ステージ4：上へのぼる縦スクロール。落ちると全HP。敵はステージ3と同じ強さ・数。 =====
function buildStage4(){
  clearScene(); scene='stage'; vertical=true; stageNum=4;
  const colX=700, FW=1000;
  // 下のスタート地面
  G(colX-560, 1120, GROUND_Y);            // x[140,1260]
  // 横に長い足場（床）を上へ。ワンウェイなので下から通り抜け、上に着地してのぼる。
  const Y=[];
  { let yy=350; for(let i=0;i<17;i++){ P(colX-FW/2, yy, FW); Y.push(yy); yy-=120; } }  // 17段・120px間隔・横長
  const bossY=-1710;
  P(colX-FW/2, bossY, FW);                // ボス＆ゴールの床（横長）
  levelW = 1400;

  // 星（何段かの上）・回復リンゴ・無敵キャンディ
  [0,2,4,6,8,10,12,14,16].forEach(i=> items.push({t:'star',x:colX+((i%2)?150:-150),y:Y[i]-40,r:20,got:false,bob:Math.random()*6}));
  items.push({t:'apple', x:colX, y:Y[8]-44,  r:26, got:false, bob:0});
  items.push({t:'candy', x:colX, y:Y[13]-44, r:28, got:false, bob:0});

  // ==== 敵（数少なめ・攻撃は横方向のみ・下の段はならしで敵なし）====
  // サメ（横に巡回＆突進）×2
  spawn('shark', colX-260,'ground',{patrol:[colX-520,colX-150], gy:GROUND_Y});   // スタート地点(700)には来ない
  spawn('shark', colX+120,'ground',{patrol:[colX-300,colX+430], gy:Y[10]});
  // 炎の悪魔（横に火の玉）×3
  spawn('flameDemon', colX+250,'ground',{gy:Y[4]});
  spawn('flameDemon', colX-250,'ground',{gy:Y[8]});
  spawn('flameDemon', colX+250,'ground',{gy:Y[13]});
  // 魔法使い（横に魔法弾）×2
  spawn('mage', colX-250,'ground',{hp:5, gy:Y[6]});
  spawn('mage', colX+250,'ground',{hp:5, gy:Y[12]});
  // おばけ（横に追いかけ）×2
  spawn('ghost', colX+220,'air',{y:Y[5]-58});
  spawn('ghost', colX-220,'air',{y:Y[11]-58});
  // コウモリ（体当たり・上下ゆれ小さめ）×3
  spawn('bat', colX-170,'air',{cx:colX-170,range:130,amp:26,y:Y[3]-64});
  spawn('bat', colX+170,'air',{cx:colX+170,range:130,amp:26,y:Y[9]-64});
  spawn('bat', colX-170,'air',{cx:colX-170,range:130,amp:26,y:Y[14]-64});

  // ==== ボス（死神・ステージ3と同じ強さ）====
  boss = mkEnemy('reaper', colX-75, bossY-170, 150,170);
  boss.hp=22; boss.maxhp=22; boss.boss=true; boss.state='idle'; boss.t=1.2;
  boss.arena=[colX-400, colX+400]; boss.active=false; boss.face=-1;
  boss.ds=240; boss.dal='bottom';
  boss.vertical=true; boss.floorY=bossY; boss.actY=bossY+380;   // 上に近づくと起きる／足場が床
  enemies.push(boss);

  // ==== ゴール看板（ボス撃破で有効化）→ むらへ帰るとクリア ====
  goal = {x:colX+230, y:bossY-150, w:90, h:150, active:false};
  // スタートの「↑」案内看板（装飾）
  decor.push({sprite:'signpost', x:colX-360, y:GROUND_Y-150, w:110, h:150});

  // 装飾雲（縦に散らす）
  for(let i=0;i<22;i++) floaters.push({x:colX-320+Math.random()*640, y:GROUND_Y-60 - i*120 - Math.random()*70, w:120+Math.random()*80});
  npc=null;
}

function spawn(type,x,mode,opt){ enemies.push(mkEnemyByType(type,x,mode,opt)); }
function mkEnemy(type,x,y,w,h){ return {type,x,y,w,h,vx:0,vy:0,dead:false,hp:1,face:-1,anim:Math.random()*6}; }
function mkEnemyByType(type,x,mode,opt){
  opt=opt||{};
  const S2=hard();                 // ステージ2以上は強化
  const X=ex();                    // ステージ3はさらに強化
  const sMul=X?1.3:1;              // 速度倍率（ステージ3）
  const cMul=X?0.7:1;              // クールダウン短縮（ステージ3）
  let e;
  const gy=opt.gy||GROUND_Y;      // 地上敵の足元の高さ（縦ステージでは足場の上に乗せる）
  if(type==='shark'){ e=mkEnemy(type,x,gy-70,110,72); e.mode='ground';
    e.patrol=opt.patrol||[x-300,x+300]; e.spd=(S2?140:100)*sMul; e.chargeSpd=(S2?430:300)*sMul; e.charging=false; e.vx=-e.spd;
    e.ds=124; e.dal='bottom'; }
  else if(type==='bat'){ e=mkEnemy(type,x,opt.y||GROUND_Y-260,74,64); e.mode='air';
    e.cx=opt.cx||x; e.range=opt.range||160; e.amp=opt.amp||70; e.baseY=opt.y||GROUND_Y-260; e.ph=Math.random()*6;
    e.phSpd=(S2?2.9:2)*(X?1.25:1); e.ds=92; e.dal='center'; }
  else if(type==='ghost'){ e=mkEnemy(type,x,opt.y||GROUND_Y-200,78,84); e.mode='chase'; e.spd=(S2?115:70)*sMul; e.ph=Math.random()*6; e.baseY=opt.y||GROUND_Y-200;
    e.ds=100; e.dal='center'; }
  else if(type==='flameDemon'){ e=mkEnemy(type,x,gy-96,86,96); e.mode='turret'; e.cd=((S2?1.0:1.6)+Math.random()*(S2?0.5:1))*cMul;
    e.ds=116; e.dal='bottom'; }
  else if(type==='mage'){ e=mkEnemy(type,x,gy-104,84,104); e.mode='mage'; e.hp=opt.hp||(X?5:(S2?4:2)); e.maxhp=e.hp; e.cd=(S2?1.1:1.8)*cMul; e.step=0;
    e.ds=120; e.dal='bottom'; }
  else if(type==='cloudEnemy'){ e=mkEnemy(type,opt.x||x,opt.y||120,120,80); e.mode='cloud'; e.cd=(opt.drop||2.4)*cMul; e.drift=20;
    e.ds=120; e.dal='center'; }
  return e;
}

// ---------- プレイヤー ----------
let pl;
function newPlayer(){
  return { x:120,y:GROUND_Y-96,w:66,h:96,vx:0,vy:0,face:1,onGround:false,coyote:0,
    hp:3,maxhp:3,inv:0,invPower:0,atk:0,atkCd:0, atkHits:new Set(), walkT:0, dead:false, spawnX:120, spawnY:GROUND_Y-96,
    guarding:false, guardFlash:0, guardAnim:0,
    airJumps:0, helmetHp: (SAVE.helmetOn && SAVE.helmets>0)?HELMET_MAX:0 };
}

function tryAttack(){
  if(state!=='play'||!pl||pl.dead) return;
  if(pl.guarding || key.guard) return;   // ガード中は攻撃できない
  if(pl.atkCd>0) return;
  const w=curWeapon();
  pl.atk=0.22; pl.atkCd = w.cd || (w.ranged?0.30:0.36); pl.atkHits=new Set();
  if(w.ranged){ fireBullet(w); snd('shoot'); } else snd('attack');
}
function fireBullet(w){
  const dir=pl.face;
  const bx=pl.x+(dir>0?pl.w-2:2), by=pl.y+pl.h*0.42;
  const sw=w.shotW||28, sh=w.shotH||14, spd=w.shotSpd||680;
  pshots.push({x:bx-sw/2, y:by-sh/2, w:sw, h:sh, vx:dir*spd, dmg:w.dmg, life:w.shotLife||1.3, sprite:w.shot||'bulletShot'});
  const c1 = w.shot==='wpnWandShot' ? '#ffec3d' : w.shot==='wpnArrow' ? '#d8d8d8' : '#ffcf3f';
  for(let i=0;i<6;i++) particles.push({x:bx+dir*8, y:by, vx:dir*(140+Math.random()*140),
    vy:(Math.random()-.5)*140, life:0.16, c:i%2?c1:'#ff8a1e', r:3});
}

// ---------- ゲーム状態 ----------
let state='title';   // title|play|pause|clear|over
let score=0, cam=0, camY=0, time=0, shake=0, flashGoal=0;

// シーンを読み込み、プレイヤーを配置。keepHp=前シーンのHPを引き継ぐ
function loadScene(name, spawnX, keepHp, stageN){
  const hp = keepHp && pl ? pl.hp : 3;
  if(name==='village') buildVillage(); else buildStage(stageN||1);
  pl=newPlayer(); pl.x=spawnX; pl.spawnX=spawnX; pl.spawnY=pl.y; pl.hp=hp; pl.maxhp=3;
  cam=Math.max(0,Math.min(Math.max(0,levelW-VW), spawnX-VW*0.38));
  if(!isFinite(cam)) cam=0;
  camY=0;
  if(vertical){ const wvh=cv.height/scale; camY = pl.y+pl.h/2 - wvh*0.62; if(!isFinite(camY)) camY=0; }
  shake=0; time=0;
  state='play'; showOverlay(false); music(true);
}
function resetGame(){        // タイトルから：むらへ
  unlockAudio(); loadScene('village', 120, false);
}
function startGame(){ resetGame(); }
function retry(){           // 死んだシーンをやり直し（ステージならそのステージを最初から）
  unlockAudio();
  if(scene==='stage') loadScene('stage', stageNum===4?700:120, false, stageNum);
  else loadScene('village', 120, false);
}
// ゲート移動
function useGate(g){
  snd('coin');
  loadScene(g.to, g.spawnX, true, g.stage);
}

// ---------- メインループ ----------
let last=0;
function loop(t){
  const dt=Math.min(0.033,(t-last)/1000||0); last=t;
  fitCanvas();                       // 横伸び防止：表示サイズと内部解像度を毎フレーム合わせる
  if(state==='play'){ update(dt); }
  render();
  if(state!==_uiState){ _uiState=state; syncTouchUI(); }
  requestAnimationFrame(loop);
}
// 画面のポーズボタンは「あそび中(play)」だけ表示（ポーズ中はオーバーレイの「つづける」を使う）
let _uiState='';
function syncTouchUI(){ const b=document.getElementById('pauseBtn'); if(b) b.style.display=(state==='play')?'flex':'none'; }

function update(dt){
  time+=dt;
  // ↑（ジャンプ）でインタラクション：かじ屋ショップ / 冒険ゲート。通り抜けでは発動しない。
  if(!pl.dead && jumpBuf>0){
    if(scene==='village' && smith && rectHit(pl,smith)){ jumpBuf=0; openShop(); return; }
    for(const g of gates){ if(rectHit(pl,g)){
      if(g.need && !SAVE[g.need]) break;    // ロック中は入れない（↑はジャンプになる）
      jumpBuf=0; useGate(g); return; } }
  }
  updatePlayer(dt);
  updateEnemies(dt);
  updateProjectiles(dt);
  updatePShots(dt);
  updateItems(dt);
  updateParticles(dt);
  // カメラ（非有限値になったら復帰）
  if(vertical){
    // 横：プレイヤーを中央に
    const cx=Math.max(0, Math.min(Math.max(0,levelW-VW), pl.x+pl.w/2-VW*0.5));
    if(!isFinite(cam)) cam = isFinite(cx)?cx:0; else if(isFinite(cx)) cam += (cx-cam)*Math.min(1,dt*8);
    // 縦：上へだけ追従（登った高さは保つ＝落ちると画面外へ）
    const wvh=cv.height/scale;
    const cyTgt=pl.y+pl.h/2 - wvh*0.62;
    if(isFinite(cyTgt) && cyTgt<camY) camY += (cyTgt-camY)*Math.min(1,dt*6);
    if(!isFinite(camY)) camY=0;
  } else {
    const clamped=Math.max(0, Math.min(Math.max(0,levelW-VW), pl.x+pl.w/2-VW*0.38));
    if(!isFinite(cam)) cam = isFinite(clamped)?clamped:0;
    else if(isFinite(clamped)) cam += (clamped-cam)*Math.min(1,dt*8);
  }
  if(shake>0) shake=Math.max(0,shake-dt*60);
  if(flashGoal>0) flashGoal-=dt;
  // ゴール判定（死神撃破後 → むらへ帰ってクリア）
  if(goal&&goal.active&&aabb(pl,goal)){ win(); return; }
  // ヒント表示（発動は↑）
  hint='';
  if(scene==='village' && smith && !pl.dead && rectHit(pl,smith)) hint='↑ でショップ';
  if(!pl.dead) for(const g of gates){ if(rectHit(pl,g)){
    hint = (g.need && !SAVE[g.need]) ? g.lockMsg : ('↑ '+g.label); break; } }
  // 落下：横ステージ＝ハート1つ失って復帰。縦ステージ＝高い所から落ちたら全HP（即ゲームオーバー）
  if(!pl.dead){
    if(vertical){ const wvh=cv.height/scale; if(pl.y > camY + wvh + 40) fallDeathAll(); }
    else if(pl.y>WORLD_H+120){ fallDeath(); }
  }
}

function fallDeath(){
  pl.hp-=1; shake=12; snd('hurt');
  if(pl.hp<=0){ pl.hp=0; pl.dead=true; pl.vy=0; setTimeout(gameOver,900); }
  else { respawn(); }
}
// 縦ステージ：高い所から落ちたらHPをすべて失う（即ゲームオーバー）
function fallDeathAll(){
  pl.hp=0; pl.dead=true; pl.vy=0; shake=14; snd('hurt'); setTimeout(gameOver,900);
}

// --- プレイヤー物理 ---
function updatePlayer(dt){
  if(pl.dead){ pl.vy=Math.min(pl.vy+GRAV*dt,MAX_FALL); pl.y+=pl.vy*dt; return; }

  // ガード：地上で盾ボタンを押している間。移動・ジャンプ・攻撃は不可。向きだけ変えられる。
  pl.guarding = !!(key.guard && pl.onGround && pl.atk<=0);
  let dir=(key.right?1:0)-(key.left?1:0);

  if(pl.guarding){
    if(dir!==0) pl.face=dir;            // 盾を向ける方向だけ変更
    pl.vx -= pl.vx*Math.min(1,dt*22);   // その場で止まる
    jumpBuf=0;                          // ジャンプ入力は消費
    if(pl.guardFlash>0) pl.guardFlash-=dt;
  } else {
    const spd = curChar().speed||1;             // チーターなど足の速いキャラは移動が速い
    const acc = (pl.onGround?2600:1800)*spd;
    const maxV = MOVE*spd;
    if(dir!==0){ pl.vx += dir*acc*dt; pl.face=dir; }
    else { pl.vx -= pl.vx*Math.min(1,dt*(pl.onGround?14:6)); }
    pl.vx=Math.max(-maxV,Math.min(maxV,pl.vx));

    // ジャンプ（ジャンプ靴なら高く跳べ、空中でもう1回だけ跳べる＝二段ジャンプ）
    if(jumpBuf>0) jumpBuf-=dt;
    pl.coyote = pl.onGround?COYOTE:Math.max(0,pl.coyote-dt);
    if(pl.onGround) pl.airJumps = bootsEquipped()?1:0;   // 着地で空中ジャンプ回数を回復
    // ウサギなどジャンプ力の高いキャラは高く跳ぶ。curChar().jump は「とうたつ高さの倍率」なので、初速には√をかける（高さ∝初速²）
    const jv = (bootsEquipped()?BOOT_JUMP_V:JUMP_V) * Math.sqrt(curChar().jump||1);
    if(jumpBuf>0 && pl.coyote>0){ pl.vy=-jv; pl.onGround=false; pl.coyote=0; jumpBuf=0; puff(pl.x+pl.w/2,pl.y+pl.h); snd('jump'); }
    else if(jumpBuf>0 && pl.airJumps>0){ pl.vy=-jv*0.92; pl.airJumps--; jumpBuf=0; dblJumpFx(pl.x+pl.w/2,pl.y+pl.h*0.6); snd('jump'); }
    if(!key.jump && pl.vy<-260) pl.vy=-260;  // 可変ジャンプ
  }

  pl.vy=Math.min(pl.vy+GRAV*dt,MAX_FALL);

  moveAndCollide(pl,dt);

  if(pl.onGround && Math.abs(pl.vx)>30) pl.walkT+=dt*Math.abs(pl.vx)/120; else pl.walkT=0;
  if(pl.inv>0) pl.inv-=dt;
  if(pl.invPower>0){ pl.invPower-=dt; if(pl.invPower<0) pl.invPower=0; }
  if(pl.atk>0) pl.atk-=dt;
  if(pl.atkCd>0) pl.atkCd-=dt;
  pl.guardAnim += ((pl.guarding?1:0)-pl.guardAnim)*Math.min(1,dt*16);   // 盾の構えをなめらかに

  // 攻撃ヒット（近接武器。1回の攻撃で各敵に1ヒット）
  const w=curWeapon();
  if(pl.atk>0 && !w.ranged){
    const hb=attackBox();
    if(!pl.atkHits) pl.atkHits=new Set();
    enemies.forEach(e=>{ if(!e.dead && !pl.atkHits.has(e) && overlap(hb,e)){ pl.atkHits.add(e);
      damageEnemy(e,w.dmg,pl.face);
      if(w.knock){ e.x+=pl.face*w.knock; if(e.charging)e.charging=false; if(e.vx)e.vx=-e.vx*0.4; } }});
  }
  // アイテム取得（星／リンゴ＝ハート回復／キャンディ＝10秒むてき）
  items.forEach(it=>{ if(it.got || !circHit(pl,it)) return;
    if(it.t==='star'){ it.got=true; score++; SAVE.stars++; saveData(); sparkle(it.x,it.y); snd('coin'); }
    else if(it.t==='apple'){
      if(pl.hp>=pl.maxhp) return;                 // 満タンなら取らずに残す
      it.got=true; pl.hp++; snd('heal');
      for(let i=0;i<12;i++) particles.push({x:it.x,y:it.y,vx:(Math.random()-.5)*160,vy:-Math.random()*160-40,life:0.7,c:'#ff5d73',r:4}); }
    else if(it.t==='candy'){
      it.got=true; pl.invPower=10; pl.inv=Math.max(pl.inv,0.2); snd('power');
      for(let i=0;i<20;i++) particles.push({x:it.x,y:it.y,vx:(Math.random()-.5)*260,vy:-Math.random()*260-40,life:0.9,
        c:['#ffe14d','#ff2ad4','#1a2ee0','#8a2be2','#ff0000'][i%5],r:5}); }
  });
  // チェックポイント更新（着地時、地上にいる時）
  if(pl.onGround){ pl.spawnX=Math.max(pl.spawnX, Math.min(pl.x, levelW-200)); pl.spawnY=pl.y; }
}

function attackBox(){
  const reach=curWeapon().reach||60;
  return pl.face>0 ? {x:pl.x+pl.w-6,y:pl.y+10,w:reach,h:pl.h-20}
                   : {x:pl.x-reach+6,y:pl.y+10,w:reach,h:pl.h-20};
}

function moveAndCollide(o,dt){
  // X
  o.x+=o.vx*dt;
  for(const s of solids){ if(s.plat) continue; if(rectHit(o,s)){
    if(o.vx>0) o.x=s.x-o.w; else if(o.vx<0) o.x=s.x+s.w; o.vx=0; }}
  // Y
  o.y+=o.vy*dt; o.onGround=false;
  for(const s of solids){
    if(!rectHit(o,s)) continue;
    if(s.plat){ // 上からのみ乗れる
      if(o.vy>0 && (o.y+o.h-o.vy*dt) <= s.y+2){ o.y=s.y-o.h; o.vy=0; o.onGround=true; }
      continue;
    }
    if(o.vy>0){ o.y=s.y-o.h; o.vy=0; o.onGround=true; }
    else if(o.vy<0){ o.y=s.y+s.h; o.vy=0; }
  }
}

// --- 敵 ---
// 敵が画面に映っているか（映っている敵だけが攻撃する）。縦ステージは上下も見る。
function enemyOnScreen(e){
  const m=30;
  if(e.x+e.w < cam-m || e.x > cam+VW+m) return false;
  if(vertical){ const wvh=cv.height/scale; if(e.y+e.h < camY-m || e.y > camY+wvh+m) return false; }
  return true;
}
function updateEnemies(dt){
  enemies.forEach(e=>{
    if(e.dead) return;
    e.anim=(e.anim||0)+dt;
    if(e.boss){ updateBoss(e,dt); }
    else switch(e.mode){
      case 'ground': { // サメ：巡回、視界内で突進
        const seePlayer = Math.abs(pl.y-e.y)<120 &&
          ((e.face<0 && pl.x<e.x && pl.x>e.x-360) || (e.face>0 && pl.x>e.x && pl.x<e.x+360));
        if(seePlayer) e.charging=true;
        const sp=e.charging?e.chargeSpd:e.spd;
        e.x += e.face*sp*dt;
        if(e.x<e.patrol[0]){ e.x=e.patrol[0]; e.face=1; e.charging=false; }
        if(e.x+e.w>e.patrol[1]){ e.x=e.patrol[1]-e.w; e.face=-1; e.charging=false; }
        break; }
      case 'air': { // コウモリ：左右往復＋サイン上下
        e.ph+=dt*(e.phSpd||2); e.x=e.cx+Math.sin(e.ph)*e.range; e.y=e.baseY+Math.sin(e.ph*2)*e.amp;
        e.face = Math.cos(e.ph)>=0?1:-1; break; }
      case 'chase': { // おばけ：ゆらゆら接近
        e.ph+=dt*3; const dx=(pl.x-e.x); e.x+=Math.sign(dx)*e.spd*dt*(Math.abs(dx)<600?1:0.3);
        e.y=e.baseY+Math.sin(e.ph)*14; e.face=dx<0?-1:1; break; }
      case 'turret': { // 炎の悪魔：プレイヤーを狙って火の玉
        e.face=pl.x<e.x?-1:1;
        e.cd-=dt; if(e.cd<=0 && enemyOnScreen(e) && Math.abs(pl.x-e.x)<640){ e.cd=(hard()?1.2:1.9)*(ex()?0.75:1);
          const sp=(hard()?430:330)*(ex()?1.2:1), sx=e.x+e.w/2, sy=e.y+e.h*0.35;
          if(vertical){ shoot('fireball', sx, sy, (pl.x<e.x?-1:1)*sp, 0, true); }   // 縦ステージ：横だけに撃つ
          else { const dx=(pl.x+pl.w/2)-sx, dy=(pl.y+pl.h*0.4)-sy, L=Math.hypot(dx,dy)||1;
            shoot('fireball', sx, sy, dx/L*sp, dy/L*sp); } }
        break; }
      case 'mage': { // 魔法使い：弾＋小移動
        e.cd-=dt; e.face=pl.x<e.x?-1:1;
        if(e.cd<=0 && enemyOnScreen(e) && Math.abs(pl.x-e.x)<700){ e.cd=(hard()?1.0:1.6)*(ex()?0.8:1);
          const sp=(hard()?360:280)*(ex()?1.2:1);
          if(vertical){ shoot('magicBolt',e.x+e.w/2,e.y+e.h*0.3, (pl.x<e.x?-1:1)*sp, 0, true); }   // 縦ステージ：横だけ
          else { const dx=pl.x-e.x, dy=(pl.y+20)-(e.y+20), L=Math.hypot(dx,dy)||1;
            shoot('magicBolt',e.x+e.w/2,e.y+e.h*0.3, dx/L*sp, dy/L*sp); } }
        break; }
      case 'cloud': { // 雨雲：漂って稲妻
        e.x+=Math.sin(time*0.5)*e.drift*dt*10;
        e.cd-=dt; if(e.cd<=0 && enemyOnScreen(e) && Math.abs(pl.x-e.x)<(ex()?440:(hard()?380:300))){ e.cd=(hard()?1.8:2.6)*(ex()?0.75:1);
          projectiles.push({t:'lightning',x:e.x+e.w/2-8,y:e.y+e.h,w:16,h:520,life:0.5,warn:ex()?0.2:(hard()?0.28:0.35)}); }
        break; }
    }
    // 接触処理
    if(!e.dead && overlap(pl,e)){
      if(pl.invPower>0){                        // キャンディ無敵中：触れた敵を倒す（ボスは無傷ですり抜け）
        if(!e.boss){ damageEnemy(e,99,e.x<pl.x?-1:1); }
      } else if(pl.inv<=0){
        const stomp = pl.vy>60 && (pl.y+pl.h-e.y) < 44 && e.mode!=='cloud';
        if(stomp){ damageEnemy(e,e.boss?1:99,0); pl.vy=-560; puff(pl.x+pl.w/2,pl.y+pl.h); }
        else {
          const blocked = hurt(1, e.x<pl.x?1:-1, e.x+e.w/2);
          if(blocked){ e.x += (e.x<pl.x?-1:1)*18; e.charging=false; if(e.vx) e.vx=-e.vx*0.4; }
        }
      }
    }
  });
}

function updateBoss(e,dt){
  const S2=hard(), X=ex();
  if(!e.active){ if(e.vertical ? (pl.y < e.actY) : (pl.x>e.arena[0]+250)){ e.active=true; e.t=1; } else return; }
  e.face=pl.x<e.x?-1:1;
  e.t-=dt;
  switch(e.state){
    case 'idle':
      e.vx*=0.9; e.y += (((e.floorY||GROUND_Y)-e.h)-e.y)*Math.min(1,dt*4);
      if(e.t<=0){ e.state=(Math.random()<(X?0.65:0.6)?'dash':'summon'); e.t=(e.state==='dash')?(X?0.25:(S2?0.35:0.5)):(X?0.55:(S2?0.7:0.9)); }
      break;
    case 'dash':
      if(e.t>0){ e.vx=0; } // 溜め
      else { e.vx=e.face*(X?820:(S2?680:520)); e.x+=e.vx*dt;
        if(e.x<e.arena[0]){e.x=e.arena[0];} if(e.x+e.w>e.arena[1]){e.x=e.arena[1]-e.w;}
        if(e.t<-0.9){ e.state='idle'; e.t=X?0.35:(S2?0.5:0.8); } }
      break;
    case 'summon':
      if(e.t<=0){
        const by=(e.floorY||GROUND_Y);   // ボスの足元を基準に召喚（縦ステージ対応）
        enemies.push(mkEnemyByType('bat',e.x,'air',{cx:e.x,range:120,amp:60,y:by-240}));
        enemies.push(mkEnemyByType('ghost',e.x+120,'air',{y:by-200}));
        if(S2){ enemies.push(mkEnemyByType('bat',e.x-120,'air',{cx:e.x-120,range:140,amp:70,y:by-280})); }
        if(X){ enemies.push(mkEnemyByType('ghost',e.x-140,'air',{y:by-250})); }
        e.state='idle'; e.t=X?0.6:(S2?0.8:1.1);
      }
      break;
  }
}

function damageEnemy(e,dmg,dir){
  if(e.dead) return;
  e.hp-=dmg;
  if(e.hp>0){ e.flash=0.15; if(dir) e.x+=dir*10; hitSpark(e.x+e.w/2,e.y+e.h/2); snd('hit'); return; }
  e.dead=true; poof(e.x+e.w/2,e.y+e.h/2, e.boss?26:12);
  if(e.boss){ bossDefeated(); } else { snd('stomp'); }
}

function bossDefeated(){
  shake=18; flashGoal=2.5; snd('boss');
  if(goal) goal.active=true;
  const fx=goal?goal.x:8800, fy=goal?goal.y+goal.h*0.5:GROUND_Y-100;
  for(let i=0;i<40;i++) particles.push({x:fx,y:fy,
    vx:(Math.random()-.5)*300,vy:-Math.random()*400-100,life:1.2,c:'#ffd23f',r:5});
}

// --- 弾 ---
function shoot(kind,x,y,vx,vy,flat){ projectiles.push({t:kind,x:x-14,y:y-14,w:28,h:28,vx,vy,life:4,flat:!!flat}); }
function updateProjectiles(dt){
  projectiles.forEach(p=>{
    if(p.t==='lightning'){ p.life-=dt; if(p.warn>0){p.warn-=dt;}
      else if(pl.inv<=0 && rectHit(pl,p)) hurt(1,0,null,true);  // 雷は上から＝盾で防げない
      return; }
    p.life-=dt; if(p.t==='fireball' && !p.flat) p.vy+=GRAV*0.06*dt;  // ほぼ直進（軽い重力）。flat＝横だけ（重力なし）
    p.x+=p.vx*dt; p.y+=p.vy*dt;
    if(pl.inv<=0 && overlap(pl,{x:p.x,y:p.y,w:p.w,h:p.h})){ hurt(1,p.vx>0?1:-1, p.x+p.w/2); p.life=0; }
    for(const s of solids){ if(!s.plat && rectHit(p,s)){ p.life=0; break; } }
  });
  projectiles=projectiles.filter(p=>p.life>0);
}

// プレイヤーの弾（銃）：まっすぐ飛んで敵に当たる。遠くの敵も狙える。
function updatePShots(dt){
  pshots.forEach(p=>{
    p.life-=dt; p.x+=p.vx*dt;
    for(const e of enemies){ if(e.dead) continue;
      if(rectHit({x:p.x,y:p.y,w:p.w,h:p.h}, e)){
        damageEnemy(e, p.dmg||1, p.vx>0?1:-1); hitSpark(p.x+(p.vx>0?p.w:0), p.y+p.h/2); p.life=0; break; } }
    if(p.life>0) for(const s of solids){ if(!s.plat && rectHit(p,s)){ p.life=0; break; } }
  });
  pshots=pshots.filter(p=>p.life>0);
}
function updateItems(dt){ items.forEach(it=>{ it.bob=(it.bob||0)+dt*3; }); }
function updateParticles(dt){
  particles.forEach(p=>{ p.life-=dt; p.vy+=GRAV*0.5*dt; p.x+=p.vx*dt; p.y+=p.vy*dt; });
  particles=particles.filter(p=>p.life>0);
  bombFx.forEach(f=>{ f.life-=dt; f.r += (BOMB_RANGE - f.r)*Math.min(1,dt*12); });
  bombFx=bombFx.filter(f=>f.life>0);
}

// --- 被弾 ---
// srcX: 攻撃の発生位置X（ガードの向き判定に使用）。unblock: 盾で防げない攻撃（上からの雷など）。
// 戻り値: ガードで防げたら true。
function hurt(dmg,dir,srcX,unblock){
  if(pl.dead || pl.invPower>0 || pl.inv>0) return false;   // キャンディの無敵中は無傷
  if(!unblock && guardBlocks(srcX)){ onGuardBlock(srcX); return true; }
  // 使いすてヘルメット：ハートの代わりに受け止める（1回でこわれる。落下は守らない）
  if(SAVE.helmetOn && pl.helmetHp>0){ helmetHit(dir); return false; }
  pl.hp-=dmg; pl.inv=1.1; shake=10; snd('hurt');
  if(dir){ pl.vx=dir*260; pl.vy=-320; }
  if(pl.hp<=0){ pl.hp=0; pl.dead=true; setTimeout(gameOver,900); }
  return false;
}
// ガード中は（防げる攻撃なら）どの向きからでも防ぐ。※上からの雷など unblock は hurt() 側で除外済み。
function guardBlocks(srcX){
  return !!pl.guarding;
}
function onGuardBlock(srcX){
  pl.guardFlash=0.18; pl.inv=0.12; shake=4; snd('guard');
  // 盾の位置あたりに火花
  const gx = pl.x+pl.w/2 + pl.face*pl.w*0.5, gy=pl.y+pl.h*0.45;
  for(let i=0;i<8;i++) particles.push({x:gx,y:gy,vx:pl.face*Math.random()*180+pl.face*40,
    vy:(Math.random()-.5)*220, life:0.35, c:i%2?'#fff':'#ffd23f', r:3});
}
// 使いすてヘルメットが1回ぶんダメージを受け止める。0になったら1個こわれ、在庫があれば次をかぶる。
function helmetHit(dir){
  pl.helmetHp--; pl.inv=1.0; shake=8; snd('guard');
  const gx=pl.x+pl.w/2, gy=pl.y+pl.h*0.14;
  for(let i=0;i<10;i++) particles.push({x:gx,y:gy,vx:(Math.random()-.5)*220,vy:-Math.random()*160-20,life:0.4,c:i%2?'#fff':'#9aa0ab',r:3});
  if(dir){ pl.vx=dir*160; pl.vy=-200; }
  if(pl.helmetHp<=0){                     // このヘルメットは壊れた（自動では次をかぶらない＝同時に1つだけ）
    SAVE.helmets=Math.max(0,SAVE.helmets-1); SAVE.helmetOn=false; saveData();
    for(let i=0;i<16;i++) particles.push({x:gx,y:gy,vx:(Math.random()-.5)*300,vy:-Math.random()*260-40,life:0.6,c:i%2?'#e8c9a8':'#9aa0ab',r:4});
    pl.helmetHp = 0;   // かぶり直すには むらのかじ屋で「そうびする」
  }
}
function respawn(){ pl.x=Math.max(60,pl.spawnX-30); pl.y=pl.spawnY-20; pl.vx=0; pl.vy=0; pl.inv=1.3; }

// ---------- 状態遷移 ----------
function gameOver(){ if(state!=='play') return; state='over'; music(false); snd('over'); showOverlay(true,'over'); }
let lastCleared=1;
function win(){ if(state!=='play') return; music(false); snd('clear');
  lastCleared=stageNum;
  if(stageNum===1) SAVE.cleared1=true; else if(stageNum===2) SAVE.cleared2=true;
  else if(stageNum===3) SAVE.cleared3=true; else if(stageNum===4) SAVE.cleared4=true; saveData();
  loadScene('village', 2120, true);   // むらに帰還
  state='clear'; showOverlay(true,'clear'); }
function togglePause(){ if(state==='play'){ state='pause'; music(false); showOverlay(true,'pause'); }
  else if(state==='pause'){ state='play'; music(true); showOverlay(false); } }

// ---------- エフェクト ----------
function puff(x,y){ for(let i=0;i<6;i++) particles.push({x,y,vx:(Math.random()-.5)*120,vy:-Math.random()*80,life:0.4,c:'#ffffff',r:4}); }
function dblJumpFx(x,y){ for(let i=0;i<12;i++){ const a=i/12*6.283; particles.push({x,y,vx:Math.cos(a)*180,vy:Math.sin(a)*180+40,life:0.35,c:i%2?'#bffcff':'#ffffff',r:3}); } }
function poof(x,y,n){ for(let i=0;i<n;i++) particles.push({x,y,vx:(Math.random()-.5)*260,vy:-Math.random()*260-40,life:0.7,c:i%2?'#4a3728':'#c9c9d0',r:5}); }
function sparkle(x,y){ for(let i=0;i<8;i++) particles.push({x,y,vx:(Math.random()-.5)*200,vy:-Math.random()*220,life:0.6,c:'#ffd23f',r:4}); }
function hitSpark(x,y){ for(let i=0;i<6;i++) particles.push({x,y,vx:(Math.random()-.5)*220,vy:(Math.random()-.5)*220,life:0.35,c:'#fff',r:3}); }

// ---------- 当たり判定ヘルパ ----------
function rectHit(a,b){ return a.x<b.x+b.w && a.x+a.w>b.x && a.y<b.y+b.h && a.y+a.h>b.y; }
function aabb(a,b){ return rectHit(a,b); }
function overlap(a,b){ return rectHit({x:a.x+6,y:a.y+6,w:a.w-12,h:a.h-12},{x:b.x+6,y:b.y+6,w:b.w-12,h:b.h-12}); }
function circHit(a,it){ const cx=Math.max(a.x,Math.min(it.x,a.x+a.w)),cy=Math.max(a.y,Math.min(it.y,a.y+a.h));
  return Math.hypot(it.x-cx,it.y-cy)<it.r+6; }

// ---------- 描画 ----------
function render(){
  const w=cv.width,h=cv.height;
  // 空グラデ（キャンバス全面・素の座標系）
  ctx.setTransform(1,0,0,1,0,0);
  const g=ctx.createLinearGradient(0,0,0,h);
  g.addColorStop(0,'#a9e0f5'); g.addColorStop(0.6,'#d8f0e6'); g.addColorStop(1,'#f6efd8');
  ctx.fillStyle=g; ctx.fillRect(0,0,w,h);

  drawParallax();
  drawWorld();

  drawHUD();
}

function layer(factor){ // カメラ視差変換をセット（originYで上下センタリング）
  const jx = shake>0?(Math.random()-.5)*shake:0, jy = shake>0?(Math.random()-.5)*shake:0;
  const cyOff = vertical ? camY*factor*scale : 0;   // 縦カメラ（ステージ4のみ）
  ctx.setTransform(scale,0,0,scale, -cam*factor*scale + jx, originY - cyOff + jy);
}

function drawParallax(){
  if(scene==='village'){
    // 雲（丘より上・奥の空）。丘より先に描くので、頂上と重なっても丘の奥に自然に収まる。
    layer(0.45); floaters.forEach(f=>{ drawSprite('decoCloud', f.x, f.y, f.w, f.w*0.5, false); });
    // 地平線に立つ、なだらかな緑の丘（背景）
    drawVillageHills();
  } else if(vertical){
    // 縦ステージ：雲だけを視差でうかべる（縦に流れる）
    layer(0.5); floaters.forEach(f=>{ drawSprite('decoCloud', f.x, f.y, f.w, f.w*0.5, false); });
  } else {
    layer(0.25); tileX('bgHills', WORLD_H-230, 512,256, 0.25);
    layer(0.4); floaters.forEach(f=>{ drawSprite('decoCloud', f.x, f.y, f.w, f.w*0.5, false); });
    layer(0.6); tileX('bgBushes', WORLD_H-200, 512,200, 0.6);
  }
}

// むらの丘：地平線から立ち上がる、なだらかな緑の丘（背景）。
// 丘の下端は地面(GROUND_Y)まで届くので「空に浮いた帯」にはならない。
function drawVillageHills(){
  const factor=0.5;    // 遠景としてゆっくりスクロール
  layer(factor);
  const camX = isFinite(cam)?cam*factor:0;
  const vw = isFinite(VW)?VW:MIN_VW;
  const x0=camX-160, x1=camX+vw+160;
  const ridgeY=225;    // こぶの谷ライン（この上に丘が盛り上がる）
  const amp=95, wl=540;// なだらかで大きい丘
  const baseY=GROUND_Y+40;  // 地面より下まで塗って浮かないようにする
  ctx.fillStyle='#8ee62a'; ctx.strokeStyle='#4fb000'; ctx.lineWidth=6; ctx.lineJoin='round';
  ctx.beginPath();
  ctx.moveTo(x0, baseY);
  ctx.lineTo(x0, ridgeY);
  for(let x=x0; x<=x1; x+=6){
    const y = ridgeY - Math.abs(Math.sin(x/wl*Math.PI))*amp;   // 上向きのなだらかなこぶ
    ctx.lineTo(x, y);
  }
  ctx.lineTo(x1, baseY);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  // ラクガキ風テクスチャ
  ctx.strokeStyle='#5bc10f'; ctx.lineWidth=3; ctx.lineCap='round';
  for(let x=Math.floor(x0/60)*60; x<x1; x+=60){
    const top = ridgeY - Math.abs(Math.sin(x/wl*Math.PI))*amp;
    for(let k=0;k<3;k++){ const yy=top+30+k*40;
      if(yy<GROUND_Y-10){ ctx.beginPath(); ctx.moveTo(x, yy); ctx.lineTo(x+22, yy-9); ctx.stroke(); } }
  }
}

function tileX(key,y,tw,th, factor){
  const startWorld=cam*factor - tw;
  const x0=Math.floor(startWorld/tw)*tw;
  for(let x=x0; x< cam*factor+VW+tw; x+=tw){ drawSprite(key,x,y,tw,th,false); }
}

function drawWorld(){
  layer(1);
  const groundKey = scene==='village' ? 'villageGround' : 'groundTile';
  const fillCol   = scene==='village' ? '#5aab12' : '#b98a4e';
  // 地面タイル
  solids.forEach(s=>{
    if(s.plat){ drawPlat(s); }
    else {
      for(let x=s.x; x<s.x+s.w; x+=TILE){ drawSprite(groundKey,x,s.y,TILE,TILE,false); }
      ctx.fillStyle=fillCol; ctx.fillRect(s.x,s.y+TILE, s.w, WORLD_H*3);
    }
  });
  // むらの建物（家・かじ屋）
  decor.forEach(d=>{ if(!d.back) drawSprite(d.sprite, d.x, d.y, d.w, d.h, false); });
  // かじ屋の看板文字
  if(scene==='village') decor.forEach(d=>{ if(d.smith) smithSign(d); });
  // ゲート（看板）
  gates.forEach(g=>{
    const locked = g.need && !SAVE[g.need];
    if(locked) ctx.globalAlpha=0.55;
    drawSprite('signpost', g.x-20, g.y-6, 120,150, false);
    bubble(g.x+g.w/2, g.y-2, locked ? ('🔒 '+g.label) : g.label);
    ctx.globalAlpha=1;
  });

  // アイテム（星・リンゴ・キャンディ）
  items.forEach(it=>{ if(it.got) return; const yy=it.y+Math.sin(it.bob)*6;
    if(it.t==='apple') drawSprite('itemApple', it.x-24, yy-24, 48, 48, false);
    else if(it.t==='candy') drawSprite('itemCandy', it.x-26, yy-42, 52, 65, false);
    else drawSprite('star', it.x-20, yy-20, 40, 40, false);
  });
  // ゴール
  if(goal){ const a=goal.active; if(a && Math.floor(time*6)%2===0){ ctx.globalAlpha=1; }
    drawSprite('signpost', goal.x-20, goal.y-8, 130,165, false);
    if(a){ ctx.save(); ctx.globalAlpha=0.6+0.4*Math.sin(time*6); ctx.fillStyle='#ffd23f';
      ctx.beginPath(); ctx.arc((goal.x+goal.w/2), goal.y+goal.h/2, 90,0,7); ctx.fill(); ctx.restore(); }
  }
  // 冒険スタート時の応援メッセージ
  if(pl && scene==='stage' && time<4.5){ bubble(pl.x+pl.w/2, pl.y-8, 'いけ！ '+curChar().name+'！'); }

  // 弾
  projectiles.forEach(p=>{
    if(p.t==='lightning'){
      if(p.warn>0){ ctx.save(); ctx.globalAlpha=0.5+0.5*Math.sin(time*40); ctx.strokeStyle='#ffd23f';
        ctx.lineWidth=4; ctx.beginPath(); ctx.moveTo(p.x+8,p.y); ctx.lineTo(p.x+8,p.y+p.h); ctx.stroke(); ctx.restore(); }
      else { ctx.save(); ctx.strokeStyle='#bfe0ff'; ctx.lineWidth=10; ctx.lineCap='round';
        ctx.beginPath(); let yy=p.y; ctx.moveTo(p.x+8,yy);
        for(;yy<p.y+p.h;yy+=26) ctx.lineTo(p.x+8+(Math.random()-.5)*20,yy); ctx.stroke();
        ctx.strokeStyle='#fff'; ctx.lineWidth=4; ctx.stroke(); ctx.restore(); }
      return;
    }
    drawSprite(p.t==='fireball'?'fireball':'magicBolt', p.x, p.y, p.w, p.h, p.vx<0);
  });
  // プレイヤーの弾
  pshots.forEach(p=>{ drawSprite(p.sprite||'bulletShot', p.x, p.y, p.w, p.h, p.vx<0); });

  // 敵（スプライトは正方形＝元絵の比率のまま等倍描画）
  enemies.forEach(e=>{ if(e.dead) return;
    // アートは右向き基準。左を向く（face<0）ときだけ左右反転する。
    const bob = (e.dal==='center')?Math.sin((e.anim||0)*6)*4:0;
    const cx = e.x+e.w/2;
    const refY = (e.dal==='center') ? e.y+e.h/2+bob : e.y+e.h;
    ctx.save();
    if(e.flash>0){ ctx.globalAlpha=0.6; e.flash-=0.016; }
    drawSpriteSquare(mapKey(e.type), cx, refY, e.ds||e.h, e.dal||'bottom', e.face<0);
    ctx.restore();
    if(e.boss&&e.active) bossBar(e);
  });

  // プレイヤー
  drawPlayer();

  // パーティクル
  particles.forEach(p=>{ ctx.globalAlpha=Math.max(0,Math.min(1,p.life*2)); ctx.fillStyle=p.c;
    ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,7); ctx.fill(); });
  // 爆弾の爆発リング（白→オレンジのひろがる輪）
  bombFx.forEach(f=>{ ctx.globalAlpha=Math.max(0,f.life/f.max)*0.8;
    ctx.lineWidth=8; ctx.strokeStyle='#ffd23f'; ctx.beginPath(); ctx.arc(f.x,f.y,f.r,0,7); ctx.stroke();
    ctx.lineWidth=4; ctx.strokeStyle='#ff6b1a'; ctx.beginPath(); ctx.arc(f.x,f.y,f.r*0.7,0,7); ctx.stroke(); });
  ctx.globalAlpha=1;
}

function mapKey(type){ return type; } // enemy.type は ARTキーと一致

function drawPlayer(){
  if(!pl) return;
  // キャンディ無敵中：虹色オーラ＋きらめき
  if(pl.invPower>0 && !pl.dead){
    const hue=(time*260)%360;
    ctx.save();
    ctx.globalAlpha=0.35+0.25*Math.sin(time*12);
    ctx.fillStyle='hsl('+hue+',95%,60%)';
    ctx.beginPath(); ctx.arc(pl.x+pl.w/2, pl.y+pl.h*0.5, pl.w*0.95, 0, 7); ctx.fill();
    ctx.restore();
    if(Math.floor(time*40)%2===0) particles.push({x:pl.x+pl.w*Math.random(), y:pl.y+pl.h*Math.random(),
      vx:(Math.random()-.5)*70, vy:-Math.random()*90-10, life:0.4, c:'hsl('+(((hue+120*Math.random())|0))+',95%,65%)', r:3});
  }
  if(pl.inv>0 && Math.floor(time*20)%2===0 && !pl.dead) return; // 点滅（被弾直後のみ）
  const C=curChar(); const K=C.keys; const ds=C.ds;
  let key=K.idle;
  if(pl.guarding) key=K.guard;
  else if(pl.atk>0) key=K.attack;
  else if(!pl.onGround) key=K.idle;
  else if(Math.abs(pl.vx)>30) key=(Math.floor(pl.walkT*2)%2)?K.walk:K.idle;
  const cx=pl.x+pl.w/2, refY=pl.y+pl.h;
  if(pl.dead){ // 倒れる演出（回転）も比率は保つ
    ctx.save();
    ctx.translate(cx, refY - ds*FEET + ds/2);
    if(pl.face<0) ctx.scale(-1,1);
    ctx.rotate(0.3);
    const im=IMG[key];
    if(im) ctx.drawImage(im,-ds/2,-ds/2,ds,ds);
    ctx.restore();
    return;
  }
  drawSpriteSquare(key, cx, refY, ds, 'bottom', pl.face<0);
  drawKnightGear();                       // ネコ/イヌ騎士の剣・盾（攻撃/ガードで動く）
  drawHelmetOnHead(cx, refY - ds*FEET, ds, pl.face<0);
  drawWeaponInHand();
  // 長いクールダウンの武器（弓矢）は、頭の上にリロードゲージを出す
  const cw=curWeapon();
  if(cw.cd>=1 && pl.atkCd>0){
    const bw=44, frac=1-Math.min(1,Math.max(0,pl.atkCd)/cw.cd);
    const bx=pl.x+pl.w/2-bw/2, by=pl.y-18;
    ctx.fillStyle='rgba(0,0,0,.4)'; roundRect(bx,by,bw,7,3); ctx.fill();
    ctx.fillStyle='#7cc7ff'; roundRect(bx+1.5,by+1.5,(bw-3)*frac,4,2); ctx.fill();
  }
}
// 使いすてヘルメットを頭に重ねて描く（かぶっている間だけ）。
function drawHelmetOnHead(cx, spriteTop, ds, flip){
  if(!(SAVE.helmetOn && pl.helmetHp>0)) return;
  const im=IMG.gearHelmet;
  const hw=ds*0.62, hh=ds*0.52, hx=cx, hy=spriteTop+ds*0.19;
  ctx.save(); ctx.translate(hx,hy); if(flip) ctx.scale(-1,1);
  if(im){ ctx.drawImage(im,-hw/2,-hh/2,hw,hh); }
  else { ctx.fillStyle='#e8c9a8'; ctx.strokeStyle='#4a3728'; ctx.lineWidth=3;
    ctx.beginPath(); ctx.arc(0,hh*0.1,hw*0.42,Math.PI,0); ctx.fill(); ctx.stroke(); }
  ctx.restore();
}
// ネコ/イヌの騎士だけ：剣と盾を体とは別に描いて動かす。
// 盾はガードで前へ構え、剣は攻撃で振り下ろす（「けん」装備のときだけ剣を表示）。
function drawKnightGear(){
  if(!pl || pl.dead) return;
  if(SAVE.char!=='cat' && SAVE.char!=='dog') return;
  const dir=pl.face, w=pl.w, ga=Math.max(0,Math.min(1,pl.guardAnim||0));
  const cx=pl.x+w/2;
  // 剣：ガード中は後ろに下げて構える（＝攻撃に見えない）。攻撃(pl.atk)のときだけ前へ振り下ろす。
  //     盾より先に描いて、ガード時は盾の後ろに隠れるようにする。
  if(SAVE.weapon==='sword' && IMG.knightSword){
    const prog = pl.atk>0 ? (0.22-Math.max(0,pl.atk))/0.22 : 0;   // 0→1
    const hx=cx + dir*w*0.42, hy=pl.y+pl.h*0.56;   // 右手の位置
    const dw=w*0.5, dh=w*0.92;
    ctx.save(); ctx.translate(hx,hy); if(dir<0) ctx.scale(-1,1);
    ctx.rotate(-0.1 + prog*1.4 - ga*0.9);          // 通常は立て構え／攻撃で振り下ろし／ガードは後ろへ下げる
    ctx.drawImage(IMG.knightSword,-dw*0.5,-dh*0.80,dw,dh);  // 柄(下)を軸に、刃は上へ
    ctx.restore();
  }
  // 盾：ふだんは左手（体の後ろ寄り・低い）。ガードすると体の前へ出して高く構える＝はっきり「防御」の姿勢。
  if(IMG.knightShield){
    const hx = cx + dir*(-w*0.40 + ga*w*0.62);     // 後ろ(-0.40w) → 前(+0.22w)
    const hy = (pl.y+pl.h*0.60) - ga*(pl.h*0.20);  // ガードで少し上げる
    const s  = 1 + ga*0.12;                        // ガードで少し大きく
    const sw=w*0.66*s, sh=w*0.72*s;
    ctx.save(); ctx.translate(hx,hy); if(dir<0) ctx.scale(-1,1);
    ctx.rotate(-ga*0.28);                          // ほんの少し立てる
    ctx.drawImage(IMG.knightShield,-sw*0.5,-sh*0.5,sw,sh);
    ctx.restore();
  }
}
// 装備した武器（けん以外）を手元に表示。攻撃中は前へ振る/構える。
function drawWeaponInHand(){
  const w=curWeapon(); if(!w.sprite || !IMG[w.sprite]) return;
  const prog = pl.atk>0 ? (0.22-Math.max(0,pl.atk))/0.22 : 0;   // 0→1
  const dir=pl.face;
  const hx = pl.x+pl.w/2 + dir*(pl.w*0.42 + prog*20);
  const hy = pl.y + pl.h*0.55 - (w.ranged?6:prog*16);
  let dw=58, dh=44;
  if(SAVE.weapon==='axe'){ dw=58; dh=58; } else if(SAVE.weapon==='bat'){ dw=64; dh=64; }
  else if(SAVE.weapon==='hammer'){ dw=66; dh=66; }
  else if(SAVE.weapon==='wand'){ dw=52; dh=62; }
  else if(SAVE.weapon==='bow'){ dw=60; dh=62; }
  ctx.save();
  ctx.translate(hx, hy);
  if(dir<0) ctx.scale(-1,1);
  if(!w.ranged && pl.atk>0) ctx.rotate(-0.5 + prog*0.9);   // 近接は振り下ろし
  ctx.drawImage(IMG[w.sprite], -dw/2, -dh/2, dw, dh);
  ctx.restore();
}

function drawPlat(s){
  layer(1);
  ctx.fillStyle='#8fd06a'; ctx.strokeStyle='#4a3728'; ctx.lineWidth=3;
  roundRect(s.x,s.y,s.w,s.h,8); ctx.fill(); ctx.stroke();
  ctx.fillStyle='#c69a5e'; ctx.fillRect(s.x+4,s.y+10,s.w-8,s.h-12);
  ctx.fillStyle='#8fd06a'; roundRect(s.x,s.y,s.w,10,5); ctx.fill();
}

function bossBar(e){
  layer(1);
  const w=e.w+20, x=e.x-10, y=e.y-24;
  ctx.fillStyle='rgba(0,0,0,.4)'; roundRect(x,y,w,10,5); ctx.fill();
  ctx.fillStyle='#ff5d73'; roundRect(x+2,y+2,(w-4)*Math.max(0,e.hp/e.maxhp),6,3); ctx.fill();
}

function bubble(x,y,text){
  layer(1);
  ctx.font='700 22px sans-serif'; const tw=ctx.measureText(text).width;
  const bw=tw+28, bh=40, bx=x-bw/2, by=y-bh-14;
  ctx.fillStyle='#fff'; ctx.strokeStyle='#4a3728'; ctx.lineWidth=3;
  roundRect(bx,by,bw,bh,12); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x-10,by+bh); ctx.lineTo(x,by+bh+14); ctx.lineTo(x+10,by+bh); ctx.closePath();
  ctx.fillStyle='#fff'; ctx.fill(); ctx.strokeStyle='#4a3728'; ctx.stroke();
  ctx.fillStyle='#4a3728'; ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText(text,x,by+bh/2); ctx.textAlign='left'; ctx.textBaseline='alphabetic';
}

// HUD（画面固定）
function drawHUD(){
  ctx.setTransform(dpr,0,0,dpr,0,0);
  const pad=14;
  // ハート
  for(let i=0;i<pl?.maxhp;i++){
    const x=pad+i*38, y=pad, s=32;
    if(IMG.heart && i<pl.hp) ctx.drawImage(IMG.heart,x,y,s,s);
    else { ctx.fillStyle=i<pl.hp?'#ff5d73':'rgba(255,255,255,.35)'; drawHeart(x+s/2,y+s/2+2,s*0.5); }
  }
  // 星（貯金の総数）
  const sx=pad, sy=pad+44;
  if(IMG.star) ctx.drawImage(IMG.star,sx,sy,30,30);
  else { ctx.fillStyle='#ffd23f'; ctx.beginPath(); ctx.arc(sx+15,sy+15,13,0,7); ctx.fill(); }
  ctx.fillStyle='#fff'; ctx.strokeStyle='#4a3728'; ctx.lineWidth=4; ctx.font='800 26px sans-serif';
  ctx.textAlign='left'; ctx.textBaseline='alphabetic';
  ctx.strokeText('× '+SAVE.stars, sx+38, sy+26); ctx.fillText('× '+SAVE.stars, sx+38, sy+26);
  // 使いすてヘルメット（在庫数 × ＋ いまかぶっているヘルメットの残り回数を点で表示）
  let infoY = sy+42;
  if(pl && SAVE.helmets>0){
    const yy=infoY, worn=SAVE.helmetOn;
    ctx.save(); if(!worn) ctx.globalAlpha=0.5;   // 未装備の予備はうすく表示
    if(IMG.gearHelmet) ctx.drawImage(IMG.gearHelmet, pad-2, yy-8, 34, 30);
    else { ctx.fillStyle='#e8c9a8'; ctx.beginPath(); ctx.arc(pad+15,yy+8,13,Math.PI,0); ctx.fill(); }
    ctx.fillStyle='#fff'; ctx.strokeStyle='#4a3728'; ctx.lineWidth=4; ctx.font='800 22px sans-serif';
    ctx.textAlign='left'; ctx.textBaseline='alphabetic';
    ctx.strokeText('× '+SAVE.helmets, pad+34, yy+18); ctx.fillText('× '+SAVE.helmets, pad+34, yy+18);
    if(HELMET_MAX>1) for(let i=0;i<HELMET_MAX;i++){ const dx=pad+84+i*13, dy=yy+9;
      ctx.beginPath(); ctx.arc(dx,dy,5,0,7);
      ctx.fillStyle = (worn && i<pl.helmetHp) ? '#7fce4f' : 'rgba(255,255,255,.35)'; ctx.fill();
      ctx.lineWidth=2; ctx.strokeStyle='#4a3728'; ctx.stroke(); }
    ctx.restore();
    infoY+=40;
  }
  // 使いすて爆弾（在庫数。装備中は濃く、未装備はうすく）
  if(pl && SAVE.bombs>0){
    const yy=infoY, on=SAVE.bombOn;
    ctx.save(); if(!on) ctx.globalAlpha=0.5;
    // 爆弾アイコン（黒い玉＋みじかい導火線）
    ctx.beginPath(); ctx.arc(pad+13,yy+10,11,0,7); ctx.fillStyle='#2b2b33'; ctx.fill();
    ctx.lineWidth=3; ctx.strokeStyle='#8a6a3a'; ctx.beginPath(); ctx.moveTo(pad+18,yy+1); ctx.quadraticCurveTo(pad+24,yy-6,pad+27,yy-3); ctx.stroke();
    ctx.fillStyle='#ff6b1a'; ctx.beginPath(); ctx.arc(pad+27,yy-3,2.5,0,7); ctx.fill();
    ctx.fillStyle='#fff'; ctx.strokeStyle='#4a3728'; ctx.lineWidth=4; ctx.font='800 22px sans-serif';
    ctx.textAlign='left'; ctx.textBaseline='alphabetic';
    ctx.strokeText('× '+SAVE.bombs, pad+34, yy+18); ctx.fillText('× '+SAVE.bombs, pad+34, yy+18);
    ctx.restore();
    infoY+=40;
  }
  // キャンディ無敵の残り秒数
  if(pl && pl.invPower>0){
    const yy=infoY;
    if(IMG.itemCandy) ctx.drawImage(IMG.itemCandy, pad, yy-4, 26, 33);
    else { ctx.fillStyle='#ff2ad4'; ctx.beginPath(); ctx.arc(pad+13,yy+9,12,0,7); ctx.fill(); }
    ctx.fillStyle='#fff'; ctx.strokeStyle='#8a2be2'; ctx.lineWidth=4; ctx.font='800 22px sans-serif';
    ctx.textAlign='left'; ctx.textBaseline='alphabetic';
    const m='むてき '+Math.ceil(pl.invPower); ctx.strokeText(m, pad+34, yy+22); ctx.fillText(m, pad+34, yy+22);
  }
  // ステージ表示
  if(scene==='stage'){ ctx.textAlign='center'; ctx.font='800 22px sans-serif'; ctx.lineWidth=5;
    ctx.fillStyle=stageNum===3?'#b06cff':(stageNum===2?'#ff5d73':'#fff'); ctx.strokeStyle='#4a3728';
    const m='ステージ '+stageNum; ctx.strokeText(m,cv.width/dpr/2,34); ctx.fillText(m,cv.width/dpr/2,34);
    ctx.textAlign='left'; }
  // 下部ヒント（かじ屋・ゲート等）
  if(hint){ ctx.textAlign='center'; ctx.font='800 22px sans-serif'; ctx.lineWidth=5;
    ctx.fillStyle='#fff'; ctx.strokeStyle='#4a3728';
    const m=(hint==='かじ屋')?'かじ屋：ちかづくと ショップ':hint;
    const yy=cv.height/dpr-26;
    ctx.strokeText(m,cv.width/dpr/2, yy); ctx.fillText(m,cv.width/dpr/2, yy); ctx.textAlign='left'; }
  // ゴール告知
  if(flashGoal>0){ ctx.textAlign='center'; ctx.font='800 34px sans-serif';
    ctx.fillStyle='#fff'; ctx.strokeStyle='#4a3728'; ctx.lineWidth=6;
    const m='ゴールが あらわれた！'; ctx.strokeText(m,cv.width/dpr/2, 90); ctx.fillText(m,cv.width/dpr/2,90);
    ctx.textAlign='left'; }
}
// かじ屋の看板文字
function smithSign(d){ layer(1);
  ctx.fillStyle='#2b2b2b'; ctx.font='800 '+Math.round(d.h*0.13)+'px sans-serif';
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText('かじ屋', d.x+d.w*0.5, d.y+d.h*0.25);
  ctx.textAlign='left'; ctx.textBaseline='alphabetic';
}
function drawHeart(cx,cy,r){ ctx.beginPath();
  ctx.moveTo(cx,cy+r*0.7);
  ctx.bezierCurveTo(cx-r*1.3,cy-r*0.4,cx-r*0.5,cy-r*1.1,cx,cy-r*0.35);
  ctx.bezierCurveTo(cx+r*0.5,cy-r*1.1,cx+r*1.3,cy-r*0.4,cx,cy+r*0.7);
  ctx.closePath(); ctx.fill(); }

// ---------- オーバーレイUI ----------
const overlay=document.getElementById('overlay');
function showOverlay(show,kind){
  if(!show){ overlay.classList.add('hidden'); return; }
  overlay.classList.remove('hidden');
  let html='';
  if(kind==='clear'){
    const sub = lastCleared===1 ? 'ステージ1クリア！ <b>ステージ2</b>が あそべるように なった！'
              : lastCleared===2 ? 'ステージ2クリア！ <b>ステージ3</b>が あそべるように なった！'
              :                   'ステージ3クリア！ ぜんステージ せいは！ 🏆';
    html=`<h1>クリア！ 🎉</h1><p class="big">${sub}</p>
    <p>もっている星：<b>${SAVE.stars}</b> 個</p><button id="startBtn">▶ むらへ</button>
    <div class="keys">かじ屋で 星をつかって なかまを ふやせるよ</div>`;
  }
  else if(kind==='over') html=`<h1>ゲームオーバー</h1><p>もう一度ちょうせん！</p>
    <p>もっている星：<b>${SAVE.stars}</b> 個</p><button id="startBtn">▶ リトライ</button>
    <button class="ov2 js-update">🔄 さいしんに こうしん</button>`;
  else if(kind==='pause') html=`<h1>ポーズ中</h1><p>「つづける」を おしてね（P キーでもOK）</p>
    <button id="startBtn">▶ つづける</button>
    ${scene==='stage'?'<button id="retryBtn" class="ov2">🔄 やりなおす</button><button id="toVillageBtn" class="ov2">🏘 むらへもどる</button>':''}
    <button class="ov2 js-update">🔄 さいしんに こうしん（${APP_VERSION}）</button>`;
  overlay.innerHTML=html;
  const b=document.getElementById('startBtn');
  b.onclick=()=>{
    if(kind==='pause'){ state='play'; music(true); showOverlay(false); }
    else if(kind==='clear'){ state='play'; music(true); showOverlay(false); }  // 既にむらに帰還済み
    else if(kind==='over'){ retry(); }                                          // 死んだステージをやり直し
    else startGame();
  };
  const vb=document.getElementById('toVillageBtn');
  if(vb) vb.onclick=()=>{ loadScene('village', 2120, true); };   // ポーズから村へ
  const rb=document.getElementById('retryBtn');
  if(rb) rb.onclick=()=>{ retry(); };                            // ポーズからステージをやりなおす
}
document.getElementById('startBtn').onclick=startGame;

// ---------- 更新（iPad対策）：ボタンでキャッシュを消して最新に入れ替え ----------
const APP_VERSION='v18';
async function forceUpdate(){
  const b=document.getElementById('updateBtn'); if(b){ b.textContent='こうしん中…'; }
  try{ const rs=await navigator.serviceWorker.getRegistrations(); await Promise.all(rs.map(r=>r.unregister())); }catch(e){}
  try{ if(window.caches){ const ks=await caches.keys(); await Promise.all(ks.map(k=>caches.delete(k))); } }catch(e){}
  // キャッシュを消してから、URLに時刻を付けて完全に読み直す
  location.replace(location.pathname + '?u=' + Date.now());
}
(function(){
  // どの画面の「こうしん」ボタン(.js-update)を押しても更新（あとから作られるボタンにも効く）
  document.addEventListener('click', e=>{ if(e.target && e.target.closest && e.target.closest('.js-update')) forceUpdate(); });
  const vl=document.getElementById('verLabel'); if(vl) vl.textContent=APP_VERSION;
})();

// ---------- かじ屋ショップ ----------
const shopEl=document.getElementById('shop');
function openShop(){
  state='shop'; music(false); snd('coin');
  renderShop();
  shopEl.classList.remove('hidden');
}
function closeShop(){
  shopEl.classList.add('hidden');
  state='play'; music(true);
}
function renderShop(){
  // なかま（キャラ）
  let charRows='';
  for(const id of CHAR_ORDER){
    const c=CHARS[id];
    const owned=SAVE.unlocked.indexOf(id)>=0, using=SAVE.char===id;
    let btn;
    if(using) btn=`<span class="tag using">つかっています</span>`;
    else if(owned) btn=`<button class="sbtn use" data-use="${id}">これにする</button>`;
    else if(SAVE.stars>=c.cost) btn=`<button class="sbtn buy" data-buy="${id}">★${c.cost} でこうかん</button>`;
    else btn=`<span class="tag lock">★${c.cost}（星がたりない）</span>`;
    charRows+=`<div class="srow"><div class="sicon"><img src="assets/${charPreview(id)}"></div>
      <div class="sinfo"><div class="sname">${c.name}${c.desc?` <span class="sdesc">${c.desc}</span>`:''}</div>${btn}</div></div>`;
  }
  // ぶき（武器）※cost0（なし・けん）は常に所持あつかい
  let wpnRows='';
  for(const id of WEAPON_ORDER){
    const w=WEAPONS[id];
    const owned=weaponOwned(id), using=SAVE.weapon===id;
    let btn;
    if(using) btn=`<span class="tag using">${id==='none'?'はずしています':'そうびちゅう'}</span>`;
    else if(owned) btn=`<button class="sbtn use" data-wuse="${id}">${id==='none'?'ぶきを はずす':'そうびする'}</button>`;
    else if(SAVE.stars>=w.cost) btn=`<button class="sbtn buy" data-wbuy="${id}">★${w.cost} でこうかん</button>`;
    else btn=`<span class="tag lock">★${w.cost}（星がたりない）</span>`;
    const desc = id==='none'?'すで（武器なし）': id==='gun'?'とおくの敵をうてる': id==='axe'?'つよい（リーチ広め）': id==='bat'?'ふきとばす'
      : id==='wand'?'とおくへ 星をうつ': id==='hammer'?'つよい！ 大きくふきとばす': id==='bow'?'とおくの敵をうてる（1秒に1回）': 'きほんの武器';
    const icon = wpnPreview(id);
    wpnRows+=`<div class="srow"><div class="sicon">${icon?`<img src="assets/${icon}">`:(id==='none'?'✋':'🗡️')}</div>
      <div class="sinfo"><div class="sname">${w.name} <span class="sdesc">${desc}</span></div>${btn}</div></div>`;
  }
  // どうぐ（ジャンプ靴＝買い切り／ヘルメット＝何個も買える使いすて）
  let gearRows='';
  { let btn;
    if(SAVE.boots) btn=`<span class="tag using">そうびちゅう</span>`;
    else if(SAVE.stars>=BOOT_COST) btn=`<button class="sbtn buy" data-gbuy="boots">★${BOOT_COST} でこうかん</button>`;
    else btn=`<span class="tag lock">★${BOOT_COST}（星がたりない）</span>`;
    gearRows+=`<div class="srow"><div class="sicon"><img src="assets/boots.svg"></div>
      <div class="sinfo"><div class="sname">ジャンプぐつ <span class="sdesc">たかく跳べる＋二段ジャンプ</span></div>${btn}</div></div>`;
  }
  { let buyBtn, eqCtrl;
    if(SAVE.stars>=HELMET_COST) buyBtn=`<button class="sbtn buy" data-gbuy="helmet">★${HELMET_COST} で かう</button>`;
    else buyBtn=`<span class="tag lock">★${HELMET_COST}（星がたりない）</span>`;
    if(SAVE.helmetOn) eqCtrl=`<span class="tag using">そうびちゅう</span>`;
    else if(SAVE.helmets>0) eqCtrl=`<button class="sbtn use" data-gequip="helmet">そうびする</button>`;
    else eqCtrl='';
    gearRows+=`<div class="srow"><div class="sicon"><img src="assets/helmet.svg"></div>
      <div class="sinfo"><div class="sname">ヘルメット <span class="sdesc">ダメージを1回ふせぐ 使いすて（同時に1つだけ・もっている:${SAVE.helmets}こ）</span></div>${buyBtn}${eqCtrl}</div></div>`;
  }
  { let buyBtn, eqCtrl;
    if(SAVE.stars>=BOMB_COST) buyBtn=`<button class="sbtn buy" data-gbuy="bomb">★${BOMB_COST} で かう</button>`;
    else buyBtn=`<span class="tag lock">★${BOMB_COST}（星がたりない）</span>`;
    if(SAVE.bombOn) eqCtrl=`<span class="tag using">そうびちゅう</span>`;
    else if(SAVE.bombs>0) eqCtrl=`<button class="sbtn use" data-gequip="bomb">そうびする</button>`;
    else eqCtrl='';
    gearRows+=`<div class="srow"><div class="sicon"><img src="assets/bomb.svg"></div>
      <div class="sinfo"><div class="sname">ばくだん <span class="sdesc">つかうと2回分のダメージ！ 使いすて（そうびして1つだけ持ちこめる・もっている:${SAVE.bombs}こ）</span></div>${buyBtn}${eqCtrl}</div></div>`;
  }
  shopEl.innerHTML=`<div class="sbox">
    <h2>🔨 かじ屋</h2>
    <div class="sstars">もっている星：★ <b>${SAVE.stars}</b></div>
    <div class="shead">なかま</div>${charRows}
    <div class="shead">ぶき</div>${wpnRows}
    <div class="shead">どうぐ</div>${gearRows}
    <button class="sclose" id="shopClose">とじる</button>
  </div>`;
  shopEl.querySelectorAll('[data-buy]').forEach(b=>b.onclick=()=>buyChar(b.dataset.buy));
  shopEl.querySelectorAll('[data-use]').forEach(b=>b.onclick=()=>{ SAVE.char=b.dataset.use; saveData(); snd('coin'); renderShop(); });
  shopEl.querySelectorAll('[data-wbuy]').forEach(b=>b.onclick=()=>buyWeapon(b.dataset.wbuy));
  shopEl.querySelectorAll('[data-wuse]').forEach(b=>b.onclick=()=>{ SAVE.weapon=b.dataset.wuse; saveData(); snd('coin'); renderShop(); });
  shopEl.querySelectorAll('[data-gbuy]').forEach(b=>b.onclick=()=>buyGear(b.dataset.gbuy));
  shopEl.querySelectorAll('[data-gequip]').forEach(b=>b.onclick=()=>{ b.dataset.gequip==='bomb'?equipBomb():equipHelmet(); });
  document.getElementById('shopClose').onclick=closeShop;
}
function charPreview(id){
  return {cat:'cat_knight_idle.svg', dog:'dog_knight_idle.svg', seal:'seal_mage_idle.svg',
    penguin:'penguin_idle.svg', panda:'panda_idle.svg', rabbit:'rabbit_idle.svg', cheetah:'cheetah_idle.svg'}[id];
}
function wpnPreview(id){
  return {gun:'weapon_gun.svg', axe:'weapon_axe.svg', bat:'weapon_bat.svg', sword:'',
    wand:'weapon_wand.svg', hammer:'weapon_hammer.svg', bow:'weapon_bow.svg'}[id];
}
function buyChar(id){
  const c=CHARS[id];
  if(SAVE.stars<c.cost || SAVE.unlocked.indexOf(id)>=0) return;
  SAVE.stars-=c.cost; SAVE.unlocked.push(id); SAVE.char=id; saveData();
  snd('clear'); renderShop();
}
function buyWeapon(id){
  const w=WEAPONS[id];
  if(SAVE.stars<w.cost || SAVE.weapons.indexOf(id)>=0) return;
  SAVE.stars-=w.cost; SAVE.weapons.push(id); SAVE.weapon=id; saveData();
  snd('clear'); renderShop();
}
function buyGear(id){
  if(id==='boots'){
    if(SAVE.boots || SAVE.stars<BOOT_COST) return;
    SAVE.stars-=BOOT_COST; SAVE.boots=true; saveData(); snd('clear'); renderShop();
  } else if(id==='helmet'){
    if(SAVE.stars<HELMET_COST) return;
    SAVE.stars-=HELMET_COST; SAVE.helmets++;
    if(!SAVE.helmetOn){ SAVE.helmetOn=true; if(pl) pl.helmetHp=HELMET_MAX; }   // まだかぶってなければ1つ装備
    saveData(); snd('coin'); renderShop();
  } else if(id==='bomb'){
    if(SAVE.stars<BOMB_COST) return;
    SAVE.stars-=BOMB_COST; SAVE.bombs++;
    if(!SAVE.bombOn) SAVE.bombOn=true;   // まだ装備してなければ1つ装備（ステージに持ちこめる）
    saveData(); snd('coin'); updateBombBtn(); renderShop();
  }
}
// 予備の爆弾を1つ装備する（同時に装備できるのは1つだけ）
function equipBomb(){
  if(SAVE.bombOn || SAVE.bombs<=0) return;
  SAVE.bombOn=true; saveData(); snd('coin'); updateBombBtn(); renderShop();
}
// 予備のヘルメットを1つ装備する（同時に装備できるのは1つだけ）
function equipHelmet(){
  if(SAVE.helmetOn || SAVE.helmets<=0) return;
  SAVE.helmetOn=true; if(pl) pl.helmetHp=HELMET_MAX; saveData(); snd('coin'); renderShop();
}

// ---------- ミュート切替 ----------
const muteBtn=document.getElementById('muteBtn');
function toggleMuteUI(){
  unlockAudio();
  const m = window.GameAudio ? GameAudio.toggleMute() : true;
  if(muteBtn) muteBtn.textContent = m ? '🔇' : '🔊';
}
if(muteBtn){
  muteBtn.textContent = (window.GameAudio && GameAudio.isMuted()) ? '🔇' : '🔊';
  muteBtn.onclick = toggleMuteUI;
}
// 画面のポーズボタン（キーボードのないiPad用。P キーと同じ動作）
const pauseBtn=document.getElementById('pauseBtn');
if(pauseBtn) pauseBtn.onclick=()=>togglePause();

// ---------- デバッグ用フック（?dev の時のみ） ----------
if(location.search.includes('dev')){
  window.__g = {
    get pl(){return pl;}, get enemies(){return enemies;}, get boss(){return boss;},
    get goal(){return goal;}, get state(){return state;}, get score(){return score;},
    tp(x){ if(pl){ pl.x=x; pl.spawnX=x; pl.vx=0; pl.vy=0; cam=Math.max(0,x-VW*0.38);} },
    killBoss(){ if(boss){ boss.active=true; damageEnemy(boss,boss.hp,0); } },
    setKey(k,v){ key[k]=v; }, attack(){ tryAttack(); },
    hurtAt(srcX,unblock){ return hurt(1,0,srcX,unblock); },
    get guarding(){ return pl&&pl.guarding; },
    step(n,dt){ dt=dt||1/60; for(let i=0;i<(n||1);i++){ if(state==='play') update(dt); } },
    go(name,x,st){ loadScene(name, x||120, true, st); },
    addStars(n){ SAVE.stars+=n; saveData(); }, save:SAVE,
    setCleared1(v){ SAVE.cleared1=!!v; saveData(); },
    setCleared2(v){ SAVE.cleared2=!!v; saveData(); },
    setCleared3(v){ SAVE.cleared3=!!v; saveData(); },
    equipWeapon(id){ SAVE.weapon=id; if(SAVE.weapons.indexOf(id)<0)SAVE.weapons.push(id); saveData(); },
    setBoots(v){ SAVE.boots=!!v; saveData(); },
    setHelmets(n){ SAVE.helmets=Math.max(0,n|0); SAVE.helmetOn=SAVE.helmets>0; if(pl) pl.helmetHp=SAVE.helmetOn?HELMET_MAX:0; saveData(); },
    equipHelmet(){ equipHelmet(); },
    get airJumps(){ return pl&&pl.airJumps; },
    setChar(id){ SAVE.char=id; if(SAVE.unlocked.indexOf(id)<0)SAVE.unlocked.push(id); saveData(); },
    get pshots(){ return pshots; },
    openShop(){ openShop(); }, closeShop(){ closeShop(); }, buy(id){ buyChar(id); },
    simJump(){ jumpBuf=JUMP_BUF; }, get jumpBuf(){ return jumpBuf; },
    get cam(){ return cam; }, get VW(){ return VW; }, get levelW(){ return levelW; },
    snap(){ return {scene, stageNum, state, stars:SAVE.stars, char:SAVE.char, weapon:SAVE.weapon,
      weapons:SAVE.weapons.slice(), pshots:pshots.length,
      boots:SAVE.boots, helmets:SAVE.helmets, helmetOn:SAVE.helmetOn, helmetHp:pl&&pl.helmetHp, airJumps:pl&&pl.airJumps,
      cleared1:SAVE.cleared1, cleared2:SAVE.cleared2, cleared3:SAVE.cleared3, enemyCount:enemies.filter(e=>!e.dead).length,
      plHp:pl&&pl.hp, plx:pl&&Math.round(pl.x),
      bossHp:boss&&boss.hp, bossMaxHp:boss&&boss.maxhp, bossDead:boss&&boss.dead, goalActive:goal&&goal.active}; }
  };
}

// ---------- 起動 ----------
resize(); bindTouch(); buildVillage(); pl=newPlayer(); pl.x=120;
loadArt();
})();
