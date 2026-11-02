import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, CheckCircle2, CircleOff, LogOut, Plus, RefreshCw, ShieldCheck } from 'lucide-react';

type Company = { id: string; name: string; document: string; plan: string; is_active: boolean; stores: number; created_at: string };
const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/$/, '');
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const SESSION_KEY = 'konnexy_master_session';
type Session = { access_token: string; refresh_token: string; expires_at: number };
function readSession(): Session | null { try { const s = sessionStorage.getItem(SESSION_KEY); return s ? JSON.parse(s) as Session : null; } catch { return null; } }
async function rpc<T>(name: string, params: object, token: string): Promise<T> {
  const res = await fetch(`${url}/rest/v1/rpc/${name}`, { method:'POST', headers: { apikey:key!, Authorization:`Bearer ${token}`, 'Content-Type':'application/json' }, body:JSON.stringify(params) });
  if (!res.ok) { const err = await res.json().catch(()=>({message:'Falha na operação'})); throw new Error(err.message || 'Operação não autorizada'); }
  return await res.json() as T;
}
export const MasterPage: React.FC = () => {
  const [session,setSession] = useState<Session|null>(readSession);
  const [email,setEmail] = useState(''); const [password,setPassword] = useState('');
  const [companies,setCompanies] = useState<Company[]>([]); const [name,setName] = useState('');
  const [document,setDocument] = useState(''); const [plan,setPlan] = useState('pro');
  const [busy,setBusy] = useState(false); const [error,setError] = useState('');
  const [ready,setReady] = useState(false);
  const logout=()=>{sessionStorage.removeItem(SESSION_KEY);setSession(null);setCompanies([]);};
  const load=async(token:string)=>{setError('');try{const rows=await rpc<Company[]>('master_list_companies',{},token);setCompanies(rows);setReady(true);}catch(e){setError(e instanceof Error?e.message:'Falha ao carregar empresas');setReady(false);}};
  useEffect(()=>{if(!session)return;let canceled=false;(async()=>{try{
    if(!url||!key)throw new Error('Supabase não configurado.');
    let active=session;
    if(Date.now()/1000>=session.expires_at-60){const res=await fetch(`${url}/auth/v1/token?grant_type=refresh_token`,{method:'POST',headers:{apikey:key,'Content-Type':'application/json'},body:JSON.stringify({refresh_token:session.refresh_token})});if(!res.ok)throw new Error('Sessão expirada. Entre novamente.');const data=await res.json();active={access_token:data.access_token,refresh_token:data.refresh_token,expires_at:Math.floor(Date.now()/1000)+data.expires_in};sessionStorage.setItem(SESSION_KEY,JSON.stringify(active));if(!canceled)setSession(active);}
    if(!canceled)await load(active.access_token);
  }catch(e){if(!canceled){logout();setError(e instanceof Error?e.message:'Sessão inválida');}}})();return()=>{canceled=true};},[session?.access_token]);
  const login=async(e:React.FormEvent)=>{e.preventDefault();setBusy(true);setError('');try{
    if(!url||!key)throw new Error('Configure as variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.');
    const res=await fetch(`${url}/auth/v1/token?grant_type=password`,{method:'POST',headers:{apikey:key,'Content-Type':'application/json'},body:JSON.stringify({email,password})});
    const data=await res.json();if(!res.ok)throw new Error(data.msg||data.error_description||'Credenciais inválidas');
    const s:Session={access_token:data.access_token,refresh_token:data.refresh_token,expires_at:Math.floor(Date.now()/1000)+data.expires_in};
    await rpc('master_list_companies',{},s.access_token);sessionStorage.setItem(SESSION_KEY,JSON.stringify(s));setPassword('');setSession(s);
  }catch(e){setError(e instanceof Error?e.message:'Não foi possível entrar');}finally{setBusy(false);}};
  const create=async(e:React.FormEvent)=>{e.preventDefault();if(!session)return;setBusy(true);setError('');try{await rpc('master_create_company',{p_name:name,p_document:document,p_plan:plan},session.access_token);setName('');setDocument('');await load(session.access_token);}catch(e){setError(e instanceof Error?e.message:'Falha ao cadastrar');}finally{setBusy(false);}};
  const toggle=async(c:Company)=>{if(!session||!window.confirm(`${c.is_active?'Suspender':'Ativar'} ${c.name}?`))return;setBusy(true);setError('');try{await rpc('master_set_company_status',{p_tenant_id:c.id,p_active:!c.is_active},session.access_token);await load(session.access_token);}catch(e){setError(e instanceof Error?e.message:'Falha ao alterar status');}finally{setBusy(false);}};
  return <main className="min-h-screen bg-slate-950 text-slate-100"><header className="border-b border-slate-800 px-5 py-5"><div className="mx-auto flex max-w-6xl items-center justify-between"><div className="flex items-center gap-3"><ShieldCheck className="text-emerald-400"/><strong>Konnexy · Administração SaaS</strong></div><div className="flex items-center gap-3"><Link className="text-sm text-slate-400 hover:text-white" to="/">Site</Link>{session&&<button onClick={logout} className="flex items-center gap-2 text-sm text-rose-300"><LogOut size={16}/> Sair</button>}</div></div></header>
  <div className="mx-auto max-w-6xl px-5 py-10">{error&&<p role="alert" className="mb-6 rounded-xl border border-rose-700 bg-rose-950/50 p-4 text-sm text-rose-200">{error}</p>}
  {!session?<form onSubmit={login} className="mx-auto max-w-md space-y-5 rounded-2xl border border-slate-800 bg-slate-900 p-8"><h1 className="text-2xl font-bold">Acesso master</h1><p className="text-sm text-slate-400">Exclusivo para administradores autorizados da Konnexy.</p><label className="block text-sm">E-mail<input type="email" required autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)} className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 p-3"/></label><label className="block text-sm">Senha<input type="password" required autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 p-3"/></label><button disabled={busy} className="w-full rounded-xl bg-emerald-500 p-3 font-bold text-slate-950 disabled:opacity-50">Entrar no painel</button></form>:
  <><div className="mb-8 flex flex-wrap items-center justify-between gap-4"><div><h1 className="text-3xl font-black">Empresas cadastradas</h1><p className="mt-1 text-sm text-slate-400">Gerencie os estabelecimentos da plataforma.</p></div><button onClick={()=>load(session.access_token)} className="flex items-center gap-2 rounded-lg border border-slate-700 px-4 py-2"><RefreshCw size={16}/> Atualizar</button></div>
  <div className="mb-8 grid gap-4 sm:grid-cols-3">{[['Total',companies.length],['Ativas',companies.filter(c=>c.is_active).length],['Inativas',companies.filter(c=>!c.is_active).length]].map(([label,count])=><div key={label} className="rounded-xl border border-slate-800 bg-slate-900 p-5"><p className="text-sm text-slate-400">{label}</p><p className="mt-2 text-3xl font-bold">{count}</p></div>)}</div>
  <form onSubmit={create} className="mb-8 grid gap-4 rounded-2xl border border-slate-800 bg-slate-900 p-6 md:grid-cols-4"><div className="md:col-span-4 flex items-center gap-2 font-bold"><Plus size={18} className="text-emerald-400"/> Cadastrar empresa</div><input required minLength={2} value={name} onChange={e=>setName(e.target.value)} placeholder="Nome da empresa" aria-label="Nome da empresa" className="rounded-lg border border-slate-700 bg-slate-950 p-3"/><input required minLength={5} value={document} onChange={e=>setDocument(e.target.value)} placeholder="CNPJ ou CPF" aria-label="CNPJ ou CPF" className="rounded-lg border border-slate-700 bg-slate-950 p-3"/><select value={plan} onChange={e=>setPlan(e.target.value)} aria-label="Plano" className="rounded-lg border border-slate-700 bg-slate-950 p-3"><option value="free">Gratuito</option><option value="pro">Pro</option><option value="enterprise">Enterprise</option></select><button disabled={busy||!ready} className="rounded-lg bg-emerald-500 px-4 py-3 font-bold text-slate-950 disabled:opacity-50">Cadastrar</button></form>
  <section className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900"><table className="w-full min-w-[680px] text-left text-sm"><thead className="border-b border-slate-800 text-slate-400"><tr>{['Empresa','Documento','Plano','Lojas','Status','Ação'].map(h=><th key={h} className="p-4">{h}</th>)}</tr></thead><tbody>{companies.map(c=><tr key={c.id} className="border-b border-slate-800/70"><td className="p-4 font-semibold"><span className="inline-flex items-center gap-2"><Building2 size={16} className="text-emerald-400"/>{c.name}</span></td><td className="p-4">{c.document}</td><td className="p-4 uppercase">{c.plan}</td><td className="p-4">{c.stores}</td><td className="p-4">{c.is_active?<span className="inline-flex items-center gap-1 text-emerald-400"><CheckCircle2 size={15}/>Ativa</span>:<span className="inline-flex items-center gap-1 text-rose-400"><CircleOff size={15}/>Inativa</span>}</td><td className="p-4"><button disabled={busy} onClick={()=>toggle(c)} className="rounded-lg border border-slate-600 px-3 py-2 hover:bg-slate-800 disabled:opacity-50">{c.is_active?'Suspender':'Ativar'}</button></td></tr>)}</tbody></table>{companies.length===0&&<p className="p-8 text-center text-slate-400">Nenhuma empresa cadastrada.</p>}</section>
  <p className="mt-5 text-xs text-amber-300">A suspensão altera o cadastro central. O bloqueio de dispositivos offline depende da implantação da validação de licença e sincronização.</p></>}
  </div></main>;
};
