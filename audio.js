/* audio.js — Web Audio API による効果音＆BGM（外部ファイル不要・完全内蔵）
   window.GameAudio を公開。ユーザー操作（スタート等）で unlock() を呼んで有効化する。 */
(() => {
'use strict';

let ctx=null, master=null, musicGain=null, sfxGain=null;
let muted = (localStorage.getItem('nekoMute')==='1');
let ready=false;

function ensure(){
  if(ctx) return true;
  const AC = window.AudioContext || window.webkitAudioContext;
  if(!AC) return false;
  ctx = new AC();
  master = ctx.createGain(); master.gain.value = muted?0:0.9; master.connect(ctx.destination);
  musicGain = ctx.createGain(); musicGain.gain.value = 0.16; musicGain.connect(master);
  sfxGain = ctx.createGain(); sfxGain.gain.value = 0.5; sfxGain.connect(master);
  ready=true;
  return true;
}

// ---- 汎用トーン ----
function tone(f0, f1, dur, type, vol, when, dest){
  if(!ctx) return;
  const t = when!=null?when:ctx.currentTime;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type||'square';
  o.frequency.setValueAtTime(f0, t);
  if(f1 && f1!==f0) o.frequency.exponentialRampToValueAtTime(Math.max(1,f1), t+dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol||0.3, t+0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t+dur);
  o.connect(g); g.connect(dest||sfxGain);
  o.start(t); o.stop(t+dur+0.02);
}
function noise(dur, vol, when, hp){
  if(!ctx) return;
  const t = when!=null?when:ctx.currentTime;
  const n = Math.floor(ctx.sampleRate*dur);
  const buf = ctx.createBuffer(1,n,ctx.sampleRate);
  const d = buf.getChannelData(0);
  for(let i=0;i<n;i++) d[i]=(Math.random()*2-1)*(1-i/n);
  const src = ctx.createBufferSource(); src.buffer=buf;
  const f = ctx.createBiquadFilter(); f.type='highpass'; f.frequency.value=hp||800;
  const g = ctx.createGain(); g.gain.setValueAtTime(vol||0.3,t); g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
  src.connect(f); f.connect(g); g.connect(sfxGain);
  src.start(t); src.stop(t+dur+0.02);
}
const M2F = m => 440*Math.pow(2,(m-69)/12);  // MIDI→周波数

// ---- 効果音プリセット ----
const SFX = {
  jump(){ tone(360,760,0.14,'square',0.3); },
  attack(){ tone(820,240,0.10,'sawtooth',0.25); noise(0.06,0.12,null,1500); },
  coin(){ const t=ctx.currentTime; tone(M2F(88),M2F(88),0.07,'square',0.3,t); tone(M2F(93),M2F(93),0.12,'square',0.3,t+0.07); },
  stomp(){ tone(520,90,0.16,'square',0.32); noise(0.08,0.15,null,600); },
  hit(){ tone(300,180,0.06,'square',0.2); },
  guard(){ const t=ctx.currentTime; tone(1000,1500,0.05,'square',0.22,t); tone(1500,900,0.12,'triangle',0.18,t+0.02); noise(0.05,0.14,t,3000); },
  shoot(){ const t=ctx.currentTime; tone(900,180,0.08,'square',0.22,t); noise(0.05,0.18,t,1200); },
  heal(){ const t=ctx.currentTime; [72,76,79].forEach((m,i)=>tone(M2F(m),M2F(m),0.16,'triangle',0.26,t+i*0.09)); },
  power(){ const t=ctx.currentTime; [60,64,67,72,76,79,84].forEach((m,i)=>tone(M2F(m),M2F(m),0.12,'square',0.24,t+i*0.06)); },
  hurt(){ const t=ctx.currentTime; tone(300,70,0.28,'sawtooth',0.32,t); noise(0.12,0.2,t,300); },
  boss(){ const t=ctx.currentTime; [69,72,76,81].forEach((m,i)=>tone(M2F(m),M2F(m),0.16,'square',0.28,t+i*0.10)); },
  clear(){ const t=ctx.currentTime; [72,76,79,84,88].forEach((m,i)=>tone(M2F(m),M2F(m),0.20,'square',0.3,t+i*0.12)); },
  over(){ const t=ctx.currentTime; [69,66,62,57].forEach((m,i)=>tone(M2F(m),M2F(m),0.28,'triangle',0.3,t+i*0.16)); }
};

// ---- BGM（チップチューンのループ）----
// 4小節ループ。コード C - G - Am - F。メロディはコード構成音のバウンス、ベースは各拍のルート。
const CHORDS = [
  [72,76,79,84],  // C:  C E G C
  [74,79,83,86],  // G:  D G B D
  [72,76,81,84],  // Am: C E A C
  [72,77,81,84],  // F:  C F A C
];
const BASS = [36,31,33,29]; // C2, G1, A1, F1（低め）
const RHYTHM = [1,0,1,1, 0,1,0,1, 1,0,1,0, 1,1,0,1]; // 16分の発音パターン
let seq = { on:false, timer:null, next:0, step:0, id:0 };
const STEP = 0.125; // 16分の長さ（秒）→ 約120BPM

// myId が最新の seq.id と一致するループだけが動く。古いループは即終了（＝二重再生を防ぐ）。
function schedule(myId){
  if(!seq.on || myId!==seq.id) return;
  // タブ復帰などで大きく遅れたら再同期（音の塊が出るのを防ぐ）
  if(seq.next < ctx.currentTime - 0.25) seq.next = ctx.currentTime + 0.05;
  const ahead = ctx.currentTime + 0.20;
  while(seq.next < ahead){
    const t = seq.next;
    const bar = Math.floor(seq.step/16)%4;
    const s = seq.step%16;
    const chord = CHORDS[bar];
    // メロディ
    if(RHYTHM[s]){
      const m = chord[(Math.floor(seq.step/1))%chord.length] + 0; // 構成音を巡回
      tone(M2F(m), M2F(m), STEP*0.9, 'square', 0.22, t, musicGain);
    }
    // ハモリ（少し下）を弱く
    if(s%4===0){ tone(M2F(chord[0]-12), 0, STEP*1.6, 'triangle', 0.16, t, musicGain); }
    // ベース（各小節アタマと中間）
    if(s===0 || s===8){ tone(M2F(BASS[bar]), 0, STEP*3, 'triangle', 0.28, t, musicGain); }
    // 軽いパーカッション（ハイハット風）
    if(s%2===0){ noise(0.02, 0.05, t, 6000); }
    seq.next += STEP;
    seq.step++;
  }
  seq.timer = setTimeout(()=>schedule(myId), 40);
}
// 既に再生中なら何もしない（＝重ねて開始しない）。id を進めて古いループを無効化。
function startMusic(){
  if(!ready || seq.on) return;
  if(seq.timer){ clearTimeout(seq.timer); seq.timer=null; }
  seq.on=true; seq.id++; seq.step=0; seq.next=ctx.currentTime+0.05;
  schedule(seq.id);
}
function stopMusic(){
  seq.on=false; seq.id++;                 // id を進めて走行中のループを確実に停止
  if(seq.timer){ clearTimeout(seq.timer); seq.timer=null; }
}

// ---- 公開API ----
window.GameAudio = {
  unlock(){ if(!ensure()) return; if(ctx.state==='suspended') ctx.resume(); },
  play(name){ if(!ready||muted) return; if(SFX[name]) SFX[name](); },
  music(flag){ if(!ready) return; if(flag) startMusic(); else stopMusic(); },
  toggleMute(){
    muted=!muted; localStorage.setItem('nekoMute', muted?'1':'0');
    if(master) master.gain.value = muted?0:0.9;
    return muted;
  },
  isMuted(){ return muted; }
};
})();
