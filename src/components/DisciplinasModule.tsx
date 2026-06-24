import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Edit2, Trash2, ArrowRight, Trophy, Search, Sparkles, X, Info, MapPin, Calendar, Clock, AlertTriangle } from 'lucide-react';
import { Disciplina, Equipo, Match } from '../types';
import { db, isSupabaseConfigured } from '../lib/supabase';

interface DisciplinasModuleProps {
  onSelectDisciplina: (disciplina: Disciplina) => void;
}

export function DisciplinasModule({ onSelectDisciplina }: DisciplinasModuleProps) {
  const [disciplinas, setDisciplinas] = useState<Disciplina[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [teamCounts, setTeamCounts] = useState<Record<string, number>>({});

  // Form states
  const [showForm, setShowForm] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nombre, setNombre] = useState<string>('');
  const [descripcion, setDescripcion] = useState<string>('');
  const [canchas, setCanchas] = useState<string>('');
  const [formError, setFormError] = useState<string>('');

  // Notification state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [seedingProgress, setSeedingProgress] = useState<{ message: string; percent: number } | null>(null);

  // Comparativa states
  const [showComparativa, setShowComparativa] = useState<boolean>(false);
  const [isLoadingComparativa, setIsLoadingComparativa] = useState<boolean>(false);
  const [comparativaData, setComparativaData] = useState<{
    slots: string[];
    matchesBySlot: Record<string, (Match & { disciplinaName: string; duration: number })[]>;
  } | null>(null);

  const normalizeTeamName = (name: string) => {
    return name.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  };

  const loadComparativaData = async () => {
    setIsLoadingComparativa(true);
    setComparativaData(null);
    try {
      const allMatches: (Match & { disciplinaName: string; duration: number })[] = [];
      let minMinutes = 24 * 60;
      let maxMinutes = 0;

      for (const disc of disciplinas) {
        const matches = await db.getPartidos(disc.id);
        const savedDuration = localStorage.getItem(`campeonato_duration_${disc.id}`);
        const duration = savedDuration ? parseInt(savedDuration) : 30;

        matches.forEach(m => {
          if (!m.hora) return;
          const [h, min] = m.hora.split(':').map(Number);
          const startMin = h * 60 + min;
          const endMin = startMin + duration;

          if (startMin < minMinutes) minMinutes = startMin;
          if (endMin > maxMinutes) maxMinutes = endMin;

          allMatches.push({
            ...m,
            disciplinaName: disc.nombre,
            duration
          });
        });
      }

      if (allMatches.length === 0) {
        setComparativaData({ slots: [], matchesBySlot: {} });
        setIsLoadingComparativa(false);
        return;
      }

      const slots: string[] = [];
      const matchesBySlot: Record<string, typeof allMatches> = {};

      for (let current = minMinutes; current < maxMinutes; current += 10) {
        const h = Math.floor(current / 60).toString().padStart(2, '0');
        const m = (current % 60).toString().padStart(2, '0');
        const slotStr = `${h}:${m}`;
        slots.push(slotStr);

        const slotEnd = current + 10;
        matchesBySlot[slotStr] = allMatches.filter(match => {
          const [mh, mm] = (match.hora || '08:00').split(':').map(Number);
          const matchStart = mh * 60 + mm;
          const matchEnd = matchStart + match.duration;
          return matchStart < slotEnd && matchEnd > current;
        });
      }

      setComparativaData({ slots, matchesBySlot });
    } catch (e) {
      console.error(e);
      showToast('Error al cargar datos comparativos', 'error');
    } finally {
      setIsLoadingComparativa(false);
    }
  };

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const discList = await db.getDisciplinas();
      setDisciplinas(discList);

      // Fetch team counts for each discipline
      const counts: Record<string, number> = {};
      for (const disc of discList) {
        const teams = await db.getEquipos(disc.id);
        counts[disc.id] = teams.length;
      }
      setTeamCounts(counts);
    } catch (err) {
      console.error('Error al cargar disciplinas:', err);
      showToast('Error al cargar las disciplinas', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenAdd = () => {
    setEditingId(null);
    setNombre('');
    setDescripcion('');
    setCanchas('');
    setFormError('');
    setShowForm(true);
  };

  const handleOpenEdit = (disc: Disciplina, e: React.MouseEvent) => {
    e.stopPropagation(); // Avoid triggering discipline selection
    setEditingId(disc.id);
    setNombre(disc.nombre);
    setDescripcion(disc.descripcion || '');
    setCanchas(disc.canchas || '');
    setFormError('');
    setShowForm(true);
  };

  const handleDelete = async (id: string, nombreDisc: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Avoid triggering discipline selection
    if (window.confirm(`¿Estás seguro de que deseas eliminar la disciplina "${nombreDisc}"? Esto también eliminará todos sus equipos registrados.`)) {
      try {
        await db.deleteDisciplina(id);
        showToast(`Disciplina "${nombreDisc}" eliminada correctamente.`);
        loadData();
      } catch (err) {
        console.error(err);
        showToast('Error al eliminar la disciplina.', 'error');
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) {
      setFormError('El nombre de la disciplina es obligatorio.');
      return;
    }

    try {
      if (editingId) {
        await db.updateDisciplina(editingId, nombre.trim(), descripcion.trim() || undefined, canchas.trim() || undefined);
        showToast('Disciplina actualizada correctamente.');
      } else {
        await db.addDisciplina(nombre.trim(), descripcion.trim() || undefined, canchas.trim() || undefined);
        showToast('Nueva disciplina agregada con éxito.');
      }
      setShowForm(false);
      setNombre('');
      setDescripcion('');
      setCanchas('');
      setEditingId(null);
      loadData();
    } catch (err) {
      console.error(err);
      setFormError('Hubo un error al guardar la disciplina. Por favor, reintenta.');
    }
  };

  const handleLoadRealData = async () => {
    const isConfigured = isSupabaseConfigured();
    const modeMessage = isConfigured 
      ? '¡Estás en modo Supabase Nube! Esto borrará las tablas existentes en tu base de datos de Supabase e insertará las disciplinas y equipos reales del campeonato.'
      : 'ADVERTENCIA: Estás en modo Local (LocalStorage). Los datos reales se cargarán únicamente en este navegador y no se subirán a Supabase porque no has configurado las variables de entorno.';

    if (window.confirm(`${modeMessage}\n\n¿Estás seguro de que deseas proceder con la carga de datos reales?`)) {
      try {
        setSeedingProgress({ message: 'Iniciando carga de datos reales...', percent: 0 });
        if (typeof db.loadRealDataset === 'function') {
          await db.loadRealDataset((message, percent) => {
            setSeedingProgress({ message, percent });
          });
          if (isConfigured) {
            showToast('¡Datos reales cargados con éxito en Supabase y localmente!');
          } else {
            showToast('¡Datos reales cargados correctamente de forma local!');
          }
          await loadData();
        }
      } catch (err: any) {
        console.error('Error al cargar datos reales:', err);
        const errorMsg = err?.message || JSON.stringify(err);
        showToast(`Error al guardar en Supabase: ${errorMsg}. Verifica tus tablas y políticas SQL.`, 'error');
      } finally {
        setSeedingProgress(null);
      }
    }
  };

  const filteredDisciplinas = disciplinas.filter(disc =>
    disc.nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (disc.descripcion && disc.descripcion.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Search and Action Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Buscar disciplina..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              setShowComparativa(true);
              loadComparativaData();
            }}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 px-4 py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <Calendar className="w-4 h-4" />
            Comparativa Global
          </button>
          <button
            onClick={handleOpenAdd}
            id="btn-add-discipline"
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 hover:shadow-md transition-all active:scale-98 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Agregar Disciplina
          </button>
        </div>
      </div>

      {/* Modal / Slide-over Form */}
      <AnimatePresence>
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-xl shadow-xl border border-slate-100 max-w-md w-full overflow-hidden"
            >
              <div className="flex items-center justify-between px-6 py-4 bg-indigo-50 border-b border-indigo-100/50">
                <h3 className="font-display font-semibold text-slate-800 flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-indigo-600" />
                  {editingId ? 'Editar Disciplina' : 'Nueva Disciplina Deportiva'}
                </h3>
                <button
                  onClick={() => setShowForm(false)}
                  className="p-1 rounded-full text-slate-400 hover:bg-indigo-100/50 hover:text-slate-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                {formError && (
                  <div className="p-3 rounded-lg bg-red-50 text-red-600 text-xs font-medium border border-red-100">
                    {formError}
                  </div>
                )}

                <div className="space-y-1.5">
                  <label htmlFor="disc-name" className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Nombre de la Disciplina <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="disc-name"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    placeholder="Ej. Fútbol 7, Básquetbol, Tenis de Mesa"
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-lg text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                    required
                    autoFocus
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="disc-desc" className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Descripción / Detalles
                  </label>
                  <textarea
                    id="disc-desc"
                    value={descripcion}
                    onChange={(e) => setDescripcion(e.target.value)}
                    placeholder="Reglamento rápido, ubicación, horarios o comentarios adicionales..."
                    rows={2}
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-lg text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors resize-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="disc-canchas" className="text-xs font-semibold text-slate-700 uppercase tracking-wider block">
                    Cancha / Campo de Juego <span className="text-slate-400 font-normal">(puedes ingresar varias)</span>
                  </label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <input
                      type="text"
                      id="disc-canchas"
                      value={canchas}
                      onChange={(e) => setCanchas(e.target.value)}
                      placeholder="Ej. Cancha 1, Cancha 2, Campo A"
                      className="w-full pl-9 pr-3.5 py-2 border border-slate-200 rounded-lg text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                    />
                  </div>
                  
                  {/* Quick selections for fast entry, perfect for multi-court settings */}
                  <div className="pt-1 flex flex-wrap gap-1.5 items-center">
                    <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mr-1">Sugerir:</span>
                    {[
                      'Cancha 1', 
                      'Cancha 2', 
                      'Cancha 3', 
                      'Cancha 1 y 2', 
                      'Cancha Principal', 
                      'Coliseo'
                    ].map((badge) => {
                      const isActive = canchas.includes(badge);
                      return (
                        <button
                          key={badge}
                          type="button"
                          onClick={() => {
                            if (!canchas) {
                              setCanchas(badge);
                            } else if (canchas.includes(badge)) {
                              // Remove it
                              const regex = new RegExp(`,\\s*${badge}|${badge},\\s*|${badge}`, 'g');
                              const cleaned = canchas.replace(regex, '').trim().replace(/^,|,$/g, '');
                              setCanchas(cleaned);
                            } else {
                              setCanchas(canchas + ', ' + badge);
                            }
                          }}
                          className={`text-[10px] px-2 py-0.5 rounded-full border transition-all duration-150 cursor-pointer ${
                            isActive
                              ? 'bg-indigo-50 text-indigo-600 border-indigo-200 font-semibold shadow-2xs'
                              : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {badge}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-sm font-medium transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors hover:shadow-sm"
                  >
                    {editingId ? 'Guardar Cambios' : 'Registrar Disciplina'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Disciplines Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
          <span className="text-sm text-slate-500 font-medium">Cargando disciplinas deportivas...</span>
        </div>
      ) : filteredDisciplinas.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-slate-300 p-12 text-center max-w-lg mx-auto">
          <div className="w-12 h-12 rounded-full bg-slate-50 text-slate-400 flex items-center justify-center mx-auto mb-4">
            <Trophy className="w-6 h-6" />
          </div>
          <h4 className="font-display font-semibold text-slate-800 mb-1">Ninguna disciplina encontrada</h4>
          <p className="text-sm text-slate-500 mb-6 leading-relaxed">
            {searchQuery 
              ? 'No hay disciplinas que coincidan con tu búsqueda. Intenta con otro término.' 
              : 'Comienza agregando las disciplinas deportivas que formarán parte del campeonato.'}
          </p>
          {!searchQuery && (
            <button
              onClick={handleOpenAdd}
              className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all"
            >
              <Plus className="w-4 h-4" />
              Agregar primera disciplina
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredDisciplinas.map((disc, idx) => (
            <motion.div
              key={`${disc.id || 'disc'}-${idx}`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: idx * 0.05 }}
              onClick={() => onSelectDisciplina(disc)}
              id={`discipline-card-${disc.id}`}
              className="group bg-white rounded-xl border border-slate-200 hover:border-indigo-400 p-5 shadow-xs hover:shadow-md cursor-pointer flex flex-col justify-between transition-all duration-300 relative overflow-hidden"
            >
              {/* Top Accent Bar */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 to-violet-500 opacity-0 group-hover:opacity-100 transition-opacity" />

              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div className="p-2 bg-indigo-50 group-hover:bg-indigo-100 text-indigo-600 rounded-lg transition-colors">
                    <Trophy className="w-5 h-5" />
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => handleOpenEdit(disc, e)}
                      title="Editar"
                      className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => handleDelete(disc.id, disc.nombre, e)}
                      title="Eliminar"
                      className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div>
                  <h4 className="font-display font-semibold text-slate-800 group-hover:text-indigo-600 transition-colors text-base sm:text-lg">
                    {disc.nombre}
                  </h4>
                  <p className="text-xs text-slate-500 line-clamp-2 mt-1 min-h-[32px] leading-relaxed">
                    {disc.descripcion || 'Sin descripción o reglamento establecido.'}
                  </p>

                  {/* Cancha display */}
                  <div className="flex items-center gap-1.5 mt-2.5 text-xs text-slate-600 font-medium">
                    <MapPin className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                    <span className="text-slate-400 font-normal">Cancha:</span>
                    <span className="text-slate-700 font-bold bg-slate-50 border border-slate-100 rounded-md px-2 py-0.5 truncate max-w-[150px]" title={disc.canchas || 'Por asignar'}>
                      {disc.canchas || 'Por asignar'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-4 mt-4 flex items-center justify-between text-xs font-medium">
                <span className="bg-slate-100 text-slate-600 group-hover:bg-indigo-50 group-hover:text-indigo-700 px-2.5 py-1 rounded-full transition-colors flex items-center gap-1">
                  <strong>{teamCounts[disc.id] || 0}</strong> {teamCounts[disc.id] === 1 ? 'equipo' : 'equipos'}
                </span>
                <span className="text-indigo-600 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                  Registrar Equipos <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Floating Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg border text-sm font-medium ${
              toast.type === 'error'
                ? 'bg-red-50 text-red-700 border-red-200'
                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
            }`}
          >
            {toast.type === 'success' ? <Sparkles className="w-4 h-4" /> : <Info className="w-4 h-4" />}
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Comparativa Global Modal */}
      <AnimatePresence>
        {showComparativa && (
          <div className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-slate-50 rounded-xl shadow-2xl w-full max-w-6xl min-h-[80vh] flex flex-col overflow-hidden"
            >
              <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200 shrink-0 sticky top-0 z-10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-slate-800 text-lg">Comparativa Global de Fixtures</h3>
                    <p className="text-xs text-slate-500 font-medium">Intervalos de 10 minutos para detección de cruces</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowComparativa(false)}
                  className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 p-6 overflow-y-auto">
                {isLoadingComparativa ? (
                  <div className="flex flex-col items-center justify-center h-full min-h-[400px] gap-3">
                    <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                    <span className="text-sm text-slate-500 font-medium">Analizando cronogramas de {disciplinas.length} disciplinas...</span>
                  </div>
                ) : !comparativaData || comparativaData.slots.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center">
                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 mb-4">
                      <Clock className="w-8 h-8" />
                    </div>
                    <h4 className="text-slate-800 font-bold mb-1">No hay partidos programados</h4>
                    <p className="text-slate-500 text-sm">Aún no se ha generado ningún cronograma en las disciplinas.</p>
                  </div>
                ) : (
                  <div className="relative border-l-2 border-indigo-200 ml-4 sm:ml-8 py-2 space-y-8">
                    {comparativaData.slots.map(slot => {
                      const matches = comparativaData.matchesBySlot[slot] || [];
                      if (matches.length === 0) return null;
                      
                      // Detección de cruces
                      const teamsInSlot = new Set<string>();
                      const conflictTeams = new Set<string>();
                      matches.forEach(m => {
                        const t1 = normalizeTeamName(m.equipo1);
                        const t2 = normalizeTeamName(m.equipo2);
                        if (t1 !== normalizeTeamName('BYE (Descanso)') && t1 !== 'bye_dummy') {
                          if (teamsInSlot.has(t1)) conflictTeams.add(t1);
                          teamsInSlot.add(t1);
                        }
                        if (t2 !== normalizeTeamName('BYE (Descanso)') && t2 !== 'bye_dummy') {
                          if (teamsInSlot.has(t2)) conflictTeams.add(t2);
                          teamsInSlot.add(t2);
                        }
                      });

                      const hasConflict = conflictTeams.size > 0;

                      return (
                        <div key={slot} className="relative pl-6 sm:pl-8">
                          {/* Timeline Dot */}
                          <div className={`absolute -left-[9px] top-1 w-4 h-4 rounded-full border-4 border-slate-50 shadow-sm ${hasConflict ? 'bg-red-500' : 'bg-indigo-500'}`} />
                          
                          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mb-3">
                            <h4 className={`text-xl font-black font-mono tracking-tight ${hasConflict ? 'text-red-600' : 'text-slate-800'}`}>
                              {slot}
                            </h4>
                            {hasConflict && (
                              <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider bg-red-100 text-red-700 px-2 py-1 rounded-md">
                                <AlertTriangle className="w-3.5 h-3.5" /> Cruce Detectado
                              </span>
                            )}
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                            {matches.map((m, idx) => {
                              const t1Norm = normalizeTeamName(m.equipo1);
                              const t2Norm = normalizeTeamName(m.equipo2);
                              const isT1Conflict = conflictTeams.has(t1Norm);
                              const isT2Conflict = conflictTeams.has(t2Norm);

                              return (
                                <div key={`${m.id}-${idx}`} className={`p-3 rounded-lg border text-sm transition-all ${isT1Conflict || isT2Conflict ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-white hover:border-indigo-300 hover:shadow-md'}`}>
                                  <div className="flex justify-between items-start mb-2">
                                    <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider bg-indigo-50 px-1.5 py-0.5 rounded">{m.disciplinaName}</span>
                                    <span className="text-[10px] font-medium text-slate-500 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded shadow-xs">{m.cancha}</span>
                                  </div>
                                  <div className="flex items-center justify-between gap-2 mt-1">
                                    <div className={`flex-1 text-right font-bold truncate ${isT1Conflict ? 'text-red-700' : 'text-slate-800'}`} title={m.equipo1}>
                                      {m.equipo1}
                                    </div>
                                    <div className="text-[9px] text-slate-400 font-black bg-slate-100 px-1.5 rounded-sm shrink-0">VS</div>
                                    <div className={`flex-1 text-left font-bold truncate ${isT2Conflict ? 'text-red-700' : 'text-slate-800'}`} title={m.equipo2}>
                                      {m.equipo2}
                                    </div>
                                  </div>
                                  <div className="mt-2.5 pt-2 border-t border-slate-100 text-center text-[10px] font-semibold text-slate-500 flex items-center justify-center gap-1.5">
                                    <Clock className="w-3 h-3 text-slate-400" />
                                    <span>Horario oficial: {m.hora} - {(() => {
                                      const [hh, mm] = (m.hora || '08:00').split(':').map(Number);
                                      const totalMins = hh * 60 + mm + m.duration;
                                      return `${Math.floor(totalMins/60).toString().padStart(2,'0')}:${(totalMins%60).toString().padStart(2,'0')}`;
                                    })()}</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Seeding Progress Modal Overlay */}
      <AnimatePresence>
        {seedingProgress && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="bg-white rounded-xl shadow-xl border border-slate-150 p-6 max-w-md w-full space-y-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center text-amber-600 animate-pulse">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-base">Cargando Datos Reales del Campeonato</h3>
                  <p className="text-xs text-slate-500">Por favor, espera mientras configuramos el sistema...</p>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-semibold text-slate-600">
                  <span className="truncate max-w-[280px]" title={seedingProgress.message}>
                    {seedingProgress.message}
                  </span>
                  <span>{seedingProgress.percent}%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                  <motion.div
                    className="bg-amber-500 h-full rounded-full"
                    style={{ width: `${seedingProgress.percent}%` }}
                    transition={{ duration: 0.2 }}
                  />
                </div>
              </div>

              <p className="text-[11px] text-slate-400 text-center leading-relaxed">
                Este proceso borra los datos antiguos y escribe las 4 disciplinas oficiales con sus equipos y delegados reales según el fixture del campeonato de Ingeniería de Sistemas.
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
