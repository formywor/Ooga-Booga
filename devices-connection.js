(function(root){'use strict';
 class Connection{
  constructor(bluetooth,render){this.bluetooth=bluetooth;this.render=render;this.epoch=0;this.state='disconnected';}
  show(state,message){this.state=state;this.render({state,message,device:this.device?.name||null});}
  connect(protocol){
   if(!this.bluetooth?.requestDevice){this.show('unsupported','Web Bluetooth is unavailable. Use a supported browser and OS. The browser prototype works without glasses.');return Promise.resolve();}
   if(!protocol){this.show('disconnected','No hardware or verified firmware protocol has been selected. Discovery is disabled; arbitrary Bluetooth devices cannot be treated as Nebula Glasses.');return Promise.resolve();}
   if(this.device)this.disconnect();const generation=++this.epoch;this.show('choosing device','Choose a device advertising the configured compatible service.');let chosen;
   // Must run synchronously from the Choose button, before any await or network call.
   try{chosen=this.bluetooth.requestDevice({filters:[{services:[protocol.serviceUuid]}]});}catch(e){this.show('unsupported','Bluetooth access is blocked. Open Nebula directly in your browser.');return Promise.resolve();}
   return this.finish(chosen,protocol,generation);
  }
  async finish(chosen,p,generation){let device;
   try{device=await chosen;if(generation!==this.epoch)return;this.device=device;this.permissionDevice=device;this.disconnected=()=>{if(this.device===device){this.epoch++;this.show('disconnected unexpectedly','Bluetooth disconnected. Select Choose compatible glasses to reconnect deliberately.');}};device.addEventListener('gattserverdisconnected',this.disconnected);
    this.show('connecting','Connecting to the selected BLE control transport.');const server=await device.gatt.connect();if(generation!==this.epoch){device.gatt.disconnect();return;}
    this.show('verifying compatibility','Checking the documented service, control characteristic and protocol information.');const service=await server.getPrimaryService(p.serviceUuid),info=await service.getCharacteristic(p.infoUuid),control=await service.getCharacteristic(p.controlUuid);
    if(!info.properties.read||!(control.properties.write||control.properties.writeWithoutResponse))throw Error('Incompatible characteristics');
    const value=await info.readValue();if(value.byteLength>1024)throw Error('Invalid protocol information');const details=JSON.parse(new TextDecoder().decode(value));
    if(details.protocol!==p.protocol||details.version!==p.version||details.model!==p.model)throw Error('Incompatible protocol');
    if(generation!==this.epoch){device.gatt.disconnect();return;}this.show('connected','Compatible BLE control transport connected. This is not proof of account ownership. Camera/media transport and OS audio pairing are separate and are not connected by this action.');
   }catch(e){if(generation!==this.epoch)return;if(device){device.removeEventListener('gattserverdisconnected',this.disconnected);device.gatt?.disconnect();}this.device=null;this.show('disconnected',e?.name==='NotFoundError'?'No device selected or Bluetooth chooser cancelled. Nothing connected; check Bluetooth availability before retrying.':e?.name==='SecurityError'?'Bluetooth is blocked by the browser or embedding policy. Open Nebula in a browser tab.':'The device could not be verified as compatible Nebula Glasses. It was not connected as glasses.');}
  }
  disconnect(){this.epoch++;if(this.device){this.device.removeEventListener('gattserverdisconnected',this.disconnected);this.device.gatt?.disconnect();}this.show('disconnected','Disconnected. Reconnect only with a deliberate user action.');}
  async forget(){const device=this.device||this.permissionDevice;this.disconnect();this.device=null;this.permissionDevice=null;if(device?.forget){try{await device.forget();this.show('disconnected','Device permission forgotten by this browser.');}catch{this.show('disconnected','Disconnected. Remove the device permission in browser settings.');}}else this.show('disconnected','Disconnected. Clear any saved device permission in browser site settings; operating-system pairing is separate.');}
 }
 if(typeof module!=='undefined'&&module.exports)module.exports={Connection};else root.NebulaGlassesConnection={Connection};
})(typeof window!=='undefined'?window:this);
