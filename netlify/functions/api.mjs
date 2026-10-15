import { getStore } from "@netlify/blobs";
import crypto from "node:crypto";
import { members as allMembers, snapshot, store as saveBackup } from "../../lib/snap.mjs";
const M=()=>getStore("members"),S=()=>getStore("site");
const R=(d,s=200)=>new Response(JSON.stringify(d),{status:s,headers:{"content-type":"application/json","cache-control":"no-store"}});
const key=()=>process.env.TOKEN_SECRET||process.env.STAFF_PASSWORD||"";
const sig=e=>crypto.createHmac("sha256",key()).update(String(e)).digest("hex");
const okTok=t=>{const[e,h]=String(t||"").split(".");if(!e||!h||+e<Date.now())return false;const x=sig(e);return x.length===h.length&&crypto.timingSafeEqual(Buffer.from(x),Buffer.from(h))};
const hh=s=>crypto.createHash("sha256").update(String(s)).digest();
const eq=(a,b)=>crypto.timingSafeEqual(hh(a),hh(b));
const mk=()=>new Date(Date.now()+288e5).toISOString().slice(0,7);
const mask=n=>String(n||"").trim().split(/\s+/).map(w=>w[0]+"*".repeat(Math.min(w.length-1,3))).join(" ");
const DEF={shop:"MKS TYRE",earn:1,rp:100,rr:1,logo:"",prize:"Top 3 setiap bulan menang hadiah percuma!"};
const cfg=async()=>({...DEF,...(await S().get("cfg",{type:"json"})||{})});
const getM=c=>M().get(c,{type:"json"});
const T=v=>String(v||"").trim().slice(0,120);
async function lb(k,c,n,p){const l=(await S().get(k,{type:"json"}))||[];const i=l.findIndex(x=>x.c===c);i>=0?l[i]={c,n,p}:l.push({c,n,p});l.sort((a,b)=>b.p-a.p);await S().setJSON(k,l.slice(0,50))}
async function recent(c){const r=((await S().get("recent",{type:"json"}))||[]).filter(x=>x!==c);r.unshift(c);await S().setJSON("recent",r.slice(0,30))}
async function restore(d){
 const Mm=M(),k=mk();
 const l=(d.members||[]).filter(x=>x&&/^[A-Z0-9-]{4,24}$/.test(x.code));
 for(let i=0;i<l.length;i+=50)await Promise.all(l.slice(i,i+50).map(({code,...m})=>Mm.setJSON(code,m)));
 if(d.cfg)await S().setJSON("cfg",d.cfg);if(d.poster)await S().setJSON("poster",d.poster);
 const all=await allMembers();
 const top=(f,key)=>all.filter(f).map(m=>({c:m.code,n:mask(m.name),p:m[key]})).sort((a,b)=>b.p-a.p).slice(0,50);
 await S().setJSON("lb-all",top(m=>m.earned>0,"earned"));
 await S().setJSON("lb-"+k,top(m=>m.mk===k&&m.mp>0,"mp"));
 return l.length}
