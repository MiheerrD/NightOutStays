"use client";
import {useEffect,useMemo,useState} from "react";
import {createClient} from "@supabase/supabase-js";

const supabase=createClient("https://gxwemplbykjxhezefykh.supabase.co","sb_publishable_MOsISosc6eV2rfgn-fUVoA_KmrmYLqS");
const money=v=>new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:0}).format(Number(v||0));
const date=v=>v?new Intl.DateTimeFormat("en-IN",{day:"2-digit",month:"short",year:"numeric"}).format(new Date(v)):"—";
const title=v=>String(v||"").replaceAll("_"," ").replace(/\b\w/g,m=>m.toUpperCase());

export default function AdminPromotions(){
 const [data,setData]=useState(null),[tab,setTab]=useState("promotions"),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false);
 const [error,setError]=useState(""),[success,setSuccess]=useState(""),[search,setSearch]=useState(""),[status,setStatus]=useState("all");
 const [rule,setRule]=useState({ruleName:"",promotionType:"featured",scopeType:"global",city:"",propertyType:"",hostId:"",propertyId:"",pricingMethod:"fixed",fixedFee:"",subscriptionMultiplier:"",durationDays:30,priority:0,validFrom:"",validUntil:"",notes:""});
 const [discount,setDiscount]=useState({hostId:"",propertyId:"",promotionType:"",discountName:"",discountType:"percentage",discountValue:"",maxDiscountAmount:"",validFrom:"",validUntil:"",maxUses:"",reason:""});
 const [grant,setGrant]=useState({hostId:"",propertyId:"",promotionType:"featured",durationDays:30,reason:""});

 useEffect(()=>{load()},[]);
 async function token(){const {data}=await supabase.auth.getSession();return data?.session?.access_token||""}
 async function load(){setLoading(true);setError("");try{const t=await token();if(!t){location.href="/admin/login";return}const r=await fetch("/api/admin/promotions",{cache:"no-store",headers:{Authorization:`Bearer ${t}`}});const j=await r.json();if(r.status===401){location.href="/admin/login";return}if(!r.ok)throw new Error(j.error||"Unable to load promotions.");setData(j)}catch(e){setError(e.message)}finally{setLoading(false)}}
 async function act(payload){setSaving(true);setError("");setSuccess("");try{const t=await token();const r=await fetch("/api/admin/promotions",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${t}`},body:JSON.stringify(payload)});const j=await r.json();if(!r.ok)throw new Error(j.error||"Unable to save.");setSuccess(j.message||"Saved.");await load();return true}catch(e){setError(e.message);return false}finally{setSaving(false)}}

 const promotions=useMemo(()=>{const q=search.toLowerCase().trim();return(data?.promotions||[]).filter(x=>(!q||`${x.property_name} ${x.host_name} ${x.host_business_name} ${x.promotion_type}`.toLowerCase().includes(q))&&(status==="all"||x.status===status))},[data,search,status]);
 if(loading)return <main style={s.page}><section style={s.panel}>Loading promotions...</section></main>;
 const summary=data?.summary||{};
 return <main style={s.page}>
  <div style={s.head}><div><h1 style={s.h1}>Promotions</h1><p style={s.sub}>Control promoted visibility, pricing, approvals, discounts and complimentary upgrades.</p></div><button style={s.primary} onClick={load}>Refresh</button></div>
  <div style={s.cards}><Card l="Active Promotions" v={summary.active}/><Card l="Pending Approval" v={summary.pending}/><Card l="Featured" v={summary.featured}/><Card l="Premium" v={summary.premium}/><Card l="Boosted" v={summary.boosted}/><Card l="Promotion Revenue" v={money(summary.revenue)}/></div>
  <div style={s.tabs}><Tab a={tab==="promotions"} f={()=>setTab("promotions")}>Promotions</Tab><Tab a={tab==="pricing"} f={()=>setTab("pricing")}>Pricing Rules</Tab><Tab a={tab==="discounts"} f={()=>setTab("discounts")}>Host Offers</Tab><Tab a={tab==="grant"} f={()=>setTab("grant")}>Complimentary Promotion</Tab></div>
  {error&&<div style={s.err}>{error}</div>}{success&&<div style={s.ok}>{success}</div>}

  {tab==="promotions"&&<section style={s.panel}>
   <div style={s.filters}><input style={s.input} placeholder="Search property or Host" value={search} onChange={e=>setSearch(e.target.value)}/><select style={s.select} value={status} onChange={e=>setStatus(e.target.value)}><option value="all">All Statuses</option>{["pending_payment","pending_approval","active","rejected","expired","cancelled","failed"].map(x=><option key={x} value={x}>{title(x)}</option>)}</select></div>
   <div style={s.tableWrap}><table style={s.table}><thead><tr>{["Property / Host","Level","Price","Period","Status","Actions"].map(x=><th style={s.th} key={x}>{x}</th>)}</tr></thead><tbody>
    {promotions.map(p=><tr key={p.id}>
     <td style={s.td}><b>{p.property_name||"Property"}</b><small style={s.small}>{p.host_business_name||p.host_name||"Host"}</small></td>
     <td style={s.td}><b>{title(p.promotion_type)}</b><small style={s.small}>{p.duration_days||30} days</small></td>
     <td style={s.td}><b>{money(p.total_amount)}</b><small style={s.small}>{p.discount_name_snapshot||p.pricing_rule_name_snapshot||"Legacy pricing"}</small></td>
     <td style={s.td}>{date(p.starts_at)}<small style={s.small}>to {date(p.expires_at)}</small></td>
     <td style={s.td}><span style={s.badge}>{title(p.status)}</span>{p.admin_granted&&<small style={s.small}>Admin granted</small>}</td>
     <td style={s.td}><div style={s.actions}>
      {p.status==="pending_approval"&&<><button style={s.primarySmall} onClick={()=>act({action:"approve",id:p.id})}>Approve</button><button style={s.danger} onClick={()=>{const reason=prompt("Rejection reason");if(reason)act({action:"reject",id:p.id,reason})}}>Reject</button></>}
      {p.status==="active"&&<button style={s.danger} onClick={()=>{const reason=prompt("Revocation reason");if(reason)act({action:"revoke",id:p.id,reason})}}>Revoke</button>}
     </div></td>
    </tr>)}
   </tbody></table>{!promotions.length&&<div style={s.empty}>No promotions found.</div>}</div>
  </section>}

  {tab==="pricing"&&<>
   <section style={s.panel}><h2 style={s.h2}>Create Promotion Pricing Rule</h2><p style={s.help}>Most specific rule wins: Property → Host → City + Property Type → City → Property Type → Global.</p>
    <form style={s.grid} onSubmit={async e=>{e.preventDefault();if(await act({action:"create_rule",...rule}))setRule({...rule,ruleName:"",fixedFee:"",subscriptionMultiplier:"",notes:""})}}>
     <Field l="Rule Name"><input required style={s.input} value={rule.ruleName} onChange={e=>setRule({...rule,ruleName:e.target.value})}/></Field>
     <Field l="Promotion Level"><select style={s.select} value={rule.promotionType} onChange={e=>setRule({...rule,promotionType:e.target.value})}>{["featured","premium","boosted"].map(x=><option key={x}>{x}</option>)}</select></Field>
     <Field l="Scope"><select style={s.select} value={rule.scopeType} onChange={e=>setRule({...rule,scopeType:e.target.value,hostId:"",propertyId:""})}>{["global","city","property_type","city_property_type","host","property"].map(x=><option key={x} value={x}>{title(x)}</option>)}</select></Field>
     {(rule.scopeType==="city"||rule.scopeType==="city_property_type")&&<Field l="City"><input required style={s.input} value={rule.city} onChange={e=>setRule({...rule,city:e.target.value})}/></Field>}
     {(rule.scopeType==="property_type"||rule.scopeType==="city_property_type")&&<Field l="Property Type"><input required style={s.input} value={rule.propertyType} onChange={e=>setRule({...rule,propertyType:e.target.value})}/></Field>}
     {(rule.scopeType==="host"||rule.scopeType==="property")&&<Field l="Host"><select required style={s.select} value={rule.hostId} onChange={e=>setRule({...rule,hostId:e.target.value,propertyId:""})}><option value="">Select Host</option>{data.hosts.map(h=><option key={h.id} value={h.id}>{h.business_name||h.full_name||h.email}</option>)}</select></Field>}
     {rule.scopeType==="property"&&<Field l="Property"><select required style={s.select} value={rule.propertyId} onChange={e=>setRule({...rule,propertyId:e.target.value})}><option value="">Select Property</option>{data.properties.filter(p=>p.host_id===rule.hostId).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>}
     <Field l="Pricing Method"><select style={s.select} value={rule.pricingMethod} onChange={e=>setRule({...rule,pricingMethod:e.target.value})}><option value="fixed">Fixed Fee</option><option value="subscription_multiplier">Subscription Multiplier</option></select></Field>
     {rule.pricingMethod==="fixed"?<Field l="Fee Before GST"><input required type="number" min="0" style={s.input} value={rule.fixedFee} onChange={e=>setRule({...rule,fixedFee:e.target.value})}/></Field>:<Field l="Subscription Multiplier"><input required type="number" step=".1" min="0" style={s.input} value={rule.subscriptionMultiplier} onChange={e=>setRule({...rule,subscriptionMultiplier:e.target.value})}/></Field>}
     <Field l="Duration Days"><input required type="number" min="1" style={s.input} value={rule.durationDays} onChange={e=>setRule({...rule,durationDays:e.target.value})}/></Field>
     <Field l="Priority"><input type="number" style={s.input} value={rule.priority} onChange={e=>setRule({...rule,priority:e.target.value})}/></Field>
     <Field l="Valid From"><input type="date" style={s.input} value={rule.validFrom} onChange={e=>setRule({...rule,validFrom:e.target.value})}/></Field><Field l="Valid Until"><input type="date" style={s.input} value={rule.validUntil} onChange={e=>setRule({...rule,validUntil:e.target.value})}/></Field>
     <Field l="Notes"><input style={s.input} value={rule.notes} onChange={e=>setRule({...rule,notes:e.target.value})}/></Field><div style={{alignSelf:"end"}}><button disabled={saving} style={s.primary}>Create Rule</button></div>
    </form>
   </section>
   <section style={s.panel}><h2 style={s.h2}>Pricing Rules</h2><div style={s.ruleGrid}>{data.rules.map(r=><div key={r.id} style={s.ruleCard}><div style={s.row}><div><b>{r.rule_name}</b><small style={s.small}>{title(r.promotion_type)} · {title(r.scope_type)}</small></div><button style={r.is_active?s.danger:s.primarySmall} onClick={()=>act({action:"toggle_rule",id:r.id,isActive:!r.is_active})}>{r.is_active?"Deactivate":"Activate"}</button></div><div style={s.price}>{r.pricing_method==="fixed"?money(r.fixed_fee):`${Number(r.subscription_multiplier)}× Subscription`}</div><small style={s.small}>{r.duration_days} days · Priority {r.priority} · {r.is_active?"Active":"Inactive"}</small></div>)}</div></section>
  </>}

  {tab==="discounts"&&<>
   <section style={s.panel}><h2 style={s.h2}>Create Host Promotion Offer</h2><form style={s.grid} onSubmit={async e=>{e.preventDefault();if(await act({action:"create_discount",...discount}))setDiscount({...discount,propertyId:"",discountName:"",discountValue:"",reason:""})}}>
    <Field l="Host"><select required style={s.select} value={discount.hostId} onChange={e=>setDiscount({...discount,hostId:e.target.value,propertyId:""})}><option value="">Select Host</option>{data.hosts.map(h=><option key={h.id} value={h.id}>{h.business_name||h.full_name||h.email}</option>)}</select></Field>
    <Field l="Property (Optional)"><select style={s.select} value={discount.propertyId} onChange={e=>setDiscount({...discount,propertyId:e.target.value})}><option value="">All Host Properties</option>{data.properties.filter(p=>p.host_id===discount.hostId).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
    <Field l="Promotion Level (Optional)"><select style={s.select} value={discount.promotionType} onChange={e=>setDiscount({...discount,promotionType:e.target.value})}><option value="">All Levels</option>{["featured","premium","boosted"].map(x=><option key={x}>{x}</option>)}</select></Field>
    <Field l="Offer Name"><input required style={s.input} value={discount.discountName} onChange={e=>setDiscount({...discount,discountName:e.target.value})}/></Field>
    <Field l="Discount Type"><select style={s.select} value={discount.discountType} onChange={e=>setDiscount({...discount,discountType:e.target.value})}><option value="percentage">Percentage</option><option value="fixed">Fixed Amount</option><option value="free">Free</option></select></Field>
    {discount.discountType!=="free"&&<Field l={discount.discountType==="percentage"?"Discount %":"Discount ₹"}><input required type="number" min="0" style={s.input} value={discount.discountValue} onChange={e=>setDiscount({...discount,discountValue:e.target.value})}/></Field>}
    <Field l="Maximum Uses"><input type="number" min="1" style={s.input} value={discount.maxUses} onChange={e=>setDiscount({...discount,maxUses:e.target.value})}/></Field>
    <Field l="Valid From"><input type="date" style={s.input} value={discount.validFrom} onChange={e=>setDiscount({...discount,validFrom:e.target.value})}/></Field><Field l="Valid Until"><input type="date" style={s.input} value={discount.validUntil} onChange={e=>setDiscount({...discount,validUntil:e.target.value})}/></Field>
    <Field l="Reason"><input style={s.input} value={discount.reason} onChange={e=>setDiscount({...discount,reason:e.target.value})}/></Field><div style={{alignSelf:"end"}}><button disabled={saving} style={s.primary}>Create Offer</button></div>
   </form></section>
   <section style={s.panel}><h2 style={s.h2}>Host Offers</h2><div style={s.ruleGrid}>{data.discounts.map(d=><div key={d.id} style={s.ruleCard}><div style={s.row}><div><b>{d.discount_name}</b><small style={s.small}>{d.host_business_name||d.host_name} · {d.property_name||"All properties"}</small></div><button style={d.is_active?s.danger:s.primarySmall} onClick={()=>act({action:"toggle_discount",id:d.id,isActive:!d.is_active})}>{d.is_active?"Deactivate":"Activate"}</button></div><div style={s.price}>{d.discount_type==="free"?"FREE":d.discount_type==="percentage"?`${Number(d.discount_value)}% OFF`:`${money(d.discount_value)} OFF`}</div><small style={s.small}>{d.promotion_type?title(d.promotion_type):"All levels"} · Used {d.used_count}{d.max_uses?` / ${d.max_uses}`:""}</small></div>)}</div></section>
  </>}

  {tab==="grant"&&<section style={s.panel}><h2 style={s.h2}>Grant Complimentary Promotion</h2><p style={s.help}>Admin can activate a free visibility upgrade immediately. No Razorpay payment is created.</p><form style={s.grid} onSubmit={async e=>{e.preventDefault();if(await act({action:"grant",...grant}))setGrant({...grant,propertyId:"",reason:""})}}>
   <Field l="Host"><select required style={s.select} value={grant.hostId} onChange={e=>setGrant({...grant,hostId:e.target.value,propertyId:""})}><option value="">Select Host</option>{data.hosts.map(h=><option key={h.id} value={h.id}>{h.business_name||h.full_name||h.email}</option>)}</select></Field>
   <Field l="Property"><select required style={s.select} value={grant.propertyId} onChange={e=>setGrant({...grant,propertyId:e.target.value})}><option value="">Select Property</option>{data.properties.filter(p=>p.host_id===grant.hostId).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
   <Field l="Promotion Level"><select style={s.select} value={grant.promotionType} onChange={e=>setGrant({...grant,promotionType:e.target.value})}>{["featured","premium","boosted"].map(x=><option key={x}>{x}</option>)}</select></Field>
   <Field l="Duration Days"><input required type="number" min="1" style={s.input} value={grant.durationDays} onChange={e=>setGrant({...grant,durationDays:e.target.value})}/></Field>
   <Field l="Reason"><input required style={s.input} value={grant.reason} onChange={e=>setGrant({...grant,reason:e.target.value})}/></Field><div style={{alignSelf:"end"}}><button disabled={saving} style={s.primary}>Activate Free Promotion</button></div>
  </form></section>}
 </main>
}
function Card({l,v}){return <div style={s.card}><span style={s.cardLabel}>{l}</span><strong style={s.cardValue}>{v}</strong></div>}
function Tab({a,f,children}){return <button onClick={f} style={{...s.tab,...(a?s.tabOn:{})}}>{children}</button>}
function Field({l,children}){return <label style={s.field}><span>{l}</span>{children}</label>}
const s={page:{maxWidth:1550,margin:"0 auto",padding:28,background:"#f6f8fb",minHeight:"100vh",color:"#17324d",fontFamily:"Arial,sans-serif"},head:{display:"flex",justifyContent:"space-between",alignItems:"center",gap:18,marginBottom:20},h1:{fontSize:34,margin:0,color:"#082f5a"},h2:{margin:"0 0 8px",color:"#082f5a"},sub:{margin:"7px 0 0",color:"#66788a"},help:{color:"#66788a",fontSize:13},cards:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(165px,1fr))",gap:12,marginBottom:18},card:{background:"white",border:"1px solid #dfe6ee",borderRadius:14,padding:17},cardLabel:{display:"block",fontSize:12,color:"#718396",marginBottom:8},cardValue:{fontSize:22,color:"#082f5a"},tabs:{display:"flex",gap:8,flexWrap:"wrap",marginBottom:16},tab:{border:"1px solid #d5dee8",background:"white",color:"#214e78",borderRadius:10,padding:"10px 14px",fontWeight:700,cursor:"pointer"},tabOn:{background:"#082f5a",color:"white"},panel:{background:"white",border:"1px solid #dfe6ee",borderRadius:15,padding:20,marginBottom:18},filters:{display:"grid",gridTemplateColumns:"minmax(250px,1fr) 220px",gap:10,marginBottom:14},input:{width:"100%",boxSizing:"border-box",padding:"11px 12px",border:"1px solid #cfd9e4",borderRadius:9,background:"white"},select:{width:"100%",boxSizing:"border-box",padding:"11px 12px",border:"1px solid #cfd9e4",borderRadius:9,background:"white"},grid:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:13},field:{display:"flex",flexDirection:"column",gap:6,fontSize:12,fontWeight:700,color:"#53687b"},primary:{border:0,background:"#082f5a",color:"white",borderRadius:9,padding:"11px 16px",fontWeight:800,cursor:"pointer"},primarySmall:{border:0,background:"#082f5a",color:"white",borderRadius:8,padding:"8px 10px",fontWeight:700,cursor:"pointer"},danger:{border:"1px solid #d99",background:"white",color:"#9b1c1c",borderRadius:8,padding:"8px 10px",fontWeight:700,cursor:"pointer"},err:{background:"#fff0f0",border:"1px solid #f0c9c9",color:"#9b1c1c",borderRadius:10,padding:12,marginBottom:14},ok:{background:"#eef9f1",border:"1px solid #cde8d4",color:"#166534",borderRadius:10,padding:12,marginBottom:14},tableWrap:{overflowX:"auto"},table:{width:"100%",borderCollapse:"collapse",minWidth:1050},th:{textAlign:"left",padding:11,background:"#f8fafc",borderBottom:"1px solid #e5ebf1",fontSize:12,color:"#607487"},td:{padding:12,borderBottom:"1px solid #edf1f4",verticalAlign:"top",fontSize:13},small:{display:"block",marginTop:5,fontSize:11,color:"#748698",fontWeight:400},badge:{display:"inline-block",background:"#eaf2fb",color:"#214e78",borderRadius:999,padding:"6px 9px",fontSize:11,fontWeight:700},actions:{display:"flex",gap:6,flexWrap:"wrap"},empty:{padding:30,textAlign:"center",color:"#748698"},ruleGrid:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(290px,1fr))",gap:13,marginTop:15},ruleCard:{border:"1px solid #e0e7ef",borderRadius:13,padding:15},row:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10},price:{fontSize:21,fontWeight:800,color:"#082f5a",marginTop:14}};
