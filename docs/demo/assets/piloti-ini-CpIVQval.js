import{a as y}from"./utils-BJZhQEh8.js";import{w as p,g as $}from"./web-vfs-BHxWm_Zt.js";/**
 * @license lucide-react v1.70.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const u={name:"sliders-horizontal",size:24,node:[["path",{d:"M10 5H3",key:"1qgfaw"}],["path",{d:"M12 19H3",key:"yhmn1j"}],["path",{d:"M14 3v4",key:"1sua03"}],["path",{d:"M16 17v4",key:"1q0r14"}],["path",{d:"M21 12h-9",key:"1o4lsq"}],["path",{d:"M21 19h-5",key:"1rlt1p"}],["path",{d:"M21 5h-7",key:"1oszz2"}],["path",{d:"M8 10v4",key:"tgpxqk"}],["path",{d:"M8 12H3",key:"a7s4jb"}]]};u.node;const m=y(u),c=".config/Piloti",h="piloti.app-ini.v1.";function l(n){const t={};let i="General";for(const r of n.split(/\r?\n/)){const e=r.trim();if(!e||e.startsWith("#")||e.startsWith(";"))continue;if(e.startsWith("[")&&e.endsWith("]")){i=e.slice(1,-1).trim()||"General",t[i]||(t[i]={});continue}const s=e.indexOf("=");if(s>0){const o=e.slice(0,s).trim(),a=e.slice(s+1).trim();t[i]||(t[i]={}),t[i][o]=a}}return t}function g(n){const t=[];for(const[i,r]of Object.entries(n)){const e=Object.entries(r).map(([s,o])=>`${s}=${o}`);t.push(`[${i}]
${e.join(`
`)}`)}return t.join(`

`)+(t.length>0?`
`:"")}function f(n){if(typeof localStorage>"u")return{};try{const t=localStorage.getItem(`${h}${n}`);return t?l(t):{}}catch{return{}}}async function I(n,t){const i=`${c}/${t}.ini`;if(n)try{return(await n.files.readText(i)).match({Ok:s=>{try{localStorage.setItem(`${h}${t}`,s)}catch{}return l(s)},Err:()=>f(t)})}catch{return f(t)}const r=$(`/home/user/${i}`);return(r==null?void 0:r.kind)==="file"&&typeof r.content=="string"?l(r.content):f(t)}async function M(n,t,i,r){const e=await I(n,t),s={...e,[i]:{...e[i]??{},...Object.fromEntries(Object.entries(r).map(([a,d])=>[a,String(d)]))}},o=g(s);try{localStorage.setItem(`${h}${t}`,o)}catch{}if(n)try{await n.files.createDir(".config").catch(()=>{}),await n.files.createDir(c).catch(()=>{}),await n.files.write(`${c}/${t}.ini`,o);return}catch{}try{p(`/home/user/${c}/${t}.ini`,o)}catch{}}export{m as S,f as g,I as r,M as w};
