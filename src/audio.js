(function (root) {
  'use strict';
  class DuelAudio {
    constructor(prefs) {
      this.prefs=prefs;this.context=null;this.master=null;this.scene='lobby';this.unlocked=false;this.musicState='ready';this.currentTrack=null;this.failed=new Set();this.positions=new Map();this.sceneTracks=new Map();this.playEpoch=0;this.fadeTimer=null;
      this.tracks=root.DUEL_MUSIC||[];
      this.shuffle=new root.DuelExperience.ShuffleBag(this.tracks.filter(t=>t.scene==='battle').map(t=>t.id));
      this.player=new root.Audio();this.player.preload='metadata';this.player.volume=0;
      this.player.addEventListener('ended',()=>{if(this.scene==='battle')this.nextTrack();});
      this.player.addEventListener('playing',()=>{this.musicState='playing';this.announce();});
      this.player.addEventListener('error',()=>{if(this.currentTrack){this.failed.add(this.currentTrack.id);this.musicState='error';this.announce();if(this.scene==='battle'&&this.tracks.some(t=>t.scene==='battle'&&!this.failed.has(t.id)))this.nextTrack();}});
      this.setScene('lobby');
    }
    unlock() {
      this.unlocked=true;
      if (!this.context) {
        const Audio = root.AudioContext || root.webkitAudioContext;
        if (!Audio) { this.update(); return; }
        try {
          this.context = new Audio();
          this.master = this.context.createGain();
          this.master.gain.value = this.prefs.sound ? this.prefs.volume : 0;
          const compressor = this.context.createDynamicsCompressor();
          compressor.threshold.value = -16; compressor.ratio.value = 5;
          this.master.connect(compressor); compressor.connect(this.context.destination);
        } catch { this.update(); return; }
      }
      if (this.context.state === 'suspended') this.context.resume().catch(() => {});
      this.update();
    }
    update() {
      if(this.context&&this.master)this.master.gain.setTargetAtTime(this.prefs.sound?this.prefs.volume:0,this.context.currentTime,.08);
      const active=this.unlocked&&this.prefs.music&&!root.document.hidden;
      if(!active){this.playEpoch++;clearInterval(this.fadeTimer);this.fadeTimer=null;this.player.pause();this.musicState=this.prefs.music?'ready':'paused';this.announce();return;}
      if(this.currentTrack?.src&&!this.failed.has(this.currentTrack.id)){
        if(this.player.paused){const epoch=++this.playEpoch;this.musicState='loading';const started=this.player.play();started?.then(()=>{if(epoch!==this.playEpoch)return;this.fadeIn();}).catch(error=>{if(epoch!==this.playEpoch)return;this.musicState=error.name==='NotAllowedError'?'blocked':'error';this.announce();});}
        else if(!this.fadeTimer)this.player.volume=this.musicVolume();
      }
      this.announce();
    }
    musicVolume(){return Math.max(0,Math.min(1,Number(this.prefs.musicVolume??.28)));}
    fadeIn(){clearInterval(this.fadeTimer);this.player.volume=0;let step=0;this.fadeTimer=setInterval(()=>{this.player.volume=this.musicVolume()*Math.min(1,++step/12);if(step>=12){clearInterval(this.fadeTimer);this.fadeTimer=null;}},35);}
    setScene(scene){
      if(this.scene===scene&&this.currentTrack)return;
      this.scene=scene;
      const saved=this.sceneTracks.get(scene),id=scene==='battle'?(saved||this.shuffle.next()):this.tracks.find(t=>t.scene===scene)?.id;
      this.selectTrack(id,true);
    }
    selectTrack(id,resume=false){
      const track=this.tracks.find(t=>t.id===id);if(!track)return;
      if(this.currentTrack){this.positions.set(this.currentTrack.id,this.player.currentTime||0);}
      this.playEpoch++;clearInterval(this.fadeTimer);this.fadeTimer=null;this.player.pause();this.player.volume=0;
      this.currentTrack=track;this.sceneTracks.set(this.scene,id);this.musicState='ready';
      if(!track.src){this.musicState='missing';this.announce();return;}
      this.player.src=track.src;this.player.loop=this.scene!=='battle';
      const position=resume?this.positions.get(id)||0:0;
      this.player.onloadedmetadata=()=>{if(this.currentTrack?.id!==id)return;if(position>0&&position<this.player.duration)this.player.currentTime=position;};
      this.update();
    }
    nextTrack(){
      if(this.scene!=='battle')return;
      let id=null;for(let i=0;i<this.tracks.length;i++){const candidate=this.shuffle.next();if(candidate&&!this.failed.has(candidate)){id=candidate;break;}}
      if(id)this.selectTrack(id,false);
    }
    status(){return {scene:this.scene,state:this.musicState,id:this.currentTrack?.id||null,title:this.currentTrack?.title||'',available:this.tracks.filter(t=>t.src).length,total:this.tracks.length};}
    announce(){root.dispatchEvent(new CustomEvent('duel-music-status',{detail:this.status()}));}
    tone(frequency, duration, type = 'sine', volume = .15, delay = 0, endFrequency = null) {
      if (!this.context || this.context.state !== 'running') return;
      const time = this.context.currentTime + delay;
      const osc = this.context.createOscillator(), gain = this.context.createGain();
      osc.type = type; osc.frequency.setValueAtTime(frequency, time);
      if (endFrequency) osc.frequency.exponentialRampToValueAtTime(endFrequency, time + duration);
      gain.gain.setValueAtTime(.0001, time); gain.gain.exponentialRampToValueAtTime(Math.max(.0002, volume), time + Math.min(.03, duration / 3));
      gain.gain.exponentialRampToValueAtTime(.0001, time + duration);
      osc.connect(gain); gain.connect(this.master); osc.start(time); osc.stop(time + duration + .05);
      osc.onended = () => { osc.disconnect(); gain.disconnect(); };
    }
    noise(duration = .2, volume = .12, frequency = 1500) {
      if (!this.context || this.context.state !== 'running') return;
      const count = Math.ceil(this.context.sampleRate * duration), buffer = this.context.createBuffer(1, count, this.context.sampleRate), values = buffer.getChannelData(0);
      for (let i = 0; i < count; i++) values[i] = (Math.random() * 2 - 1) * (1 - i / count);
      const source = this.context.createBufferSource(), filter = this.context.createBiquadFilter(), gain = this.context.createGain();
      source.buffer = buffer; filter.type = 'lowpass'; filter.frequency.value = frequency; gain.gain.value = volume;
      source.connect(filter); filter.connect(gain); gain.connect(this.master); source.start();
      source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); };
    }
    play(name) {
      if (!this.prefs.sound || !this.context) return;
      switch (name) {
        case 'click': this.tone(510, .07, 'sine', .055, 0, 350); break;
        case 'card': this.noise(.11, .10, 1900); this.tone(340, .08, 'sine', .06); break;
        case 'draw': this.noise(.18, .16, 2600); this.tone(880, .23, 'sine', .09, .04); break;
        case 'summon': [261.63, 392, 523.25, 783.99].forEach((n, i) => this.tone(n, .8, 'triangle', .13, i * .09)); this.noise(.4, .08, 550); break;
        case 'special': [196, 293.66, 392, 587.33, 783.99].forEach((n, i) => this.tone(n, 1.35, 'triangle', .12, i * .1)); this.tone(65.4, 1.2, 'sine', .22); break;
        case 'spell': [523.25, 659.25, 1046.5].forEach((n, i) => this.tone(n, .7, 'sine', .14, i * .1)); break;
        case 'trap': this.tone(180, .8, 'triangle', .17, 0, 720); this.tone(600, .7, 'sine', .12, .15, 300); this.noise(.3, .08, 1400); break;
        case 'attack': this.tone(340, .3, 'sawtooth', .09, 0, 60); this.noise(.35, .2, 3500); break;
        case 'damage': this.tone(95, .45, 'sine', .28, 0, 35); this.noise(.4, .17, 1000); break;
        case 'phase': this.tone(392, .25, 'sine', .12); this.tone(587.33, .4, 'sine', .1, .1); break;
        case 'victory': [261.63, 329.63, 392, 523.25, 659.25, 783.99].forEach((n, i) => this.tone(n, 1.8, 'triangle', .14, i * .12)); break;
        case 'defeat': [293.66, 261.63, 220, 146.83].forEach((n, i) => this.tone(n, 1.4, 'triangle', .1, i * .23)); break;
      }
    }
  }
  root.DuelAudio = DuelAudio;
})(window);
