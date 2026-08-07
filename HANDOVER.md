# 引き継ぎ書 — 「ネコの騎士のぼうけん」

子どもの手描きイラストを使った **横スクロールアクションゲーム**（HTML5 Canvas + JavaScript、1フォルダー完結・オフライン動作）。

- 場所：`/Users/koshihayato/百花ゲーム01/game/`
- 元の手描き素材：`/Users/koshihayato/百花ゲーム01/IMG_0332.HEIC`（キャラ集）, `IMG_0333.HEIC`（背景）。以降のキャラ/アイテムはユーザーが会話に貼った手描き画像から起こしている。

---

## 1. 起動・ビルド方法
- **遊ぶ**：フォルダー内で `python3 -m http.server 8123` → ブラウザで `http://localhost:8123`。または `index.html` を直接開く（SVGは data URI 埋め込みなので canvas taint は起きない）。
- **プレビュー（Claude用）**：`/Users/koshihayato/UGREEN NAS/.claude/launch.json` に `"game"`（port 8123, `python3 -m http.server 8123 --directory .../game`）がある。`preview_start {name:"game"}` で起動。
- **アセット更新**：`assets/*.svg` を編集したら必ず **`node build_assets.js`** を実行 → `assets.js`（data URI 群 `window.ART`）が再生成される → ブラウザ再読み込み。

## 2. ファイル構成
| ファイル | 役割 |
|---|---|
| `index.html` | 画面・CSS・ショップUI(`#shop`)・ミュートボタン・タッチ操作UI・`<script>`読み込み |
| `game.js` | ゲーム本体（物理・敵AI・ボス・カメラ・シーン・ショップ・アイテム・武器・描画・HUD・セーブ） |
| `audio.js` | Web Audio API による効果音＆BGM合成（`window.GameAudio`） |
| `assets.js` | `build_assets.js` が生成する `window.ART = {key: dataURI}`（**直接編集しない**） |
| `assets/*.svg` | 全スプライト（47点）。`build_assets.js` の `MAP` でファイル名→ARTキーを対応 |
| `build_assets.js` | `assets/*.svg` → `assets.js` を生成（`node build_assets.js`） |
| `manifest.webmanifest` | PWA マニフェスト（アプリ名・アイコン・`display:standalone`・`orientation:landscape`） |
| `sw.js` | オフライン用サービスワーカー（ネットワーク優先＋キャッシュ）。更新時は先頭の `VERSION` を上げる |
| `icon.svg` / `icon-512.png` / `icon-192.png` / `apple-touch-icon.png` | ホーム画面アイコン（ネコの騎士）。`icon.svg`→`qlmanage -t`＋`sips`でPNG化 |
| `IPAD_SETUP.md` | iPad で遊ぶ手順（HTTPS公開→ホーム画面に追加）。ユーザー向け |
| `ART_SPEC.md` | 全スプライト共通のアート規格（輪郭#4a3728・右向き・viewBox 0 0 128 128・足底 y≈122・透明背景 等） |
| `GAME_DESIGN.md` | 初期ゲーム設計書（現状はこの引き継ぎ書の方が最新） |
| `README.md` | ユーザー向け遊び方・操作 |
| ※ `assets/village_waterfall.svg` | **未使用**（村の滝は削除済み。消して良い） |

## 3. 実装済みの機能（現状）
### シーン
- `scene` = `'village'`（拠点）/`'stage'`。ステージ番号は `stageNum`(1|2|3)。難易度は`hard()`(=stageNum>=2)と`ex()`(=stageNum>=3のみ)の2段で判定。
- **むら**：家2軒・かじ屋（ショップ）・**なだらかな緑の丘（地平線に立つ背景）**。滝は削除済み。右に看板「ぼうけん1へ」「ぼうけん2へ」。
- **ステージ1/2/3**：同じ地形（穴・足場）。ステージが上がるほど敵が多く・速く・強い。**ボスHP 8→15→22**。ステージ3(`ex()`)は敵の速度×1.3・クールダウン短縮・魔法弾/火の玉/雷が速く多い・ボスのダッシュ/召喚も強化。敵配置は各ステージで別（`buildStage`内の`stageNum===1/2/else`分岐）。

### キャラクター（かじ屋「なかま」で購入・変更／星が通貨）
`CHARS`（game.js）：cat(0), dog(15), seal(25), **penguin(150)**, **panda(115)**, **rabbit(130)**, **cheetah(130)**。各キャラ4ポーズ（idle/walk/attack/guard）。penguinは銃、pandaは爆弾を持った見た目（機能は装備武器に従う）。
- **キャラ固有ステータス**（`CHARS`の任意プロパティ、既定は等倍）：`jump`＝ジャンプ**とうたつ高さ**の倍率（初速には`Math.sqrt(jump)`をかける。高さ∝初速²のため）、`speed`＝移動速度の倍率（`MOVE`と加速度に直接かける）。`desc`＝ショップ表示の説明文。例：**ウサギ**`jump:1.5`（1.5倍高くジャンプ）、**チーター**`speed:1.7`（1.7倍速く走る）。物理は`updatePlayer`で`curChar().jump/speed`を参照。

