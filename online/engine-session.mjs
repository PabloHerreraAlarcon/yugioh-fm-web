/** Ordered bounded lockstep. Runtime state is never predicted or skipped.
 * Input window overlaps network transfer with simulation work.
 */
export class OnlineEngineSession {
  constructor({engine,send,readPad,onState=()=>{}}) {
    if(engine.isolatedOnline!==true)throw Error('Se requiere un motor online aislado');
    for(const name of ['prepare','step','checksum','pause'])
      if(typeof engine[name]!=='function')throw Error(`Falta puente Wasm: ${name}`);
    Object.assign(this,{engine,send,readPad,onState,state:'idle',tick:0,generation:0,
      busy:false,suspended:false,window:1,nextInput:0,queue:[],received:0});
  }
  async receive(message) {
    if(message.type==='LOAD') {
      if(this.state!=='idle')throw Error('Carga duplicada');
      const window=message.manifest.inputWindow??1;
      if(!Number.isInteger(window)||window<1||window>16)throw Error('Ventana de entrada inválida');
      this.window=window;this.state='loading';const generation=++this.generation;
      await this.engine.prepare(structuredClone(message.manifest));
      if(generation!==this.generation)return;
      this.state='loaded';this.send({type:'LOADED',hash:message.manifest.hash});
    } else if(message.type==='START') {
      if(this.state!=='loaded'||message.tick!==0)throw Error('Inicio inesperado');
      this.state='playing';this.submit();
    } else if(message.type==='FRAME') {
      if(this.state!=='playing'||message.tick!==this.received||this.queue.length>=32||
        !Array.isArray(message.pads)||message.pads.length!==2||
        message.pads.some(p=>!Number.isInteger(p)||p<0||p>65535))throw Error('Secuencia de controles inválida');
      this.received++;this.queue.push(message);
      return this.pump();
    } else if(message.type==='STATE'&&message.state==='suspended') {
      this.suspended=true;
    } else if(message.type==='STATE'&&message.state==='playing') {
      this.suspended=false;
      if(this.state==='playing'){this.submit();return this.pump();}
    } else if(message.type==='STATE'&&['paused','desynced'].includes(message.state)) {
      this.stop(message.state);
    }
    this.onState(this.state);
  }
  async pump() {
    if(this.busy||this.suspended||this.state!=='playing')return;
    this.busy=true;const generation=this.generation;
    try {
      while(this.queue.length&&!this.suspended&&this.state==='playing') {
        const message=this.queue.shift();
        if(message.tick!==this.tick)throw Error('Paso de simulación fuera de secuencia');
        await this.engine.step(message.pads,message.tick);
        if(generation!==this.generation)return;
        this.tick++;
        if(this.tick%120===0)this.send({type:'CHECK',tick:message.tick,hash:await this.engine.checksum()});
        if(generation!==this.generation)return;
        this.submit();this.onState(this.state);
      }
    } finally {this.busy=false;}
  }
  submit() {
    if(this.suspended||this.state!=='playing')return;
    while(this.nextInput<this.tick+this.window) {
      const pad=this.readPad();
      if(!Number.isInteger(pad)||pad<0||pad>65535)throw Error('Mando inválido');
      this.send({type:'INPUT',tick:this.nextInput++,pad});
    }
  }
  stop(reason='paused') {
    this.generation++;this.state=reason;this.queue=[];this.engine.pause();this.onState(this.state);
  }
}
