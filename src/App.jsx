import { useState, useMemo, useRef, useEffect } from "react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from "recharts";
import {
  TrendingUp, TrendingDown, DollarSign, ShoppingCart, Users, Target,
  BarChart2, Calendar, PlusCircle, FileText, Menu, ChevronLeft,
  ChevronRight, Package, Link2, Zap, X, Check, ChevronDown, AlertCircle,
  RefreshCw, Trash2, MessageSquare, LogOut, Shield, Eye, EyeOff,
  Loader, Flag, CreditCard, Wallet, Building2
} from "lucide-react";
import { createClient } from "@supabase/supabase-js";

// ─── SUPABASE ────────────────────────────────────────────────────────────────
const SUPABASE_URL = "https://ksxertqqyqmwlnitlsgn.supabase.co";
const SUPABASE_KEY = "sb_publishable_dKK0B-VdkBYmNNcT0MrbeA_EjNn40Hv";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── COLORS ──────────────────────────────────────────────────────────────────
const C = {
  bg:"#0f1117", card:"#1a1d27", card2:"#1e2130",
  border:"#2a2d3e", accent:"#6c63ff", accentLight:"#8b85ff",
  green:"#22c55e", red:"#ef4444", yellow:"#f59e0b",
  cyan:"#06b6d4", purple:"#a855f7", text:"#e2e8f0", muted:"#94a3b8",
};

// ─── ROLES ───────────────────────────────────────────────────────────────────
const ROLES = {
  admin:       { label:"Admin",       color:C.accent, pages:["dashboard","forecast","lancamento","mensal","financeiro","dre","graficos","custos","posvenda","integracoes","storiesbot"] },
  gestor:      { label:"Gestor",      color:C.cyan,   pages:["dashboard","forecast","mensal","graficos","posvenda","storiesbot"] },
  operacional: { label:"Operacional", color:C.green,  pages:["dashboard","forecast","lancamento","posvenda"] },
};
function canAccess(role, page) { return ROLES[role]?.pages.includes(page) ?? false; }

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const MONTHS = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const WEEKDAYS = ["domingo","segunda-feira","terça-feira","quarta-feira","quinta-feira","sexta-feira","sábado"];
const YEAR = 2026;

function getDaysInMonth(y,m){ return new Date(y,m+1,0).getDate(); }
function getWeekday(y,m,d){ return WEEKDAYS[new Date(y,m,d).getDay()]; }
function toYMD(d){ return d.toISOString().slice(0,10); }
function parseYMD(s){ const [y,m,d]=s.split("-").map(Number); return new Date(y,m-1,d); }
function fmt(n,prefix="R$"){
  if(n==null||isNaN(n)) return "-";
  return `${prefix} ${Number(n).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2})}`;
}
function fmtPct(n){ if(!n||!isFinite(n)) return "-"; return `${(n*100).toFixed(1)}%`; }
function fmtROAS(n){ if(n==null||!isFinite(n)||n<=0) return "-"; return `${n.toFixed(2)}x`; }
const META_TAX = 0.1215;

function calcKPIs(days){
  const anuncios           = days.reduce((s,d)=>s+(d.anuncios||0),0);
  const leads              = days.reduce((s,d)=>s+(d.leads||0),0);
  const faturamento        = days.reduce((s,d)=>s+(d.faturamento||0),0);
  const pedidos            = days.reduce((s,d)=>s+(d.pedidos||0),0);
  const custoProdutos      = days.reduce((s,d)=>s+(d.custo_produtos||0),0);
  const custoFreteCorreios = days.reduce((s,d)=>s+(d.custo_frete_correios||0),0);
  const custoFreteMotoboy  = days.reduce((s,d)=>s+(d.custo_frete_motoboy||0),0);
  const totalFrete = custoFreteCorreios + custoFreteMotoboy;
  const lucro      = faturamento - anuncios - custoProdutos - totalFrete;
  const roas       = anuncios>0 ? faturamento/anuncios : null;
  const cpVenda    = pedidos>0  ? anuncios/pedidos : null;
  const ticketMedio= pedidos>0  ? faturamento/pedidos : null;
  const txConversao= leads>0    ? pedidos/leads : null;
  const custoLead  = leads>0    ? anuncios/leads : null;
  return { anuncios, leads, faturamento, pedidos, custoProdutos,
    custoFreteCorreios, custoFreteMotoboy, totalFrete, lucro,
    roas, cpVenda, ticketMedio, txConversao, custoLead };
}

function buildInitialData(){
  const data={};
  for(let m=0;m<12;m++){
    const days=getDaysInMonth(YEAR,m);
    data[m]=[];
    for(let d=1;d<=days;d++){
      data[m].push({ date:toYMD(new Date(YEAR,m,d)), day:d, month:m, year:YEAR,
        weekday:getWeekday(YEAR,m,d), anuncios:0, leads:0, faturamento:0, pedidos:0,
        custo_produtos:0, custo_frete_correios:0, custo_frete_motoboy:0 });
    }
  }
  return data;
}

function getPresetRange(preset){
  const now=new Date(); const today=toYMD(now); const dow=now.getDay();
  switch(preset){
    case "today": return {start:today,end:today};
    case "week":  { const s=new Date(now); s.setDate(now.getDate()-dow); const e=new Date(now); e.setDate(now.getDate()+(6-dow)); return{start:toYMD(s),end:toYMD(e)}; }
    case "7days": { const s=new Date(now); s.setDate(now.getDate()-6); return{start:toYMD(s),end:today}; }
    case "month": { return{start:toYMD(new Date(YEAR,now.getMonth(),1)),end:toYMD(new Date(YEAR,now.getMonth()+1,0))}; }
    case "lastmonth": { return{start:toYMD(new Date(YEAR,now.getMonth()-1,1)),end:toYMD(new Date(YEAR,now.getMonth(),0))}; }
    default: return null;
  }
}

function getFilteredDays(data,dateFilter){
  return Object.values(data).flat().filter(d=>{
    if(!dateFilter.start||!dateFilter.end) return true;
    return d.date>=dateFilter.start && d.date<=dateFilter.end;
  });
}

// ─── MINI CALENDAR ───────────────────────────────────────────────────────────
function MiniCalendar({value,onChange,minDate,maxDate}){
  const [viewing,setViewing]=useState(()=>{ const d=value?parseYMD(value):new Date(); return{year:d.getFullYear(),month:d.getMonth()}; });
  const days=getDaysInMonth(viewing.year,viewing.month);
  const firstDow=new Date(viewing.year,viewing.month,1).getDay();
  const cells=[]; for(let i=0;i<firstDow;i++) cells.push(null); for(let d=1;d<=days;d++) cells.push(d);
  const ymd=(d)=>toYMD(new Date(viewing.year,viewing.month,d));
  return (
    <div style={{width:220}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
        <button onClick={()=>setViewing(v=>{const d=new Date(v.year,v.month-1,1);return{year:d.getFullYear(),month:d.getMonth()};})} style={{background:"transparent",border:"none",color:C.muted,cursor:"pointer",padding:"4px 6px"}}><ChevronLeft size={14}/></button>
        <span style={{color:C.text,fontSize:13,fontWeight:600}}>{MONTHS[viewing.month].slice(0,3)} {viewing.year}</span>
        <button onClick={()=>setViewing(v=>{const d=new Date(v.year,v.month+1,1);return{year:d.getFullYear(),month:d.getMonth()};})} style={{background:"transparent",border:"none",color:C.muted,cursor:"pointer",padding:"4px 6px"}}><ChevronRight size={14}/></button>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2,marginBottom:4}}>
        {["D","S","T","Q","Q","S","S"].map((d,i)=><div key={i} style={{textAlign:"center",fontSize:10,color:C.muted,padding:"2px 0"}}>{d}</div>)}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2}}>
        {cells.map((d,i)=>{
          if(!d) return <div key={i}/>;
          const dStr=ymd(d); const isSelected=dStr===value;
          const disabled=(minDate&&dStr<minDate)||(maxDate&&dStr>maxDate);
          return <button key={i} disabled={disabled} onClick={()=>onChange(dStr)}
            style={{background:isSelected?C.accent:"transparent",border:"none",borderRadius:6,padding:"5px 2px",color:disabled?C.border:isSelected?"#fff":C.text,cursor:disabled?"not-allowed":"pointer",fontSize:12,textAlign:"center"}}>{d}</button>;
        })}
      </div>
    </div>
  );
}

