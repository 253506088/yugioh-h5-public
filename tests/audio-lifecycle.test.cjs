const test = require('node:test'), assert = require('node:assert/strict'), vm = require('node:vm'), fs = require('node:fs');
const { ShuffleBag } = require('../src/experience.js');
function create() {
  class Audio {
    constructor() { this.currentTime=0; this.paused=true; this.duration=180; this.listeners={}; }
    addEventListener(type, listener) { this.listeners[type]=listener; }
    set src(value) { this.source=value; }
    get src() { return this.source; }
    play() { this.paused=false; return Promise.resolve(); }
    pause() { this.paused=true; }
  }
  const window={DuelExperience:{ShuffleBag},Audio,DUEL_MUSIC:[{id:'lobby',scene:'lobby',src:'lobby'},...['a','b','c'].map(id=>({id,scene:'battle',src:id}))],document:{hidden:false},dispatchEvent(){}};
  vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../src/audio.js'),'utf8'),{window,CustomEvent:class {},setInterval:()=>1,clearInterval(){},Math});
  return new window.DuelAudio({music:true,sound:false,musicVolume:.3});
}
test('each new duel starts at zero with a different battle song, including lobby interludes',()=>{
  const sound=create();let last=null;
  for(let i=0;i<30;i++){
    sound.beginDuel();assert.notEqual(sound.status().id,last);assert.equal(sound.player.currentTime,0);
    last=sound.status().id;sound.player.currentTime=87;
    if(i%2===0)sound.setScene('lobby');
  }
});
test('ordinary scene visits resume the current duel while ended songs advance without repeats',()=>{
  const sound=create();sound.beginDuel();const first=sound.status().id;sound.player.currentTime=42;
  sound.setScene('lobby');sound.setScene('battle');sound.player.onloadedmetadata();
  assert.equal(sound.status().id,first);assert.equal(sound.player.currentTime,42);
  sound.player.listeners.ended();assert.notEqual(sound.status().id,first);assert.equal(sound.player.currentTime,0);
  sound.failed.add('b');sound.failed.add('c');sound.beginDuel();assert.equal(sound.status().id,'a');
});
