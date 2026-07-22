import { createClient } from "@supabase/supabase-js";
import 'dotenv/config';
const url = process.env.SUPABASE_URL, anon = process.env.SUPABASE_PUBLISHABLE_KEY, svc = process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!svc){ console.error("no service role"); process.exit(2); }
const admin = createClient(url, svc, { auth:{persistSession:false}});
const sub = createClient(url, anon, { auth:{persistSession:false}, realtime:{params:{eventsPerSecond:10}}});
const events = [];
const ch = sub.channel("pop-test").on("postgres_changes",{event:"*",schema:"public",table:"home_popular_items"},(p)=>{ events.push({t:p.eventType,new:p.new?.title,old:p.old?.id}); console.log("EVT",p.eventType,p.new?.title||p.old?.id); });
await new Promise((res,rej)=>{ ch.subscribe((s,err)=>{ console.log("sub",s,err?.message||""); if(s==="SUBSCRIBED") res(); if(s==="CHANNEL_ERROR"||s==="TIMED_OUT") rej(new Error(s)); }); setTimeout(()=>rej(new Error("sub-timeout")),8000); });
const tag = "RT-"+Date.now().toString(36);
console.log("tag",tag);
// INSERT
let { data:ins, error:e1 } = await admin.from("home_popular_items").insert({ title:tag+" A", is_active:true, position:999 }).select().single();
if(e1){ console.error("insert err",e1); process.exit(1);}
console.log("inserted", ins.id);
await new Promise(r=>setTimeout(r,3000));
// UPDATE
const { error:e2 } = await admin.from("home_popular_items").update({ title:tag+" B", price:"R99" }).eq("id",ins.id);
if(e2) console.error("update err",e2);
await new Promise(r=>setTimeout(r,3000));
// DISABLE
await admin.from("home_popular_items").update({ is_active:false }).eq("id",ins.id);
await new Promise(r=>setTimeout(r,3000));
// DELETE
await admin.from("home_popular_items").delete().eq("id",ins.id);
await new Promise(r=>setTimeout(r,3000));
console.log("---SUMMARY---");
console.log(JSON.stringify(events,null,2));
const kinds = events.map(e=>e.t);
const need = ["INSERT","UPDATE","UPDATE","DELETE"];
const ok = need.every(k=>kinds.includes(k));
console.log("PASS?", ok, "kinds:", kinds.join(","));
await sub.removeChannel(ch);
process.exit(ok?0:1);