// ─── DATE FILTER BAR ─────────────────────────────────────────────────────────
function DateFilterBar({dateFilter,setDateFilter}){
  const [open,setOpen]=useState(false); const [tab,setTab]=useState("presets");
  const [customStart,setCustomStart]=useState(toYMD(new Date())); const [customEnd,setCustomEnd]=useState(toYMD(new Date()));
  const ref=useRef();
  useEffect(()=>{ function h(e){if(ref.current&&!ref.current.contains(e.target))setOpen(false);} document.addEventListener("mousedown",h); return()=>document.removeEventListener("mousedown",h); },[]);
  const presets=[{id:"today",label:"Hoje"},{id:"week",label:"Esta semana"},{id:"7days",label:"Últimos 7 dias"},{id:"month",label:"Este mês"},{id:"lastmonth",label:"Mês passado"}];
  function applyPreset(id){const r=getPresetRange(id);setDateFilter({preset:id,...r});setOpen(false);}
  function applyCustom(){setDateFilter({preset:"custom",start:customStart,end:customEnd});setOpen(false);}
  const label=dateFilter.preset==="custom"?`${dateFilter.start} → ${dateFilter.end}`:presets.find(p=>p.id===dateFilter.preset)?.label||"Selecionar período";
  return (
    <div ref={ref} style={{position:"relative",zIndex:100}}>
      <button onClick={()=>setOpen(o=>!o)} style={{display:"flex",alignItems:"center",gap:8,background:C.card,border:`1px solid ${C.accent}`,borderRadius:10,padding:"8px 14px",color:C.text,cursor:"pointer",fontSize:13,fontWeight:500}}>
        <Calendar size={14} color={C.accent}/>{label}<ChevronDown size={14} color={C.muted}/>
      </button>
      {open&&(
        <div style={{position:"absolute",top:"calc(100% + 8px)",left:0,background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:16,minWidth:340,boxShadow:"0 8px 32px #0008",zIndex:200}}>
          <div style={{display:"flex",gap:8,marginBottom:16}}>
            {["presets","custom"].map(t=><button key={t} onClick={()=>setTab(t)} style={{flex:1,padding:"7px 0",borderRadius:8,border:"none",cursor:"pointer",background:tab===t?C.accent:"transparent",color:tab===t?"#fff":C.muted,fontSize:12,fontWeight:600}}>{t==="presets"?"Períodos rápidos":"Customizado"}</button>)}
          </div>
          {tab==="presets"?(
            <div style={{display:"flex",flexDirection:"column",gap:4}}>
              {presets.map(p=><button key={p.id} onClick={()=>applyPreset(p.id)} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 12px",borderRadius:8,border:"none",cursor:"pointer",background:dateFilter.preset===p.id?`${C.accent}22`:"transparent",color:dateFilter.preset===p.id?C.accentLight:C.text,fontSize:13,textAlign:"left"}}>{p.label}{dateFilter.preset===p.id&&<Check size={14} color={C.accent}/>}</button>)}
            </div>
          ):(
            <div>
              <div style={{display:"flex",gap:16,marginBottom:12}}>
                <div><div style={{color:C.muted,fontSize:11,marginBottom:6}}>Início</div><MiniCalendar value={customStart} onChange={setCustomStart} maxDate={customEnd}/></div>
                <div><div style={{color:C.muted,fontSize:11,marginBottom:6}}>Fim</div><MiniCalendar value={customEnd} onChange={setCustomEnd} minDate={customStart}/></div>
              </div>
              <button onClick={applyCustom} style={{width:"100%",background:C.accent,border:"none",borderRadius:8,padding:"10px 0",color:"#fff",fontWeight:600,cursor:"pointer",fontSize:13}}>Filtrar período</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── KPI CARD ────────────────────────────────────────────────────────────────
function KpiCard({icon:Icon,label,value,color=C.accent,sub}){
  return (
    <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:"16px 20px",display:"flex",flexDirection:"column",gap:8}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <span style={{color:C.muted,fontSize:13}}>{label}</span>
        <div style={{background:`${color}22`,borderRadius:8,padding:6}}><Icon size={16} color={color}/></div>
      </div>
      <div style={{fontSize:22,fontWeight:700,color:C.text}}>{value}</div>
      {sub&&<div style={{fontSize:12,color:C.muted}}>{sub}</div>}
    </div>
  );
}
function SectionTitle({children}){ return <h2 style={{color:C.text,fontSize:18,fontWeight:600,margin:"24px 0 12px"}}>{children}</h2>; }

// ─── LOGIN ───────────────────────────────────────────────────────────────────
function LoginScreen({onLogin}){
  const [email,setEmail]=useState(""); const [password,setPassword]=useState("");
  const [showPw,setShowPw]=useState(false); const [loading,setLoading]=useState(false); const [error,setError]=useState("");
  async function handleSubmit(e){
    e.preventDefault(); setError(""); setLoading(true);
    const {data,error:err}=await supabase.auth.signInWithPassword({email,password});
    setLoading(false);
    if(err) setError("Email ou senha incorretos.");
    else onLogin(data.user);
  }
  const fi={background:"#252836",border:`1px solid ${C.border}`,borderRadius:10,padding:"12px 14px",color:C.text,fontSize:14,width:"100%",outline:"none",boxSizing:"border-box"};
  return (
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"Inter,system-ui,sans-serif",padding:20}}>
      <div style={{width:"100%",maxWidth:400}}>
        <div style={{textAlign:"center",marginBottom:40}}>
          <div style={{width:56,height:56,borderRadius:14,background:C.accent,display:"inline-flex",alignItems:"center",justifyContent:"center",marginBottom:16}}><BarChart2 size={28} color="#fff"/></div>
          <h1 style={{color:C.text,fontSize:26,fontWeight:700,margin:"0 0 6px"}}>Smartfy Dashboard</h1>
          <p style={{color:C.muted,fontSize:14,margin:0}}>Faça login para continuar</p>
        </div>
        <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:16,padding:32}}>
          <form onSubmit={handleSubmit}>
            <div style={{marginBottom:16}}>
              <label style={{color:C.muted,fontSize:13,display:"block",marginBottom:6}}>Email</label>
              <input type="email" value={email} onChange={e=>setEmail(e.target.value)} style={fi} placeholder="seu@email.com" required/>
            </div>
            <div style={{marginBottom:24}}>
              <label style={{color:C.muted,fontSize:13,display:"block",marginBottom:6}}>Senha</label>
              <div style={{position:"relative"}}>
                <input type={showPw?"text":"password"} value={password} onChange={e=>setPassword(e.target.value)} style={{...fi,paddingRight:44}} placeholder="••••••••" required/>
                <button type="button" onClick={()=>setShowPw(s=>!s)} style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",color:C.muted,display:"flex"}}>
                  {showPw?<EyeOff size={16}/>:<Eye size={16}/>}
                </button>
              </div>
            </div>
            {error&&<div style={{background:`${C.red}18`,border:`1px solid ${C.red}44`,borderRadius:8,padding:"10px 14px",marginBottom:16,display:"flex",alignItems:"center",gap:8}}><AlertCircle size={14} color={C.red}/><span style={{color:C.red,fontSize:13}}>{error}</span></div>}
            <button type="submit" disabled={loading} style={{width:"100%",background:C.accent,border:"none",borderRadius:10,padding:"13px 0",color:"#fff",fontWeight:700,fontSize:15,cursor:loading?"not-allowed":"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8,opacity:loading?0.7:1}}>
              {loading?<><Loader size={16} style={{animation:"spin 1s linear infinite"}}/>Entrando...</>:"Entrar"}
            </button>
          </form>
        </div>
        <p style={{textAlign:"center",color:C.muted,fontSize:12,marginTop:20}}>Acesso restrito à equipe Smartfy</p>
      </div>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

// ─── BARRA META DIÁRIA (fogo / sangue nos olhos) ─────────────────────────────
function MetaDiariaBar({faturamentoHoje, metaDiaria, supermetaDiaria}){
  if(!metaDiaria||metaDiaria<=0) return null;
  const bateuMeta = faturamentoHoje >= metaDiaria;
  const bateuSuper = supermetaDiaria > 0 && faturamentoHoje >= supermetaDiaria;

  // The bar has two zones: [0 → metaDiaria] + [metaDiaria → supermetaDiaria]
  // We render them side-by-side; the meta zone takes 70% width, supermeta extension 30%
  const hasSuper = supermetaDiaria > 0 && supermetaDiaria > metaDiaria;
  const metaZonePct = hasSuper ? 70 : 100;
  const superZonePct = hasSuper ? 30 : 0;

  // Fill within meta zone (0–100%)
  const fillMetaPct = Math.min((faturamentoHoje / metaDiaria) * 100, 100);
  // Fill within supermeta zone (0–100%), only if meta was beaten
  const fillSuperPct = hasSuper && bateuMeta
    ? Math.min(((faturamentoHoje - metaDiaria) / (supermetaDiaria - metaDiaria)) * 100, 100)
    : 0;

  const falta = metaDiaria - faturamentoHoje;
  const pctDia = faturamentoHoje > 0 ? ((faturamentoHoje / metaDiaria) * 100).toFixed(1) : "0.0";

  const fireGradient = "linear-gradient(90deg,#ff3c00,#ff7a00,#ffd000,#ff4800)";
  const superGradient = "linear-gradient(90deg,#ffd000,#ff00cc,#a855f7,#6c63ff)";
  const normalGradient = `linear-gradient(90deg,${C.accent},${C.accentLight})`;
  const nearGradient = `linear-gradient(90deg,${C.yellow},#ff9900)`;

  const barColor = bateuMeta ? fireGradient : (faturamentoHoje >= metaDiaria * 0.8 ? nearGradient : normalGradient);

  return (
    <div style={{
      background: bateuMeta
        ? "linear-gradient(135deg,#1a0800 0%,#2a0a00 50%,#1a0800 100%)"
        : C.card,
      border: `1px solid ${bateuMeta ? "#ff4400" : C.border}`,
      borderRadius: 12,
      padding: "16px 20px",
      marginBottom: 12,
      position: "relative",
      overflow: "hidden",
      boxShadow: bateuMeta ? "0 0 24px rgba(255,68,0,0.35), inset 0 0 40px rgba(255,68,0,0.08)" : "none",
    }}>
      {/* Fundo pulsante quando meta batida */}
      {bateuMeta && (
        <div style={{
          position:"absolute",top:0,left:0,right:0,bottom:0,
          background:"radial-gradient(ellipse at center, rgba(255,80,0,0.12) 0%, transparent 70%)",
          animation:"pulse-fire 1.5s ease-in-out infinite",
          pointerEvents:"none",
        }}/>
      )}

      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10,position:"relative"}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          {bateuSuper ? <span style={{fontSize:18}}>🏆</span> : bateuMeta ? <span style={{fontSize:18,animation:"shake 0.4s ease infinite"}}>🔥</span> : <span style={{fontSize:16}}>🎯</span>}
          <span style={{
            color: bateuMeta ? "#ff9944" : C.text,
            fontWeight:700,
            fontSize:14,
            textTransform:"uppercase",
            letterSpacing:"0.05em",
          }}>Meta do Dia</span>
          {bateuMeta && <span style={{fontSize:12,background:"#ff4400",color:"#fff",padding:"2px 8px",borderRadius:99,fontWeight:700,animation:"pulse-fire 1s ease infinite"}}>META BATIDA!</span>}
          {bateuSuper && <span style={{fontSize:12,background:"linear-gradient(90deg,#a855f7,#6c63ff)",color:"#fff",padding:"2px 8px",borderRadius:99,fontWeight:700,marginLeft:4}}>🚀 SUPERMETA!</span>}
        </div>
        <span style={{
          color: bateuMeta ? "#ff9944" : C.text,
          fontWeight:800,
          fontSize:16,
        }}>{pctDia}%</span>
      </div>

      {/* Barra */}
      <div style={{display:"flex",gap:3,alignItems:"stretch",height:22,borderRadius:99,overflow:"hidden",background:C.border}}>
        {/* Zona meta */}
        <div style={{flex:metaZonePct,position:"relative",overflow:"hidden"}}>
          <div style={{
            width:`${fillMetaPct}%`,
            height:"100%",
            background: barColor,
            backgroundSize: bateuMeta ? "200% 100%" : "100% 100%",
            animation: bateuMeta ? "fire-slide 1.2s linear infinite" : "none",
            transition: "width 0.6s cubic-bezier(0.25,1,0.5,1)",
            boxShadow: bateuMeta ? "4px 0 12px rgba(255,100,0,0.8)" : "none",
          }}/>
          {bateuMeta && <div style={{position:"absolute",inset:0,background:"linear-gradient(90deg,transparent 60%,rgba(255,150,0,0.3))",animation:"flicker 0.3s ease infinite alternate"}}/>}
        </div>
        {/* Divisor — linha da meta */}
        {hasSuper && <div style={{width:2,background: bateuMeta ? "#ff6600" : "#444",flexShrink:0}}/>}
        {/* Zona supermeta */}
        {hasSuper && (
          <div style={{flex:superZonePct,position:"relative",overflow:"hidden",background:"rgba(168,85,247,0.08)"}}>
            {bateuMeta && (
              <div style={{
                width:`${fillSuperPct}%`,
                height:"100%",
                background: superGradient,
                backgroundSize:"200% 100%",
                animation:"fire-slide 0.8s linear infinite",
                transition:"width 0.6s ease",
              }}/>
            )}
          </div>
        )}
      </div>

      {/* Labels abaixo da barra */}
      <div style={{display:"flex",justifyContent:"space-between",marginTop:6,fontSize:11,color:C.muted}}>
        <span>R$ 0</span>
        <span style={{color: bateuMeta ? "#ff9944" : C.muted, fontWeight: bateuMeta ? 700 : 400}}>
          🎯 {fmt(metaDiaria)}
        </span>
        {hasSuper && <span style={{color: bateuSuper ? "#a855f7" : C.muted, fontWeight: bateuSuper ? 700 : 400}}>
          🚀 {fmt(supermetaDiaria)}
        </span>}
      </div>

      {/* Status */}
      <div style={{marginTop:8,fontSize:12,position:"relative"}}>
        {bateuSuper ? (
          <span style={{color:"#c084fc",fontWeight:700}}>🏆 Supermeta destruída! +{fmt(faturamentoHoje - supermetaDiaria)} acima da supermeta</span>
        ) : bateuMeta ? (
          <span style={{color:"#ff9944",fontWeight:700}}>🔥 Meta batida! +{fmt(faturamentoHoje - metaDiaria)} acima · {hasSuper ? `Falta ${fmt(supermetaDiaria - faturamentoHoje)} pra supermeta` : ""}</span>
        ) : faturamentoHoje > 0 ? (
          <span style={{color:C.muted}}>
            <span style={{color:C.text,fontWeight:600}}>{fmt(faturamentoHoje)}</span> vendidos hoje · Falta <span style={{color:C.red,fontWeight:700}}>{fmt(falta)}</span>
          </span>
        ) : (
          <span style={{color:C.muted}}>Nenhuma venda registrada hoje · Meta: <span style={{color:C.accentLight,fontWeight:600}}>{fmt(metaDiaria)}</span></span>
        )}
      </div>

      <style>{`
        @keyframes fire-slide{from{background-position:0% 0%}to{background-position:200% 0%}}
        @keyframes pulse-fire{0%,100%{opacity:1}50%{opacity:0.6}}
        @keyframes shake{0%,100%{transform:rotate(-8deg)}50%{transform:rotate(8deg)}}
        @keyframes flicker{from{opacity:0.6}to{opacity:1}}
      `}</style>
    </div>
  );
}

// ─── BARRA DE META ───────────────────────────────────────────────────────────
function MetaProgressBar({atual,meta,supermeta,label}){
  if(!meta||meta<=0) return null;
  const pctMeta=Math.min((atual/meta)*100,100);
  const pctSuper=supermeta?Math.min((atual/supermeta)*100,100):null;
  const metaColor=atual>=meta?C.green:atual>=(meta*0.8)?C.yellow:C.accent;
  return (
    <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:"16px 20px",marginBottom:12}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
        <span style={{color:C.text,fontWeight:600,fontSize:14}}>{label}</span>
        <span style={{color:metaColor,fontWeight:700,fontSize:15}}>{pctMeta.toFixed(1)}%</span>
      </div>
      {/* Barra principal — meta */}
      <div style={{position:"relative",marginBottom:8}}>
        <div style={{background:C.border,borderRadius:99,height:18,overflow:"hidden"}}>
          <div style={{width:`${pctMeta}%`,background:`linear-gradient(90deg,${C.accent},${metaColor})`,borderRadius:99,height:"100%",transition:"width 0.5s ease",display:"flex",alignItems:"center",justifyContent:"flex-end",paddingRight:6}}>
            {pctMeta>15&&<span style={{color:"#fff",fontSize:10,fontWeight:700}}>{fmt(atual)}</span>}
          </div>
        </div>
        <div style={{display:"flex",justifyContent:"space-between",marginTop:4}}>
          <span style={{color:C.muted,fontSize:11}}>R$ 0</span>
          <span style={{color:atual>=meta?C.green:C.muted,fontSize:11,fontWeight:atual>=meta?700:400}}>🎯 Meta: {fmt(meta)}</span>
        </div>
        {atual<meta&&(
          <div style={{marginTop:4,fontSize:12,color:C.muted}}>
            Falta <span style={{color:C.red,fontWeight:700}}>{fmt(meta-atual)}</span> · {(100-pctMeta).toFixed(1)}% restante
          </div>
        )}
        {atual>=meta&&<div style={{marginTop:4,fontSize:12,color:C.green,fontWeight:700}}>✅ Meta batida! +{fmt(atual-meta)} acima</div>}
      </div>
      {/* Barra supermeta */}
      {supermeta&&supermeta>0&&(
        <div style={{marginTop:12}}>
          <div style={{background:C.border,borderRadius:99,height:12,overflow:"hidden"}}>
            <div style={{width:`${pctSuper}%`,background:`linear-gradient(90deg,${C.purple},${C.yellow})`,borderRadius:99,height:"100%",transition:"width 0.5s ease"}}/>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",marginTop:4}}>
            <span style={{color:C.muted,fontSize:11}}>{pctSuper?.toFixed(1)}% da supermeta</span>
            <span style={{color:atual>=(supermeta||0)?C.yellow:C.muted,fontSize:11,fontWeight:atual>=(supermeta||0)?700:400}}>🚀 Supermeta: {fmt(supermeta)}</span>
          </div>
          {atual>=(supermeta)&&<div style={{marginTop:2,fontSize:12,color:C.yellow,fontWeight:700}}>🔥 Supermeta batida! +{fmt(atual-supermeta)} acima</div>}
        </div>
      )}
    </div>
  );
}

// ─── DASHBOARD ───────────────────────────────────────────────────────────────
function Dashboard({data,prejuizoMes,metaDailyData,kommoStats,forecast}){
  const defaultFilter=getPresetRange("month");
  const [dateFilter,setDateFilter]=useState({preset:"month",...defaultFilter});
  const filteredDays=useMemo(()=>getFilteredDays(data,dateFilter),[data,dateFilter]);
  const kpi=useMemo(()=>calcKPIs(filteredDays),[filteredDays]);

  const metaFiltered=useMemo(()=>{
    if(!metaDailyData||!metaDailyData.length) return null;
    const days=metaDailyData.filter(d=>d.date>=dateFilter.start&&d.date<=dateFilter.end);
    if(!days.length) return null;
    const tax=days[0]?.tax||META_TAX;
    const liq=days.reduce((s,d)=>s+(d.spendLiq||0),0);
    const total=days.reduce((s,d)=>s+(d.spendTotal||0),0);
    return{liq,total,tax,impostos:total-liq};
  },[metaDailyData,dateFilter]);

  const daysWithData=filteredDays.filter(d=>d.faturamento>0||d.anuncios>0);
  const chartData=daysWithData.map(d=>{ const k=calcKPIs([d]); return{name:`${d.day}/${d.month+1}`,fat:d.faturamento,lucro:k.lucro,anuncios:d.anuncios}; });
  const monthlyChart=MONTHS.map((m,mi)=>{ const k=calcKPIs(data[mi]||[]); return{name:m.slice(0,3),fat:k.faturamento,lucro:k.lucro}; }).filter(r=>r.fat>0||r.lucro!==0);
  const ttStyle={contentStyle:{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,color:C.text}};
  const periodLabel={today:"Hoje",week:"Esta semana","7days":"Últimos 7 dias",month:"Este mês",lastmonth:"Mês passado"}[dateFilter.preset]||(dateFilter.preset==="custom"?`${dateFilter.start} a ${dateFilter.end}`:"");

  // Meta do mês atual
  const currentMonthForecast=forecast?.[new Date().getMonth()];
  const metaMes=currentMonthForecast?.meta_faturamento||0;
  const supermetaMes=currentMonthForecast?.supermeta_faturamento||0;
  const faturamentoMesAtual=calcKPIs(data[new Date().getMonth()]||[]).faturamento;

  // Meta diária proporcional (dias trabalhados)
  const diasTrabalhados=currentMonthForecast?.dias_trabalhados||getDaysInMonth(YEAR,new Date().getMonth());
  const metaDiaria=metaMes>0?metaMes/diasTrabalhados:0;
  const supermetaDiaria=supermetaMes>0?supermetaMes/diasTrabalhados:0;
  const diaAtual=new Date().getDate();
  const todayYMD=toYMD(new Date());
  const faturamentoHoje=(data[new Date().getMonth()]||[]).find(d=>d.date===todayYMD)?.faturamento||0;

  return (
    <div>
      <div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap",marginBottom:4}}>
        <h2 style={{color:C.text,fontSize:18,fontWeight:600,margin:0}}>Dashboard</h2>
        <DateFilterBar dateFilter={dateFilter} setDateFilter={setDateFilter}/>
      </div>
      <div style={{color:C.muted,fontSize:12,marginBottom:16}}>{filteredDays.length} dias · {daysWithData.length} com dados</div>

      {/* Barra de progresso da meta */}
      {metaMes>0&&(
        <div style={{marginBottom:8}}>
          <MetaProgressBar atual={faturamentoMesAtual} meta={metaMes} supermeta={supermetaMes} label={`Faturamento — ${MONTHS[new Date().getMonth()]}`}/>
          {metaDiaria>0&&(
            <MetaDiariaBar faturamentoHoje={faturamentoHoje} metaDiaria={metaDiaria} supermetaDiaria={supermetaDiaria}/>
          )}
        </div>
      )}

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(175px,1fr))",gap:12,marginTop:16}}>
        <KpiCard icon={DollarSign} label="Faturamento" value={fmt(kpi.faturamento)} color={C.green}/>
        <KpiCard icon={TrendingUp} label="Lucro" value={fmt(kpi.lucro)} color={kpi.lucro>=0?C.green:C.red}/>
        <KpiCard icon={Target} label="ROAS" value={fmtROAS(kpi.roas)} color={C.accent} sub="faturamento ÷ anúncios"/>
        <KpiCard icon={ShoppingCart} label="Pedidos" value={kpi.pedidos} color={C.cyan}/>
        <KpiCard icon={Users} label="Leads" value={kpi.leads} color={C.yellow}/>
        <KpiCard icon={BarChart2} label="Anúncios" value={fmt(kpi.anuncios)} color={C.purple}/>
        <KpiCard icon={DollarSign} label="CP Venda" value={fmt(kpi.cpVenda)} color={C.purple}/>
        <KpiCard icon={DollarSign} label="Ticket Médio" value={fmt(kpi.ticketMedio)} color={C.cyan}/>
        <KpiCard icon={Target} label="Tx. Conversão" value={fmtPct(kpi.txConversao)} color={C.green}/>
        <KpiCard icon={Users} label="Custo/Lead" value={fmt(kpi.custoLead)} color={C.yellow}/>
        <KpiCard icon={TrendingDown} label="Prejuízo pós-venda" value={fmt(prejuizoMes)} color={C.red} sub="trocas e devoluções"/>
      </div>

      {metaFiltered&&(
        <>
          <SectionTitle>💰 Gastos Meta Ads — {periodLabel}</SectionTitle>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:12,marginBottom:8}}>
            <div style={{background:C.card,border:`2px solid ${C.accent}44`,borderRadius:12,padding:20}}>
              <div style={{color:C.muted,fontSize:12,marginBottom:4}}>Gasto líquido (sem imposto)</div>
              <div style={{color:C.text,fontWeight:700,fontSize:24}}>{fmt(metaFiltered.liq)}</div>
            </div>
            <div style={{background:C.card,border:`2px solid ${C.red}44`,borderRadius:12,padding:20}}>
              <div style={{color:C.muted,fontSize:12,marginBottom:4}}>Imposto embutido ({(metaFiltered.tax*100).toFixed(2)}%)</div>
              <div style={{color:C.red,fontWeight:700,fontSize:24}}>{fmt(metaFiltered.impostos)}</div>
            </div>
            <div style={{background:C.card,border:`2px solid ${C.yellow}55`,borderRadius:12,padding:20}}>
              <div style={{color:C.muted,fontSize:12,marginBottom:4}}>Total com imposto</div>
              <div style={{color:C.yellow,fontWeight:700,fontSize:24}}>{fmt(metaFiltered.total)}</div>
            </div>
          </div>
        </>
      )}

      {kommoStats&&(
        <>
          <SectionTitle>📱 Leads por Canal — Kommo</SectionTitle>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))",gap:12}}>
            <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:16}}><div style={{color:C.muted,fontSize:12}}>Total de leads</div><div style={{color:C.text,fontWeight:700,fontSize:24}}>{kommoStats.totalLeads}</div></div>
            <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:16}}><div style={{color:C.muted,fontSize:12}}>Tempo médio resposta</div><div style={{color:C.yellow,fontWeight:700,fontSize:24}}>{kommoStats.tempoMedioResposta} <span style={{fontSize:14}}>min</span></div></div>
            {kommoStats.byChannel.map(ch=>(
              <div key={ch.canal} style={{background:C.card,border:`1px solid ${ch.cor}44`,borderRadius:12,padding:16}}>
                <div style={{color:C.muted,fontSize:12}}>{ch.canal==="Instagram DM"?"📸":"💬"} {ch.canal}</div>
                <div style={{color:ch.cor,fontWeight:700,fontSize:22}}>{ch.leads} <span style={{color:C.muted,fontSize:13}}>leads</span></div>
                <div style={{color:C.green,fontSize:12,marginTop:4}}>Conv: {((ch.convertidos/ch.leads)*100).toFixed(1)}%</div>
              </div>
            ))}
          </div>
        </>
      )}

      {chartData.length>0&&(
        <>
          <SectionTitle>Faturamento vs Lucro — {periodLabel}</SectionTitle>
          <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:16}}>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border}/>
                <XAxis dataKey="name" tick={{fill:C.muted,fontSize:10}}/><YAxis tick={{fill:C.muted,fontSize:11}}/>
                <Tooltip {...ttStyle} formatter={v=>fmt(v)}/><Legend wrapperStyle={{color:C.muted,fontSize:12}}/>
                <Bar dataKey="fat" name="Faturamento" fill={C.accent} radius={[4,4,0,0]}/>
                <Bar dataKey="lucro" name="Lucro" fill={C.green} radius={[4,4,0,0]}/>
                <Bar dataKey="anuncios" name="Anúncios" fill={C.yellow} radius={[4,4,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      {monthlyChart.length>1&&(
        <>
          <SectionTitle>Evolução Anual {YEAR}</SectionTitle>
          <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:16}}>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={monthlyChart}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border}/>
                <XAxis dataKey="name" tick={{fill:C.muted,fontSize:11}}/><YAxis tick={{fill:C.muted,fontSize:11}}/>
                <Tooltip {...ttStyle} formatter={v=>fmt(v)}/><Legend wrapperStyle={{color:C.muted,fontSize:12}}/>
                <Line type="monotone" dataKey="fat" name="Faturamento" stroke={C.accent} strokeWidth={2} dot={false}/>
                <Line type="monotone" dataKey="lucro" name="Lucro" stroke={C.green} strokeWidth={2} dot={false}/>
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
}