### 武器（かじ屋「ぶき」で購入・装備。単体購入可・全部外せる）
`WEAPONS`（game.js）：
- `none`（そうびなし＝素手・短い近接）cost0・常時
- `sword`（けん）cost0・常時・近接reach60
- `gun`（じゅう）**80・遠距離**（弾 `pshots` を発射、遠くの敵に当たる）
- `axe`（おの）50・近接reach80・**ダメージ2**
- `bat`（金ぞくバット）50・近接・**ノックバック大**
- `wand`（ステッキ）**60・遠距離**（魔法の星 `wpnWandShot` を発射・ふつうの連射）
- `hammer`（ハンマー）50・近接reach72・**ダメージ2＋ノックバック特大**（`cd`0.5で少し重い振り）
- `bow`（弓矢）**70・遠距離**（矢 `wpnArrow` を発射・**`cd`1.0＝1秒に1回**・ダメージ2・射程長め）
- cost0(none/sword)は常時所持あつかい（`weaponOwned()`）。装備武器は手元に重畳描画（`drawWeaponInHand`）。
- 武器の任意フィールド：`cd`＝攻撃後のクールダウン秒（未指定は遠距離0.30/近接0.36）、遠距離は`shot`(弾ARTキー)/`shotSpd`/`shotW`/`shotH`/`shotLife`で弾の見た目・速さ・大きさ・寿命を指定（`fireBullet`が参照）。`cd>=1`の武器は頭上にリロードゲージを表示（`drawPlayer`）。

### どうぐ（かじ屋「どうぐ」で購入。`buyGear`/`equipHelmet`）
- 🥾 **ジャンプぐつ**（`SAVE.boots`、`BOOT_COST`＝40）：買い切り。履くと**高くジャンプ**（`BOOT_JUMP_V`=900、通常780）＋**二段ジャンプ**（`pl.airJumps`。空中でもう1回。着地で回復）。`bootsEquipped()`で判定。アイコンは `assets/boots.svg`（canvas描画なし＝ショップ`<img>`のみ）。
- ⛑ **ヘルメット**（`SAVE.helmets`＝在庫数, `SAVE.helmetOn`＝装備中か, `HELMET_COST`＝10）：**何個でも買えるが、同時に装備できるのは1つだけ**。装備中の1個が被弾を肩代わりし、`HELMET_MAX`(=1)回でこわれる（`pl.helmetHp`）。**壊れても自動で次をかぶらない**＝むらのかじ屋で「そうびする」（`equipHelmet`）で予備を1つ装備。優先順位は**ガード＞ヘルメット＞ハート**（`hurt()`内）。落下(穴)は`fallDeath`直減なので守らない。頭に重畳描画（`drawHelmetOnHead`）＋HUDに在庫数と現在の残り回数を表示（未装備の予備はうすく表示）。ARTキー`gearHelmet`（`assets/helmet.svg`）。

### アイテム（各ステージ1個まで）
- 🍎 **リンゴ**（`item_apple`）：ハート1回復。満タンなら取らずに残す。**ステージ1=1個(キャンディ無)/ステージ2=1個**。
- 🍭 **キャンディー**（`item_candy`）：**10秒むてき**（`pl.invPower`）。全ダメージ無効＋触れた敵を倒す（ボスは無傷ですり抜け）。虹オーラ＋HUDに「むてき ◯」。**ステージ2のみ1個**。落下(穴)は無敵でもミス。
- 配置は `buildStage()` 内の `items.push(...)`。

### 操作
- 移動 ←→/AD、ジャンプ Space/↑/W（可変高さ・コヨーテ）、攻撃 J/Z、**ガード K/↓/S**（向いてる方向の敵/弾を盾で防ぐ・移動/攻撃不可）、ポーズ P、リスタート R、ミュート M。スマホは画面下タッチUI（🛡⚔⤴＋◀▶）。
- **ゲート/ショップは「↑を押して発動」**（通り抜けでは発動しない）。村に「ぼうけん1/2/3へ」ゲート3つ。ステージ2は`SAVE.cleared1`、ステージ3は`SAVE.cleared2`で解放（未解放は🔒表示）。
- **ステージ→村はポーズ画面の「🏘 むらへもどる」ボタンのみ**（戦闘中の誤発動を防ぐため、ステージ内に村ゲートは置いていない）。村へ自動で戻るのは**ボス撃破→ゴール(クリア)**のとき。

