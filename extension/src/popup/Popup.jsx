import React, { useEffect, useState } from 'react';
import { LiquidMusicBar } from '../content/components/LiquidMusicBar.jsx';
import { YouTubePlaylistPicker } from '../content/components/YouTubePlaylistPicker.jsx';
import { historyService } from '../services/history.service.js';
import { settingsService } from '../services/settings.service.js';
import { cacheService } from '../services/cache.service.js';
import { reelLinksService } from '../services/reelLinks.service.js';
import { getSongYouTubeUrl, buildYouTubeSearchUrl } from '../utils/youtubeHelper.js';
import '../styles/liquidGlass.css';
export function Popup(){
  const [tab,setTab]=useState(location.hash==='#settings'?'settings':'reel');
  const [current,setCurrent]=useState(null),[history,setHistory]=useState([]),[saved,setSaved]=useState([]),[settings,setSettings]=useState(null),[message,setMessage]=useState('');
  async function refresh(){
    try{const [active]=await chrome.tabs.query({active:true,currentWindow:true});if(active?.url?.startsWith('https://www.instagram.com/')){chrome.tabs.sendMessage(active.id,{type:'GET_CURRENT_STATE'},result=>{if(!chrome.runtime.lastError)setCurrent(result||null);else setCurrent(null);});}else setCurrent(null);}catch{}
  }
  useEffect(()=>{
    settingsService.getSettings().then(setSettings);historyService.getHistory().then(setHistory);reelLinksService.list().then(setSaved);refresh();
    const timer=setInterval(()=>{refresh();historyService.getHistory().then(setHistory);},1200);return()=>clearInterval(timer);
  },[]);
  useEffect(()=>{if(settings)document.documentElement.dataset.theme=settings.theme==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):settings.theme;},[settings?.theme]);
  async function setting(key,value){setSettings(s=>({...s,[key]:value}));try{await settingsService.updateSettings({[key]:value});}catch{setMessage('Could not save settings.');}}
  async function analyze(){const response=await chrome.runtime.sendMessage({type:'MANUAL_IDENTIFY'});if(!response?.success)setMessage(response?.message||'Open an Instagram reel.');refresh();}
  async function viewerAction(action,value){const response=await chrome.runtime.sendMessage({type:'VIEWER_ACTION',action,value});if(!response?.success)throw new Error(response?.message||'Could not change this reel.');refresh();}
  return <main className="popup-container"><header className="popup-header"><div><strong className="popup-brand">♫ ReelSong</strong><p>Watch freely. Analyze on your click.</p></div><button aria-label="Settings" title="Settings" onClick={()=>setTab(tab==='settings'?'reel':'settings')}>⚙</button></header>
    <nav className="popup-tabs" aria-label="ReelSong tabs">{[['reel','Current reel'],['history','Song history'],['saved','Saved reels']].map(([id,label])=><button key={id} aria-pressed={tab===id} onClick={()=>{setTab(id);if(id==='saved')reelLinksService.list().then(setSaved);}}>{label}</button>)}</nav>
    {message&&<p className="popup-notice" role="status">{message}</p>}
    {tab==='reel'&&(current?.reel?<LiquidMusicBar inPopup state={current.state==='CANCELLED'?'READY_TO_IDENTIFY':current.state} data={{...current,result:current.song}} viewer={current.viewer} onViewerAction={viewerAction} onRetry={analyze}/>:<div className="popup-empty"><strong>Open an Instagram reel</strong><p>Then return here to analyze the song or control playback.</p></div>)}
    {tab==='history'&&<section className="popup-list"><header><strong>Identified songs</strong><button onClick={async()=>{await historyService.clearHistory();setHistory([]);}}>Clear history</button></header>{!history.length&&<p>No verified songs yet. Click Analyze song on a reel to get started.</p>}{history.map(song=><article className="popup-song" key={song.id}><strong>{song.title}</strong><span>{song.artist}</span><a href={getSongYouTubeUrl(song)||buildYouTubeSearchUrl(song.artist,song.title)} target="_blank" rel="noreferrer">{getSongYouTubeUrl(song)?'Play on YouTube':'Search YouTube'} ↗</a></article>)}</section>}
    {tab==='saved'&&<section className="popup-list"><strong>Reel links saved on this device</strong>{!saved.length&&<p>No saved reel links yet. Use Save link on a reel.</p>}{saved.map(item=><article className="popup-song" key={item.url}><a href={item.url} target="_blank" rel="noreferrer">{item.url}</a><button onClick={async()=>{await reelLinksService.remove(item.url);setSaved(await reelLinksService.list());}}>Remove saved link</button></article>)}</section>}
    {tab==='settings'&&settings&&<section className="settings-view"><h2>Settings</h2><p className="popup-notice">Manual analysis only. Scrolling and playback never use recognition requests.</p>
      <label>Theme<select value={settings.theme} onChange={e=>setting('theme',e.target.value)}><option value="system">System</option><option value="dark">Dark</option><option value="light">Light</option></select></label>
      <label>Audio sample duration<select value={settings.sampleDuration} onChange={e=>setting('sampleDuration',Number(e.target.value))}>{[8,10,12].map(s=><option key={s} value={s}>{s} seconds</option>)}</select></label>
      <label>Local recognition server<input value={settings.backendUrl} onChange={e=>setting('backendUrl',e.target.value)} placeholder="http://localhost:5050"/></label>
      <button className="rs-secondary" onClick={async()=>{await cacheService.clear();setMessage('Recognition cache cleared.');}}>Clear recognition cache</button>
      <h2>YouTube setup</h2><label>YouTube OAuth client ID<input value={settings.youtubeClientId||''} onChange={e=>setting('youtubeClientId',e.target.value.trim())} placeholder="…apps.googleusercontent.com"/></label>
      <p className="rs-note">Register this redirect URI in your Google OAuth web client:</p><code className="redirect-uri">{chrome.identity.getRedirectURL()}</code>
      <YouTubePlaylistPicker key={settings.youtubeClientId} settingsMode/>
      <button className="rs-text-button" onClick={()=>chrome.runtime.sendMessage({type:'OPEN_YOUTUBE_SETTINGS'})}>Open setup in a persistent tab</button>
      <p className="rs-note">Enable YouTube Data API v3 in your Google project. If the consent screen is in testing, add your Google account as a test user. YouTube sign-in may close the toolbar popup; reopen it and your playlists will load again.</p>
    </section>}
  </main>;
}
