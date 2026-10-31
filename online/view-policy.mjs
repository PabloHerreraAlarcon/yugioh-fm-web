/** Presentation only. Both seats keep the native table; card backs are drawn by the local render hook. */
export class OnlineViewPolicy {
 constructor(seat){if(seat!==0&&seat!==1)throw Error('Jugador invalido');this.seat=seat;this.lastTurn=null;this.ready=false;}
 update(words){const [,opponent,turn,flags,lp0,lp1]=words;const visible=opponent===255&&(turn===0||turn===1);if(!visible||turn!==this.lastTurn){this.ready=false;this.lastTurn=visible?turn:null;}if(visible&&turn===this.seat&&(flags&15)===4)this.ready=true;return {visible,privateHand:visible&&turn!==this.seat,privateDetails:visible&&(turn!==this.seat||!this.ready),text:!visible?'Preparando duelo…':turn===this.seat?'Tu turno':'Turno del rival',lp:[lp0,lp1]};}
}
