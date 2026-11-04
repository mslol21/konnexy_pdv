import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BadgeCheck, BarChart3, CloudOff, LockKeyhole, MonitorSmartphone, ShoppingCart, Store } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';

const features = [
  { icon: CloudOff, title: 'Venda mesmo sem internet', description: 'Operação local offline-first para não parar o atendimento.' },
  { icon: ShoppingCart, title: 'Frente de caixa ágil', description: 'Produtos, pagamentos e registro de vendas em um fluxo simples.' },
  { icon: BarChart3, title: 'Gestão em um só lugar', description: 'Acompanhe estoque, caixa, financeiro e indicadores.' },
  { icon: MonitorSmartphone, title: 'Feito para o balcão', description: 'Interface adaptada para computador e dispositivos móveis.' }
];

export const LandingPage: React.FC = () => {
  const { isAuthenticated } = useAuthStore();

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-6">
        <Link to="/" className="flex items-center gap-3 font-black text-xl"><span className="rounded-xl bg-emerald-500 px-3 py-2 text-slate-950">K</span>Konnexy PDV</Link>
        <nav className="flex items-center gap-3">
          <a href="#recursos" className="hidden text-sm text-slate-300 sm:block">Recursos</a>
          {isAuthenticated ? (
            <Link to="/app" className="rounded-xl border border-emerald-500 bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-500">
              Ir para o PDV
            </Link>
          ) : (
            <Link to="/login" className="rounded-xl border border-slate-600 px-4 py-2 text-sm hover:border-emerald-400">
              Acessar demonstração
            </Link>
          )}
        </nav>
      </header>
      <section className="mx-auto grid max-w-7xl items-center gap-12 px-5 pb-24 pt-16 lg:grid-cols-2 lg:pt-28">
        <div>
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300"><BadgeCheck size={16}/> Gestão comercial simplificada</div>
          <h1 className="text-4xl font-black leading-tight tracking-tight sm:text-6xl">Seu caixa não precisa parar. <span className="text-emerald-400">Seu negócio pode ir além.</span></h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-300">Um PDV pensado para o comércio: venda com agilidade, controle seu estoque e acompanhe os resultados em um só lugar.</p>
          <div className="mt-9 flex flex-wrap gap-3">
            {isAuthenticated ? (
              <Link to="/app" className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-6 py-4 font-bold text-slate-950 hover:bg-emerald-400">
                Acessar Meu PDV <ArrowRight size={18}/>
              </Link>
            ) : (
              <Link to="/login" className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-6 py-4 font-bold text-slate-950 hover:bg-emerald-400">
                Testar demonstração <ArrowRight size={18}/>
              </Link>
            )}
            <a href="https://www.konnexy.com.br/massami" target="_blank" rel="noreferrer" className="rounded-xl border border-slate-600 px-6 py-4 font-semibold hover:border-emerald-400">Falar com a Konnexy</a>
          </div>
          <p className="mt-4 text-xs text-slate-500">A demonstração utiliza dados fictícios. A operação comercial requer ativação e configuração.</p>
        </div>
        <div className="relative rounded-3xl border border-slate-700 bg-slate-900 p-5 shadow-2xl shadow-emerald-950/20">
          <div className="mb-6 flex items-center justify-between border-b border-slate-700 pb-4">
            <div className="flex items-center gap-2 font-bold"><Store className="text-emerald-400"/> Painel de operações</div>
            <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs text-emerald-300">Exemplo demonstrativo</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[['Vendas do dia','R$ 2.480,00'],['Ticket médio','R$ 62,00'],['Pedidos','40'],['Produtos ativos','128']].map(([label,value])=>(
              <div key={label} className="rounded-2xl border border-slate-700 bg-slate-950 p-5">
                <p className="text-xs text-slate-400">{label}</p>
                <p className="mt-3 text-2xl font-black">{value}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-xl bg-slate-800 p-4 text-sm text-slate-300">Uma visão rápida do seu negócio, sem planilhas complicadas.</div>
        </div>
      </section>
      <section id="recursos" className="border-t border-slate-800 bg-slate-900/50 px-5 py-20">
        <div className="mx-auto max-w-7xl">
          <h2 className="text-3xl font-black">Tudo o que seu comércio precisa para começar</h2>
          <p className="mt-3 text-slate-400">Do balcão à gestão, com uma experiência simples.</p>
          <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {features.map(({icon:Icon,title,description})=>(
              <article key={title} className="rounded-2xl border border-slate-700 bg-slate-900 p-6">
                <Icon className="mb-5 text-emerald-400" size={30}/>
                <h3 className="font-bold">{title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-slate-400">{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
      <footer className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-5 py-8 text-sm text-slate-400">
        <span>© Konnexy PDV</span>
        <span className="flex items-center gap-2"><LockKeyhole size={14}/> Gestão com controle de acesso</span>
      </footer>
    </main>
  );
};