### 戦闘・物理
- プレイヤー：AABB当たり判定、重力、踏みつけ(stomp)で敵撃破、剣/武器の近接は**1攻撃につき各敵1ヒット**（`pl.atkHits`）。被弾で1ハート減＋無敵時間`pl.inv`。穴落下で`fallDeath`（1ミス→復帰、0でゲームオーバー）。
- 敵：shark(地上突進)/bat(サイン飛行)/ghost(追尾)/flameDemon(火の玉)/mage(魔法弾hp2〜6)/cloudEnemy(かみなり)。ボス reaper(ダッシュ＋雑魚召喚)。`mkEnemyByType()`で`hard()`＝ステージ2以上、`ex()`＝ステージ3で強化（速度`sMul`/CD`cMul`）。

### 音
- `audio.js`。効果音（jump/attack/shoot/coin/stomp/hit/guard/hurt/heal/power/boss/clear/over）＋チップチューンBGM。
- **BGMは必ず1ループのみ**（`schedule(myId)` のトークン方式。開始/停止で `seq.id++`。二重再生バグ対策済み）。ミュートは `localStorage nekoMute`。

### セーブ（`localStorage`）
`nekoStars`(星), `nekoUnlocked`(解放キャラ配列), `nekoChar`(選択キャラ), `nekoWeapons`(所持武器配列), `nekoWeapon`(装備武器), `nekoCleared1/2/3`(クリア状況), `nekoBoots`(ジャンプ靴所持), `nekoHelmets`(ヘルメット在庫数), `nekoHelmetOn`(ヘルメット装備中か), `nekoMute`。
**初期状態＝ネコ＋けんのみ・星0・未クリア**（`SAVE` の既定値）。`saveData()` で保存。

## 4. game.js の主なセクション（読む順の目安）
定数/canvas・`resize()`（NaN/0サイズ対策あり）→ アセット読込(`IMG`/`PLACE`/`loadArt`)→ `SAVE`/`saveData`→ `CHARS`/`WEAPONS`→ `drawSprite`/`drawSpriteSquare`(正方形＝比率保持描画)→ 入力(keyboard/touch)→ シーン(`buildVillage`/`buildStage`/`loadScene`/`clearScene`/`useGate`)→ 敵(`mkEnemyByType`/`updateEnemies`/`updateBoss`)→ プレイヤー(`updatePlayer`/`tryAttack`/`fireBullet`/`hurt`/`guardBlocks`)→ 弾(敵`projectiles`＋自弾`pshots`)→ アイテム/パーティクル→ 状態(`win`/`gameOver`/`togglePause`/`retry`)→ 描画(`render`/`drawParallax`/`drawVillageHills`/`drawWorld`/`drawPlayer`/`drawWeaponInHand`/`drawHUD`)→ ショップ(`openShop`/`renderShop`/`buyChar`/`buyWeapon`)→ ミュート→ **デバッグフック(`?dev`時のみ `window.__g`)**→ 起動。

## 5. 開発・検証のコツ（重要）
- **`?dev` を付けて開くと `window.__g` が有効**：`snap()`（状態）, `go(scene,x,stage)`, `tp(x)`, `killBoss()`, `equipWeapon(id)`, `setChar(id)`, `simJump()`, `step(n)`（rAFに依存せず`update`を回す）, `save`(SAVE参照) 等。デタミニスティックに検証できる。
- **タブが非表示だと requestAnimationFrame が止まる**（`update`が進まない）。dev検証は `step()` を使う。スクリーンショットは1フレーム描画を強制する。
- **プレビューのブラウザは bfcache で古いページ状態を復元することがある** → 確実に作り直したいときは **毎回ユニークなURL**（`?v=1`, `?v=2`…）で開く。
- **⚠ dev操作はセーブを汚す**：`setChar`/`equipWeapon`/`buyChar`/`buyWeapon`/星取得(step中) は `saveData()` で `localStorage` に永続化される。**検証後は必ずセーブを初期化する**（下記）。過去に「ペンギン/武器を最初から持っている」「星が増えている」等の誤解を招いた。
  ```js
  // セーブ初期化（?dev で）
  const g=window.__g;
  g.save.stars=0; g.save.unlocked.length=0; g.save.unlocked.push('cat'); g.save.char='cat';
  g.save.weapons.length=0; g.save.weapons.push('sword'); g.save.weapon='sword';
  g.save.cleared1=false; g.save.cleared2=false; g.save.cleared3=false;
  g.save.boots=false; g.save.helmets=0; g.save.helmetOn=false;
  ['nekoStars','nekoUnlocked','nekoChar','nekoWeapons','nekoWeapon','nekoCleared1','nekoCleared2','nekoCleared3','nekoBoots','nekoHelmets','nekoHelmetOn']
    .forEach(k=>localStorage.removeItem(k));
  // localStorage.setItem('nekoStars','0'); ... で明示的に上書きする方が確実
  ```
