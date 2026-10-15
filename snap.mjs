import { getStore } from "@netlify/blobs";
export const members=async()=>{const M=getStore("members"),ks=[];
 for await(const pg of M.list({paginate:true}))ks.push(...pg.blobs.map(x=>x.key));
 const out=[];for(let i=0;i<ks.length;i+=100)out.push(...(await Promise.all(ks.slice(i,i+100).map(async c=>({code:c,...(await M.get(c,{type:"json"}))})))));return out};
export async function snapshot(){const S=getStore("site");
 const[l,cfg,poster]=await Promise.all([members(),S.get("cfg",{type:"json"}),S.get("poster",{type:"json"})]);
 return{v:1,t:Date.now(),members:l,cfg:cfg||null,poster:poster||null}}
export async function store(tag){const B=getStore("backups"),d=await snapshot();
 const id=tag||new Date(Date.now()+288e5).toISOString().slice(0,10);
 await B.setJSON(id,d,{metadata:{n:d.members.length,t:d.t}});
 const ks=[];for await(const pg of B.list({paginate:true}))ks.push(...pg.blobs.map(x=>x.key));
 for(const k of ks.filter(k=>/^\d{4}-\d\d-\d\d$/.test(k)).sort().reverse().slice(30))await B.delete(k);
 for(const k of ks.filter(k=>k.startsWith("pre-")).sort().reverse().slice(5))await B.delete(k);
 return{id,n:d.members.length}}
