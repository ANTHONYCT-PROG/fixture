import React, { useState } from 'react';
import { Database, CheckCircle2, AlertCircle, Copy, Check, Terminal, ExternalLink } from 'lucide-react';
import { isSupabaseConfigured, getSupabaseConfig, db } from '../lib/supabase';

export function SupabaseConfigPanel() {
  const [copied, setCopied] = useState(false);
  const [showSql, setShowSql] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; details?: any } | null>(null);
  const isConfigured = isSupabaseConfigured();
  const config = getSupabaseConfig();

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      if (typeof db.testConnection === 'function') {
        const res = await db.testConnection();
        setTestResult(res);
      } else {
        setTestResult({ success: false, message: 'La función de prueba de conexión no está disponible.' });
      }
    } catch (err: any) {
      setTestResult({ success: false, message: `Error inesperado durante la prueba: ${err?.message || err}` });
    } finally {
      setTesting(false);
    }
  };

  const sqlScript = `-- 1. CREAR TABLA DE DISCIPLINAS
create table disciplinas (
  id uuid default gen_random_uuid() primary key,
  nombre text not null,
  descripcion text,
  canchas text,
  creado_en timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. CREAR TABLA DE EQUIPOS
create table equipos (
  id uuid default gen_random_uuid() primary key,
  disciplina_id uuid references disciplinas(id) on delete cascade not null,
  nombre text not null,
  delegado text,
  contacto text,
  creado_en timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. CREAR TABLA DE PARTIDOS (FIXTURES)
create table partidos (
  id text primary key,
  disciplina_id uuid references disciplinas(id) on delete cascade not null,
  equipo1 text not null,
  equipo2 text not null,
  cancha text,
  grupo text,
  ronda integer not null,
  hora text default '08:00',
  goles1 text default '',
  goles2 text default '',
  creado_en timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. CREAR TABLA DE GRUPOS DEL FIXTURE
create table fixture_grupos (
  disciplina_id uuid references disciplinas(id) on delete cascade primary key,
  grupo_a text[] default '{}'::text[] not null,
  grupo_b text[] default '{}'::text[] not null,
  creado_en timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Habilitar RLS para todas las tablas
alter table disciplinas enable row level security;
alter table equipos enable row level security;
alter table partidos enable row level security;
alter table fixture_grupos enable row level security;

-- Configurar políticas de acceso libre para lectura y escritura
create policy "Acceso libre para lectura y escritura" on disciplinas
  for all using (true) with check (true);

create policy "Acceso libre para lectura y escritura" on equipos
  for all using (true) with check (true);

create policy "Acceso libre para lectura y escritura" on partidos
  for all using (true) with check (true);

create policy "Acceso libre para lectura y escritura" on fixture_grupos
  for all using (true) with check (true);`;

  const handleCopy = () => {
    navigator.clipboard.writeText(sqlScript);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-6 transition-all duration-300">
      <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${isConfigured ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-display font-semibold text-slate-800 text-sm sm:text-base flex items-center gap-2">
              Estado de Base de Datos
              {isConfigured ? (
                <span className="inline-flex items-center gap-1 text-xs font-normal text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Conectado a Supabase
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-normal text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                  <AlertCircle className="w-3.5 h-3.5" /> Modo Local (LocalStorage)
                </span>
              )}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {isConfigured 
                ? `Sincronizando datos con: ${config.url}`
                : 'Guardando datos localmente en tu navegador. Tus cambios se conservarán aquí.'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isConfigured && (
            <button
              onClick={handleTestConnection}
              disabled={testing}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 ${
                testing 
                  ? 'bg-slate-100 text-slate-400 border-slate-200' 
                  : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200 hover:shadow-xs'
              }`}
            >
              <Database className={`w-3.5 h-3.5 ${testing ? 'animate-spin' : ''}`} />
              {testing ? 'Probando...' : 'Probar Conexión ⚡'}
            </button>
          )}

          <button
            onClick={() => setShowSql(!showSql)}
            className="text-xs font-semibold text-slate-600 hover:text-slate-800 border border-slate-200 bg-white hover:bg-slate-50 flex items-center gap-1 px-3 py-1.5 rounded-lg transition-all cursor-pointer"
          >
            <Terminal className="w-3.5 h-3.5" />
            {showSql ? 'Ocultar Guía' : 'Ver Guía de Conexión'}
          </button>
        </div>
      </div>

      {/* Test Connection Result Alert */}
      {testResult && (
        <div className={`p-4 border-t border-b border-slate-100 flex items-start gap-2.5 text-xs ${
          testResult.success ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'
        }`}>
          {testResult.success ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          )}
          <div className="flex-1 space-y-1">
            <span className="font-bold">{testResult.success ? 'Conexión Exitosa:' : 'Fallo en la Conexión:'}</span>
            <p className="leading-relaxed">{testResult.message}</p>
            {!testResult.success && testResult.details && (
              <div className="mt-2 p-2 bg-rose-100/50 rounded font-mono text-[10px] text-rose-950 border border-rose-200/50 max-h-[120px] overflow-y-auto whitespace-pre-wrap">
                {JSON.stringify(testResult.details, null, 2)}
              </div>
            )}
          </div>
          <button 
            onClick={() => setTestResult(null)}
            className="text-slate-400 hover:text-slate-600 font-semibold px-2 py-1 rounded hover:bg-slate-200/50 cursor-pointer text-sm"
          >
            ×
          </button>
        </div>
      )}

      {showSql && (
        <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50 text-slate-700 text-sm space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-2">
              <h4 className="font-semibold text-slate-800 flex items-center gap-1">
                <span>1. Configurar Variables de Entorno</span>
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Para vincular tu base de datos Supabase real, ve al panel de <strong>Settings / Secrets</strong> en AI Studio e ingresa las siguientes claves con tus credenciales del proyecto de Supabase:
              </p>
              <ul className="text-xs bg-white p-3 rounded-lg border border-slate-200 space-y-1.5 font-mono text-slate-600">
                <li><span className="text-indigo-600 font-semibold">VITE_SUPABASE_URL</span></li>
                <li><span className="text-indigo-600 font-semibold">VITE_SUPABASE_ANON_KEY</span></li>
              </ul>
              <div className="text-xs text-slate-500 mt-2 flex items-center gap-1">
                <span>Nota: Los nombres de variables de entorno en Vite deben comenzar con <code className="bg-slate-200 px-1 py-0.5 rounded font-mono text-[10px]">VITE_</code>.</span>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-semibold text-slate-800 flex items-center justify-between">
                <span>2. Ejecutar Script SQL en Supabase</span>
                <button
                  onClick={handleCopy}
                  className="text-xs font-medium bg-white hover:bg-slate-100 border border-slate-200 rounded px-2 py-1 flex items-center gap-1 text-slate-600 active:scale-95 transition-all"
                  title="Copiar script SQL"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                      <span className="text-emerald-600">¡Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-slate-500" />
                      <span>Copiar SQL</span>
                    </>
                  )}
                </button>
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Copia el siguiente script SQL y pégalo en el <strong>SQL Editor</strong> de tu panel de Supabase para crear las tablas necesarias con políticas de acceso público (RLS):
              </p>
              <div className="relative">
                <pre className="text-[11px] font-mono bg-slate-900 text-slate-200 p-3 rounded-lg overflow-x-auto max-h-[160px] border border-slate-800">
                  {sqlScript}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