// ─── FORECAST ────────────────────────────────────────────────────────────────
function Forecast({forecast,onSave}){
  const now=new Date();
  const [mes,setMes]=useState(now.getMonth());
  const saved=forecast?.[mes]||{};
  const [form,setForm]=useState({
    investimento_ads: saved.investimento_ads||"",
    meta_faturamento: saved.meta_faturamento||"",
    supermeta_faturamento: saved.supermeta_faturamento||"",
    dias_trabalhados: saved.dias_trabalhados||getDaysInMonth(YEAR,mes),
    meta_criativos: saved.meta_criativos||"",
    numero_vendas: saved.numero_vendas||"",
  });
  const [saving,setSaving]=useState(false);
  const [savedOk,setSavedOk]=useState(false);

  useEffect(()=>{
    const s=forecast?.[mes]||{};
    setForm({
      investimento_ads:s.investimento_ads||"", meta_faturamento:s.meta_faturamento||"",
      supermeta_faturamento:s.supermeta_faturamento||"", dias_trabalhados:s.dias_trabalhados||getDaysInMonth(YEAR,mes),
      meta_criativos:s.meta_criativos||"", numero_vendas:s.numero_vendas||"",
    });
  },[mes,forecast]);

  // Cálculos automáticos
  const ads=+form.investimento_ads||0;
  const fat=+form.meta_faturamento||0;
  const vendas=+form.numero_vendas||0;
  const diasTrab=+form.dias_trabalhados||1;

  const roasCalc=ads>0?fat/ads:null;
  const cpVendaCalc=vendas>0?ads/vendas:null;
  const ticketCalc=vendas>0?fat/vendas:null;
  const fatDiarioCalc=diasTrab>0?fat/diasTrab:null;
  const vendasDiarioCalc=diasTrab>0?vendas/diasTrab:null;

  async function handleSave(e){
    e.preventDefault(); setSaving(true);
    const payload={...form,investimento_ads:+form.investimento_ads||0,meta_faturamento:+form.meta_faturamento||0,supermeta_faturamento:+form.supermeta_faturamento||0,dias_trabalhados:+form.dias_trabalhados||0,meta_criativos:+form.meta_criativos||0,numero_vendas:+form.numero_vendas||0,mes,year:YEAR};
    await onSave(mes,payload);
    setSaving(false); setSavedOk(true); setTimeout(()=>setSavedOk(false),2000);
  }

  const fi={background:"#252836",border:`1px solid ${C.border}`,borderRadius:8,padding:"10px 14px",color:C.text,fontSize:14,width:"100%",outline:"none",boxSizing:"border-box"};
  const li={color:C.muted,fontSize:13,marginBottom:4,display:"block"};
  const auto=(label,value,color=C.accent)=>(
    <div style={{background:C.card2,borderRadius:10,padding:14}}>
      <div style={{color:C.muted,fontSize:12,marginBottom:4}}>{label} <span style={{color:C.accent,fontSize:10}}>(auto)</span></div>
      <div style={{color,fontWeight:700,fontSize:18}}>{value}</div>
    </div>
  );

  return (
    <div>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20,flexWrap:"wrap"}}>
        <SectionTitle style={{margin:0}}>🎯 Forecast — Meta Mensal</SectionTitle>
        <select value={mes} onChange={e=>{setMes(+e.target.value);}} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:"7px 12px",color:C.text,cursor:"pointer",fontSize:13}}>
          {MONTHS.map((m,i)=><option key={i} value={i}>{m} {YEAR}</option>)}
        </select>
      </div>

      <form onSubmit={handleSave}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:16,marginBottom:24}}>
          <div><label style={li}>💰 Investimento em Ads (R$)</label><input type="number" min="0" step="0.01" value={form.investimento_ads} onChange={e=>setForm(f=>({...f,investimento_ads:e.target.value}))} style={fi} placeholder="0,00"/></div>
          <div><label style={li}>📈 Meta de Faturamento (R$)</label><input type="number" min="0" step="0.01" value={form.meta_faturamento} onChange={e=>setForm(f=>({...f,meta_faturamento:e.target.value}))} style={fi} placeholder="0,00"/></div>
          <div><label style={li}>🚀 Supermeta de Faturamento (R$)</label><input type="number" min="0" step="0.01" value={form.supermeta_faturamento} onChange={e=>setForm(f=>({...f,supermeta_faturamento:e.target.value}))} style={fi} placeholder="0,00"/></div>
          <div><label style={li}>📅 Dias trabalhados no mês</label><input type="number" min="1" max="31" value={form.dias_trabalhados} onChange={e=>setForm(f=>({...f,dias_trabalhados:e.target.value}))} style={fi}/></div>
          <div><label style={li}>🎨 Meta de criativos</label><input type="number" min="0" value={form.meta_criativos} onChange={e=>setForm(f=>({...f,meta_criativos:e.target.value}))} style={fi} placeholder="Ex: 10"/></div>
          <div><label style={li}>🛒 Número de vendas esperadas</label><input type="number" min="0" value={form.numero_vendas} onChange={e=>setForm(f=>({...f,numero_vendas:e.target.value}))} style={fi} placeholder="Ex: 200"/></div>
        </div>

        {/* Calculados automaticamente */}
        <div style={{marginBottom:24}}>
          <div style={{color:C.text,fontWeight:600,fontSize:14,marginBottom:12}}>Métricas calculadas automaticamente</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",gap:12}}>
            {auto("ROAS projetado", roasCalc?fmtROAS(roasCalc):"-", C.accent)}
            {auto("CP Venda projetado", cpVendaCalc?fmt(cpVendaCalc):"-", C.purple)}
            {auto("Ticket médio projetado", ticketCalc?fmt(ticketCalc):"-", C.cyan)}
            {auto("Faturamento/dia", fatDiarioCalc?fmt(fatDiarioCalc):"-", C.green)}
            {auto("Vendas/dia", vendasDiarioCalc?vendasDiarioCalc.toFixed(1):"-", C.yellow)}
          </div>
        </div>

        {/* Barra preview da meta */}
        {fat>0&&<MetaProgressBar atual={0} meta={fat} supermeta={+form.supermeta_faturamento||0} label={`Preview da meta — ${MONTHS[mes]}`}/>}

        <button type="submit" disabled={saving} style={{background:savedOk?C.green:C.accent,color:"#fff",border:"none",borderRadius:10,padding:"12px 28px",fontWeight:600,fontSize:15,cursor:"pointer",display:"flex",alignItems:"center",gap:8}}>
          {saving?<><Loader size={16} style={{animation:"spin 1s linear infinite"}}/>Salvando...</>:savedOk?<><Check size={16}/>Salvo!</>:<><Flag size={16}/>Salvar Meta</>}
        </button>
      </form>
    </div>
  );
}

// ─── LANÇAMENTO DIÁRIO ───────────────────────────────────────────────────────
function LancamentoDiario({data,month,setMonth,onSave}){
  const today=new Date();
  const defaultDay=today.getMonth()===month&&today.getFullYear()===YEAR?today.getDate():1;
  const [day,setDay]=useState(defaultDay);
  const existing=data[month]?.[day-1]||{};
  const [form,setForm]=useState({anuncios:existing.anuncios||"",leads:existing.leads||"",faturamento:existing.faturamento||"",pedidos:existing.pedidos||"",custo_produtos:existing.custo_produtos||"",custo_frete_correios:existing.custo_frete_correios||"",custo_frete_motoboy:existing.custo_frete_motoboy||""});
  const [saved,setSaved]=useState(false); const [saving,setSaving]=useState(false);

  useEffect(()=>{
    const ex=data[month]?.[day-1]||{};
    setForm({anuncios:ex.anuncios||"",leads:ex.leads||"",faturamento:ex.faturamento||"",pedidos:ex.pedidos||"",custo_produtos:ex.custo_produtos||"",custo_frete_correios:ex.custo_frete_correios||"",custo_frete_motoboy:ex.custo_frete_motoboy||""});
    setSaved(false);
  },[day,month]);

  const preview=calcKPIs([{...form,anuncios:+form.anuncios||0,leads:+form.leads||0,faturamento:+form.faturamento||0,pedidos:+form.pedidos||0,custo_produtos:+form.custo_produtos||0,custo_frete_correios:+form.custo_frete_correios||0,custo_frete_motoboy:+form.custo_frete_motoboy||0}]);
  const lucro=(+form.faturamento||0)-(+form.anuncios||0)-(+form.custo_produtos||0)-(+form.custo_frete_correios||0)-(+form.custo_frete_motoboy||0);

  async function handleSubmit(e){
    e.preventDefault(); setSaving(true);
    const parsed={}; Object.entries(form).forEach(([k,v])=>{parsed[k]=parseFloat(v)||0;});
    await onSave(month,day-1,parsed);
    setSaving(false); setSaved(true); setTimeout(()=>setSaved(false),2000);
  }

  const fi={background:"#252836",border:`1px solid ${C.border}`,borderRadius:8,padding:"10px 14px",color:C.text,fontSize:14,width:"100%",outline:"none",boxSizing:"border-box"};
  const li={color:C.muted,fontSize:13,marginBottom:4,display:"block"};

  return (
    <div>
      <SectionTitle>Lançamento Diário</SectionTitle>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:20,flexWrap:"wrap"}}>
        <button onClick={()=>setDay(d=>Math.max(1,d-1))} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:"7px 11px",color:C.text,cursor:"pointer"}}><ChevronLeft size={14}/></button>
        <span style={{color:C.text,fontWeight:600,fontSize:15,minWidth:200,textAlign:"center"}}>{MONTHS[month].slice(0,3)} {day} — {data[month]?.[day-1]?.weekday}</span>
        <button onClick={()=>setDay(d=>Math.min(getDaysInMonth(YEAR,month),d+1))} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:"7px 11px",color:C.text,cursor:"pointer"}}><ChevronRight size={14}/></button>
        <select value={month} onChange={e=>{setMonth(+e.target.value);setDay(1);}} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:"7px 12px",color:C.text,cursor:"pointer",fontSize:13}}>
          {MONTHS.map((m,i)=><option key={i} value={i}>{m}</option>)}
        </select>
      </div>
      <form onSubmit={handleSubmit}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:16}}>
          {[["anuncios","💰 Gastos com Anúncios (R$)"],["leads","👥 Leads"],["faturamento","📈 Faturamento Total (R$)"],["pedidos","🛒 Pedidos"],["custo_produtos","📦 Custo dos Produtos (R$)"],["custo_frete_correios","📮 Frete Correios (R$)"],["custo_frete_motoboy","🏍️ Frete Motoboy (R$)"]].map(([key,label])=>(
            <div key={key}><label style={li}>{label}</label><input type="number" min="0" step="0.01" value={form[key]} onChange={e=>{setForm(f=>({...f,[key]:e.target.value}));setSaved(false);}} style={fi} placeholder="0,00"/></div>
          ))}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))",gap:12,margin:"20px 0",background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:16}}>
          {[["Lucro",fmt(lucro),lucro>=0?C.green:C.red],["ROAS",fmtROAS(preview.roas),C.accent],["CP Venda",fmt(preview.cpVenda),C.text],["Ticket Médio",fmt(preview.ticketMedio),C.text],["Tx Conv.",fmtPct(preview.txConversao),C.text],["Custo/Lead",fmt(preview.custoLead),C.text]].map(([l,v,c])=>(
            <div key={l}><div style={{color:C.muted,fontSize:12}}>{l}</div><div style={{color:c,fontWeight:700,fontSize:17}}>{v}</div></div>
          ))}
        </div>
        <button type="submit" disabled={saving} style={{background:saved?C.green:C.accent,color:"#fff",border:"none",borderRadius:10,padding:"12px 28px",fontWeight:600,fontSize:15,cursor:"pointer",display:"flex",alignItems:"center",gap:8,transition:"background 0.2s"}}>
          {saving?<><Loader size={16} style={{animation:"spin 1s linear infinite"}}/>Salvando...</>:saved?<><Check size={16}/>Salvo!</>:<><PlusCircle size={16}/>Salvar Lançamento</>}
        </button>
      </form>
    </div>
  );
}

