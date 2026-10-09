import {botMove} from '/engine.js';
self.onmessage=event=>{const {game,seat,version}=event.data;try{self.postMessage({version,actions:botMove(game,seat)});}catch(error){self.postMessage({version,error:error.message});}};
