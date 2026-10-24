/** Runtime contract for an isolated online engine. No campaign/storage imports.
 * prepare(manifest): seed RNG, install both decks/avatars and enter 2P deterministically.
 * step(pads,tick): advance exactly ONE simulation tick, independent of rendering/audio.
 * checksum(): hash logical state (never pixels, real time or audio output).
 * These functions must be implemented by the Wasm bridge before enabling online UI.
 */
export class OnlineEngineSession {
  constructor({ engine, send, readPad, onState = () => {} }) {
    if (engine.isolatedOnline !== true) throw Error('Se requiere un motor online aislado');
    for (const name of ['prepare','step','checksum','pause'])
      if (typeof engine[name] !== 'function') throw Error(`Falta puente Wasm: ${name}`);
    this.engine=engine; this.send=send; this.readPad=readPad; this.onState=onState;
    this.state='idle'; this.tick=0; this.generation=0; this.busy=false;
  }
  async receive(message) {
    if (message.type==='LOAD') {
      if (this.state!=='idle') throw Error('Carga duplicada');
      this.state='loading'; const generation=++this.generation;
      await this.engine.prepare(structuredClone(message.manifest));
      if (generation!==this.generation) return;
      this.state='loaded'; this.send({type:'LOADED',hash:message.manifest.hash});
    } else if (message.type==='START') {
      if (this.state!=='loaded' || message.tick!==0) throw Error('Inicio inesperado');
      this.state='playing'; this.submit();
    } else if (message.type==='FRAME') {
      if (this.state!=='playing' || this.busy || message.tick!==this.tick ||
          !Array.isArray(message.pads) || message.pads.length!==2 ||
          message.pads.some(p=>!Number.isInteger(p)||p<0||p>65535))
        throw Error('Secuencia de controles inválida');
      this.busy=true; const generation=this.generation;
      try {
        await this.engine.step(message.pads,message.tick);
        if (generation!==this.generation) return;
        this.tick++;
        if (this.tick%120===0) this.send({type:'CHECK',tick:message.tick,hash:await this.engine.checksum()});
        if (generation===this.generation && this.state==='playing') this.submit();
      } finally { this.busy=false; }
    } else if (message.type==='STATE' && ['paused','desynced'].includes(message.state)) {
      this.stop(message.state);
    }
    this.onState(this.state);
  }
  submit() {
    const pad=this.readPad();
    if (!Number.isInteger(pad)||pad<0||pad>65535) throw Error('Mando inválido');
    this.send({type:'INPUT',tick:this.tick,pad});
  }
  stop(reason='paused') {
    this.generation++; this.state=reason; this.engine.pause(); this.onState(this.state);
  }
}