// ─── VISÃO MENSAL ────────────────────────────────────────────────────────────
function VisaoMensal({data,month,setMonth}){
  const days=data[month]||[];
  const total=calcKPIs(days);
  const th={color:C.muted,fontSize:11,padding:"8px 10px",textAlign:"right",borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"};
  const td=(extra={})=>({fontSize:12,padding:"7px 10px",textAlign:"right",borderBottom:`1px solid ${C.border}22`,color:C.text,...extra});
  return (
    <div>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16,flexWrap:"wrap"}}>
        <SectionTitle style={{margin:0}}>Visão Mensal</SectionTitle>
        <select value={month} onChange={e=>setMonth(+e.target.value)} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:"7px 12px",color:C.text,cursor:"pointer",fontSize:13}}>
          {MONTHS.map((m,i)=><option key={i} value={i}>{m} {YEAR}</option>)}
        </select>
      </div>
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead><tr style={{background:C.card2}}>
            {["Data","Dia","Anúncios","Leads","Faturamento","Pedidos","CP Venda","Ticket Médio","Tx Conv.","Custo/Lead","C.Produtos","Frete Cor.","Frete Moto","Lucro","ROAS"].map((h,i)=>(
              <th key={i} style={{...th,textAlign:i<2?"left":"right"}}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {days.map((d,i)=>{
              const k=calcKPIs([d]);
              return (
                <tr key={i} style={{background:i%2===0?"transparent":"#ffffff04"}}>
                  <td style={{...td(),textAlign:"left",color:C.muted}}>{d.day}/{month+1}/{YEAR}</td>
                  <td style={{...td(),textAlign:"left",fontSize:11,color:C.muted}}>{d.weekday?.slice(0,3)}</td>
                  <td style={td()}>{d.anuncios>0?fmt(d.anuncios):<span style={{color:C.border}}>-</span>}</td>
                  <td style={td()}>{d.leads>0?d.leads:<span style={{color:C.border}}>-</span>}</td>
                  <td style={td()}>{d.faturamento>0?fmt(d.faturamento):<span style={{color:C.border}}>-</span>}</td>
                  <td style={td()}>{d.pedidos>0?d.pedidos:<span style={{color:C.border}}>-</span>}</td>
                  <td style={td()}>{d.pedidos>0?fmt(k.cpVenda):<span style={{color:C.border}}>-</span>}</td>
                  <td style={td()}>{d.pedidos>0?fmt(k.ticketMedio):<span style={{color:C.border}}>-</span>}</td>
                  <td style={td()}>{d.leads>0?fmtPct(k.txConversao):<span style={{color:C.border}}>-</span>}</td>
                  <td style={td()}>{d.leads>0?fmt(k.custoLead):<span style={{color:C.border}}>-</span>}</td>
                  <td style={td()}>{d.custo_produtos>0?fmt(d.custo_produtos):<span style={{color:C.border}}>-</span>}</td>
                  <td style={td()}>{d.custo_frete_correios>0?fmt(d.custo_frete_correios):<span style={{color:C.border}}>-</span>}</td>
                  <td style={td()}>{d.custo_frete_motoboy>0?fmt(d.custo_frete_motoboy):<span style={{color:C.border}}>-</span>}</td>
                  <td style={{...td(),color:d.faturamento>0?(k.lucro>=0?C.green:C.red):C.border}}>{d.faturamento>0?fmt(k.lucro):"-"}</td>
                  <td style={{...td(),color:d.faturamento>0?(k.roas>=1?C.green:C.red):C.border}}>{d.faturamento>0?fmtROAS(k.roas):"-"}</td>
                </tr>
              );
            })}
            <tr style={{background:C.card2,fontWeight:700}}>
              <td colSpan={2} style={{...td(),textAlign:"left",color:C.text,fontWeight:700}}>TOTAL MÊS</td>
              <td style={{...td(),color:C.accent}}>{fmt(total.anuncios)}</td><td style={td()}>{total.leads}</td>
              <td style={{...td(),color:C.green}}>{fmt(total.faturamento)}</td><td style={td()}>{total.pedidos}</td>
              <td style={td()}>{fmt(total.cpVenda)}</td><td style={td()}>{fmt(total.ticketMedio)}</td>
              <td style={td()}>{fmtPct(total.txConversao)}</td><td style={td()}>{fmt(total.custoLead)}</td>
              <td style={td()}>{fmt(total.custoProdutos)}</td><td style={td()}>{fmt(total.custoFreteCorreios)}</td>
              <td style={td()}>{fmt(total.custoFreteMotoboy)}</td>
              <td style={{...td(),color:total.lucro>=0?C.green:C.red,fontWeight:700}}>{fmt(total.lucro)}</td>
              <td style={{...td(),color:total.roas>=1?C.green:C.red,fontWeight:700}}>{fmtROAS(total.roas)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── DRE ─────────────────────────────────────────────────────────────────────
function DreMensal({data,month,setMonth,custosFixos,taxasAdquirente}){
  const kpi=calcKPIs(data[month]||[]);
  const totalCustosFixos=(custosFixos||[]).filter(c=>c.mes===month).reduce((s,c)=>s+(c.valor||0),0);
  const totalTaxasOnline=(taxasAdquirente||[]).filter(t=>t.canal==="online").reduce((s,t)=>s+(kpi.faturamento*(t.taxa/100)||0),0);
  const totalTaxasFisica=(taxasAdquirente||[]).filter(t=>t.canal==="fisica").reduce((s,t)=>s+(kpi.faturamento*(t.taxa/100)||0),0);
  const totalTaxas=totalTaxasOnline+totalTaxasFisica;
  const lucroReal=kpi.lucro-totalCustosFixos-totalTaxas;

  const rows=[
    {label:"Faturamento Bruto",value:kpi.faturamento,bold:true,color:C.green},
    {label:"(-) Custo dos Produtos",value:-kpi.custoProdutos,indent:true},
    {label:"(-) Frete Correios",value:-kpi.custoFreteCorreios,indent:true},
    {label:"(-) Frete Motoboy",value:-kpi.custoFreteMotoboy,indent:true},
    {label:"Margem Bruta",value:kpi.faturamento-kpi.custoProdutos-kpi.totalFrete,bold:true,sep:true},
    {label:"(-) Gastos com Anúncios",value:-kpi.anuncios,indent:true},
    {label:"LUCRO OPERACIONAL",value:kpi.lucro,bold:true,large:true,color:kpi.lucro>=0?C.green:C.red,sep:true},
    {sep:true,divider:true},
    {label:"(-) Taxas adquirente online",value:-totalTaxasOnline,indent:true},
    {label:"(-) Taxas adquirente físico",value:-totalTaxasFisica,indent:true},
    {label:"(-) Custos fixos do mês",value:-totalCustosFixos,indent:true},
    {label:"LUCRO LÍQUIDO REAL",value:lucroReal,bold:true,large:true,color:lucroReal>=0?C.green:C.red,sep:true},
    {sep:true,divider:true},
    {label:"ROAS",raw:fmtROAS(kpi.roas),bold:true},
    {label:"Margem Líquida",raw:kpi.faturamento>0?`${((kpi.lucro/kpi.faturamento)*100).toFixed(1)}%`:"-"},
    {label:"CP Venda",raw:fmt(kpi.cpVenda)},{label:"Ticket Médio",raw:fmt(kpi.ticketMedio)},
    {label:"Taxa de Conversão",raw:fmtPct(kpi.txConversao)},{label:"Custo por Lead",raw:fmt(kpi.custoLead)},
  ];
  return (
    <div>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:4,flexWrap:"wrap"}}>
        <SectionTitle style={{margin:0}}>DRE Mensal</SectionTitle>
        <select value={month} onChange={e=>setMonth(+e.target.value)} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:"7px 12px",color:C.text,cursor:"pointer",fontSize:13}}>
          {MONTHS.map((m,i)=><option key={i} value={i}>{m} {YEAR}</option>)}
        </select>
      </div>
      {totalTaxas>0&&<div style={{background:`${C.yellow}18`,border:`1px solid ${C.yellow}44`,borderRadius:8,padding:"8px 14px",marginBottom:12,fontSize:12,color:C.yellow}}>⚡ Taxas de adquirente incluídas no DRE — online: {fmt(totalTaxasOnline)} · físico: {fmt(totalTaxasFisica)}</div>}
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:24,maxWidth:520,marginTop:12}}>
        {rows.map((r,i)=>r.divider?<div key={i} style={{height:12}}/> : (
          <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:r.sep?"12px 0":"8px 0",borderTop:r.sep&&!r.divider?`1px solid ${C.border}`:"none"}}>
            <span style={{color:r.bold?C.text:C.muted,fontSize:r.large?16:14,fontWeight:r.bold?700:400,paddingLeft:r.indent?16:0}}>{r.label}</span>
            <span style={{color:r.color||(r.raw?C.text:(typeof r.value==="number"&&r.value<0?C.red:C.text)),fontSize:r.large?20:14,fontWeight:r.bold?700:500}}>{r.raw||fmt(r.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── GRÁFICOS ────────────────────────────────────────────────────────────────
function Graficos({data}){
  const monthly=MONTHS.map((m,mi)=>{ const k=calcKPIs(data[mi]||[]); return{name:m.slice(0,3),faturamento:k.faturamento,lucro:k.lucro,anuncios:k.anuncios,roas:k.roas!=null?+k.roas.toFixed(2):0,cpVenda:k.cpVenda||0,ticketMedio:k.ticketMedio||0}; });
  const tt={contentStyle:{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,color:C.text}};
  const card=(title,chart)=>(
    <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:20,marginBottom:20}}>
      <div style={{color:C.text,fontWeight:600,fontSize:15,marginBottom:16}}>{title}</div>{chart}
    </div>
  );
  return (
    <div>
      <SectionTitle>Gráficos e Tendências — {YEAR}</SectionTitle>
      {card("Faturamento · Lucro · Anúncios por Mês",
        <ResponsiveContainer width="100%" height={240}><BarChart data={monthly}>
          <CartesianGrid strokeDasharray="3 3" stroke={C.border}/><XAxis dataKey="name" tick={{fill:C.muted,fontSize:11}}/><YAxis tick={{fill:C.muted,fontSize:11}}/>
          <Tooltip {...tt} formatter={v=>fmt(v)}/><Legend wrapperStyle={{color:C.muted,fontSize:12}}/>
          <Bar dataKey="faturamento" name="Faturamento" fill={C.accent} radius={[4,4,0,0]}/><Bar dataKey="lucro" name="Lucro" fill={C.green} radius={[4,4,0,0]}/><Bar dataKey="anuncios" name="Anúncios" fill={C.yellow} radius={[4,4,0,0]}/>
        </BarChart></ResponsiveContainer>
      )}
      {card("ROAS Mensal",
        <ResponsiveContainer width="100%" height={200}><LineChart data={monthly}>
          <CartesianGrid strokeDasharray="3 3" stroke={C.border}/><XAxis dataKey="name" tick={{fill:C.muted,fontSize:11}}/><YAxis tick={{fill:C.muted,fontSize:11}} unit="x"/>
          <Tooltip {...tt} formatter={v=>`${v}x`}/><Line type="monotone" dataKey="roas" name="ROAS" stroke={C.accent} strokeWidth={2} dot={{fill:C.accent,r:4}}/>
        </LineChart></ResponsiveContainer>
      )}
      {card("Ticket Médio vs CP Venda",
        <ResponsiveContainer width="100%" height={200}><LineChart data={monthly}>
          <CartesianGrid strokeDasharray="3 3" stroke={C.border}/><XAxis dataKey="name" tick={{fill:C.muted,fontSize:11}}/><YAxis tick={{fill:C.muted,fontSize:11}}/>
          <Tooltip {...tt} formatter={v=>fmt(v)}/><Legend wrapperStyle={{color:C.muted,fontSize:12}}/>
          <Line type="monotone" dataKey="ticketMedio" name="Ticket Médio" stroke={C.cyan} strokeWidth={2} dot={false}/>
          <Line type="monotone" dataKey="cpVenda" name="CP Venda" stroke={C.yellow} strokeWidth={2} dot={false}/>
        </LineChart></ResponsiveContainer>
      )}
    </div>
  );
}

// ─── FINANCEIRO (Admin only) ──────────────────────────────────────────────────
function Financeiro({custosFixos,setCustosFixos,taxasAdquirente,setTaxasAdquirente,month,setMonth,data}){
  const [abaCusto,setAbaCusto]=useState("custos"); // "custos" | "taxas"
  const [formCusto,setFormCusto]=useState({descricao:"",valor:"",categoria:"outros",mes:month,recorrente:false});
  const [formTaxa,setFormTaxa]=useState({adquirente:"",taxa:"",canal:"online"});
  const [saving,setSaving]=useState(false);

  const kpi=calcKPIs(data[month]||[]);
  const custosMes=(custosFixos||[]).filter(c=>c.mes===month);
  const totalCustosMes=custosMes.reduce((s,c)=>s+(c.valor||0),0);
  const totalTaxas=(taxasAdquirente||[]).reduce((s,t)=>s+(kpi.faturamento*(t.taxa/100)||0),0);
  const caixaReal=kpi.lucro-totalCustosMes-totalTaxas;

  const categorias=["pro_labore","salarios","cartao_empresa","transportadora","aluguel","energia","outros"];
  const catLabel={pro_labore:"Pró-labore",salarios:"Salários",cartao_empresa:"Cartão empresarial",transportadora:"Transportadora",aluguel:"Aluguel",energia:"Energia/Internet",outros:"Outros"};

  async function addCusto(e){
    e.preventDefault(); setSaving(true);
    const novo={...formCusto,valor:+formCusto.valor||0,mes:month,id:Date.now()};
    setCustosFixos(prev=>[...(prev||[]),novo]);
    // Salvar no Supabase
    await supabase.from("custos_fixos").insert([{...novo,year:YEAR}]);
    setFormCusto({descricao:"",valor:"",categoria:"outros",mes:month,recorrente:false});
    setSaving(false);
  }

  async function removeCusto(id){
    setCustosFixos(prev=>(prev||[]).filter(c=>c.id!==id));
    await supabase.from("custos_fixos").delete().eq("id",id);
  }

  async function addTaxa(e){
    e.preventDefault(); setSaving(true);
    const nova={...formTaxa,taxa:+formTaxa.taxa||0,id:Date.now()};
    setTaxasAdquirente(prev=>[...(prev||[]),nova]);
    await supabase.from("taxas_adquirente").insert([nova]);
    setFormTaxa({adquirente:"",taxa:"",canal:"online"});
    setSaving(false);
  }

  async function removeTaxa(id){
    setTaxasAdquirente(prev=>(prev||[]).filter(t=>t.id!==id));
    await supabase.from("taxas_adquirente").delete().eq("id",id);
  }

  const fi={background:"#252836",border:`1px solid ${C.border}`,borderRadius:8,padding:"9px 12px",color:C.text,fontSize:13,width:"100%",outline:"none",boxSizing:"border-box"};

  return (
    <div>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20,flexWrap:"wrap"}}>
        <SectionTitle style={{margin:0}}>💼 Financeiro</SectionTitle>
        <select value={month} onChange={e=>setMonth(+e.target.value)} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:"7px 12px",color:C.text,cursor:"pointer",fontSize:13}}>
          {MONTHS.map((m,i)=><option key={i} value={i}>{m} {YEAR}</option>)}
        </select>
      </div>

      {/* Resumo de caixa real */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))",gap:12,marginBottom:24}}>
        <KpiCard icon={TrendingUp} label="Lucro operacional" value={fmt(kpi.lucro)} color={kpi.lucro>=0?C.green:C.red}/>
        <KpiCard icon={CreditCard} label="Custos fixos do mês" value={fmt(totalCustosMes)} color={C.yellow}/>
        <KpiCard icon={Building2} label="Taxas adquirente" value={fmt(totalTaxas)} color={C.purple}/>
        <KpiCard icon={Wallet} label="CAIXA REAL" value={fmt(caixaReal)} color={caixaReal>=0?C.green:C.red} sub="lucro − custos − taxas"/>
      </div>

      {/* Tabs */}
      <div style={{display:"flex",gap:8,marginBottom:20}}>
        {[["custos","💳 Custos Fixos"],["taxas","🏦 Taxas Adquirente"]].map(([id,label])=>(
          <button key={id} onClick={()=>setAbaCusto(id)} style={{padding:"8px 18px",borderRadius:9,border:`1px solid ${abaCusto===id?C.accent:C.border}`,background:abaCusto===id?`${C.accent}22`:"transparent",color:abaCusto===id?C.accentLight:C.muted,fontWeight:abaCusto===id?600:400,cursor:"pointer",fontSize:13}}>{label}</button>
        ))}
      </div>

      {abaCusto==="custos"&&(
        <div>
          {/* Formulário novo custo */}
          <form onSubmit={addCusto} style={{background:C.card,border:`1px solid ${C.accent}33`,borderRadius:12,padding:20,marginBottom:20}}>
            <div style={{color:C.text,fontWeight:600,fontSize:14,marginBottom:14}}>Adicionar custo</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))",gap:12,marginBottom:14}}>
              <div style={{gridColumn:"1/-1"}}><label style={{color:C.muted,fontSize:12,display:"block",marginBottom:4}}>Descrição</label><input value={formCusto.descricao} onChange={e=>setFormCusto(f=>({...f,descricao:e.target.value}))} style={fi} placeholder="Ex: Salário da Ana" required/></div>
              <div><label style={{color:C.muted,fontSize:12,display:"block",marginBottom:4}}>Valor (R$)</label><input type="number" min="0" step="0.01" value={formCusto.valor} onChange={e=>setFormCusto(f=>({...f,valor:e.target.value}))} style={fi} required/></div>
              <div><label style={{color:C.muted,fontSize:12,display:"block",marginBottom:4}}>Categoria</label>
                <select value={formCusto.categoria} onChange={e=>setFormCusto(f=>({...f,categoria:e.target.value}))} style={fi}>
                  {categorias.map(c=><option key={c} value={c}>{catLabel[c]}</option>)}
                </select>
              </div>
            </div>
            <button type="submit" disabled={saving} style={{background:C.accent,border:"none",borderRadius:8,padding:"9px 20px",color:"#fff",fontWeight:600,fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}>
              <PlusCircle size={14}/> Adicionar
            </button>
          </form>

          {/* Lista de custos */}
          <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden"}}>
            {custosMes.length===0?(
              <div style={{padding:32,textAlign:"center",color:C.muted,fontSize:13}}>Nenhum custo lançado para {MONTHS[month]}</div>
            ):(
              <>
                {custosMes.map((c,i)=>(
                  <div key={c.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 16px",borderBottom:i<custosMes.length-1?`1px solid ${C.border}22`:"none",background:i%2===0?"transparent":"#ffffff03"}}>
                    <div>
                      <div style={{color:C.text,fontSize:13,fontWeight:500}}>{c.descricao}</div>
                      <span style={{background:`${C.accent}22`,color:C.accentLight,borderRadius:5,padding:"1px 7px",fontSize:11}}>{catLabel[c.categoria]||c.categoria}</span>
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:12}}>
                      <span style={{color:C.red,fontWeight:700,fontSize:14}}>{fmt(c.valor)}</span>
                      <button onClick={()=>removeCusto(c.id)} style={{background:`${C.red}22`,border:"none",borderRadius:6,padding:"5px 6px",color:C.red,cursor:"pointer"}}><Trash2 size={12}/></button>
                    </div>
                  </div>
                ))}
                <div style={{padding:"10px 16px",background:C.card2,display:"flex",justifyContent:"space-between"}}>
                  <span style={{color:C.muted,fontSize:13}}>Total custos fixos</span>
                  <span style={{color:C.red,fontWeight:700}}>{fmt(totalCustosMes)}</span>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {abaCusto==="taxas"&&(
        <div>
          <form onSubmit={addTaxa} style={{background:C.card,border:`1px solid ${C.accent}33`,borderRadius:12,padding:20,marginBottom:20}}>
            <div style={{color:C.text,fontWeight:600,fontSize:14,marginBottom:14}}>Cadastrar taxa de adquirente</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))",gap:12,marginBottom:14}}>
              <div><label style={{color:C.muted,fontSize:12,display:"block",marginBottom:4}}>Adquirente</label><input value={formTaxa.adquirente} onChange={e=>setFormTaxa(f=>({...f,adquirente:e.target.value}))} style={fi} placeholder="Ex: Cielo, Stone, Nuvemshop" required/></div>
              <div><label style={{color:C.muted,fontSize:12,display:"block",marginBottom:4}}>Taxa (%)</label><input type="number" min="0" max="100" step="0.01" value={formTaxa.taxa} onChange={e=>setFormTaxa(f=>({...f,taxa:e.target.value}))} style={fi} placeholder="Ex: 2.5" required/></div>
              <div><label style={{color:C.muted,fontSize:12,display:"block",marginBottom:4}}>Canal</label>
                <select value={formTaxa.canal} onChange={e=>setFormTaxa(f=>({...f,canal:e.target.value}))} style={fi}>
                  <option value="online">🌐 Site (online)</option>
                  <option value="fisica">🏪 Loja física</option>
                </select>
              </div>
            </div>
            <button type="submit" style={{background:C.accent,border:"none",borderRadius:8,padding:"9px 20px",color:"#fff",fontWeight:600,fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}><PlusCircle size={14}/>Adicionar taxa</button>
          </form>

          <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden"}}>
            {(taxasAdquirente||[]).length===0?(
              <div style={{padding:32,textAlign:"center",color:C.muted,fontSize:13}}>Nenhuma taxa cadastrada</div>
            ):(taxasAdquirente||[]).map((t,i)=>(
              <div key={t.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 16px",borderBottom:i<(taxasAdquirente.length-1)?`1px solid ${C.border}22`:"none"}}>
                <div>
                  <span style={{color:C.text,fontWeight:600,fontSize:13}}>{t.adquirente}</span>
                  <span style={{marginLeft:8,background:t.canal==="online"?`${C.cyan}22`:`${C.green}22`,color:t.canal==="online"?C.cyan:C.green,borderRadius:5,padding:"1px 7px",fontSize:11}}>{t.canal==="online"?"🌐 Online":"🏪 Físico"}</span>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:12}}>
                  <span style={{color:C.yellow,fontWeight:700}}>{t.taxa}%</span>
                  <span style={{color:C.muted,fontSize:12}}>≈ {fmt(kpi.faturamento*(t.taxa/100))} neste mês</span>
                  <button onClick={()=>removeTaxa(t.id)} style={{background:`${C.red}22`,border:"none",borderRadius:6,padding:"5px 6px",color:C.red,cursor:"pointer"}}><Trash2 size={12}/></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── CUSTOS DE PRODUTOS ──────────────────────────────────────────────────────
function CustosProdutos(){
  const [products,setProducts]=useState([]); const [editId,setEditId]=useState(null);
  const [form,setForm]=useState({sku:"",nome:"",custo:"",categoria:"",estoque:""}); const [showForm,setShowForm]=useState(false);
  const [loading,setLoading]=useState(true); const [saving,setSaving]=useState(false);

  useEffect(()=>{loadProducts();},[]);
  async function loadProducts(){setLoading(true);const{data}=await supabase.from("products").select("*").order("nome");if(data)setProducts(data);setLoading(false);}
  async function handleSave(){
    if(!form.nome||!form.custo) return; setSaving(true);
    const payload={...form,custo:+form.custo,estoque:+form.estoque||0};
    if(editId) await supabase.from("products").update(payload).eq("id",editId);
    else await supabase.from("products").insert([payload]);
    await loadProducts(); setShowForm(false); setSaving(false);
  }
  async function handleDelete(id){await supabase.from("products").delete().eq("id",id);setProducts(ps=>ps.filter(p=>p.id!==id));}

  const fi={background:"#252836",border:`1px solid ${C.border}`,borderRadius:8,padding:"9px 12px",color:C.text,fontSize:13,width:"100%",outline:"none",boxSizing:"border-box"};
  return (
    <div>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16,flexWrap:"wrap"}}>
        <SectionTitle style={{margin:0}}>Custos de Produtos</SectionTitle>
        <button onClick={()=>{setForm({sku:"",nome:"",custo:"",categoria:"",estoque:""});setEditId(null);setShowForm(true);}} style={{display:"flex",alignItems:"center",gap:6,background:C.accent,border:"none",borderRadius:9,padding:"8px 16px",color:"#fff",fontWeight:600,fontSize:13,cursor:"pointer"}}><PlusCircle size={14}/>Novo Produto</button>
      </div>
      {showForm&&(
        <div style={{background:C.card,border:`1px solid ${C.accent}44`,borderRadius:12,padding:20,marginBottom:20}}>
          <div style={{color:C.text,fontWeight:600,fontSize:15,marginBottom:14}}>{editId?"Editar":"Novo Produto"}</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))",gap:12,marginBottom:14}}>
            {[["sku","SKU"],["nome","Nome"],["custo","Custo (R$)"],["categoria","Categoria"],["estoque","Estoque"]].map(([k,l])=>(
              <div key={k}><label style={{color:C.muted,fontSize:12,display:"block",marginBottom:4}}>{l}</label><input value={form[k]} onChange={e=>setForm(f=>({...f,[k]:e.target.value}))} style={fi}/></div>
            ))}
          </div>
          <div style={{display:"flex",gap:8}}>
            <button onClick={handleSave} disabled={saving} style={{background:C.accent,border:"none",borderRadius:8,padding:"9px 20px",color:"#fff",fontWeight:600,fontSize:13,cursor:"pointer"}}>{saving?"Salvando...":editId?"Salvar":"Adicionar"}</button>
            <button onClick={()=>setShowForm(false)} style={{background:"transparent",border:`1px solid ${C.border}`,borderRadius:8,padding:"9px 16px",color:C.muted,fontSize:13,cursor:"pointer"}}>Cancelar</button>
          </div>
        </div>
      )}
      {loading?<div style={{padding:40,textAlign:"center",color:C.muted}}><Loader size={24} style={{animation:"spin 1s linear infinite"}}/></div>:(
        <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead><tr style={{background:C.card2}}>{["SKU","Produto","Categoria","Custo Unit.","Estoque","Ações"].map((h,i)=><th key={i} style={{color:C.muted,fontSize:11,padding:"10px 14px",textAlign:i>=3?"right":"left",borderBottom:`1px solid ${C.border}`}}>{h}</th>)}</tr></thead>
            <tbody>
              {products.map((p,i)=>(
                <tr key={p.id} style={{background:i%2===0?"transparent":"#ffffff04"}}>
                  <td style={{padding:"10px 14px",fontSize:12,color:C.muted,fontFamily:"monospace"}}>{p.sku}</td>
                  <td style={{padding:"10px 14px",fontSize:13,color:C.text,fontWeight:500}}>{p.nome}</td>
                  <td style={{padding:"10px 14px"}}><span style={{background:`${C.accent}22`,color:C.accentLight,borderRadius:5,padding:"2px 8px",fontSize:11}}>{p.categoria}</span></td>
                  <td style={{padding:"10px 14px",fontSize:13,textAlign:"right",color:C.green,fontWeight:600}}>{fmt(p.custo)}</td>
                  <td style={{padding:"10px 14px",fontSize:13,textAlign:"right"}}>{p.estoque}</td>
                  <td style={{padding:"10px 14px",textAlign:"right"}}>
                    <button onClick={()=>{setForm({sku:p.sku,nome:p.nome,custo:p.custo,categoria:p.categoria||"",estoque:p.estoque||""});setEditId(p.id);setShowForm(true);}} style={{background:`${C.accent}22`,border:"none",borderRadius:6,padding:"5px 10px",color:C.accentLight,fontSize:12,cursor:"pointer",marginRight:6}}>Editar</button>
                    <button onClick={()=>handleDelete(p.id)} style={{background:`${C.red}22`,border:"none",borderRadius:6,padding:"5px 10px",color:C.red,fontSize:12,cursor:"pointer"}}>Excluir</button>
                  </td>
                </tr>
              ))}
              {products.length===0&&<tr><td colSpan={6} style={{padding:32,textAlign:"center",color:C.muted}}>Nenhum produto cadastrado</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── PÓS-VENDA ───────────────────────────────────────────────────────────────
const STEP_LABELS=["Produto","Motivo","Resolução","Fornecedor","Fretes","Resumo"];
function PosVenda({posVendaList,onAdd,onDelete,products}){
  const empty={produto_id:"",motivo:"",resolucao_cliente:"",fornecedor_troca:"",destino_produto:"",frete_reverso:"",frete_reenvio:"",data:toYMD(new Date())};
  const [step,setStep]=useState(0); const [form,setForm]=useState(empty); const [showForm,setShowForm]=useState(false); const [saved,setSaved]=useState(false); const [saving,setSaving]=useState(false);
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  const produto=products.find(p=>p.id===+form.produto_id);
  function calcPrej(f){
    const frev=parseFloat(f.frete_reverso)||0; const fren=parseFloat(f.frete_reenvio)||0;
    const cp=products.find(p=>p.id===+f.produto_id)?.custo||0;
    let total=frev+fren;
    if(f.fornecedor_troca==="nao"&&f.destino_produto==="descarte") total+=cp;
    return{frev,fren,custoProd:f.fornecedor_troca==="nao"&&f.destino_produto==="descarte"?cp:0,total};
  }
  const prej=calcPrej(form); const needsReenvio=form.resolucao_cliente==="reenvio"; const needsDestino=form.fornecedor_troca==="nao";
  function canNext(){if(step===0)return!!form.produto_id;if(step===1)return form.motivo.trim().length>0;if(step===2)return!!form.resolucao_cliente;if(step===3)return!!form.fornecedor_troca&&(!needsDestino||!!form.destino_produto);return true;}
  async function handleSubmit(){setSaving(true);const p=calcPrej(form);await onAdd({...form,prejuizo_total:p.total,custo_produto:p.custoProd,frete_reverso_val:p.frev,frete_reenvio_val:p.fren});setForm(empty);setStep(0);setShowForm(false);setSaving(false);setSaved(true);setTimeout(()=>setSaved(false),2500);}
  const fi={background:"#252836",border:`1px solid ${C.border}`,borderRadius:8,padding:"10px 13px",color:C.text,fontSize:14,width:"100%",outline:"none",boxSizing:"border-box"};
  const optBtn=(val,cur,label,desc,fn)=><button key={val} onClick={()=>fn(val)} style={{display:"flex",flexDirection:"column",gap:4,padding:"14px 16px",borderRadius:10,border:`2px solid ${cur===val?C.accent:C.border}`,background:cur===val?`${C.accent}18`:"transparent",cursor:"pointer",textAlign:"left",flex:1,minWidth:140}}><span style={{color:cur===val?C.accentLight:C.text,fontWeight:600,fontSize:14}}>{label}</span>{desc&&<span style={{color:C.muted,fontSize:12}}>{desc}</span>}</button>;
  const stepBar=<div style={{display:"flex",alignItems:"center",gap:0,marginBottom:24}}>{STEP_LABELS.map((l,i)=><div key={i} style={{display:"flex",alignItems:"center",flex:i<STEP_LABELS.length-1?1:"none"}}><div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4}}><div style={{width:28,height:28,borderRadius:"50%",background:i<step?C.green:i===step?C.accent:C.border,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,color:i<=step?"#fff":C.muted}}>{i<step?<Check size={13}/>:i+1}</div><span style={{fontSize:10,color:i===step?C.text:C.muted,whiteSpace:"nowrap"}}>{l}</span></div>{i<STEP_LABELS.length-1&&<div style={{flex:1,height:2,background:i<step?C.green:C.border,margin:"0 4px",marginBottom:16}}/>}</div>)}</div>;
  const stepContent=()=>{
    if(step===0) return <div><div style={{color:C.text,fontWeight:600,fontSize:15,marginBottom:12}}>Qual produto teve troca/devolução?</div>{products.length===0?<div style={{color:C.muted,padding:20,textAlign:"center"}}>Nenhum produto cadastrado.</div>:<div style={{display:"flex",flexDirection:"column",gap:8}}>{products.map(p=><button key={p.id} onClick={()=>set("produto_id",p.id)} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 16px",borderRadius:10,border:`2px solid ${+form.produto_id===p.id?C.accent:C.border}`,background:+form.produto_id===p.id?`${C.accent}18`:"transparent",cursor:"pointer"}}><div style={{textAlign:"left"}}><div style={{color:C.text,fontWeight:600,fontSize:14}}>{p.nome}</div><div style={{color:C.muted,fontSize:12}}>SKU: {p.sku}</div></div><div style={{textAlign:"right"}}><div style={{color:C.red,fontWeight:700,fontSize:14}}>{fmt(p.custo)}</div><div style={{color:C.muted,fontSize:11}}>custo unit.</div></div></button>)}</div>}</div>;
    if(step===1) return <div><div style={{color:C.text,fontWeight:600,fontSize:15,marginBottom:12}}>Motivo da troca/devolução?</div><textarea value={form.motivo} onChange={e=>set("motivo",e.target.value)} style={{...fi,minHeight:100,resize:"vertical"}} placeholder="Ex: produto com defeito..."/></div>;
    if(step===2) return <div><div style={{color:C.text,fontWeight:600,fontSize:15,marginBottom:12}}>Como foi resolvido para o cliente?</div><div style={{display:"flex",gap:12,flexWrap:"wrap"}}>{optBtn("reenvio",form.resolucao_cliente,"📦 Reenvio","Novo produto enviado",v=>set("resolucao_cliente",v))}{optBtn("loja",form.resolucao_cliente,"🏪 Troca na loja","Cliente veio pessoalmente",v=>set("resolucao_cliente",v))}</div></div>;
    if(step===3) return <div><div style={{color:C.text,fontWeight:600,fontSize:15,marginBottom:12}}>O fornecedor vai trocar?</div><div style={{display:"flex",gap:12,flexWrap:"wrap",marginBottom:needsDestino?20:0}}>{optBtn("sim",form.fornecedor_troca,"✅ Sim","Fornecedor repõe",v=>set("fornecedor_troca",v))}{optBtn("nao",form.fornecedor_troca,"❌ Não","Prejuízo fica conosco",v=>{set("fornecedor_troca",v);set("destino_produto","");})}</div>{needsDestino&&<><div style={{color:C.text,fontWeight:600,fontSize:14,marginBottom:10}}>Destino do produto devolvido?</div><div style={{display:"flex",gap:12,flexWrap:"wrap"}}>{optBtn("descarte",form.destino_produto,"🗑️ Descarte","Produto com defeito",v=>set("destino_produto",v))}{optBtn("estoque",form.destino_produto,"🔄 Volta ao estoque","Troca de modelo",v=>set("destino_produto",v))}</div></>}</div>;
    if(step===4) return <div><div style={{color:C.text,fontWeight:600,fontSize:15,marginBottom:16}}>Custos de frete</div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}><div><label style={{color:C.muted,fontSize:12,display:"block",marginBottom:6}}>📮 Frete reverso (devolução)</label><input type="number" min="0" step="0.01" value={form.frete_reverso} onChange={e=>set("frete_reverso",e.target.value)} style={fi} placeholder="0,00"/></div>{needsReenvio&&<div><label style={{color:C.muted,fontSize:12,display:"block",marginBottom:6}}>🚚 Frete de reenvio</label><input type="number" min="0" step="0.01" value={form.frete_reenvio} onChange={e=>set("frete_reenvio",e.target.value)} style={fi} placeholder="0,00"/></div>}</div></div>;
    if(step===5){const rows=[...(prej.custoProd>0?[{label:`Produto (${produto?.nome})`,val:prej.custoProd,color:C.red}]:[]),...(prej.frev>0?[{label:"Frete reverso",val:prej.frev,color:C.yellow}]:[]),...(prej.fren>0?[{label:"Frete reenvio",val:prej.fren,color:C.yellow}]:[])];return <div><div style={{color:C.text,fontWeight:600,fontSize:15,marginBottom:16}}>Resumo</div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}><div style={{background:C.card2,borderRadius:10,padding:14}}><div style={{color:C.muted,fontSize:12,marginBottom:4}}>Produto</div><div style={{color:C.text,fontWeight:600}}>{produto?.nome}</div></div><div style={{background:C.card2,borderRadius:10,padding:14}}><div style={{color:C.muted,fontSize:12,marginBottom:4}}>Motivo</div><div style={{color:C.text,fontSize:13}}>{form.motivo}</div></div></div><div style={{background:"#2a1a1a",border:`1px solid ${C.red}33`,borderRadius:12,padding:16}}><div style={{color:C.muted,fontSize:12,marginBottom:8}}>Composição do prejuízo</div>{rows.length===0?<div style={{color:C.green,fontSize:14}}>✓ Sem prejuízo financeiro</div>:rows.map((r,i)=><div key={i} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:i<rows.length-1?`1px solid ${C.border}22`:"none"}}><span style={{color:C.muted,fontSize:13}}>{r.label}</span><span style={{color:r.color,fontWeight:600}}>{fmt(r.val)}</span></div>)}<div style={{display:"flex",justifyContent:"space-between",padding:"10px 0 0",borderTop:`1px solid ${C.border}`,marginTop:6}}><span style={{color:C.text,fontWeight:700}}>Total prejuízo</span><span style={{color:prej.total>0?C.red:C.green,fontWeight:700,fontSize:18}}>{fmt(prej.total)}</span></div></div></div>;}
  };
  const totalPrejMes=posVendaList.reduce((s,r)=>s+(r.prejuizo_total||0),0);
  return (
    <div>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16,flexWrap:"wrap"}}>
        <SectionTitle style={{margin:0}}>Pós-Venda</SectionTitle>
        <button onClick={()=>{setShowForm(true);setSaved(false);}} style={{display:"flex",alignItems:"center",gap:6,background:C.accent,border:"none",borderRadius:9,padding:"8px 16px",color:"#fff",fontWeight:600,fontSize:13,cursor:"pointer"}}><PlusCircle size={14}/>Registrar ocorrência</button>
        {saved&&<span style={{color:C.green,fontSize:13,display:"flex",alignItems:"center",gap:4}}><Check size={14}/>Registrado!</span>}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",gap:12,marginBottom:20}}>
        <KpiCard icon={TrendingDown} label="Prejuízo total" value={fmt(totalPrejMes)} color={C.red} sub={`${posVendaList.length} ocorrências`}/>
        <KpiCard icon={RefreshCw} label="Com reenvio" value={posVendaList.filter(r=>r.resolucao_cliente==="reenvio").length} color={C.yellow}/>
        <KpiCard icon={Package} label="Descartados" value={posVendaList.filter(r=>r.destino_produto==="descarte").length} color={C.red}/>
        <KpiCard icon={Check} label="Fornecedor trocou" value={posVendaList.filter(r=>r.fornecedor_troca==="sim").length} color={C.green}/>
      </div>
      {showForm&&(
        <div style={{background:C.card,border:`1px solid ${C.accent}44`,borderRadius:14,padding:24,marginBottom:24}}>
          {stepBar}
          <div style={{minHeight:220}}>{stepContent()}</div>
          <div style={{display:"flex",justifyContent:"space-between",marginTop:24,gap:8}}>
            <button onClick={()=>{setForm(empty);setStep(0);setShowForm(false);}} style={{background:"transparent",border:`1px solid ${C.border}`,borderRadius:8,padding:"9px 16px",color:C.muted,fontSize:13,cursor:"pointer"}}>Cancelar</button>
            <div style={{display:"flex",gap:8}}>
              {step>0&&<button onClick={()=>setStep(s=>s-1)} style={{background:C.card2,border:`1px solid ${C.border}`,borderRadius:8,padding:"9px 16px",color:C.text,fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}><ChevronLeft size={14}/>Voltar</button>}
              {step<5?<button onClick={()=>setStep(s=>s+1)} disabled={!canNext()} style={{background:canNext()?C.accent:C.border,border:"none",borderRadius:8,padding:"9px 20px",color:"#fff",fontWeight:600,fontSize:13,cursor:canNext()?"pointer":"not-allowed",display:"flex",alignItems:"center",gap:6}}>Próximo<ChevronRight size={14}/></button>:<button onClick={handleSubmit} disabled={saving} style={{background:C.red,border:"none",borderRadius:8,padding:"9px 24px",color:"#fff",fontWeight:700,fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}>{saving?<Loader size={14}/>:<Check size={14}/>}Registrar prejuízo</button>}
            </div>
          </div>
        </div>
      )}
      {posVendaList.length>0?(
        <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden"}}>
          {posVendaList.map((r,i)=>{const prod=products.find(p=>p.id===+r.produto_id);return(
            <div key={r.id} style={{display:"grid",gridTemplateColumns:"90px 1fr 100px 100px 80px 40px",gap:8,padding:"12px 16px",alignItems:"center",borderTop:i>0?`1px solid ${C.border}22`:"none",background:i%2===0?"transparent":"#ffffff03"}}>
              <div style={{color:C.muted,fontSize:12}}>{r.data}</div>
              <div><div style={{color:C.text,fontSize:13,fontWeight:500}}>{prod?.nome||"?"}</div><div style={{color:C.muted,fontSize:11}}>{r.motivo?.slice(0,40)}{r.motivo?.length>40?"…":""}</div></div>
              <span style={{background:`${C.yellow}22`,color:C.yellow,borderRadius:5,padding:"2px 8px",fontSize:11,textAlign:"center"}}>{r.resolucao_cliente==="reenvio"?"Reenvio":"Loja"}</span>
              <span style={{background:r.fornecedor_troca==="sim"?`${C.green}22`:`${C.red}22`,color:r.fornecedor_troca==="sim"?C.green:C.red,borderRadius:5,padding:"2px 8px",fontSize:11,textAlign:"center"}}>{r.fornecedor_troca==="sim"?"Trocou":"Não trocou"}</span>
              <div style={{color:r.prejuizo_total>0?C.red:C.green,fontWeight:700,fontSize:13,textAlign:"right"}}>{fmt(r.prejuizo_total)}</div>
              <button onClick={()=>onDelete(r.id)} style={{background:`${C.red}22`,border:"none",borderRadius:6,padding:"5px 6px",color:C.red,cursor:"pointer"}}><Trash2 size={12}/></button>
            </div>
          );})}
          <div style={{padding:"10px 16px",background:C.card2,display:"flex",justifyContent:"flex-end",gap:8,alignItems:"center"}}>
            <span style={{color:C.muted,fontSize:12}}>Total:</span><span style={{color:C.red,fontWeight:700,fontSize:16}}>{fmt(totalPrejMes)}</span>
          </div>
        </div>
      ):(!showForm&&<div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:48,textAlign:"center"}}><MessageSquare size={40} color={C.border} style={{margin:"0 auto 12px"}}/><div style={{color:C.muted,fontSize:14}}>Nenhuma ocorrência registrada</div></div>)}
    </div>
  );
}

// ─── INTEGRAÇÕES ─────────────────────────────────────────────────────────────
function Integracoes({onMetaData,onKommoData}){
  const fi={background:"#252836",border:`1px solid ${C.border}`,borderRadius:8,padding:"9px 12px",color:C.text,fontSize:13,width:"100%",outline:"none",boxSizing:"border-box"};
  const statusBadge=s=>({idle:{color:C.muted,bg:`${C.muted}22`,label:"Não conectado"},connecting:{color:C.yellow,bg:`${C.yellow}22`,label:"Conectando..."},connected:{color:C.green,bg:`${C.green}22`,label:"Conectado"},error:{color:C.red,bg:`${C.red}22`,label:"Erro"}}[s]);
  const IntCard=({title,icon:Icon,iconColor,status,children})=>{const s=statusBadge(status);return(<div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:24,marginBottom:20}}><div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}><div style={{display:"flex",alignItems:"center",gap:10}}><div style={{background:`${iconColor}22`,borderRadius:10,padding:10}}><Icon size={20} color={iconColor}/></div><span style={{color:C.text,fontWeight:700,fontSize:17}}>{title}</span></div><span style={{background:s.bg,color:s.color,borderRadius:20,padding:"4px 12px",fontSize:12,fontWeight:600}}>{s.label}</span></div>{children}</div>);};

  const [metaStatus,setMetaStatus]=useState("idle"); const [metaToken,setMetaToken]=useState(""); const [metaAccountId,setMetaAccountId]=useState(""); const [metaTax,setMetaTax]=useState((META_TAX*100).toFixed(2)); const [metaSyncing,setMetaSyncing]=useState(false); const [metaLog,setMetaLog]=useState([]);
  function handleMetaConnect(){if(!metaToken||!metaAccountId)return;setMetaStatus("connecting");setTimeout(()=>{const tax=parseFloat(metaTax)/100||META_TAX;const demo=Array.from({length:31},(_,i)=>{const d=new Date(2026,2,i+1);if(d.getMonth()!==2)return null;const spend=+(400+Math.random()*300).toFixed(2);return{date:toYMD(d),spendLiq:spend,spendTotal:+(spend*(1+tax)).toFixed(2),tax};}).filter(Boolean);setMetaStatus("connected");setMetaLog(["✓ Token validado","✓ Conta encontrada","✓ 31 dias importados","✓ Sync diário ativo — 08h"]);onMetaData&&onMetaData(demo);},2000);}

  const [kommoStatus,setKommoStatus]=useState("idle"); const [kommoCreds,setKommoCreds]=useState({subdomain:"",clientId:"",clientSecret:""}); const [kommoSyncing,setKommoSyncing]=useState(false); const [kommoLog,setKommoLog]=useState([]);
  function handleKommoConnect(){if(!kommoCreds.subdomain||!kommoCreds.clientId)return;setKommoStatus("connecting");setTimeout(()=>{const stats={totalLeads:247,byChannel:[{canal:"Instagram DM",leads:142,convertidos:38,cor:"#e1306c"},{canal:"WhatsApp",leads:105,convertidos:31,cor:C.green}],pipeline:[{etapa:"Novo",qtd:34},{etapa:"Em atendimento",qtd:28},{etapa:"Proposta",qtd:15},{etapa:"Fechado",qtd:69},{etapa:"Perdido",qtd:101}],tempoMedioResposta:8.4};setKommoStatus("connected");setKommoLog(["✓ OAuth2 autenticado","✓ 247 leads carregados","✓ Instagram DM + WhatsApp","✓ Sync a cada 30min"]);onKommoData&&onKommoData(stats);},2000);}

  const [blingStatus,setBlingStatus]=useState("idle"); const [blingCreds,setBlingCreds]=useState({clientId:"",secretId:""}); const [blingLog,setBlingLog]=useState([]);
  function handleBlingConnect(){if(!blingCreds.clientId||!blingCreds.secretId)return;setBlingStatus("connecting");setTimeout(()=>{setBlingStatus("connected");setBlingLog(["✓ OAuth2 estabelecido","✓ 312 pedidos importados","✓ 48 produtos sincronizados","ℹ️ Lançamentos vão do Bling → Dash (somente leitura)"]);},1800);}

  const [nuvemStatus,setNuvemStatus]=useState("idle"); const [nuvemToken,setNuvemToken]=useState(""); const [nuvemLog,setNuvemLog]=useState([]);
  function handleNuvemConnect(){if(!nuvemToken)return;setNuvemStatus("connecting");setTimeout(()=>{setNuvemStatus("connected");setNuvemLog(["✓ Token Nuvemshop validado","✓ 156 pedidos importados (últimos 30 dias)","✓ Faturamento sincronizado","✓ Sync automático diário ativo"]);},2000);}

  return (
    <div>
      <SectionTitle>Integrações</SectionTitle>
      <div style={{background:`${C.cyan}18`,border:`1px solid ${C.cyan}44`,borderRadius:10,padding:"10px 14px",marginBottom:20,fontSize:12,color:C.cyan}}>
        ℹ️ <b>Fluxo recomendado:</b> Nuvemshop/Bling → Dash (puxar dados). O lançamento manual no Dash não envia pedidos para o Bling para evitar duplicatas.
      </div>

      {/* META ADS */}
      <IntCard title="Meta Ads" icon={BarChart2} iconColor="#1877f2" status={metaStatus}>
        <div style={{background:"#1a1f2e",border:`1px solid ${C.border}`,borderRadius:8,padding:12,marginBottom:16,display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
          <AlertCircle size={14} color={C.yellow}/><span style={{color:C.muted,fontSize:12}}>Imposto Meta Brasil:</span>
          <div style={{display:"flex",alignItems:"center",gap:6}}><input type="number" step="0.01" min="0" max="100" value={metaTax} onChange={e=>setMetaTax(e.target.value)} style={{...fi,width:80,padding:"6px 10px"}}/><span style={{color:C.muted,fontSize:13}}>%</span></div>
          <span style={{color:C.yellow,fontSize:12}}>R$100 → R${(100*(1+parseFloat(metaTax)/100)).toFixed(2)}</span>
        </div>
        {metaStatus==="connected"?(
          <div>
            <div style={{display:"flex",gap:8,marginBottom:14}}>
              <button onClick={()=>{setMetaSyncing(true);setTimeout(()=>setMetaSyncing(false),1500);}} disabled={metaSyncing} style={{background:C.accent,border:"none",borderRadius:8,padding:"9px 18px",color:"#fff",fontWeight:600,fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}><Zap size={13}/>{metaSyncing?"Sincronizando...":"Sincronizar agora"}</button>
              <button onClick={()=>{setMetaStatus("idle");setMetaLog([]);onMetaData&&onMetaData([]);}} style={{background:"transparent",border:`1px solid ${C.border}`,borderRadius:8,padding:"9px 14px",color:C.muted,fontSize:13,cursor:"pointer"}}>Desconectar</button>
            </div>
            {metaLog.length>0&&<div style={{background:C.card2,borderRadius:8,padding:12,fontFamily:"monospace",fontSize:11}}>{metaLog.map((l,i)=><div key={i} style={{color:C.green,marginBottom:2}}>{l}</div>)}</div>}
          </div>
        ):(
          <div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}>
              <div style={{gridColumn:"1/-1"}}><label style={{color:C.muted,fontSize:12,display:"block",marginBottom:4}}>Access Token</label><input type="password" value={metaToken} onChange={e=>setMetaToken(e.target.value)} style={fi} placeholder="EAAxxxxxxx..."/></div>
              <div><label style={{color:C.muted,fontSize:12,display:"block",marginBottom:4}}>ID da conta de anúncios</label><input value={metaAccountId} onChange={e=>setMetaAccountId(e.target.value)} style={fi} placeholder="act_123456789"/></div>
            </div>
            <button onClick={handleMetaConnect} disabled={!metaToken||!metaAccountId} style={{background:metaToken&&metaAccountId?"#1877f2":C.border,border:"none",borderRadius:9,padding:"10px 22px",color:"#fff",fontWeight:700,fontSize:13,cursor:metaToken&&metaAccountId?"pointer":"not-allowed"}}>{metaStatus==="connecting"?"Conectando...":"Conectar ao Meta Ads"}</button>
          </div>
        )}
      </IntCard>

      {/* NUVEMSHOP */}
      <IntCard title="Nuvemshop" icon={ShoppingCart} iconColor={C.green} status={nuvemStatus}>
        <p style={{color:C.muted,fontSize:13,margin:"0 0 12px"}}>Puxa pedidos e faturamento direto da sua loja Nuvemshop, sincronizando automaticamente com o dashboard.</p>
        {nuvemStatus==="connected"?(
          <div>
            <div style={{display:"flex",gap:8,marginBottom:12}}>
              <button style={{background:C.accent,border:"none",borderRadius:8,padding:"9px 18px",color:"#fff",fontWeight:600,fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}><Zap size={13}/>Sincronizar agora</button>
              <button onClick={()=>{setNuvemStatus("idle");setNuvemLog([]);}} style={{background:"transparent",border:`1px solid ${C.border}`,borderRadius:8,padding:"9px 14px",color:C.muted,fontSize:13,cursor:"pointer"}}>Desconectar</button>
            </div>
            {nuvemLog.length>0&&<div style={{background:C.card2,borderRadius:8,padding:10,fontFamily:"monospace",fontSize:11}}>{nuvemLog.map((l,i)=><div key={i} style={{color:C.green,marginBottom:2}}>{l}</div>)}</div>}
          </div>
        ):(
          <div>
            <div style={{background:"#1a2030",borderRadius:8,padding:12,marginBottom:14,fontSize:12,color:C.muted}}>
              <b style={{color:C.text}}>Como obter o token:</b><br/>1. Acesse sua loja Nuvemshop → Parceiros → Aplicativos<br/>2. Crie um app privado e copie o <b style={{color:C.text}}>Access Token</b><br/>3. Cole abaixo
            </div>
            <div style={{marginBottom:14}}><label style={{color:C.muted,fontSize:12,display:"block",marginBottom:4}}>Access Token Nuvemshop</label><input type="password" value={nuvemToken} onChange={e=>setNuvemToken(e.target.value)} style={fi} placeholder="seu_token_nuvemshop"/></div>
            <button onClick={handleNuvemConnect} disabled={!nuvemToken} style={{background:nuvemToken?C.green:C.border,border:"none",borderRadius:9,padding:"10px 22px",color:nuvemToken?"#0f1117":"#fff",fontWeight:700,fontSize:13,cursor:nuvemToken?"pointer":"not-allowed"}}>{nuvemStatus==="connecting"?"Conectando...":"Conectar Nuvemshop"}</button>
          </div>
        )}
      </IntCard>

      {/* KOMMO */}
      <IntCard title="Kommo CRM" icon={Users} iconColor="#ff6b6b" status={kommoStatus}>
        {kommoStatus==="connected"?(
          <div>
            <div style={{display:"flex",gap:8,marginBottom:12}}>
              <button onClick={()=>{setKommoSyncing(true);setTimeout(()=>setKommoSyncing(false),1400);}} style={{background:C.accent,border:"none",borderRadius:8,padding:"9px 18px",color:"#fff",fontWeight:600,fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}><Zap size={13}/>{kommoSyncing?"Sincronizando...":"Sincronizar"}</button>
              <button onClick={()=>{setKommoStatus("idle");setKommoLog([]);onKommoData&&onKommoData(null);}} style={{background:"transparent",border:`1px solid ${C.border}`,borderRadius:8,padding:"9px 14px",color:C.muted,fontSize:13,cursor:"pointer"}}>Desconectar</button>
            </div>
            {kommoLog.length>0&&<div style={{background:C.card2,borderRadius:8,padding:10,fontFamily:"monospace",fontSize:11}}>{kommoLog.map((l,i)=><div key={i} style={{color:C.green,marginBottom:2}}>{l}</div>)}</div>}
          </div>
        ):(
          <div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}>
              <div style={{gridColumn:"1/-1"}}><label style={{color:C.muted,fontSize:12,display:"block",marginBottom:4}}>Subdomínio</label><input value={kommoCreds.subdomain} onChange={e=>setKommoCreds(c=>({...c,subdomain:e.target.value}))} style={fi} placeholder="seusubdominio"/></div>
              <div><label style={{color:C.muted,fontSize:12,display:"block",marginBottom:4}}>Client ID</label><input value={kommoCreds.clientId} onChange={e=>setKommoCreds(c=>({...c,clientId:e.target.value}))} style={fi}/></div>
              <div><label style={{color:C.muted,fontSize:12,display:"block",marginBottom:4}}>Client Secret</label><input type="password" value={kommoCreds.clientSecret} onChange={e=>setKommoCreds(c=>({...c,clientSecret:e.target.value}))} style={fi}/></div>
            </div>
            <button onClick={handleKommoConnect} disabled={!kommoCreds.subdomain||!kommoCreds.clientId} style={{background:kommoCreds.subdomain&&kommoCreds.clientId?"#ff6b6b":C.border,border:"none",borderRadius:9,padding:"10px 22px",color:"#fff",fontWeight:700,fontSize:13,cursor:kommoCreds.subdomain&&kommoCreds.clientId?"pointer":"not-allowed"}}>{kommoStatus==="connecting"?"Conectando...":"Conectar Kommo"}</button>
          </div>
        )}
      </IntCard>

      {/* BLING */}
      <IntCard title="Bling ERP" icon={Link2} iconColor={C.cyan} status={blingStatus}>
        {blingStatus==="connected"?(
          <div>
            <button onClick={()=>{setBlingStatus("idle");setBlingLog([]);}} style={{background:"transparent",border:`1px solid ${C.border}`,borderRadius:8,padding:"9px 14px",color:C.muted,fontSize:13,cursor:"pointer",marginBottom:10}}>Desconectar</button>
            {blingLog.length>0&&<div style={{background:C.card2,borderRadius:8,padding:12,fontFamily:"monospace",fontSize:11}}>{blingLog.map((l,i)=><div key={i} style={{color:l.startsWith("ℹ️")?C.cyan:C.green,marginBottom:3}}>{l}</div>)}</div>}
          </div>
        ):(
          <div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}>
              <div><label style={{color:C.muted,fontSize:12,display:"block",marginBottom:4}}>Client ID</label><input value={blingCreds.clientId} onChange={e=>setBlingCreds(c=>({...c,clientId:e.target.value}))} style={fi}/></div>
              <div><label style={{color:C.muted,fontSize:12,display:"block",marginBottom:4}}>Secret ID</label><input type="password" value={blingCreds.secretId} onChange={e=>setBlingCreds(c=>({...c,secretId:e.target.value}))} style={fi}/></div>
            </div>
            <button onClick={handleBlingConnect} style={{background:C.cyan,border:"none",borderRadius:9,padding:"10px 22px",color:"#0f1117",fontWeight:700,fontSize:13,cursor:"pointer"}}>{blingStatus==="connecting"?"Conectando...":"Conectar Bling"}</button>
          </div>
        )}
      </IntCard>
    </div>
  );
}

// ─── STORIESBOT ───────────────────────────────────────────────────────────────
const SB_URL = "https://storiebot.onrender.com";
const SB_DAYS = [
  {id:0,label:"DOM"},{id:1,label:"SEG"},{id:2,label:"TER"},
  {id:3,label:"QUA"},{id:4,label:"QUI"},{id:5,label:"SEX"},{id:6,label:"SÁB"}
];
const SB_TABS = [
  {id:"stories", label:"📸 Stories", color:"#e1306c"},
  {id:"feed",    label:"🖼 Feed & Reels", color:"#405de6"},
];
const SB_STATUS_COLOR = {pending:C.yellow, posted:C.green, failed:C.red, processing:C.cyan, scheduled:C.accent};
const SB_TYPE_ICONS = {story:"📸",image:"🖼",video:"🎬",reel:"🎭",carousel:"🎠"};

const SB_TYPE_TAG = {
  story:    {label:"Story",     bg:"#e1306c22", color:"#e1306c"},
  image:    {label:"Feed",      bg:"#405de622", color:"#405de6"},
  video:    {label:"Vídeo",     bg:"#06b6d422", color:"#06b6d4"},
  reel:     {label:"Reel",      bg:"#833ab422", color:"#c084fc"},
  carousel: {label:"Carrossel", bg:"#f59e0b22", color:"#f59e0b"},
};

function SbCard({item, onPostNow, onDelete}){
  const sc = SB_STATUS_COLOR[item.status] || C.muted;
  const typeTag = SB_TYPE_TAG[item.media_type] || {label:item.media_type||"Post", bg:C.border+"33", color:C.muted};
  return (
    <div style={{background:C.card2,border:`1px solid ${C.border}`,borderRadius:10,padding:"10px 12px",marginBottom:8,cursor:"default"}}>
      {/* Thumbnail */}
      {item.media_url && (
        <img src={item.media_url} alt="" onError={e=>{e.target.style.display="none";}}
          style={{width:"100%",height:78,objectFit:"cover",borderRadius:7,marginBottom:8,border:`1px solid ${C.border}`}}/>
      )}
      {/* Type tag + name */}
      <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:4}}>
        <span style={{background:typeTag.bg,color:typeTag.color,borderRadius:5,padding:"2px 7px",fontSize:10,fontWeight:700,flexShrink:0}}>
          {SB_TYPE_ICONS[item.media_type]||"📌"} {typeTag.label}
        </span>
        <span style={{color:C.text,fontWeight:600,fontSize:12,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
          {item.name || ""}
        </span>
      </div>
      {item.scheduled_time && (
        <div style={{color:C.muted,fontSize:11,marginBottom:4}}>🕐 {item.scheduled_time}</div>
      )}
      {item.caption && (
        <div style={{color:C.muted,fontSize:11,marginBottom:5,display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>
          💬 {item.caption}
        </div>
      )}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginTop:6}}>
        <span style={{background:`${sc}22`,color:sc,borderRadius:5,padding:"2px 7px",fontSize:10,fontWeight:700}}>
          {item.status||"pending"}
        </span>
        <div style={{display:"flex",gap:5}}>
          {item.status==="pending"&&(
            <button onClick={()=>onPostNow(item.id)}
              style={{background:`${C.green}22`,color:C.green,border:"none",borderRadius:6,padding:"4px 8px",fontSize:11,cursor:"pointer",fontWeight:700}}>
              ▶
            </button>
          )}
          <button onClick={()=>onDelete(item.id)}
            style={{background:`${C.red}15`,color:C.red,border:"none",borderRadius:6,padding:"4px 7px",cursor:"pointer"}}>
            <Trash2 size={11}/>
          </button>
        </div>
      </div>
    </div>
  );
}

function SbKanban({items, onPostNow, onDelete, onAddInDay}){
  const today = new Date().getDay();
  return (
    <div style={{display:"grid",gridTemplateColumns:"repeat(7,minmax(120px,1fr))",gap:8,overflowX:"auto",paddingBottom:8}}>
      {SB_DAYS.map(({id,label})=>{
        const dayItems = items.filter(it=>it.day_of_week===id);
        const isToday = id===today;
        return (
          <div key={id} style={{
            background: isToday ? `${C.accent}11` : C.card,
            border:`1px solid ${isToday?C.accent:C.border}`,
            borderRadius:10,padding:"10px 8px",minHeight:180,
          }}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
              <span style={{color:isToday?C.accent:C.muted,fontWeight:700,fontSize:12,letterSpacing:"0.05em"}}>
                {label}{isToday&&" ●"}
              </span>
              <div style={{display:"flex",alignItems:"center",gap:4}}>
                <span style={{background:C.border,color:C.muted,borderRadius:99,width:18,height:18,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700}}>
                  {dayItems.length}
                </span>
                <button onClick={()=>onAddInDay(id)}
                  style={{background:"transparent",border:"none",color:C.muted,cursor:"pointer",padding:0,display:"flex",alignItems:"center"}}
                  title="Adicionar">
                  <PlusCircle size={14}/>
                </button>
              </div>
            </div>
            {dayItems.length===0 ? (
              <div style={{textAlign:"center",color:C.border,padding:"20px 0",fontSize:11}}>
                <MessageSquare size={20} style={{opacity:0.3,display:"block",margin:"0 auto 6px"}}/>
                Vazio
              </div>
            ) : (
              dayItems.map(item=>(
                <SbCard key={item.id} item={item} onPostNow={onPostNow} onDelete={onDelete}/>
              ))
            )}
          </div>
        );
      })}
    </div>
  );
}

function StoriesBot() {
  const [sbToken, setSbToken] = useState(null);
  const [sbEmail, setSbEmail] = useState("");
  const [sbPass, setSbPass] = useState("");
  const [sbLoginErr, setSbLoginErr] = useState("");
  const [sbLoading, setSbLoading] = useState(false);

  // 2 tabs
  const [sbTab, setSbTab] = useState("stories");

  // Data
  const [stories, setStories] = useState([]);
  const [feedItems, setFeedItems] = useState([]); // feed + reels + carousel combined
  const [dataLoading, setDataLoading] = useState(false);

  // Form
  const [showForm, setShowForm] = useState(false);
  const [formPresetDay, setFormPresetDay] = useState(null);
  const [formType, setFormType] = useState("story");
  const [formMediaUrl, setFormMediaUrl] = useState("");
  const [formMediaUrls, setFormMediaUrls] = useState(["",""]); // array of up to 20 URLs
  const [formCaption, setFormCaption] = useState("");
  const [formName, setFormName] = useState("");
  const [formDay, setFormDay] = useState("1");
  const [formTime, setFormTime] = useState("09:00");
  const [formLoading, setFormLoading] = useState(false);
  const [formErr, setFormErr] = useState("");

  // Scheduler
  const [schedulerOn, setSchedulerOn] = useState(true);

  const sbHeaders = (tok) => ({
    "Content-Type": "application/json",
    "Authorization": `Bearer ${tok || sbToken}`,
  });

  async function sbLogin() {
    setSbLoading(true); setSbLoginErr("");
    try {
      const r = await fetch(`${SB_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: sbEmail, password: sbPass }),
      });
      const d = await r.json();
      if (!r.ok) { setSbLoginErr(d.detail || "Erro no login"); setSbLoading(false); return; }
      setSbToken(d.access_token);
      loadAll(d.access_token);
    } catch(e) { setSbLoginErr("Erro de conexão"); }
    setSbLoading(false);
  }

  async function loadAll(tok) {
    setDataLoading(true);
    try {
      const [rs, rf] = await Promise.all([
        fetch(`${SB_URL}/stories`, { headers: sbHeaders(tok||sbToken) }),
        fetch(`${SB_URL}/feed`,    { headers: sbHeaders(tok||sbToken) }),
      ]);
      const [ds, df] = await Promise.all([rs.json(), rf.json()]);
      setStories(Array.isArray(ds) ? ds : []);
      setFeedItems(Array.isArray(df) ? df : []); // all feed types: image/video/reel/carousel
    } catch(e) {}
    setDataLoading(false);
    // also load scheduler
    try {
      const r = await fetch(`${SB_URL}/scheduler/status`, { headers: sbHeaders(tok||sbToken) });
      const d = await r.json();
      setSchedulerOn(d.enabled ?? true);
    } catch(e) {}
  }

  async function toggleScheduler() {
    try {
      const r = await fetch(`${SB_URL}/scheduler/toggle`, { method:"POST", headers:sbHeaders() });
      const d = await r.json();
      setSchedulerOn(d.enabled ?? !schedulerOn);
    } catch(e) {}
  }

  async function handlePostNow(id) {
    if(sbTab==="stories"){
      await fetch(`${SB_URL}/stories/post-now`, { method:"POST", headers:sbHeaders(), body:JSON.stringify({story_id:id}) });
    } else {
      await fetch(`${SB_URL}/feed/${id}/post-now`, { method:"POST", headers:sbHeaders() });
    }
    loadAll();
  }

  async function handleDelete(id) {
    if(sbTab==="stories"){
      await fetch(`${SB_URL}/stories/${id}`, { method:"DELETE", headers:sbHeaders() });
    } else {
      await fetch(`${SB_URL}/feed/${id}`, { method:"DELETE", headers:sbHeaders() });
    }
    loadAll();
  }

  function openFormForDay(dayId) {
    setFormPresetDay(dayId);
    setFormDay(String(dayId));
    setFormType(sbTab==="stories" ? "story" : "image");
    setFormErr(""); setFormMediaUrl(""); setFormMediaUrls(["",""]); setFormCaption(""); setFormName(""); setFormTime("09:00");
    setShowForm(true);
  }

  function openFormGeneral() {
    setFormPresetDay(null);
    setFormType(sbTab==="stories" ? "story" : "image");
    setFormErr(""); setFormMediaUrl(""); setFormMediaUrls(["",""]); setFormCaption(""); setFormName(""); setFormDay("1"); setFormTime("09:00");
    setShowForm(true);
  }

  async function submitForm() {
    setFormLoading(true); setFormErr("");
    try {
      const isStory = formType==="story";
      const isCarousel = formType==="carousel";
      let body, url;
      if(isStory){
        url = `${SB_URL}/stories`;
        body = { media_url:formMediaUrl, day_of_week:parseInt(formDay), scheduled_time:formTime, name:formName||undefined, media_type:"story" };
      } else {
        url = `${SB_URL}/feed`;
        body = { media_type:formType, caption:formCaption||undefined, name:formName||undefined, scheduled_time:formTime, day_of_week:parseInt(formDay) };
        if(isCarousel) body.media_urls = formMediaUrls.map(s=>s.trim()).filter(Boolean);
        else body.media_url = formMediaUrl;
      }
      const r = await fetch(url, { method:"POST", headers:sbHeaders(), body:JSON.stringify(body) });
      const d = await r.json();
      if(!r.ok){ setFormErr(d.detail||"Erro ao criar"); setFormLoading(false); return; }
      setShowForm(false);
      loadAll();
    } catch(e){ setFormErr("Erro de conexão"); }
    setFormLoading(false);
  }

  // ── Login ──
  if(!sbToken) return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:400,gap:16}}>
      <div style={{background:C.card,borderRadius:16,padding:40,width:"100%",maxWidth:380,border:`1px solid ${C.border}`}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:24}}>
          <div style={{width:40,height:40,borderRadius:10,background:"linear-gradient(135deg,#e1306c,#405de6)",display:"flex",alignItems:"center",justifyContent:"center"}}>
            <MessageSquare size={20} color="#fff"/>
          </div>
          <div>
            <div style={{color:C.text,fontWeight:700,fontSize:18}}>StoriesBot</div>
            <div style={{color:C.muted,fontSize:12}}>Agendamento Instagram</div>
          </div>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          <input value={sbEmail} onChange={e=>setSbEmail(e.target.value)} placeholder="Email" type="email"
            style={{background:C.card2,border:`1px solid ${C.border}`,borderRadius:8,padding:"10px 14px",color:C.text,fontSize:14,outline:"none",width:"100%",boxSizing:"border-box"}}/>
          <input value={sbPass} onChange={e=>setSbPass(e.target.value)} placeholder="Senha" type="password"
            onKeyDown={e=>e.key==="Enter"&&sbLogin()}
            style={{background:C.card2,border:`1px solid ${C.border}`,borderRadius:8,padding:"10px 14px",color:C.text,fontSize:14,outline:"none",width:"100%",boxSizing:"border-box"}}/>
          {sbLoginErr&&<div style={{color:C.red,fontSize:12}}>{sbLoginErr}</div>}
          <button onClick={sbLogin} disabled={sbLoading}
            style={{background:"linear-gradient(90deg,#e1306c,#405de6)",color:"#fff",border:"none",borderRadius:8,padding:"11px",fontWeight:600,fontSize:14,cursor:"pointer",opacity:sbLoading?0.6:1}}>
            {sbLoading?"Entrando…":"Entrar"}
          </button>
        </div>
      </div>
    </div>
  );

  const currentTab = SB_TABS.find(t=>t.id===sbTab);
  const currentItems = sbTab==="stories" ? stories : feedItems;
  const isStory = sbTab==="stories";

  // Totals per tab
  const counts = {
    stories: stories.length,
    feed: feedItems.length,
  };

  return (
    <div style={{padding:"4px 0"}}>
      {/* Header */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16,flexWrap:"wrap",gap:10}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:38,height:38,borderRadius:10,background:"linear-gradient(135deg,#e1306c,#405de6)",display:"flex",alignItems:"center",justifyContent:"center"}}>
            <MessageSquare size={18} color="#fff"/>
          </div>
          <div>
            <div style={{color:C.text,fontWeight:700,fontSize:18}}>StoriesBot</div>
            <div style={{color:C.muted,fontSize:12}}>Kanban semanal · Instagram</div>
          </div>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
          <button onClick={toggleScheduler} style={{
            background:schedulerOn?`${C.green}22`:`${C.red}22`,
            color:schedulerOn?C.green:C.red,
            border:`1px solid ${schedulerOn?C.green:C.red}44`,
            borderRadius:8,padding:"6px 14px",fontSize:12,fontWeight:600,cursor:"pointer"
          }}>{schedulerOn?"⏰ Scheduler ON":"⏸ Scheduler OFF"}</button>
          <button onClick={()=>loadAll()} style={{background:"transparent",border:`1px solid ${C.border}`,borderRadius:8,padding:"6px 12px",color:C.muted,fontSize:12,cursor:"pointer",display:"flex",alignItems:"center",gap:5}}>
            <RefreshCw size={12}/> Atualizar
          </button>
          <button onClick={openFormGeneral} style={{background:`linear-gradient(90deg,${currentTab.color},${C.accent})`,color:"#fff",border:"none",borderRadius:8,padding:"8px 16px",fontWeight:600,fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}>
            <PlusCircle size={15}/> Novo Post
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{display:"flex",gap:4,marginBottom:16,background:C.card2,borderRadius:10,padding:4,width:"fit-content"}}>
        {SB_TABS.map(({id,label,color})=>(
          <button key={id} onClick={()=>setSbTab(id)} style={{
            background:sbTab===id?color:"transparent",
            color:sbTab===id?"#fff":C.muted,
            border:"none",borderRadius:7,padding:"7px 16px",fontWeight:600,fontSize:13,cursor:"pointer",transition:"all .15s",
            display:"flex",alignItems:"center",gap:6,
          }}>
            {label}
            <span style={{background:sbTab===id?"rgba(255,255,255,0.25)":C.border,borderRadius:99,padding:"1px 6px",fontSize:10,fontWeight:700,color:sbTab===id?"#fff":C.muted}}>
              {counts[id]}
            </span>
          </button>
        ))}
      </div>

      {/* Kanban */}
      {dataLoading ? (
        <div style={{textAlign:"center",color:C.muted,padding:60}}><Loader size={28} style={{animation:"spin 1s linear infinite"}}/></div>
      ) : (
        <SbKanban
          items={currentItems}
          onPostNow={handlePostNow}
          onDelete={handleDelete}
          onAddInDay={openFormForDay}
        />
      )}

      {/* Stats bar */}
      <div style={{display:"flex",gap:12,marginTop:16,flexWrap:"wrap"}}>
        {(["pending","posted","failed"] ).map(st=>{
          const count = currentItems.filter(it=>it.status===st).length;
          const col = SB_STATUS_COLOR[st]||C.muted;
          return count>0 ? (
            <span key={st} style={{background:`${col}18`,color:col,borderRadius:7,padding:"4px 12px",fontSize:12,fontWeight:600}}>
              {st==="pending"?"⏳":st==="posted"?"✅":"❌"} {count} {st}
            </span>
          ) : null;
        })}
      </div>

      {/* Form Modal */}
      {showForm&&(
        <div style={{position:"fixed",inset:0,background:"#000b",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
          <div style={{background:C.card,borderRadius:16,padding:28,width:"100%",maxWidth:460,border:`1px solid ${C.border}`,maxHeight:"92vh",overflowY:"auto"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
              <div style={{color:C.text,fontWeight:700,fontSize:16}}>Novo Post</div>
              <button onClick={()=>setShowForm(false)} style={{background:"transparent",border:"none",color:C.muted,cursor:"pointer"}}><X size={18}/></button>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:13}}>
              {/* Tipo */}
              <div>
                <div style={{color:C.muted,fontSize:12,marginBottom:6}}>Tipo</div>
                <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                  {[["story","📸 Story"],["image","🖼 Feed"],["video","🎬 Vídeo"],["reel","🎭 Reel"],["carousel","🎠 Carrossel"]].map(([id,label])=>(
                    <button key={id} onClick={()=>setFormType(id)} style={{
                      background:formType===id?C.accent:`${C.border}55`,color:formType===id?"#fff":C.muted,
                      border:"none",borderRadius:7,padding:"6px 12px",fontSize:12,fontWeight:600,cursor:"pointer"
                    }}>{label}</button>
                  ))}
                </div>
              </div>
              {/* Nome */}
              <div>
                <div style={{color:C.muted,fontSize:12,marginBottom:4}}>Nome (opcional)</div>
                <input value={formName} onChange={e=>setFormName(e.target.value)} placeholder="Ex: Promo segunda"
                  style={{width:"100%",background:C.card2,border:`1px solid ${C.border}`,borderRadius:8,padding:"9px 12px",color:C.text,fontSize:13,outline:"none",boxSizing:"border-box"}}/>
              </div>
              {/* URL mídia single */}
              {formType!=="carousel"&&(
                <div>
                  <div style={{color:C.muted,fontSize:12,marginBottom:4}}>URL da mídia</div>
                  <input value={formMediaUrl} onChange={e=>setFormMediaUrl(e.target.value)} placeholder="https://res.cloudinary.com/..."
                    style={{width:"100%",background:C.card2,border:`1px solid ${C.border}`,borderRadius:8,padding:"9px 12px",color:C.text,fontSize:13,outline:"none",boxSizing:"border-box"}}/>
                </div>
              )}
              {/* URLs carrossel — até 20 campos individuais */}
              {formType==="carousel"&&(
                <div>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
                    <span style={{color:C.muted,fontSize:12}}>Mídias do carrossel <span style={{color:C.accent}}>({formMediaUrls.filter(u=>u.trim()).length}/20)</span></span>
                    {formMediaUrls.length < 20 && (
                      <button onClick={()=>setFormMediaUrls(prev=>[...prev,""])}
                        style={{background:`${C.accent}22`,color:C.accent,border:"none",borderRadius:6,padding:"4px 10px",fontSize:12,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:4}}>
                        <PlusCircle size={12}/> Adicionar
                      </button>
                    )}
                  </div>
                  <div style={{display:"flex",flexDirection:"column",gap:7,maxHeight:320,overflowY:"auto",paddingRight:2}}>
                    {formMediaUrls.map((url,idx)=>(
                      <div key={idx} style={{display:"flex",alignItems:"center",gap:6}}>
                        <span style={{color:C.muted,fontSize:11,fontWeight:700,minWidth:20,textAlign:"right"}}>{idx+1}.</span>
                        <input
                          value={url}
                          onChange={e=>{
                            const next=[...formMediaUrls];
                            next[idx]=e.target.value;
                            setFormMediaUrls(next);
                          }}
                          placeholder={`https://res.cloudinary.com/... (mídia ${idx+1})`}
                          style={{flex:1,background:C.card2,border:`1px solid ${url.trim()?C.accent:C.border}`,borderRadius:8,padding:"8px 10px",color:C.text,fontSize:12,outline:"none",boxSizing:"border-box"}}
                        />
                        {formMediaUrls.length > 2 && (
                          <button onClick={()=>setFormMediaUrls(prev=>prev.filter((_,i)=>i!==idx))}
                            style={{background:`${C.red}15`,color:C.red,border:"none",borderRadius:6,padding:"5px 7px",cursor:"pointer",flexShrink:0}}>
                            <X size={12}/>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <div style={{color:C.muted,fontSize:11,marginTop:8}}>
                    💡 Mínimo 2 mídias. Podem ser imagens (.jpg/.png) ou vídeos (.mp4). Máximo 20.
                  </div>
                </div>
              )}
              {/* Legenda (não story) */}
              {formType!=="story"&&(
                <div>
                  <div style={{color:C.muted,fontSize:12,marginBottom:4}}>Legenda</div>
                  <textarea value={formCaption} onChange={e=>setFormCaption(e.target.value)} rows={3}
                    placeholder="Escreva a legenda..."
                    style={{width:"100%",background:C.card2,border:`1px solid ${C.border}`,borderRadius:8,padding:"9px 12px",color:C.text,fontSize:13,outline:"none",resize:"vertical",boxSizing:"border-box"}}/>
                </div>
              )}
              {/* Dia */}
              <div>
                <div style={{color:C.muted,fontSize:12,marginBottom:4}}>Dia da semana</div>
                <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                  {SB_DAYS.map(({id,label})=>(
                    <button key={id} onClick={()=>setFormDay(String(id))} style={{
                      background:formDay===String(id)?C.accent:`${C.border}55`,
                      color:formDay===String(id)?"#fff":C.muted,
                      border:"none",borderRadius:7,padding:"6px 10px",fontSize:12,fontWeight:600,cursor:"pointer"
                    }}>{label}</button>
                  ))}
                </div>
              </div>
              {/* Horário */}
              <div>
                <div style={{color:C.muted,fontSize:12,marginBottom:4}}>Horário</div>
                <input type="time" value={formTime} onChange={e=>setFormTime(e.target.value)}
                  style={{width:"100%",background:C.card2,border:`1px solid ${C.border}`,borderRadius:8,padding:"9px 12px",color:C.text,fontSize:13,outline:"none",boxSizing:"border-box"}}/>
              </div>
              {formErr&&<div style={{color:C.red,fontSize:12}}>{formErr}</div>}
              <div style={{display:"flex",gap:8,marginTop:4}}>
                <button onClick={()=>setShowForm(false)} style={{flex:1,background:`${C.border}55`,color:C.muted,border:"none",borderRadius:8,padding:"10px",cursor:"pointer",fontWeight:600,fontSize:13}}>
                  Cancelar
                </button>
                <button onClick={submitForm} disabled={formLoading} style={{flex:2,background:C.accent,color:"#fff",border:"none",borderRadius:8,padding:"10px",cursor:"pointer",fontWeight:600,fontSize:13,opacity:formLoading?0.6:1}}>
                  {formLoading?"Criando…":"Criar Post"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── NAV CONFIG ───────────────────────────────────────────────────────────────
const NAV=[
  {id:"dashboard",  label:"Dashboard",   icon:BarChart2},
  {id:"forecast",   label:"Forecast",    icon:Flag},
  {id:"lancamento", label:"Lançamento",  icon:PlusCircle},
  {id:"mensal",     label:"Visão Mensal",icon:Calendar},
  {id:"financeiro", label:"Financeiro",  icon:Wallet},
  {id:"dre",        label:"DRE",         icon:FileText},
  {id:"graficos",   label:"Gráficos",    icon:TrendingUp},
  {id:"custos",     label:"Produtos",    icon:Package},
  {id:"posvenda",   label:"Pós-Venda",   icon:RefreshCw},
  {id:"integracoes",label:"Integrações", icon:Link2},
  {id:"storiesbot", label:"StoriesBot",  icon:MessageSquare},
];

// ─── APP ─────────────────────────────────────────────────────────────────────
export default function App(){
  // AUTH
  const [user,setUser]=useState(null); const [userRole,setUserRole]=useState("operacional"); const [authLoading,setAuthLoading]=useState(true);

  useEffect(()=>{
    supabase.auth.getSession().then(({data:{session}})=>{ if(session?.user){setUser(session.user);loadUserRole(session.user.id);}else setAuthLoading(false); });
    const{data:{subscription}}=supabase.auth.onAuthStateChange((_event,session)=>{ if(session?.user){setUser(session.user);loadUserRole(session.user.id);}else{setUser(null);setAuthLoading(false);}});
    return()=>subscription.unsubscribe();
  },[]);

  async function loadUserRole(userId){
    const{data}=await supabase.from("profiles").select("role").eq("id",userId).single();
    setUserRole(data?.role||"operacional"); setAuthLoading(false);
  }
  async function handleLogout(){await supabase.auth.signOut();setUser(null);setData(buildInitialData());}

  // STATE
  const [data,setData]=useState(buildInitialData);
  const [page,setPage]=useState("dashboard");
  const [month,setMonth]=useState(new Date().getMonth());
  const [menuOpen,setMenuOpen]=useState(false);
  const [dbLoading,setDbLoading]=useState(false);
  const [posVendaList,setPosVendaList]=useState([]);
  const [metaDailyData,setMetaDailyData]=useState([]);
  const [kommoStats,setKommoStats]=useState(null);
  const [products,setProducts]=useState([]);
  const [forecast,setForecast]=useState({});
  const [custosFixos,setCustosFixos]=useState([]);
  const [taxasAdquirente,setTaxasAdquirente]=useState([]);

  useEffect(()=>{if(!user)return;loadAllData();},[user]);

  async function loadAllData(){
    setDbLoading(true);
    // Lançamentos diários
    const{data:rows}=await supabase.from("daily_data").select("*").eq("year",YEAR).order("date");
    if(rows&&rows.length>0){const nd=buildInitialData();rows.forEach(r=>{const m=r.month;const di=r.day-1;if(nd[m]&&nd[m][di])nd[m][di]={...nd[m][di],...r};});setData(nd);}
    // Pós-venda
    const{data:pv}=await supabase.from("pos_venda_records").select("*").order("created_at",{ascending:false});
    if(pv)setPosVendaList(pv);
    // Produtos
    const{data:prods}=await supabase.from("products").select("*").order("nome");
    if(prods)setProducts(prods);
    // Forecast
    const{data:fc}=await supabase.from("forecast").select("*").eq("year",YEAR);
    if(fc){const obj={};fc.forEach(f=>obj[f.mes]=f);setForecast(obj);}
    // Custos fixos
    const{data:cf}=await supabase.from("custos_fixos").select("*").eq("year",YEAR);
    if(cf)setCustosFixos(cf);
    // Taxas adquirente
    const{data:ta}=await supabase.from("taxas_adquirente").select("*");
    if(ta)setTaxasAdquirente(ta);
    setDbLoading(false);
  }

  async function handleSave(m,dayIdx,values){
    const dayObj=data[m][dayIdx];
    const payload={date:dayObj.date,day:dayObj.day,month:m,year:YEAR,weekday:dayObj.weekday,...values};
    const{error}=await supabase.from("daily_data").upsert(payload,{onConflict:"date"});
    if(!error){setData(prev=>{const n={...prev};n[m]=[...prev[m]];n[m][dayIdx]={...n[m][dayIdx],...values};return n;});}
  }

  async function handleAddPosVenda(record){
    const{data:inserted}=await supabase.from("pos_venda_records").insert([record]).select().single();
    if(inserted)setPosVendaList(l=>[inserted,...l]);
  }
  async function handleDeletePosVenda(id){await supabase.from("pos_venda_records").delete().eq("id",id);setPosVendaList(l=>l.filter(r=>r.id!==id));}

  async function handleSaveForecast(mes,payload){
    await supabase.from("forecast").upsert({...payload,year:YEAR,mes},{onConflict:"mes,year"});
    setForecast(prev=>({...prev,[mes]:payload}));
  }

  const prejuizoMes=posVendaList.filter(r=>r.data?.startsWith(`${YEAR}-${String(month+1).padStart(2,"0")}`)).reduce((s,r)=>s+(r.prejuizo_total||0),0);
  const visibleNav=NAV.filter(item=>canAccess(userRole,item.id));

  useEffect(()=>{if(user&&!canAccess(userRole,page))setPage(ROLES[userRole]?.pages[0]||"dashboard");},[userRole,user]);

  if(authLoading) return(
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"Inter,system-ui,sans-serif"}}>
      <div style={{textAlign:"center"}}>
        <div style={{width:56,height:56,borderRadius:14,background:C.accent,display:"inline-flex",alignItems:"center",justifyContent:"center",marginBottom:16}}><BarChart2 size={28} color="#fff"/></div>
        <div style={{color:C.muted,fontSize:14,display:"flex",alignItems:"center",gap:8,justifyContent:"center"}}><Loader size={16} style={{animation:"spin 1s linear infinite"}}/>Carregando...</div>
      </div>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if(!user) return <LoginScreen onLogin={u=>setUser(u)}/>;

  const roleInfo=ROLES[userRole];
  const navBtn=(item)=>{const active=page===item.id;const Icon=item.icon;return(<button key={item.id} onClick={()=>{setPage(item.id);setMenuOpen(false);}} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",borderRadius:9,border:"none",cursor:"pointer",background:active?`${C.accent}22`:"transparent",color:active?C.accentLight:C.muted,fontWeight:active?600:400,fontSize:14,width:"100%",textAlign:"left"}}><Icon size={15} color={active?C.accentLight:C.muted}/>{item.label}</button>);};

  const sidebar=(
    <div style={{display:"flex",flexDirection:"column",gap:4,padding:"16px 12px",height:"100%"}}>
      <div style={{display:"flex",alignItems:"center",gap:10,padding:"12px 4px 20px"}}>
        <div style={{width:32,height:32,borderRadius:8,background:C.accent,display:"flex",alignItems:"center",justifyContent:"center"}}><BarChart2 size={18} color="#fff"/></div>
        <span style={{color:C.text,fontWeight:700,fontSize:17}}>Smartfy</span>
      </div>
      {visibleNav.map(navBtn)}
      <div style={{flex:1}}/>
      <div style={{borderTop:`1px solid ${C.border}`,paddingTop:12,marginTop:8}}>
        <div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 4px",marginBottom:4}}>
          <div style={{width:28,height:28,borderRadius:"50%",background:`${roleInfo?.color}33`,display:"flex",alignItems:"center",justifyContent:"center"}}><Shield size={14} color={roleInfo?.color}/></div>
          <div><div style={{color:C.text,fontSize:12,fontWeight:600,maxWidth:140,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{user.email}</div><div style={{color:roleInfo?.color,fontSize:11}}>{roleInfo?.label}</div></div>
        </div>
        <button onClick={handleLogout} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 14px",borderRadius:9,border:"none",cursor:"pointer",background:"transparent",color:C.muted,fontSize:13,width:"100%"}}><LogOut size={14}/>Sair</button>
      </div>
    </div>
  );

  return (
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",fontFamily:"Inter,system-ui,sans-serif"}}>
      {menuOpen&&(
        <div style={{position:"fixed",inset:0,zIndex:50,display:"flex"}}>
          <div style={{width:240,background:C.card,borderRight:`1px solid ${C.border}`}}>{sidebar}</div>
          <div style={{flex:1,background:"#00000066"}} onClick={()=>setMenuOpen(false)}/>
        </div>
      )}
      {/* Desktop sidebar */}
      <div style={{width:220,background:C.card,borderRight:`1px solid ${C.border}`,flexShrink:0,display:"none"}} className="dsk-sb">{sidebar}</div>

      <div style={{flex:1,display:"flex",flexDirection:"column",minWidth:0}}>
        {/* Topbar */}
        <div style={{background:C.card,borderBottom:`1px solid ${C.border}`,padding:"12px 20px",display:"flex",alignItems:"center",gap:12,position:"sticky",top:0,zIndex:30}}>
          <button onClick={()=>setMenuOpen(o=>!o)} style={{background:"transparent",border:"none",cursor:"pointer",color:C.muted,display:"flex",padding:4}}><Menu size={20}/></button>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{width:28,height:28,borderRadius:7,background:C.accent,display:"flex",alignItems:"center",justifyContent:"center"}}><BarChart2 size={15} color="#fff"/></div>
            <span style={{color:C.text,fontWeight:700,fontSize:16}}>Smartfy Dashboard</span>
          </div>
          <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:8}}>
            {dbLoading&&<div style={{color:C.muted,fontSize:12,display:"flex",alignItems:"center",gap:4}}><Loader size={13} style={{animation:"spin 1s linear infinite"}}/>Sync...</div>}
            <span style={{background:`${roleInfo?.color}22`,color:roleInfo?.color,borderRadius:20,padding:"3px 10px",fontSize:11,fontWeight:600}}>{roleInfo?.label}</span>
            <button onClick={()=>setMonth(m=>Math.max(0,m-1))} style={{background:"transparent",border:`1px solid ${C.border}`,borderRadius:6,padding:"5px 9px",color:C.muted,cursor:"pointer"}}><ChevronLeft size={14}/></button>
            <span style={{color:C.text,fontSize:13,fontWeight:600,minWidth:100,textAlign:"center"}}>{MONTHS[month]} {YEAR}</span>
            <button onClick={()=>setMonth(m=>Math.min(11,m+1))} style={{background:"transparent",border:`1px solid ${C.border}`,borderRadius:6,padding:"5px 9px",color:C.muted,cursor:"pointer"}}><ChevronRight size={14}/></button>
          </div>
        </div>

        {/* Mobile bottom nav */}
        <div style={{position:"fixed",bottom:0,left:0,right:0,background:C.card,borderTop:`1px solid ${C.border}`,display:"flex",zIndex:40,padding:"4px 0"}}>
          {visibleNav.slice(0,6).map(item=>{const active=page===item.id;const Icon=item.icon;return(<button key={item.id} onClick={()=>setPage(item.id)} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2,background:"transparent",border:"none",cursor:"pointer",color:active?C.accentLight:C.muted,padding:"6px 0",fontSize:9}}><Icon size={17} color={active?C.accentLight:C.muted}/>{item.label.split(" ")[0]}</button>);})}
        </div>

        {/* Content */}
        <div style={{flex:1,padding:"16px 20px 80px",overflowY:"auto",maxWidth:1100,width:"100%"}}>
          {page==="dashboard"   && <Dashboard data={data} prejuizoMes={prejuizoMes} metaDailyData={metaDailyData} kommoStats={kommoStats} forecast={forecast}/>}
          {page==="forecast"    && <Forecast forecast={forecast} onSave={handleSaveForecast}/>}
          {page==="lancamento"  && <LancamentoDiario data={data} month={month} setMonth={setMonth} onSave={handleSave}/>}
          {page==="mensal"      && <VisaoMensal data={data} month={month} setMonth={setMonth}/>}
          {page==="financeiro"  && <Financeiro custosFixos={custosFixos} setCustosFixos={setCustosFixos} taxasAdquirente={taxasAdquirente} setTaxasAdquirente={setTaxasAdquirente} month={month} setMonth={setMonth} data={data}/>}
          {page==="dre"         && <DreMensal data={data} month={month} setMonth={setMonth} custosFixos={custosFixos} taxasAdquirente={taxasAdquirente}/>}
          {page==="graficos"    && <Graficos data={data}/>}
          {page==="custos"      && <CustosProdutos/>}
          {page==="posvenda"    && <PosVenda posVendaList={posVendaList} onAdd={handleAddPosVenda} onDelete={handleDeletePosVenda} products={products}/>}
          {page==="integracoes" && <Integracoes onMetaData={setMetaDailyData} onKommoData={setKommoStats}/>}
          {page==="storiesbot"  && <StoriesBot/>}
        </div>
      </div>
      <style>{`
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @media(min-width:768px){.dsk-sb{display:flex!important;flex-direction:column;}}
      `}</style>
    </div>
  );
}
