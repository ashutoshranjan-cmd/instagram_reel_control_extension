import { MessageTypes } from '../utils/messageTypes.js';
import { listYouTubePlaylists, disconnectYouTube, selectYouTubePlaylist, saveToYouTube } from './youtube.js';
import { settingsService } from '../services/settings.service.js';
import { isInstagramMediaUrl } from '../platform/instagram/reelMedia.js';
let creating, capture;
async function offscreen() {
  if (!creating) creating = (async () => { if (!(await chrome.runtime.getContexts({contextTypes:['OFFSCREEN_DOCUMENT']})).length) await chrome.offscreen.createDocument({url:'src/offscreen/offscreen.html',reasons:['USER_MEDIA','BLOBS'],justification:'Identify reel audio and prepare requested downloads.'}); })();
  try { await creating; } finally { creating=null; }
}
const sendOffscreen = message => chrome.runtime.sendMessage({...message,target:'offscreen'});
export function backendAddress(value) {
  const url=new URL(value);
  if (!['http://localhost:5050','http://localhost:5000','http://127.0.0.1:5050','http://127.0.0.1:5000'].includes(url.origin)||url.pathname!=='/'||url.username||url.password||url.search||url.hash) throw new Error('Use http://localhost:5050 or http://localhost:5000 in Settings.');
  return url.origin;
}
async function startCapture(message,sender) {
  if (message.userInitiated !== true) return {success:false,code:'CLICK_REQUIRED'};
  const tabId=sender.tab.id;
  if (capture && capture.tabId!==tabId) return {success:false,code:'BUSY'};
  if (capture && !capture.cancelled) return {success:false,code:'BUSY'};
  const session={requestId:message.requestId,tabId,cancelled:false};capture=session;
  try {
    const backendUrl=backendAddress(message.backendUrl);
    try {const r=await fetch(`${backendUrl}/api/health`,{signal:AbortSignal.timeout(5000)});const h=await r.json();if(!r.ok)return{success:false,code:'NETWORK_ERROR'};if(h.provider?.configured===false)return{success:false,code:'PROVIDER_NOT_CONFIGURED'};}catch{return{success:false,code:'NETWORK_ERROR'};}
    if(session.cancelled)return{success:false,code:'CANCELLED'};
    await offscreen();
    if(session.cancelled)return{success:false,code:'CANCELLED'};
    const streamId=await chrome.tabCapture.getMediaStreamId({targetTabId:tabId});
    if(session.cancelled)return{success:false,code:'CANCELLED'};
    return await sendOffscreen({type:'OFFSCREEN_RECORD',streamId,requestId:session.requestId,duration:[8,10,12].includes(message.duration)?message.duration:10,backendUrl});
  }finally{if(capture===session)capture=null;}
}
async function relay(message) {
  const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
  if(!tab?.url?.startsWith('https://www.instagram.com/'))throw new Error('Open an Instagram reel first.');
  try{return await chrome.tabs.sendMessage(tab.id,message);}catch{await chrome.scripting.executeScript({target:{tabId:tab.id},files:['content/content.js']});return chrome.tabs.sendMessage(tab.id,message);}
}
async function download(message) {
  if(!isInstagramMediaUrl(message.media?.url))throw new Error('No accessible source for this reel.');
  if(!['mp3','mp4'].includes(message.format)||!['original','1080','720','480','360'].includes(String(message.resolution)))throw new Error('Invalid download format.');
  const name=`ReelSong-${String(message.shortcode||'reel').replace(/[^\w-]/g,'').slice(0,60)}`;
  if(message.format==='mp4'&&message.resolution==='original')return{success:true,downloadId:await chrome.downloads.download({url:message.media.url,filename:`${name}.mp4`,saveAs:true})};
  await offscreen();const settings=await settingsService.getSettings();
  const result=await sendOffscreen({...message,type:'OFFSCREEN_CONVERT',backendUrl:backendAddress(settings.backendUrl)});
  if(!result?.success)return result;
  try{return{success:true,downloadId:await chrome.downloads.download({url:result.url,filename:`${name}.${message.format}`,saveAs:true})};}
  catch(e){await sendOffscreen({type:'OFFSCREEN_RELEASE',url:result.url});throw e;}
}
chrome.runtime.onMessage.addListener((message,sender,respond)=>{
  if(message.target==='offscreen'||sender.id!==chrome.runtime.id)return;
  const page=sender.url?.startsWith(chrome.runtime.getURL(''));
  const instagram=sender.tab?.url?.startsWith('https://www.instagram.com/');
  let task;
  if(message.type==='OFFSCREEN_PROGRESS'&&page&&capture?.requestId===message.requestId){chrome.tabs.sendMessage(capture.tabId,{type:'RECOGNITION_PROGRESS',requestId:message.requestId}).catch(()=>{});return;}
  if(message.type===MessageTypes.START_AUDIO_CAPTURE&&instagram)task=startCapture(message,sender);
  if(message.type===MessageTypes.CANCEL_AUDIO_CAPTURE&&instagram){if(capture?.tabId===sender.tab.id&&capture.requestId===message.requestId){capture.cancelled=true;task=sendOffscreen({type:'OFFSCREEN_CANCEL',requestId:message.requestId}).catch(()=>({success:true}));}else task=Promise.resolve({success:true});}
  if([MessageTypes.MANUAL_IDENTIFY,'VIEWER_ACTION',MessageTypes.GET_CURRENT_STATE].includes(message.type)&&page)task=relay(message);
  if(page||instagram){
    if(message.type==='LIST_YOUTUBE_PLAYLISTS')task=listYouTubePlaylists(false,message.refresh);
    if(message.type==='CONNECT_YOUTUBE')task=listYouTubePlaylists(true,true);
    if(message.type==='SELECT_YOUTUBE_PLAYLIST')task=selectYouTubePlaylist(message.playlistId);
    if(message.type==='SAVE_TO_YOUTUBE')task=saveToYouTube(message.videoId,message.playlistId);
    if(message.type==='DOWNLOAD_REEL')task=download(message);
    if(message.type==='OPEN_YOUTUBE_SETTINGS')task=chrome.tabs.create({url:chrome.runtime.getURL('src/popup/index.html#settings')}).then(()=>({success:true}));
  }
  if(message.type==='DISCONNECT_YOUTUBE'&&page)task=disconnectYouTube();
  if(!task)return;
  task.then(respond).catch(error=>respond({success:false,code:error.code||(message.type===MessageTypes.START_AUDIO_CAPTURE?'CAPTURE_FAILED':'REQUEST_FAILED'),message:error.message}));return true;
});
chrome.tabs.onRemoved.addListener(tabId=>{if(capture?.tabId===tabId){capture.cancelled=true;sendOffscreen({type:'OFFSCREEN_CANCEL',requestId:capture.requestId}).catch(()=>{});}});