- **📱 iPad / PWA**：`index.html`に PWA用meta（`apple-mobile-web-app-capable`等）＋`viewport-fit=cover`、CSSに`env(safe-area-inset-*)`（操作ボタン/ミュートがノッチ・ホームバーに被らないように）、たて向き時の「よこにしてね」案内`#rotate`、ピンチ拡大禁止(`gesturestart`)、SW登録を追加済み。オフラインは`sw.js`（**ネットワーク優先→失敗時キャッシュ**。`fetch`は`cache:'no-cache'`、プリキャッシュは`Request(...,{cache:'reload'})`でHTTPキャッシュを迂回＝古い版が残らない）。ゲーム中スプライトは`assets.js`のdataURIなので、SWのプリキャッシュはコア＋ショップが`<img>`で読むSVGだけでよい。**SWはhttpsかlocalhostでのみ有効**（LAN の生httpでは登録されない）。公開手順は`IPAD_SETUP.md`。
- **⏸ 画面ポーズボタン**（`#pauseBtn`、右上・ミュートの左）：`togglePause()`。あそび中(`state==='play'`)だけ表示（`loop()`内の`syncTouchUI()`で切替）。ポーズ画面(`showOverlay 'pause'`)に **つづける/やりなおす(`retry()`)/むらへもどる** を用意（やりなおす・むらへはステージ時のみ）。キーボードのP・Rの代替。
- **⚠ アセット/コード更新後は`sw.js`の`VERSION`を上げる**：上げないと公開済みiPadアプリが古いキャッシュのまま。プレビュー(localhost)はネットワーク優先なので基本は最新が出るが、迷ったら`?v=N`で開く。
- **🔇 こちら（アシスタント）側では音を鳴らさない**：プレビューの音がユーザーの音と二重になる。検証時は `if(!GameAudio.isMuted()) GameAudio.toggleMute()` でミュートのまま確認する。`nekoMute=1` を保つ。

## 6. スプライト命名規約
- キャラ：`{name}_{idle|walk|attack|guard}.svg`（例 `penguin_idle.svg` → ARTキー `pengIdle`）。ファイル名→キーは `build_assets.js` の `MAP`、フォールバック色は `game.js` の `PLACE`、キャラ定義は `CHARS`。新規追加時はこの3か所＋（キャラなら`CHAR_ORDER`）を更新。
- すべて **viewBox 0 0 128 128・右向き・足底 y≈122・透明背景・width/height属性なし**（`ART_SPEC.md`）。武器は横長viewBoxあり。

## 7. 直近の既知の注意点 / TODO候補
- `village_waterfall.svg` は未使用（削除可）。
- 星の総数はプレイで貯まる通貨。ショップ価格：dog15/seal25/panda115/penguin150/rabbit130/cheetah130、gun80/axe50/bat50/wand60/hammer50/bow70、ジャンプ靴40/ヘルメット10。
- 難易度・価格・アイテム量はユーザー要望で頻繁に変わる想定。数値は `CHARS`/`WEAPONS`/`buildStage`/`mkEnemyByType`/`updateBoss` に集中。
- キャラの内蔵武器（絵の中の剣/銃/爆弾）と装備武器は別物。装備武器は攻撃挙動＋手元描画のみ変える（見た目が二重になる場合あり＝許容中）。
- 実機（ユーザーのブラウザ）とプレビューは別localStorage。ユーザーが「最初から持っている」と言う場合、過去のdev汚染 or 実機の既存セーブが原因のことが多い。

## 8. これまでの主な変更履歴（要約）
1. 基本エンジン＋ネコ主人公＋敵/ボス＋クリア/ゲームオーバー
2. 手描き準拠のアート（キャラ・敵・背景を忠実に再描画。縦横比の変形バグ修正＝`drawSpriteSquare`）
3. 効果音・BGM（二重再生バグ修正）
4. 盾ガード（方向判定）
5. むら（拠点）＋かじ屋ショップ＋キャラ購入（dog/seal→penguin/panda）＋星の永続化
6. ステージ2（敵増強・ボスHP増）＋ステージ選択ゲート（↑発動・cleared1で解放）
7. 丘/滝の見直し（最終的に滝削除・丘は地平線の背景に）
8. 武器システム（gun/axe/bat＋そうびなし、gunは遠距離）／武器は単体購入・全外し可・初期はけんのみ
9. ステージ中の村誤ワープ修正（ステージ内ゲート撤去→村復帰はポーズメニューのみ）
10. アイテム：リンゴ(回復)・キャンディ(10秒無敵)（各ステージ1個、S1はリンゴのみ）
