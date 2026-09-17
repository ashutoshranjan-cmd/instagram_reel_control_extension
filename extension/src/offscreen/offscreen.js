import { isInstagramMediaUrl } from '../platform/instagram/reelMedia.js';
let current=null,converting=false;const files=new Map();
function release(s){clearTimeout(s.timer);clearInterval(s.meter);if(s.recorder?.state==='recording')s.recorder.stop();s.stream?.getTracks().forEach(t=>t.stop());s.context?.close().catch(()=>{});}
function cancel(s){if(!s)return;s.cancelled=true;s.controller.abort();s.finish?.();release(s);}
async function record({streamId,requestId,duration,backendUrl}){
  cancel(current);const s={requestId,cancelled:false,controller:new AbortController()};current=s;
  try{
    s.stream=await navigator.mediaDevices.getUserMedia({audio:{mandatory:{chromeMediaSource:'tab',chromeMediaSourceId:streamId}},video:false});
    if(s.cancelled)return{success:false,code:'CANCELLED'};
    s.context=new AudioContext();const source=s.context.createMediaStreamSource(s.stream);source.connect(s.context.destination);await s.context.resume();
    const analyser=s.context.createAnalyser();source.connect(analyser);const samples=new Float32Array(analyser.fftSize);let audible=false;
    s.meter=setInterval(()=>{analyser.getFloatTimeDomainData(samples);if(samples.some(v=>Math.abs(v)>.001))audible=true;},100);
    const mimeType=MediaRecorder.isTypeSupported('audio/webm;codecs=opus')?'audio/webm;codecs=opus':'audio/webm';
    const recorder=new MediaRecorder(s.stream,{mimeType});s.recorder=recorder;const chunks=[];
    recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
    const blob=await new Promise((resolve,reject)=>{s.finish=()=>{if(recorder.state!=='inactive')recorder.stop();else resolve(null);};recorder.onstop=()=>resolve(new Blob(chunks,{type:mimeType}));recorder.onerror=e=>reject(e.error);recorder.start();s.timer=setTimeout(s.finish,duration*1000);s.stream.getAudioTracks()[0]?.addEventListener('ended',()=>cancel(s),{once:true});});
    release(s);if(s.cancelled)return{success:false,code:'CANCELLED'};if(!audible||!blob||blob.size<500)return{success:false,code:'SONG_NOT_FOUND'};
    chrome.runtime.sendMessage({type:'OFFSCREEN_PROGRESS',requestId}).catch(()=>{});
    const form=new FormData();form.append('audio',blob,'sample.webm');s.timer=setTimeout(()=>s.controller.abort(),25000);
    const r=await fetch(`${backendUrl}/api/recognize`,{method:'POST',body:form,signal:s.controller.signal});const data=await r.json();
    return s.cancelled?{success:false,code:'CANCELLED'}:{success:r.ok&&data.success===true,code:r.status===429?'RATE_LIMITED':data.code,result:r.ok&&data.success?data:null};
  }catch(e){return{success:false,code:s.cancelled?'CANCELLED':e.name==='AbortError'?'TIMEOUT':s.recorder?'NETWORK_ERROR':'CAPTURE_ERROR'};}
  finally{release(s);if(current===s)current=null;}
}
async function convert({media,format,resolution,backendUrl}){
  if(converting)throw new Error('Another download is being prepared. Please wait.');if(!isInstagramMediaUrl(media?.url))throw new Error('No accessible source.');converting=true;
  try{
    const r=await fetch(media.url,{credentials:'omit',signal:AbortSignal.timeout(60000)});if(!r.ok)throw new Error('The reel source is unavailable or expired. Reload the reel.');
    const limit=100*1024*1024;if(Number(r.headers.get('content-length'))>limit)throw new Error('The reel exceeds the 100 MB conversion limit.');
    const reader=r.body.getReader(),chunks=[];let size=0;
    try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit)throw new Error('The reel exceeds the 100 MB conversion limit.');chunks.push(value);}}finally{await reader.cancel().catch(()=>{});}
    const form=new FormData();form.append('media',new Blob(chunks,{type:'video/mp4'}),'reel.mp4');form.append('format',format);form.append('resolution',resolution);
    const response=await fetch(`${backendUrl}/api/media/convert`,{method:'POST',body:form,signal:AbortSignal.timeout(150000)});
    if(!response.ok){const data=await response.json().catch(()=>({}));throw new Error(data.message||'Conversion failed. Check your local server.');}
    const blob=await response.blob();if(!blob.size)throw new Error('Conversion returned an empty file.');
    const url=URL.createObjectURL(blob);files.set(url,setTimeout(()=>{URL.revokeObjectURL(url);files.delete(url);},600000));return{success:true,url};
  }catch(e){if(e instanceof TypeError)throw new Error('Cannot reach the video source or local conversion server.');throw e;}finally{converting=false;}
}
chrome.runtime.onMessage.addListener((message,sender,respond)=>{
  if(message.target!=='offscreen'||sender.id!==chrome.runtime.id)return;
  let task;
  if(message.type==='OFFSCREEN_RECORD')task=record(message);
  if(message.type==='OFFSCREEN_CANCEL'){if(current?.requestId===message.requestId)cancel(current);respond({success:true});return;}
  if(message.type==='OFFSCREEN_CONVERT')task=convert(message);
  if(message.type==='OFFSCREEN_RELEASE'){if(files.has(message.url)){clearTimeout(files.get(message.url));URL.revokeObjectURL(message.url);files.delete(message.url);}respond({success:true});return;}
  if(task){task.then(respond).catch(e=>respond({success:false,message:e.message}));return true;}
});