export default async req=>{
 if(req.method!=="POST")return R({e:"x"},405);
 let b;try{b=await req.json()}catch{return R({e:"bad"},400)}
 const a=b.a;
 if(a==="pub"){const c=await cfg();return R({shop:c.shop,logo:c.logo})}
 if(a==="login"){
  if(!process.env.STAFF_PASSWORD)return R({e:"STAFF_PASSWORD belum diset di Netlify"},500);
  if(!eq(b.pw,process.env.STAFF_PASSWORD))return R({e:"Password salah"},401);
  const e=Date.now()+6048e5;return R({t:e+"."+sig(e)});
 }
 if(a==="cust"){
  const code=T(b.code).toUpperCase();const m=code&&await getM(code);
  if(!m)return R({e:"Kod tidak dijumpai"},404);
  const c=await cfg(),k=mk();
  const [lm,la,po]=await Promise.all([S().get("lb-"+k,{type:"json"}),S().get("lb-all",{type:"json"}),S().get("poster",{type:"json"})]);
  const top=l=>(l||[]).slice(0,10).map(x=>({n:x.n,p:x.p,me:x.c===code}));
  const ri=(lm||[]).findIndex(x=>x.c===code);
  return R({name:mask(m.name),points:m.points,mp:m.mk===k?m.mp:0,rank:ri>=0?ri+1:null,month:k,
   cfg:{shop:c.shop,logo:c.logo,rp:c.rp,rr:c.rr,prize:c.prize},lm:top(lm),la:top(la),poster:po&&po.on?po:null});
 }
 if(!okTok(b.t))return R({e:"auth"},401);
 const code=T(b.code).toUpperCase();
 if(a==="get"){const m=await getM(code);return m?R({m}):R({e:"Kod tidak dijumpai"},404)}
 if(a==="recent"){const r=(await S().get("recent",{type:"json"}))||[];
  const l=await Promise.all(r.map(async c=>{const m=await getM(c);return m&&{c,n:m.name,p:m.points}}));return R({l:l.filter(Boolean)})}
 if(a==="reg"){
  const c=code||("MKS-"+Array.from(crypto.randomBytes(6),x=>"ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[x%32]).join(""));
  if(!/^[A-Z0-9-]{4,24}$/.test(c))return R({e:"Kod 4-24 huruf/nombor sahaja"},400);
  if(await getM(c))return R({e:"Kod ini sudah digunakan"},409);
  const n=T(b.name);if(!n)return R({e:"Isi nama"},400);
  await M().setJSON(c,{name:n,phone:T(b.phone),plate:T(b.plate).toUpperCase(),remark:"",points:0,earned:0,total:0,mk:mk(),mp:0,log:[],created:Date.now(),updated:Date.now()});
  await recent(c);return R({code:c});
 }
 if(["buy","redeem","save"].includes(a)){
  const m=await getM(code);if(!m)return R({e:"Kod tidak dijumpai"},404);const k=mk();
  if(m.mk!==k){m.mk=k;m.mp=0}
  if(a==="buy"){
   const amt=Number(b.amt);if(!(amt>0)||amt>1e6)return R({e:"Jumlah tak sah"},400);
   const p=Math.floor(amt*(await cfg()).earn);
   m.points+=p;m.earned=(m.earned||0)+p;m.mp+=p;m.total=(m.total||0)+amt;
   m.log=[{t:Date.now(),k:"beli",a:amt,p},...(m.log||[])].slice(0,50);m.updated=Date.now();
   await M().setJSON(code,m);
   await Promise.all([lb("lb-"+k,code,mask(m.name),m.mp),lb("lb-all",code,mask(m.name),m.earned),recent(code)]);
  }else if(a==="redeem"){
   const p=Math.floor(Number(b.pts));if(!(p>0)||p>m.points)return R({e:"Point tak cukup"},400);
   m.points-=p;m.log=[{t:Date.now(),k:"tebus",a:0,p:-p},...(m.log||[])].slice(0,50);m.updated=Date.now();
   await M().setJSON(code,m);await recent(code);
  }else{
   if(b.name!==undefined&&T(b.name))m.name=T(b.name);
   if(b.phone!==undefined)m.phone=T(b.phone);if(b.plate!==undefined)m.plate=T(b.plate).toUpperCase();
   if(b.remark!==undefined)m.remark=String(b.remark).slice(0,2000);
   m.updated=Date.now();await M().setJSON(code,m);
   for(const kk of ["lb-all","lb-"+k]){const l=await S().get(kk,{type:"json"});const x=l&&l.find(y=>y.c===code);if(x){x.n=mask(m.name);await S().setJSON(kk,l)}}
  }
  return R({m});
 }
 if(a==="settings")return R({cfg:await cfg(),poster:(await S().get("poster",{type:"json"}))||{on:false,title:"",img:""}});
 if(a==="setcfg"){const c=b.cfg||{};
  await S().setJSON("cfg",{shop:T(c.shop)||DEF.shop,earn:+c.earn>0?+c.earn:1,rp:+c.rp>0?+c.rp:100,rr:+c.rr>0?+c.rr:1,prize:String(c.prize||"").slice(0,300),logo:String(c.logo||"").slice(0,500000)});
  return R({ok:1});}
 if(a==="setposter"){const p=b.poster||{};
  await S().setJSON("poster",{on:!!p.on,title:T(p.title),img:String(p.img||"").slice(0,2000000)});return R({ok:1});}
 if(a==="export"){const out=[];let ks=[];
  for await(const pg of M().list({paginate:true}))ks.push(...pg.blobs.map(x=>x.key));
  for(let i=0;i<ks.length;i+=100)out.push(...(await Promise.all(ks.slice(i,i+100).map(async c=>({code:c,...(await getM(c))})))));
  return R({l:out});}
 if(a==="backup"){if(b.id){const d=await getStore("backups").get(String(b.id),{type:"json"});return d?R(d):R({e:"Backup tiada"},404)}return R(await snapshot())}
 if(a==="backups"){const B=getStore("backups"),ks=[];for await(const pg of B.list({paginate:true}))ks.push(...pg.blobs.map(x=>x.key));
  const l=await Promise.all(ks.sort().reverse().map(async id=>({id,...(((await B.getMetadata(id))||{}).metadata||{})})));return R({l})}
 if(a==="backupnow")return R(await saveBackup());
 if(a==="restore"){let d=b.data;if(b.id)d=await getStore("backups").get(String(b.id),{type:"json"});
  if(!d||!Array.isArray(d.members))return R({e:"Fail backup tidak sah"},400);
  await saveBackup("pre-"+Date.now());return R({n:await restore(d)})}
 return R({e:"?"},400);
};
export const config={path:"/api"};
