import React, { useState } from 'react';
import { Trophy, Users, Calendar, MapPin, Database, Award, ShieldAlert, Sparkles, HelpCircle } from 'lucide-react';
import { Disciplina } from './types';
import { SupabaseConfigPanel } from './components/SupabaseConfigPanel';
import { DisciplinasModule } from './components/DisciplinasModule';
import { EquiposModule } from './components/EquiposModule';
import { isSupabaseConfigured } from './lib/supabase';

export default function App() {
  const [selectedDisciplina, setSelectedDisciplina] = useState<Disciplina | null>(null);
  const isConfigured = isSupabaseConfigured();

  // Active module/tab (for sports/disciplines and general details)
  // For now we have "deportes" which is the main requested module.
  const [activeTab, setActiveTab] = useState<'deportes' | 'info'>('deportes');

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Upper Navigation/Header */}
      <header className="bg-slate-900 text-white shadow-md relative overflow-hidden shrink-0">
        {/* Subtle Decorative Gradient background */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.15),transparent)] pointer-events-none" />
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 relative z-10">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-600/90 text-white rounded-xl shadow-lg border border-indigo-500/30">
                <Trophy className="w-7 h-7 animate-pulse text-amber-300" />
              </div>
              <div>
                <h1 className="font-display font-extrabold text-xl sm:text-2xl md:text-3xl tracking-tight text-white flex items-center gap-2">
                  Fixture Express
                  <span className="text-[10px] font-mono tracking-widest font-medium uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-400/20 px-2 py-0.5 rounded-sm">
                    Single-Day
                  </span>
                </h1>
                <p className="text-xs text-slate-300 mt-0.5">
                  Organizador de disciplinas y equipos para tu campeonato relámpago
                </p>
              </div>
            </div>

            {/* Quick stats / date ribbon */}
            <div className="flex flex-wrap items-center gap-3 text-xs sm:text-sm">
              <div className="flex items-center gap-1.5 bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700/50 text-slate-200">
                <Calendar className="w-4 h-4 text-indigo-400" />
                <span>Fecha: Hoy (1 Día)</span>
              </div>
              <div className="flex items-center gap-1.5 bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700/50 text-slate-200">
                <MapPin className="w-4 h-4 text-indigo-400" />
                <span>Multidisciplinario</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        
        {/* Supabase Connection Status Helper Panel */}
        <SupabaseConfigPanel />

        {/* Tab Navigation */}
        <div className="flex items-center border-b border-slate-200 mb-6">
          <button
            onClick={() => {
              setActiveTab('deportes');
              setSelectedDisciplina(null);
            }}
            className={`px-4 py-2.5 font-display font-semibold text-sm border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'deportes'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Trophy className="w-4 h-4" />
            Módulo Deportes
          </button>
          
          <button
            onClick={() => setActiveTab('info')}
            className={`px-4 py-2.5 font-display font-semibold text-sm border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'info'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <HelpCircle className="w-4 h-4" />
            Información del Campeonato
          </button>
        </div>

        {/* Dynamic Section rendering based on active tab & sub-selection */}
        {activeTab === 'deportes' ? (
          <div>
            {selectedDisciplina ? (
              <EquiposModule
                disciplina={selectedDisciplina}
                onBack={() => setSelectedDisciplina(null)}
              />
            ) : (
              <div className="space-y-4">
                <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
                  <h2 className="font-display font-extrabold text-slate-900 text-lg sm:text-xl flex items-center gap-2">
                    <Award className="w-5 h-5 text-indigo-600" />
                    Disciplinas Activas
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Crea y administra las disciplinas deportivas de tu campeonato. Haz clic sobre cualquier disciplina para registrar y administrar sus equipos participantes.
                  </p>
                </div>
                
                <DisciplinasModule
                  onSelectDisciplina={(disc) => setSelectedDisciplina(disc)}
                />
              </div>
            )}
          </div>
        ) : (
          /* General Information and Help Tab */
          <div className="bg-white rounded-xl border border-slate-200 p-6 sm:p-8 max-w-3xl mx-auto space-y-6">
            <div className="space-y-2">
              <h3 className="font-display font-bold text-slate-900 text-xl sm:text-2xl flex items-center gap-2">
                <Sparkles className="w-6 h-6 text-indigo-600 animate-bounce" />
                ¿Cómo funciona Fixture Express?
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Esta herramienta está diseñada específicamente para agilizar la logística de campeonatos deportivos relámpago que se realizan en un solo día.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="p-4 rounded-lg bg-slate-50 border border-slate-100 space-y-2">
                <h4 className="font-semibold text-slate-800 text-sm flex items-center gap-1.5">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold">1</span>
                  Registra Disciplinas
                </h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Crea disciplinas como fútbol, básquetbol, vóley, etc., con reglamentos rápidos. Agrega, edita o elimínalas desde el panel principal.
                </p>
              </div>

              <div className="p-4 rounded-lg bg-slate-50 border border-slate-100 space-y-2">
                <h4 className="font-semibold text-slate-800 text-sm flex items-center gap-1.5">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold">2</span>
                  Inscribe Equipos
                </h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Haz clic en cualquier disciplina para registrar a sus respectivos equipos competidores, junto con el nombre del delegado e información de contacto.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-amber-50 border border-amber-100 text-amber-800 text-xs flex gap-2.5 items-start">
              <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-bold">Nota de Conexión a Base de Datos (Supabase):</span>
                <p className="leading-relaxed">
                  Para guardar de manera permanente tus datos en la nube, sigue los sencillos pasos de la <strong>Guía de Conexión</strong> que aparece arriba para añadir tus variables de entorno. De lo contrario, los datos se guardarán localmente en tu navegador de forma segura.
                </p>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-400 mt-12 shrink-0">
        <div className="max-w-7xl mx-auto px-4">
          <p>© {new Date().getFullYear()} Fixture Express - Campeonatos Deportivos de Un Solo Día.</p>
          <p className="mt-1 text-slate-300">Organizador y Registro de Equipos con persistencia en Supabase.</p>
        </div>
      </footer>
    </div>
  );
}
