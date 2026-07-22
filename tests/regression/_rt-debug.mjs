import { createClient } from "@supabase/supabase-js";
const URL=process.env.VITE_SUPABASE_URL, ANON=process.env.VITE_SUPABASE_PUBLISHABLE_KEY, SVC=process.env.SUPABASE_SERVICE_ROLE_KEY;
const c = createClient(URL, ANON, { auth:{persistSession:false} });
const events=[];
const ch=c.channel("t"+Date.now())
 .on("postgres_changes",{event:"*",schema:"public",table:"products"},(p)=>{events.push(p.eventType);console.log("EVT",p.eventType,p.new?.slug)})
 .on("system",{},(p)=>console.log("SYS",JSON.stringify(p)));
await new Promise((res)=>ch.subscribe((s,e)=>{console.log("STATE",s,e?.message||"");if(s==="SUBSCRIBED")res();}));
const a=createClient(URL,SVC,{auth:{persistSession:false}});
const {data:r}=await a.from("products").select("slug").limit(1).maybeSingle();
console.log("row",r);
const {error}=await a.from("products").update({updated_at:new Date().toISOString()}).eq("slug",r.slug);
console.log("upd err",error);
await new Promise(r=>setTimeout(r,6000));
console.log("total events",events.length);
process.exit(0);
