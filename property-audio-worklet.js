class PropertyPCM extends AudioWorkletProcessor {
 constructor(){super();this.data=[];this.clock=0;}
 process(inputs){const channels=inputs[0];if(!channels?.length)return true;const input=channels[0];for(let i=0;i<input.length;i++){this.clock+=16000;if(this.clock>=sampleRate){this.clock-=sampleRate;this.data.push(input[i]);}}if(this.data.length>=1600){const data=new Float32Array(this.data);this.data=[];this.port.postMessage(data,[data.buffer]);}return true;}
}
registerProcessor("property-pcm",PropertyPCM);
