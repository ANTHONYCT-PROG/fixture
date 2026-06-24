import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, Plus, Edit2, Trash2, Users, Search, Phone, User, Save, X, 
  Sparkles, AlertTriangle, Trophy, Dices, Download, Play, RotateCcw, RefreshCw,
  Volume2, VolumeX, Printer, Check, Info, Award, HelpCircle, Flame, ListOrdered,
  Clock
} from 'lucide-react';
import { Disciplina, Equipo, Match } from '../types';
import { db } from '../lib/supabase';

const sortMatchesGlobally = (matches: Match[]) => {
  return [...matches].sort((a, b) => {
    const cmpCancha = (a.cancha || '').localeCompare(b.cancha || '');
    if (cmpCancha !== 0) return cmpCancha;
    const timeA = a.hora || '00:00';
    const timeB = b.hora || '00:00';
    const cmpTime = timeA.localeCompare(timeB);
    if (cmpTime !== 0) return cmpTime;
    return (a.ronda || 1) - (b.ronda || 1);
  });
};

interface EquiposModuleProps {
  disciplina: Disciplina;
  onBack: () => void;
}

export function EquiposModule({ disciplina, onBack }: EquiposModuleProps) {
  const [equipos, setEquipos] = useState<Equipo[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Navigation Tabs
  const [activeSubTab, setActiveSubTab] = useState<'equipos' | 'fixture'>('equipos');

  // Form states
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nombre, setNombre] = useState<string>('');
  const [delegado, setDelegado] = useState<string>('');
  const [contacto, setContacto] = useState<string>('');
  const [formError, setFormError] = useState<string>('');
  const [showForm, setShowForm] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Fixture & Sorteo States
  const [fixtureGenerated, setFixtureGenerated] = useState<boolean>(false);
  const [groupAMembers, setGroupAMembers] = useState<string[]>([]);
  const [groupBMembers, setGroupBMembers] = useState<string[]>([]);
  const [generatedMatches, setGeneratedMatches] = useState<Match[]>([]);
  const [scores, setScores] = useState<Record<string, { g1: string; g2: string }>>({});
  const [splitIntoTwoCourts, setSplitIntoTwoCourts] = useState<boolean>(false);

  // Manual Editing States
  const [isEditingFixture, setIsEditingFixture] = useState<boolean>(false);
  const [editingMatches, setEditingMatches] = useState<Match[]>([]);

  // Multi-sport Conflict checking States
  const [allDisciplinas, setAllDisciplinas] = useState<Disciplina[]>([]);
  const [otherDisciplinesMatches, setOtherDisciplinesMatches] = useState<Record<string, { matches: Match[]; name: string; duration: number }>>({});

  // Roulette Raffle States
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [drawnTeams, setDrawnTeams] = useState<string[]>([]);
  const [currentSpinningTeam, setCurrentSpinningTeam] = useState<string>('');
  const [currentSpinningTeam2, setCurrentSpinningTeam2] = useState<string>('');
  const [drawTargetGroup, setDrawTargetGroup] = useState<'A' | 'B'>('A');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [lastDrawnTeam, setLastDrawnTeam] = useState<string | null>(null);
  const [lastDrawnTeam2, setLastDrawnTeam2] = useState<string | null>(null);
  const [sorteoPorPares, setSorteoPorPares] = useState<boolean>(false);
  const [waitingForNextStep, setWaitingForNextStep] = useState<boolean>(false);
  const [autoDrawMode, setAutoDrawMode] = useState<boolean>(false);
  const [nextStepParams, setNextStepParams] = useState<{
    drawn: string[];
    groupA: string[];
    groupB: string[];
    targetGroup: 'A' | 'B';
  } | null>(null);

  // Notification state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Custom Fixture Parameters
  const [hasGenerationConflicts, setHasGenerationConflicts] = useState(false);
  const [matchDuration, setMatchDuration] = useState<number | ''>(30);
  const [startTime, setStartTime] = useState<string>('08:00');
  const [numGroups, setNumGroups] = useState<number>(2); // 1, 2, 3 or 4 groups
  const [customCanchas, setCustomCanchas] = useState<string>('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false);
  const [singleElimination, setSingleElimination] = useState<boolean>(false);

  // Prohibited Pairs States
  const [prohibitedPairs, setProhibitedPairs] = useState<{ id: string, team1: string, team2: string }[]>([]);
  const [pairTeam1, setPairTeam1] = useState<string>('');
  const [pairTeam2, setPairTeam2] = useState<string>('');

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Sound Synth Generator (Web Audio API)
  const playSynthBeep = (freq = 440, type: OscillatorType = 'sine', duration = 0.08) => {
    if (!soundEnabled) return;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (e) {
      // Audio context error or blocked
    }
  };

  const normalizeTeamName = (name: string) => {
    return name.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  };

  const getMinutes = (timeStr: string): number => {
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
  };

  const loadAllDisciplinesAndMatches = async () => {
    try {
      const disciplinesList = await db.getDisciplinas();
      setAllDisciplinas(disciplinesList);

      const otherMatchesMap: Record<string, { matches: Match[]; name: string; duration: number }> = {};
      for (const d of disciplinesList) {
        if (d.id !== disciplina.id) {
          try {
            const matches = await db.getPartidos(d.id);
            if (matches && matches.length > 0) {
              const savedDuration = localStorage.getItem(`campeonato_duration_${d.id}`);
              const duration = savedDuration ? parseInt(savedDuration) : 30;
              otherMatchesMap[d.id] = {
                matches,
                name: d.nombre,
                duration
              };
            }
          } catch (e) {
            console.error('Error fetching matches for', d.nombre, e);
          }
        }
      }
      setOtherDisciplinesMatches(otherMatchesMap);
    } catch (e) {
      console.error('Error loading other disciplines and matches:', e);
    }
  };

  const checkConflictsForTeam = (teamName: string, round: number, currentMatchId: string, currentHora: string) => {
    const conflicts: { type: 'cruce' | 'descanso'; message: string; sport: string }[] = [];
    if (!teamName || teamName === 'BYE_DUMMY') return conflicts;

    const normalizedName = normalizeTeamName(teamName);
    const thisStart = getMinutes(currentHora || '08:00');
    const thisEnd = thisStart + (Number(matchDuration) || 30);

    // 1. Check conflicts in other disciplines
    Object.entries(otherDisciplinesMatches).forEach(([otherDiscId, val]) => {
      const info = val as { matches: Match[]; name: string; duration: number };
      info.matches.forEach((otherM) => {
        const team1Match = normalizeTeamName(otherM.equipo1) === normalizedName;
        const team2Match = normalizeTeamName(otherM.equipo2) === normalizedName;

        if (team1Match || team2Match) {
          // Cross-discipline check by exact time range overlap (without rest buffer)
          const otherStart = getMinutes(otherM.hora || '08:00');
          const otherEnd = otherStart + info.duration;
          
          if (thisStart < otherEnd && thisEnd > otherStart) {
            conflicts.push({
              type: 'cruce',
              message: `Cruce de horario con ${info.name} (Partido a las ${otherM.hora}).`,
              sport: info.name
            });
          }
        }
      });
    });

    // 2. Check conflicts in this discipline (plays twice in same round or consecutive rounds)
    const matchesToSearch = isEditingFixture ? editingMatches : generatedMatches;
    matchesToSearch.forEach((m) => {
      if (m.id !== currentMatchId) {
        const team1Match = normalizeTeamName(m.equipo1) === normalizedName;
        const team2Match = normalizeTeamName(m.equipo2) === normalizedName;

        if (team1Match || team2Match) {
          if (m.ronda === round) {
            conflicts.push({
              type: 'cruce',
              message: `Programado doble en Ronda ${round} de este deporte.`,
              sport: disciplina.nombre
            });
          }
        }
      }
    });

    return conflicts;
  };

  const handleSaveEditedFixture = async () => {
    if (editingMatches.length === 0) {
      if (window.confirm('¿Deseas eliminar todo el fixture de este sorteo? Podrás volver a sortear los equipos desde cero.')) {
        setGeneratedMatches([]);
        setFixtureGenerated(false);
        setGroupAMembers([]);
        setGroupBMembers([]);
        await db.deletePartidosYGrupos(disciplina.id);
        setIsEditingFixture(false);
        showToast('Fixture eliminado. Ahora puedes realizar el sorteo nuevamente.');
        await loadAllDisciplinesAndMatches();
        return;
      }
      return;
    }

    for (const m of editingMatches) {
      if (!m.equipo1 || !m.equipo2) {
        showToast('Todos los encuentros deben tener ambos equipos asignados.', 'error');
        return;
      }
      if (m.equipo1 === m.equipo2 && m.equipo1 !== 'BYE_DUMMY') {
        showToast(`Un equipo no puede jugar contra sí mismo (${m.equipo1}).`, 'error');
        return;
      }
    }

    const sortedEdited = sortMatchesGlobally(editingMatches);

    setGeneratedMatches(sortedEdited);
    await db.savePartidos(disciplina.id, sortedEdited, scores);
    setIsEditingFixture(false);
    showToast('¡Fixture de encuentros actualizado correctamente!');
    // Reload to refresh potential multi-sport conflicts in other views
    await loadAllDisciplinesAndMatches();
  };

  const handleCancelEditFixture = () => {
    setIsEditingFixture(false);
  };

  const handleAddManualMatch = () => {
    const newMatch: Match = {
      id: `m-manual-${Date.now()}`,
      equipo1: equipos[0]?.nombre || 'Equipo 1',
      equipo2: equipos[1]?.nombre || 'Equipo 2',
      cancha: disciplina.canchas ? disciplina.canchas.split(',')[0].trim() : 'Cancha 1',
      grupo: splitIntoTwoCourts ? 'Grupo A' : 'Grupo Único',
      ronda: 1
    };
    setEditingMatches([...editingMatches, newMatch]);
  };

  const loadEquipos = async () => {
    setLoading(true);
    try {
      const list = await db.getEquipos(disciplina.id);
      setEquipos(list);
    } catch (err) {
      console.error('Error al cargar equipos:', err);
      showToast('Error al cargar equipos de esta disciplina', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Initial Load & Load Persistent Fixtures
  useEffect(() => {
    loadEquipos();
    
    const loadFixtures = async () => {
      await loadAllDisciplinesAndMatches();
      
      const parts = await db.getPartidos(disciplina.id);
      const groups = await db.getFixtureGrupos(disciplina.id);
      const savedSplit = localStorage.getItem(`campeonato_split_${disciplina.id}`);
      
      if (parts && parts.length > 0) {
        const sortedParts = sortMatchesGlobally(parts);
        setGeneratedMatches(sortedParts);
        setFixtureGenerated(true);
        if (groups) {
          setGroupAMembers(groups.grupoA);
          setGroupBMembers(groups.grupoB);
        } else {
          setGroupAMembers([]);
          setGroupBMembers([]);
        }
        
        // Load scores from parts
        const loadedScores: Record<string, { g1: string; g2: string }> = {};
        parts.forEach(p => {
          loadedScores[p.id] = {
            g1: p.goles1 || '',
            g2: p.goles2 || ''
          };
        });
        setScores(loadedScores);
      } else {
        setGroupAMembers([]);
        setGroupBMembers([]);
        setGeneratedMatches([]);
        setFixtureGenerated(false);
        setScores({});
      }

      const savedDuration = localStorage.getItem(`campeonato_duration_${disciplina.id}`);
      const savedStartTime = localStorage.getItem(`campeonato_starttime_${disciplina.id}`);
      const savedNumGroups = localStorage.getItem(`campeonato_numgroups_${disciplina.id}`);
      const savedCanchas = localStorage.getItem(`campeonato_canchas_${disciplina.id}`);

      if (savedDuration) {
        setMatchDuration(parseInt(savedDuration) || 30);
      } else {
        setMatchDuration(30);
      }
      
      if (savedStartTime) {
        setStartTime(savedStartTime);
      } else {
        setStartTime('08:00');
      }

      if (savedNumGroups) {
        setNumGroups(parseInt(savedNumGroups) || 2);
      } else {
        setNumGroups(2);
      }

      if (savedCanchas) {
        setCustomCanchas(savedCanchas);
      } else {
        setCustomCanchas(disciplina.canchas || 'Cancha 1, Cancha 2');
      }

      if (savedSplit) {
        setSplitIntoTwoCourts(JSON.parse(savedSplit));
      } else {
        // Detect based on number of courts listed in discipline (e.g. if it has a comma like 'Cancha 1, Cancha 2')
        const hasMultipleCourts = !!(disciplina.canchas && (disciplina.canchas.includes(',') || disciplina.canchas.toLowerCase().includes('y')));
        setSplitIntoTwoCourts(hasMultipleCourts);
      }
    };

    loadFixtures();
  }, [disciplina.id, disciplina.canchas]);

  // Team CRUD operations
  const handleOpenAdd = () => {
    setEditingId(null);
    setNombre('');
    setDelegado('');
    setContacto('');
    setFormError('');
    setShowForm(true);
  };

  const handleOpenEdit = (equi: Equipo) => {
    setEditingId(equi.id);
    setNombre(equi.nombre);
    setDelegado(equi.delegado || '');
    setContacto(equi.contacto || '');
    setFormError('');
    setShowForm(true);
  };

  const handleDelete = async (id: string, nombreEquipo: string) => {
    if (window.confirm(`¿Estás seguro de que deseas eliminar al equipo "${nombreEquipo}"?`)) {
      try {
        await db.deleteEquipo(id);
        showToast(`Equipo "${nombreEquipo}" eliminado correctamente.`);
        loadEquipos();
      } catch (err) {
        console.error(err);
        showToast('Error al eliminar el equipo.', 'error');
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) {
      setFormError('El nombre del equipo es obligatorio.');
      return;
    }
    if (isSubmitting) return;

    // Check for duplicate names (case-insensitive) in this discipline
    const duplicate = equipos.find(
      (eq) =>
        eq.nombre.trim().toLowerCase() === nombre.trim().toLowerCase() &&
        eq.id !== editingId
    );
    if (duplicate) {
      setFormError(`Ya existe un equipo registrado con el nombre "${nombre.trim()}" en esta disciplina.`);
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingId) {
        await db.updateEquipo(editingId, nombre.trim(), delegado.trim() || undefined, contacto.trim() || undefined);
        showToast('Equipo actualizado correctamente.');
      } else {
        await db.addEquipo(disciplina.id, nombre.trim(), delegado.trim() || undefined, contacto.trim() || undefined);
        showToast('Equipo registrado con éxito.');
      }
      setShowForm(false);
      setNombre('');
      setDelegado('');
      setContacto('');
      setEditingId(null);
      await loadEquipos();
    } catch (err) {
      console.error(err);
      setFormError('Hubo un error al guardar el equipo. Por favor, reintenta.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Fixture Matchmaking Algorithm (3 matches per team, no duplicate pairings)
  const generateCircleFixture = (teams: string[], groupName: string, canchaName: string): Match[] => {
    const N = teams.length;
    if (N < 2) return [];

    const maxMatches = N < 4 ? N - 1 : 3;
    let activeTeams = [...teams];
    const isOdd = N % 2 !== 0;
    
    if (isOdd) {
      activeTeams.push("BYE_DUMMY");
    }

    const numTeams = activeTeams.length;
    const matches: Match[] = [];
    const playedPairs = new Set<string>();
    const matchCounts = new Map<string, number>();

    for (const t of teams) {
      matchCounts.set(t, 0);
    }

    // Classic circle rotation method to generate matches
    // Run up to numTeams - 1 rounds to satisfy match count constraints
    for (let round = 0; round < numTeams - 1; round++) {
      for (let i = 0; i < numTeams / 2; i++) {
        const home = activeTeams[i];
        const away = activeTeams[numTeams - 1 - i];

        if (home !== "BYE_DUMMY" && away !== "BYE_DUMMY") {
          const homeCount = matchCounts.get(home) || 0;
          const awayCount = matchCounts.get(away) || 0;

          if (homeCount < maxMatches && awayCount < maxMatches) {
            const pKey = [home, away].sort().join('::');
            if (!playedPairs.has(pKey)) {
              matches.push({
                id: `m-${groupName}-${round}-${i}-${Date.now()}`,
                equipo1: home,
                equipo2: away,
                cancha: canchaName,
                grupo: groupName,
                ronda: round + 1
              });
              matchCounts.set(home, homeCount + 1);
              matchCounts.set(away, awayCount + 1);
              playedPairs.add(pKey);
            }
          }
        }
      }

      // Rotate activeTeams (keep index 0, shift rest)
      activeTeams = [
        activeTeams[0],
        activeTeams[numTeams - 1],
        ...activeTeams.slice(1, numTeams - 1)
      ];
    }

    // Patch any teams left with less than 3 matches due to odd/bye matchups
    for (const u of teams) {
      const uCount = matchCounts.get(u) || 0;
      if (uCount < maxMatches) {
        const candidates = teams.filter(v => 
          v !== u && 
          (matchCounts.get(v) || 0) < maxMatches && 
          !playedPairs.has([u, v].sort().join('::'))
        );
        if (candidates.length > 0) {
          const v = candidates[0];
          matches.push({
            id: `m-${groupName}-patch-${u}-${v}-${Date.now()}`,
            equipo1: u,
            equipo2: v,
            cancha: canchaName,
            grupo: groupName,
            ronda: maxMatches
          });
          matchCounts.set(u, uCount + 1);
          matchCounts.set(v, (matchCounts.get(v) || 0) + 1);
          playedPairs.add([u, v].sort().join('::'));
        }
      }
    }

    return matches.sort((a, b) => a.ronda - b.ronda);
  };

  const generateSingleEliminationFixture = (teamsList: string[], groupName: string, canchaName: string): Match[] => {
    const matches: Match[] = [];
    const n = teamsList.length;
    let matchIdx = 1;
    for (let i = 0; i < n; i += 2) {
      if (i + 1 < n) {
        matches.push({
          id: `m-${groupName}-elim-${matchIdx}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          equipo1: teamsList[i],
          equipo2: teamsList[i + 1],
          ronda: 1,
          grupo: groupName,
          cancha: canchaName
        });
        matchIdx++;
      } else {
        matches.push({
          id: `m-${groupName}-elim-${matchIdx}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          equipo1: teamsList[i],
          equipo2: 'BYE_DUMMY',
          ronda: 1,
          grupo: groupName,
          cancha: canchaName
        });
      }
    }
    return matches;
  };

  const generateRoundRobinGroup = (teams: string[], groupName: string, canchaName: string): Match[] => {
    const N = teams.length;
    if (N < 2) return [];

    let activeTeams = [...teams];
    const isOdd = N % 2 !== 0;
    
    if (isOdd) {
      activeTeams.push("BYE_DUMMY");
    }

    const numTeams = activeTeams.length;
    const matches: Match[] = [];

    // Algoritmo de círculo clásico de Round Robin para garantizar todos contra todos
    for (let round = 0; round < numTeams - 1; round++) {
      for (let i = 0; i < numTeams / 2; i++) {
        const home = activeTeams[i];
        const away = activeTeams[numTeams - 1 - i];

        if (home !== "BYE_DUMMY" && away !== "BYE_DUMMY") {
          matches.push({
            id: `m-${groupName}-${round}-${i}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            equipo1: home,
            equipo2: away,
            cancha: canchaName,
            grupo: groupName,
            ronda: round + 1
          });
        }
      }

      // Rotar equipos (dejar el primero fijo, mover el resto a la derecha)
      activeTeams = [
        activeTeams[0],
        activeTeams[numTeams - 1],
        ...activeTeams.slice(1, numTeams - 1)
      ];
    }

    return matches;
  };

  const handleGenerateFixtureAutomatic = async () => {
    let conflictsDetected = false;

    if (equipos.length < 2) {
      showToast('Necesitas al menos 2 equipos para realizar el sorteo.', 'error');
      return;
    }

    // Parse canchas
    const availableCourts = customCanchas
      .split(',')
      .map(c => c.trim())
      .filter(c => c.length > 0);
    
    if (availableCourts.length === 0) {
      showToast('Debes ingresar al menos una cancha para jugar.', 'error');
      return;
    }

    // 1. Distribuir equipos de manera aleatoria y equitativa en N grupos
    const shuffledTeams = [...equipos.map(e => e.nombre)].sort(() => Math.random() - 0.5);
    
    const groupsList: string[][] = Array.from({ length: numGroups }, () => []);
    
    // Asignación inteligente respetando pares prohibidos (si numGroups > 1)
    if (numGroups > 1 && prohibitedPairs.length > 0) {
      // Ordenamos para asignar primero a los equipos con restricciones
      const restrictedTeams = new Set<string>();
      prohibitedPairs.forEach(p => {
        restrictedTeams.add(p.team1);
        restrictedTeams.add(p.team2);
      });
      
      const prioritizedTeams = [
        ...shuffledTeams.filter(t => restrictedTeams.has(t)),
        ...shuffledTeams.filter(t => !restrictedTeams.has(t))
      ];

      prioritizedTeams.forEach(team => {
        // Encontrar los grupos donde están sus "enemigos"
        const enemyGroups = new Set<number>();
        prohibitedPairs.forEach(p => {
          if (p.team1 === team) {
            const enemyIdx = groupsList.findIndex(g => g.includes(p.team2));
            if (enemyIdx !== -1) enemyGroups.add(enemyIdx);
          } else if (p.team2 === team) {
            const enemyIdx = groupsList.findIndex(g => g.includes(p.team1));
            if (enemyIdx !== -1) enemyGroups.add(enemyIdx);
          }
        });

        // Buscar el grupo con menos equipos que no sea un "enemy group"
        let bestGroupIdx = -1;
        let minSize = Infinity;

        // Primero intentar en grupos permitidos
        for (let i = 0; i < numGroups; i++) {
          if (!enemyGroups.has(i)) {
            if (groupsList[i].length < minSize) {
              minSize = groupsList[i].length;
              bestGroupIdx = i;
            }
          }
        }

        // Si todos los grupos tienen algún enemigo (caso extremo de muchas reglas), 
        // simplemente lo ponemos en el grupo más pequeño
        if (bestGroupIdx === -1) {
          minSize = Infinity;
          for (let i = 0; i < numGroups; i++) {
            if (groupsList[i].length < minSize) {
              minSize = groupsList[i].length;
              bestGroupIdx = i;
            }
          }
        }

        groupsList[bestGroupIdx].push(team);
      });
    } else {
      shuffledTeams.forEach((team, idx) => {
        const groupIdx = idx % numGroups;
        groupsList[groupIdx].push(team);
      });
    }

    const activeGroups = groupsList.filter(g => g.length > 0);

    // 2. Asignar grupos a canchas de manera equitativa
    const groupCourts: string[] = [];
    activeGroups.forEach((_, idx) => {
      const courtIdx = idx % availableCourts.length;
      groupCourts.push(availableCourts[courtIdx]);
    });

    // 3. Generar partidos Round Robin (todos contra todos) para cada grupo
    let allMatches: Match[] = [];
    const getGroupName = (idx: number) => {
      if (numGroups === 1) return 'Grupo Único';
      const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
      return `Grupo ${letters[idx] || (idx + 1)}`;
    };

    activeGroups.forEach((groupTeams, idx) => {
      const groupName = getGroupName(idx);
      const assignedCourt = groupCourts[idx];
      const groupMatches = singleElimination 
        ? generateSingleEliminationFixture(groupTeams, groupName, assignedCourt)
        : generateRoundRobinGroup(groupTeams, groupName, assignedCourt);
      allMatches = [...allMatches, ...groupMatches];
    });

    // 4. Programar los horarios de cada partido por cancha (simultáneos)
    // Primero eliminar partidos prohibidos
    if (prohibitedPairs.length > 0) {
      allMatches = allMatches.filter(m => {
        return !prohibitedPairs.some(p => 
          (m.equipo1 === p.team1 && m.equipo2 === p.team2) ||
          (m.equipo1 === p.team2 && m.equipo2 === p.team1)
        );
      });
    }

    const addMinutesToTime = (timeStr: string, minutes: number): string => {
      const [h, m] = timeStr.split(':').map(Number);
      const totalMinutes = h * 60 + m + minutes;
      const nextH = Math.floor(totalMinutes / 60) % 24;
      const nextM = totalMinutes % 60;
      return `${nextH.toString().padStart(2, '0')}:${nextM.toString().padStart(2, '0')}`;
    };

    const scheduledMatches: Match[] = [];
    const safeMatchDuration = Number(matchDuration) || 30;

    const checkTeamBusyDFS = (team1: string, team2: string, timeStr: string, currentScheduled: Match[]) => {
      let isBusy = false;
      const t1 = normalizeTeamName(team1);
      const t2 = normalizeTeamName(team2);
      const thisStart = getMinutes(timeStr);
      const thisEnd = thisStart + safeMatchDuration;

      // 1. Cross-discipline
      Object.values(otherDisciplinesMatches).forEach(val => {
        const info = val as { matches: Match[]; name: string; duration: number };
        info.matches.forEach(m => {
          const otherStart = getMinutes(m.hora || '08:00');
          const otherEnd = otherStart + info.duration;
          if (thisStart < otherEnd && thisEnd > otherStart) {
             const o1 = normalizeTeamName(m.equipo1);
             const o2 = normalizeTeamName(m.equipo2);
             if (t1 === o1 || t1 === o2 || t2 === o1 || t2 === o2) isBusy = true;
          }
        });
      });

      // 2. Intra-discipline
      currentScheduled.forEach(m => {
        const otherStart = getMinutes(m.hora || '08:00');
        const otherEnd = otherStart + safeMatchDuration;
        if (thisStart < otherEnd && thisEnd > otherStart) {
           const o1 = normalizeTeamName(m.equipo1);
           const o2 = normalizeTeamName(m.equipo2);
           if (t1 === o1 || t1 === o2 || t2 === o1 || t2 === o2) isBusy = true;
        }
      });

      return isBusy;
    };

    const isVoley = disciplina.nombre.toLowerCase().includes('voley') || disciplina.nombre.toLowerCase().includes('voleibol');

    // Estado inicial
    const initialPending = [...allMatches].sort((a, b) => a.ronda - b.ronda);
    const initialCourtTimes: Record<string, number> = {};
    availableCourts.forEach(c => initialCourtTimes[c] = 0);
    
    let optimalScheduled: Match[] = [];
    let iterations = 0;
    const MAX_ITERATIONS = 50000;

    // Motor CSP DFS (Búsqueda en profundidad con backtracking)
    const solveFixture = (
      currentPending: Match[],
      currentScheduled: Match[],
      currentCourtTimes: Record<string, number>
    ): boolean => {
      iterations++;
      if (iterations > MAX_ITERATIONS) return false;

      if (currentPending.length === 0) {
        optimalScheduled = [...currentScheduled];
        return true; 
      }

      const activeCourts = availableCourts.filter(c => currentPending.some(m => m.cancha === c));
      if (activeCourts.length === 0) return false;

      let earliestCourt = activeCourts[0];
      let minTime = currentCourtTimes[earliestCourt];
      for (const c of activeCourts) {
        if (currentCourtTimes[c] < minTime) {
          minTime = currentCourtTimes[c];
          earliestCourt = c;
        }
      }

      const matchTime = addMinutesToTime(startTime, minTime);

      for (let i = 0; i < currentPending.length; i++) {
        const match = currentPending[i];

        // Ensure match remains on its assigned court
        if (match.cancha !== earliestCourt) continue;

        if (!checkTeamBusyDFS(match.equipo1, match.equipo2, matchTime, currentScheduled)) {
          // Intentar rama
          const nextPending = [...currentPending];
          const matchToPlay = { ...nextPending.splice(i, 1)[0] };
          matchToPlay.hora = matchTime;
          
          const nextScheduled = [...currentScheduled, matchToPlay];
          const nextCourtTimes = { ...currentCourtTimes };
          nextCourtTimes[earliestCourt] += safeMatchDuration;

          // Si falla failsafe (ej. 24 horas continuas), no procesar esta rama
          if (nextCourtTimes[earliestCourt] <= 24 * 60) {
            if (solveFixture(nextPending, nextScheduled, nextCourtTimes)) {
              return true;
            }
          }
        }
      }

      return false; // Backtrack
    };

    let dfsSuccess = solveFixture(initialPending, [], initialCourtTimes);

    if (dfsSuccess) {
       scheduledMatches.push(...optimalScheduled);
       conflictsDetected = false;
    } else {
       console.warn("DFS no encontró solución sin cruces, aplicando fallback forzado.");
       // Fallback: Greedy Forzado (con cruces inevitables)
       const pendingMatches = [...initialPending];
       const courtTimes = { ...initialCourtTimes };
       
       while (pendingMatches.length > 0) {
          const activeCourts = availableCourts.filter(c => pendingMatches.some(m => m.cancha === c));
          if (activeCourts.length === 0) break; // Should not happen if pendingMatches > 0

          let earliestCourt = activeCourts[0];
          let minTime = courtTimes[earliestCourt];
          for (const c of activeCourts) {
            if (courtTimes[c] < minTime) {
              minTime = courtTimes[c];
              earliestCourt = c;
            }
          }

          const matchTime = addMinutesToTime(startTime, minTime);
          let playableMatchIndex = -1;

          for (let i = 0; i < pendingMatches.length; i++) {
            const match = pendingMatches[i];
            
            // Ensure match remains on its assigned court
            if (match.cancha !== earliestCourt) continue;

            if (!checkTeamBusyDFS(match.equipo1, match.equipo2, matchTime, scheduledMatches)) {
              playableMatchIndex = i;
              break;
            }
          }

          if (playableMatchIndex !== -1) {
            const matchToPlay = pendingMatches.splice(playableMatchIndex, 1)[0];
            matchToPlay.hora = matchTime;
            scheduledMatches.push(matchToPlay);
          } else {
            let forceIndex = 0;
            for (let i = 0; i < pendingMatches.length; i++) {
              const match = pendingMatches[i];
              if (match.cancha === earliestCourt) {
                forceIndex = i;
                break;
              }
            }

            const matchToPlay = pendingMatches.splice(forceIndex, 1)[0];
            matchToPlay.hora = matchTime;
            scheduledMatches.push(matchToPlay);
            conflictsDetected = true;
          }
          
          courtTimes[earliestCourt] += safeMatchDuration;
       }
    }

    // Ordenar los partidos globalmente
    const sortedScheduled = sortMatchesGlobally(scheduledMatches);

    const groupA = activeGroups[0] || [];
    const groupB = activeGroups[1] || [];
    
    setHasGenerationConflicts(conflictsDetected);
    setGroupAMembers(groupA);
    setGroupBMembers(groupB);
    setGeneratedMatches(sortedScheduled);
    setFixtureGenerated(true);

    await db.saveFixtureGrupos(disciplina.id, groupA, groupB);
    await db.savePartidos(disciplina.id, sortedScheduled, {});
    setScores({});

    // Guardar las configuraciones en localStorage
    localStorage.setItem(`campeonato_split_${disciplina.id}`, JSON.stringify(numGroups > 1));
    localStorage.setItem(`campeonato_duration_${disciplina.id}`, matchDuration.toString());
    localStorage.setItem(`campeonato_starttime_${disciplina.id}`, startTime);
    localStorage.setItem(`campeonato_numgroups_${disciplina.id}`, numGroups.toString());
    localStorage.setItem(`campeonato_canchas_${disciplina.id}`, customCanchas);

    showToast('¡Fixture de Grupos generado exitosamente!', 'success');
    await loadAllDisciplinesAndMatches();
  };

  // Start Spinning Roulette Draw Simulator
  const handleStartRaffle = () => {
    if (equipos.length < 2) {
      showToast('Necesitas al menos 2 equipos para realizar el sorteo.', 'error');
      return;
    }

    setDrawnTeams([]);
    setGroupAMembers([]);
    setGroupBMembers([]);
    setIsDrawing(true);
    setWaitingForNextStep(false);
    setAutoDrawMode(false);
    setNextStepParams(null);
    setLastDrawnTeam(null);
    setLastDrawnTeam2(null);
    runRouletteDrawStep([], [], [], 'A');
  };

  const runRouletteDrawStep = (
    currentDrawn: string[],
    currentGroupA: string[],
    currentGroupB: string[],
    nextTargetGroup: 'A' | 'B'
  ) => {
    const remainingTeams = equipos
      .map(e => e.nombre)
      .filter(name => !currentDrawn.includes(name));

    if (remainingTeams.length === 0) {
      // Done drawing! Generate fixtures
      setIsDrawing(false);
      setWaitingForNextStep(false);
      setAutoDrawMode(false);
      setNextStepParams(null);
      setCurrentSpinningTeam('');
      setCurrentSpinningTeam2('');
      
      // Determine Canchas Names
      let canchaA = 'Cancha 1';
      let canchaB = 'Cancha 2';
      if (disciplina.canchas) {
        const courtsList = disciplina.canchas.split(',').map(c => c.trim());
        if (courtsList.length > 0) canchaA = courtsList[0];
        if (courtsList.length > 1) canchaB = courtsList[1];
      }

      let allMatches: Match[] = [];
      if (splitIntoTwoCourts && currentGroupB.length > 0) {
        const matchesA = generateCircleFixture(currentGroupA, 'Grupo A', canchaA);
        const matchesB = generateCircleFixture(currentGroupB, 'Grupo B', canchaB);
        allMatches = [...matchesA, ...matchesB];
      } else {
        allMatches = generateCircleFixture(currentGroupA, 'Grupo Único', canchaA);
      }

      const sortedAllMatches = sortMatchesGlobally(allMatches);

      // Save to states and local storage
      setGroupAMembers(currentGroupA);
      setGroupBMembers(currentGroupB);
      setGeneratedMatches(sortedAllMatches);
      setFixtureGenerated(true);

      db.saveFixtureGrupos(disciplina.id, currentGroupA, currentGroupB);
      db.savePartidos(disciplina.id, sortedAllMatches, scores);
      localStorage.setItem(`campeonato_split_${disciplina.id}`, JSON.stringify(splitIntoTwoCourts));

      playSynthBeep(880, 'sine', 0.4);
      setTimeout(() => playSynthBeep(1100, 'sine', 0.6), 150);
      showToast('¡Sorteo de Fixture completado exitosamente!');
      
      // Notify other disciplines of potential changes/conflicts
      loadAllDisciplinesAndMatches();
      return;
    }

    setDrawTargetGroup(nextTargetGroup);

    // Roulette wheel animation variables
    let spinCount = 0;
    const maxSpins = 16;
    let intervalTime = 50;

    const usePares = sorteoPorPares && remainingTeams.length >= 2;

    const spin = () => {
      spinCount++;
      if (usePares) {
        // Pick two random remaining teams
        const idx1 = Math.floor(Math.random() * remainingTeams.length);
        let idx2 = Math.floor(Math.random() * remainingTeams.length);
        while (idx2 === idx1 && remainingTeams.length > 1) {
          idx2 = Math.floor(Math.random() * remainingTeams.length);
        }
        setCurrentSpinningTeam(remainingTeams[idx1]);
        setCurrentSpinningTeam2(remainingTeams[idx2]);
      } else {
        const tempTeam = remainingTeams[Math.floor(Math.random() * remainingTeams.length)];
        setCurrentSpinningTeam(tempTeam);
        setCurrentSpinningTeam2('');
      }

      // Play clicky noise
      playSynthBeep(220 + spinCount * 15, 'triangle', 0.05);

      if (spinCount < maxSpins) {
        // Slow down spinning gradually
        intervalTime += spinCount * 6;
        setTimeout(spin, intervalTime);
      } else {
        // Stop spin, draw official team(s)
        let officialDrawnTeam = '';
        let officialDrawnTeam2 = '';
        let nextDrawn: string[] = [];
        let nextA = [...currentGroupA];
        let nextB = [...currentGroupB];

        if (usePares) {
          // Select two unique random teams
          const r1 = Math.floor(Math.random() * remainingTeams.length);
          let r2 = Math.floor(Math.random() * remainingTeams.length);
          while (r2 === r1) {
            r2 = Math.floor(Math.random() * remainingTeams.length);
          }
          officialDrawnTeam = remainingTeams[r1];
          officialDrawnTeam2 = remainingTeams[r2];
          nextDrawn = [...currentDrawn, officialDrawnTeam, officialDrawnTeam2];

          if (splitIntoTwoCourts) {
            // Pair draw: one to A, one to B
            nextA.push(officialDrawnTeam);
            nextB.push(officialDrawnTeam2);
          } else {
            // Both to single group
            nextA.push(officialDrawnTeam);
            nextA.push(officialDrawnTeam2);
          }
        } else {
          officialDrawnTeam = remainingTeams[Math.floor(Math.random() * remainingTeams.length)];
          nextDrawn = [...currentDrawn, officialDrawnTeam];

          if (splitIntoTwoCourts) {
            if (nextTargetGroup === 'A') {
              nextA.push(officialDrawnTeam);
            } else {
              nextB.push(officialDrawnTeam);
            }
          } else {
            nextA.push(officialDrawnTeam);
          }
        }

        setDrawnTeams(nextDrawn);
        setGroupAMembers(nextA);
        setGroupBMembers(nextB);
        setLastDrawnTeam(officialDrawnTeam);
        if (usePares) {
          setLastDrawnTeam2(officialDrawnTeam2);
        } else {
          setLastDrawnTeam2(null);
        }

        // Success sound for team drawn
        playSynthBeep(587.33, 'sine', 0.15); // D5 note

        // Decide next target group (alternate)
        let nextGroup: 'A' | 'B' = 'A';
        if (splitIntoTwoCourts) {
          if (usePares) {
            // If we drew a pair and assigned one to each group, target remains balanced
            nextGroup = nextTargetGroup;
          } else {
            nextGroup = nextTargetGroup === 'A' ? 'B' : 'A';
          }
        }

        // Check if there are any remaining teams left after this draw
        const overallRemaining = equipos
          .map(e => e.nombre)
          .filter(name => !nextDrawn.includes(name));

        if (overallRemaining.length === 0) {
          // If no more teams are left, we finish the draw immediately after a brief pause!
          setTimeout(() => {
            runRouletteDrawStep(nextDrawn, nextA, nextB, nextGroup);
          }, 1500);
        } else {
          // There are more teams left.
          if (autoDrawMode) {
            // If in auto mode, proceed after 1.2 seconds automatically
            setTimeout(() => {
              runRouletteDrawStep(nextDrawn, nextA, nextB, nextGroup);
            }, 1200);
          } else {
            // If in manual/step mode, pause the draw and wait for user interaction!
            setWaitingForNextStep(true);
            setNextStepParams({
              drawn: nextDrawn,
              groupA: nextA,
              groupB: nextB,
              targetGroup: nextGroup
            });
          }
        }
      }
    };

    spin();
  };

  const handleNextDrawStep = () => {
    if (!nextStepParams) return;
    setWaitingForNextStep(false);
    
    // Clear last drawn highlights temporarily during spin
    setLastDrawnTeam(null);
    setLastDrawnTeam2(null);
    setCurrentSpinningTeam('');
    setCurrentSpinningTeam2('');
    
    // Trigger next step
    runRouletteDrawStep(
      nextStepParams.drawn,
      nextStepParams.groupA,
      nextStepParams.groupB,
      nextStepParams.targetGroup
    );
  };

  const handleCompleteAutoDraw = () => {
    if (!nextStepParams) return;
    setAutoDrawMode(true);
    setWaitingForNextStep(false);
    setLastDrawnTeam(null);
    setLastDrawnTeam2(null);
    setCurrentSpinningTeam('');
    setCurrentSpinningTeam2('');
    runRouletteDrawStep(
      nextStepParams.drawn,
      nextStepParams.groupA,
      nextStepParams.groupB,
      nextStepParams.targetGroup
    );
  };

  const handleCancelOrResetDrawing = () => {
    setIsDrawing(false);
    setWaitingForNextStep(false);
    setAutoDrawMode(false);
    setNextStepParams(null);
    setDrawnTeams([]);
    setGroupAMembers([]);
    setGroupBMembers([]);
    setLastDrawnTeam(null);
    setLastDrawnTeam2(null);
    setCurrentSpinningTeam('');
    setCurrentSpinningTeam2('');
  };

  // Eliminar Fixture / Reset Sorteo
  const handleResetSorteo = async () => {
    const isConfirmed = window.confirm('¿Estás seguro de eliminar todo el fixture programado? Esta acción no se puede deshacer.');
    if (!isConfirmed) return;

    setGroupAMembers([]);
    setGroupBMembers([]);
    setGeneratedMatches([]);
    setScores({});
    setFixtureGenerated(false);
    setDrawnTeams([]);
    setLastDrawnTeam(null);
    setShowDeleteConfirm(false);

    try {
      await db.deletePartidosYGrupos(disciplina.id);
      showToast('Se ha eliminado el fixture exitosamente.');
    } catch (err) {
      console.error('Error deleting fixture:', err);
      showToast('Error al eliminar el fixture', 'error');
    }
    
    await loadAllDisciplinesAndMatches();
  };

  // Update match score
  const handleScoreChange = async (matchId: string, side: 'g1' | 'g2', value: string) => {
    // Only accept numbers or empty string
    const cleaned = value.replace(/[^0-9]/g, '');
    const newScores = {
      ...scores,
      [matchId]: {
        g1: scores[matchId]?.g1 ?? '',
        g2: scores[matchId]?.g2 ?? '',
        [side]: cleaned
      }
    };
    setScores(newScores);
    await db.savePartidos(disciplina.id, generatedMatches, newScores);
  };

  // Export to Excel / CSV File
  const handleExportCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,\uFEFF"; // UTF-8 BOM so Excel opens with proper accents
    csvContent += `FIXTURE OFICIAL - ${disciplina.nombre.toUpperCase()}\n`;
    csvContent += `Fecha del campeonato: Campeonato de Un Solo Dia\n`;
    csvContent += `Canchas asignadas: ${disciplina.canchas || 'Por definir'}\n\n`;

    if (groupAMembers.length > 0) {
      csvContent += `GRUPO A\n`;
      csvContent += `Equipos:\n`;
      groupAMembers.forEach(t => csvContent += `- ${t}\n`);
      csvContent += `\n`;
    }
    if (groupBMembers.length > 0) {
      csvContent += `GRUPO B\n`;
      csvContent += `Equipos:\n`;
      groupBMembers.forEach(t => csvContent += `- ${t}\n`);
      csvContent += `\n`;
    }

    csvContent += `PARTIDOS Y ENCUENTROS\n`;

    const uniqueCourts = Array.from(new Set<string>(generatedMatches.map(m => m.cancha)));
    uniqueCourts.forEach(cancha => {
      csvContent += `\n--- PARTIDOS EN ${cancha.toUpperCase()} ---\n`;
      csvContent += `Ronda,Grupo,Cancha,Hora,Equipo 1,Puntaje,Puntaje,Equipo 2,Estado\n`;
      const matchesCourt = generatedMatches.filter(m => m.cancha === cancha);
      matchesCourt.forEach((m) => {
        const g1 = scores[m.id]?.g1 ?? '';
        const g2 = scores[m.id]?.g2 ?? '';
        const status = g1 && g2 ? 'Jugado' : 'Pendiente';
        csvContent += `Ronda ${m.ronda},${m.grupo},${m.cancha},${m.hora || '--:--'},"${m.equipo1}",${g1},${g2},"${m.equipo2}",${status}\n`;
      });
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Fixture_${disciplina.nombre.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('¡Archivo CSV descargado exitosamente! Ábrelo en Excel.');
  };

  // Print highly formatted PDF via browser native printing
  const handlePrintPDF = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      showToast('Permite las ventanas emergentes para exportar el PDF.', 'error');
      return;
    }

    const uniqueCourts = Array.from(new Set<string>(generatedMatches.map(m => m.cancha)));
    const matchesHtml = uniqueCourts.map(cancha => {
      const matchesCourt = generatedMatches.filter(m => m.cancha === cancha);
      const rowsHtml = matchesCourt.map((m, idx) => `
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 12px; font-weight: 600;">#${idx + 1}</td>
          <td style="padding: 12px; font-weight: 600; color: #4f46e5;">Ronda ${m.ronda}</td>
          <td style="padding: 12px; font-weight: 500; color: #0891b2;">${m.grupo}</td>
          <td style="padding: 12px; font-style: italic; color: #4b5563;">${m.cancha}</td>
          <td style="padding: 12px; font-weight: bold; color: #e11d48;">${m.hora || '--:--'}</td>
          <td style="padding: 12px; text-align: right; font-weight: 700; width: 30%; font-size: 14px;">${m.equipo1}</td>
          <td style="padding: 12px; text-align: center; font-weight: bold; background: #e2e8f0; width: 15%; border-radius: 6px; font-size: 15px; border: 1px solid #cbd5e1;">
            ${scores[m.id]?.g1 ?? ' - '} &nbsp;&nbsp;:&nbsp;&nbsp; ${scores[m.id]?.g2 ?? ' - '}
          </td>
          <td style="padding: 12px; text-align: left; font-weight: 700; width: 30%; font-size: 14px;">${m.equipo2}</td>
        </tr>
      `).join('');

      return `
        <h3 style="color: #1e3a8a; font-size: 16px; border-bottom: 2px solid #1e3a8a; padding-bottom: 8px; margin-top: 30px; margin-bottom: 15px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">
          Rol de Partidos - ${cancha}
        </h3>
        <table>
          <thead>
            <tr>
              <th style="width: 6%">Nro</th>
              <th style="width: 12%">Ronda</th>
              <th style="width: 10%">Grupo</th>
              <th style="width: 12%">Cancha</th>
              <th style="width: 10%">Hora</th>
              <th style="width: 20%; text-align: right;">Equipo 1</th>
              <th style="width: 10%; text-align: center;">Marcador</th>
              <th style="width: 20%; text-align: left;">Equipo 2</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      `;
    }).join('');

    // Dynamically calculate groups and teams from the actual generated matches
    const groupsInFixture = Array.from(new Set(generatedMatches.map(m => m.grupo)));
    const dynamicGroupsHtml = groupsInFixture.map((groupName, idx) => {
      const matchesInGroup = generatedMatches.filter(m => m.grupo === groupName);
      const teamsInGroup = new Set<string>();
      matchesInGroup.forEach(m => {
        if (!m.equipo1.includes('BYE_') && !m.equipo1.includes('BYE (')) teamsInGroup.add(m.equipo1);
        if (!m.equipo2.includes('BYE_') && !m.equipo2.includes('BYE (')) teamsInGroup.add(m.equipo2);
      });
      
      const teamHtml = Array.from(teamsInGroup).map(t => `<li style="padding: 3px 0;">${t}</li>`).join('');
      const colors = ['#4f46e5', '#0891b2', '#16a34a', '#d97706', '#9333ea', '#e11d48'];
      const color = colors[idx % colors.length];
      
      return `
        <div style="min-width: 120px;">
          <strong style="color: ${color}; font-size: 12px; text-transform: uppercase;">${groupName}</strong>
          <ul style="margin: 6px 0 0 0;">${teamHtml}</ul>
        </div>
      `;
    }).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>Fixture Oficial - ${disciplina.nombre}</title>
          <style>
            body { font-family: 'Segoe UI', Roboto, Helvetica, sans-serif; padding: 40px; color: #0f172a; line-height: 1.5; background-color: #ffffff; }
            .header { text-align: center; border-bottom: 4px double #4f46e5; padding-bottom: 15px; margin-bottom: 25px; }
            .title { font-size: 26px; font-weight: 800; color: #1e3a8a; margin: 0; text-transform: uppercase; letter-spacing: 0.5px; }
            .subtitle { font-size: 12px; color: #64748b; margin-top: 6px; text-transform: uppercase; letter-spacing: 2px; font-weight: 600; }
            .info-grid { display: grid; grid-template-columns: 1.2fr 0.8fr; gap: 20px; margin-bottom: 30px; }
            .info-card { background: #f8fafc; padding: 18px; border-radius: 10px; border: 1px solid #e2e8f0; }
            .info-card h4 { margin: 0 0 10px 0; font-size: 12px; text-transform: uppercase; color: #4f46e5; letter-spacing: 1px; font-weight: 700; }
            .info-card ul { margin: 0; padding-left: 18px; font-size: 13px; color: #334155; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; }
            th { background: #1e3a8a; color: white; padding: 12px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; font-weight: 700; }
            tr:nth-child(even) { background: #f8fafc; }
            .signature-area { margin-top: 60px; display: flex; justify-content: space-around; font-size: 12px; text-align: center; font-weight: 500; }
            .sig-box { border-top: 1px solid #94a3b8; width: 200px; margin-top: 45px; padding-top: 8px; color: #475569; }
            .footer { margin-top: 50px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 15px; }
            @media print {
              body { padding: 15px; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="title">FIXTURE OFICIAL - ${disciplina.nombre.toUpperCase()}</div>
            <div class="subtitle">Fixture express - Campeonato relámpago</div>
          </div>

          <div class="info-grid">
            <div class="info-card">
              <h4>Configuración de la Disciplina</h4>
              <div style="font-size: 13px; color: #334155; line-height: 1.6;">
                <strong>Campos de Juego (Canchas):</strong> ${disciplina.canchas || 'Por asignar'}<br>
                <strong>Reglamento y Notas:</strong> ${disciplina.descripcion || 'Estándar para campeonato de un solo día.'}<br>
                <strong>Modo del Torneo:</strong> Sorteo en Ruleta - Máx. 3 partidos por equipo (Sin revanchas duplicadas)
              </div>
            </div>
            <div class="info-card">
              <h4>Grupos Sorteados</h4>
              <div style="display: flex; gap: 30px; flex-wrap: wrap;">
                ${groupsInFixture.length > 0 ? dynamicGroupsHtml : `
                  <div>
                    <strong style="color: #4f46e5; font-size: 12px;">Equipos</strong>
                    <ul style="margin: 6px 0 0 0;">${equipos.map(t => `<li style="padding: 3px 0;">${t.nombre}</li>`).join('')}</ul>
                  </div>
                `}
              </div>
            </div>
          </div>

          <h3 style="color: #1e3a8a; font-size: 16px; border-bottom: 2px solid #1e3a8a; padding-bottom: 8px; margin-bottom: 15px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">
            Rol de Partidos Programados
          </h3>
          <div style="margin-top: 10px;">
            ${matchesHtml}
          </div>

          <div class="signature-area">
            <div class="sig-box">
              Firma del Coordinador General
            </div>
            <div class="sig-box">
              Mesa de Planillaje / Árbitro
            </div>
          </div>

          <div class="footer">
            Generado por Fixture Express. Fecha de Impresión: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}
          </div>

          <script>
            window.onload = function() { 
              setTimeout(function() {
                window.print(); 
              }, 300);
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const filteredEquipos = equipos.filter(equi =>
    equi.nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (equi.delegado && equi.delegado.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Agrupar dinámicamente los equipos por grupo según los partidos generados
  const groupsFromMatches: Record<string, string[]> = {};
  generatedMatches.forEach(m => {
    if (m.grupo) {
      if (!groupsFromMatches[m.grupo]) {
        groupsFromMatches[m.grupo] = [];
      }
      if (!groupsFromMatches[m.grupo].includes(m.equipo1)) {
        groupsFromMatches[m.grupo].push(m.equipo1);
      }
      if (!groupsFromMatches[m.grupo].includes(m.equipo2)) {
        groupsFromMatches[m.grupo].push(m.equipo2);
      }
    }
  });

  // Obtener la cancha asignada a cada grupo leyendo su primer partido
  const getGroupCourt = (groupName: string): string => {
    const firstMatch = generatedMatches.find(m => m.grupo === groupName);
    return firstMatch ? firstMatch.cancha : 'Sin asignar';
  };

  return (
    <div className="space-y-6">
      {/* Upper Navigation & Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div className="space-y-1.5">
          <button
            onClick={onBack}
            className="group inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-indigo-600 transition-colors uppercase tracking-wider"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            Volver a Deportes
          </button>
          <h2 className="font-display font-extrabold text-slate-900 text-xl sm:text-2xl md:text-3xl flex items-center gap-2">
            <Trophy className="w-7 h-7 text-indigo-600" />
            {disciplina.nombre}
          </h2>
          {disciplina.canchas && (
            <div className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-md px-2.5 py-1 w-max">
              <span className="font-semibold">Cancha asignada:</span> {disciplina.canchas}
            </div>
          )}
        </div>

        {/* Tab Selection */}
        <div className="bg-slate-100 p-1 rounded-xl flex items-center shrink-0 w-full sm:w-auto">
          <button
            onClick={() => setActiveSubTab('equipos')}
            className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 transition-all ${
              activeSubTab === 'equipos'
                ? 'bg-white text-indigo-600 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="w-4 h-4" />
            Equipos ({equipos.length})
          </button>
          <button
            onClick={() => setActiveSubTab('fixture')}
            className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 transition-all ${
              activeSubTab === 'fixture'
                ? 'bg-white text-indigo-600 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Dices className="w-4 h-4" />
            Sorteo y Fixture
          </button>
        </div>
      </div>

      {/* Main tab switch panels */}
      {activeSubTab === 'equipos' ? (
        <div className="space-y-6">
          {/* Quick Info card */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-indigo-50 to-indigo-100/50 rounded-xl p-4 border border-indigo-100/80">
              <span className="text-xs font-semibold text-indigo-700 uppercase tracking-wider block">Total Inscritos</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-3xl font-bold text-slate-900">{equipos.length}</span>
                <span className="text-xs text-indigo-600 font-medium">equipos</span>
              </div>
            </div>
            <div className="bg-white rounded-xl p-4 border border-slate-200">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Sorteo de Canchas</span>
              <span className="text-sm font-medium text-slate-700 mt-1 block">
                {splitIntoTwoCourts ? 'Dos canchas (Grupos A y B)' : 'Cancha única (Grupo General)'}
              </span>
            </div>
            <div className="bg-white rounded-xl p-4 border border-slate-200">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Partidos por Equipo</span>
              <span className="text-sm font-semibold text-indigo-600 mt-1 block">
                Cada equipo jugará 3 partidos
              </span>
            </div>
          </div>

          {/* Search & register button bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Buscar por equipo o delegado..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
              />
            </div>
            <button
              onClick={handleOpenAdd}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 hover:shadow-md transition-all active:scale-98"
            >
              <Plus className="w-4 h-4" />
              Inscribir Equipo
            </button>
          </div>

          {/* Form Modal */}
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
                      <Users className="w-5 h-5 text-indigo-600" />
                      {editingId ? 'Editar Equipo' : 'Nuevo Registro de Equipo'}
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
                      <label htmlFor="team-name" className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                        Nombre del Equipo <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <Users className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4.5 h-4.5" />
                        <input
                          type="text"
                          id="team-name"
                          value={nombre}
                          onChange={(e) => setNombre(e.target.value)}
                          placeholder="Ej. Los Intocables FC, Deportivo Cristal"
                          className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                          required
                          autoFocus
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label htmlFor="team-delegate" className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                        Nombre del Delegado / Representante
                      </label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4.5 h-4.5" />
                        <input
                          type="text"
                          id="team-delegate"
                          value={delegado}
                          onChange={(e) => setDelegado(e.target.value)}
                          placeholder="Ej. Roberto Martínez"
                          className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label htmlFor="team-contact" className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                        Contacto (Teléfono / Email)
                      </label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4.5 h-4.5" />
                        <input
                          type="text"
                          id="team-contact"
                          value={contacto}
                          onChange={(e) => setContacto(e.target.value)}
                          placeholder="Ej. +51 987 123 456"
                          className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                        />
                      </div>
                    </div>

                    <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => setShowForm(false)}
                        disabled={isSubmitting}
                        className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors hover:shadow-sm flex items-center gap-1.5 disabled:opacity-50"
                      >
                        {isSubmitting ? (
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Save className="w-4 h-4" />
                        )}
                        {isSubmitting ? 'Guardando...' : (editingId ? 'Guardar Cambios' : 'Registrar Equipo')}
                      </button>
                    </div>
                  </form>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
          
          {/* Custom Delete Confirmation Modal */}
          <AnimatePresence>
            {showDeleteConfirm && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-white rounded-xl shadow-xl border border-slate-100 max-w-md w-full overflow-hidden"
                >
                  <div className="flex items-center justify-between px-6 py-4 bg-red-50 border-b border-red-100/50">
                    <h3 className="font-display font-semibold text-red-800 flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-red-600" />
                      ¿Eliminar Fixture?
                    </h3>
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      className="p-1 rounded-full text-red-400 hover:bg-red-100/50 hover:text-red-600 transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="p-6 space-y-4">
                    <p className="text-sm text-slate-600 leading-relaxed">
                      ¿Estás seguro de eliminar el fixture de <strong>{disciplina.nombre}</strong>? Se borrarán permanentemente todos los partidos, grupos y puntajes registrados para esta disciplina. Esta acción no se puede deshacer.
                    </p>

                    <div className="flex items-center justify-end gap-2.5 pt-2">
                      <button
                        type="button"
                        onClick={() => setShowDeleteConfirm(false)}
                        className="px-4 py-2 border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={handleResetSorteo}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors hover:shadow-sm flex items-center gap-1.5"
                      >
                        <Trash2 className="w-4 h-4" />
                        Sí, eliminar fixture
                      </button>
                    </div>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* Teams Grid */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2">
              <div className="w-8 h-8 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
              <span className="text-xs text-slate-400 font-medium">Cargando lista de equipos...</span>
            </div>
          ) : filteredEquipos.length === 0 ? (
            <div className="bg-white rounded-xl border border-dashed border-slate-300 p-12 text-center max-w-lg mx-auto">
              <div className="w-12 h-12 rounded-full bg-slate-50 text-slate-400 flex items-center justify-center mx-auto mb-4">
                <Users className="w-6 h-6" />
              </div>
              <h4 className="font-display font-semibold text-slate-800 mb-1">Sin equipos registrados</h4>
              <p className="text-sm text-slate-500 mb-6 leading-relaxed">
                {searchQuery 
                  ? 'No hay equipos que coincidan con la búsqueda. Intenta con otro término.' 
                  : `Aún no se han inscrito equipos para ${disciplina.nombre}.`}
              </p>
              {!searchQuery && (
                <button
                  onClick={handleOpenAdd}
                  className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all"
                >
                  <Plus className="w-4 h-4" />
                  Inscribir primer equipo
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredEquipos.map((equi, idx) => (
                <motion.div
                  key={`${equi.id || 'equi'}-${idx}`}
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.2, delay: idx * 0.04 }}
                  className="bg-white rounded-xl border border-slate-200 hover:border-indigo-200 p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div className="space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-sm">
                          {equi.nombre.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <h4 className="font-display font-bold text-slate-800 text-sm sm:text-base">
                            {equi.nombre}
                          </h4>
                          <span className="text-[10px] text-slate-400 uppercase tracking-wider font-mono">
                            ID: {equi.id.substring(0, 8)}...
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleOpenEdit(equi)}
                          title="Editar"
                          className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(equi.id, equi.nombre)}
                          title="Eliminar"
                          className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2 border-t border-slate-100 pt-3 text-xs text-slate-600">
                      <div className="flex items-center gap-2">
                        <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="font-medium text-slate-500">Delegado:</span>
                        <span className="text-slate-800 font-semibold truncate">
                          {equi.delegado || <span className="font-normal italic text-slate-400">No especificado</span>}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="font-medium text-slate-500">Contacto:</span>
                        <span className="text-slate-800 font-semibold truncate">
                          {equi.contacto || <span className="font-normal italic text-slate-400">No especificado</span>}
                        </span>
                      </div>
                    </div>
                  </div>

                  {equipos.length < 2 && (
                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-1.5 text-[10px] text-amber-600 bg-amber-50 px-2.5 py-1 rounded-md">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>Inscribe más equipos para poder realizar el sorteo</span>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Sorteo & Fixture Tab */
        <div className="space-y-6">
          {/* Sorteo Settings Card */}
          {!fixtureGenerated && !isDrawing && (
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs max-w-xl mx-auto space-y-6">
              <div className="text-center space-y-2">
                <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-2">
                  <Dices className="w-6 h-6 animate-spin-slow" />
                </div>
                <h3 className="font-display font-bold text-slate-900 text-lg sm:text-xl">
                  Configurar Sorteo de Fixture ({disciplina.nombre})
                </h3>
                <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
                  Configura los parámetros del torneo de fase de grupos. Se generará un fixture de <strong>todos contra todos</strong> para cada grupo, programando los partidos en paralelo para empezar a la misma hora en todas las canchas.
                </p>
              </div>

              {/* Parámetros de Configuración */}
              <div className="p-5 rounded-xl bg-slate-50 border border-slate-100 space-y-4">
                
                {/* 1. Cantidad de Grupos */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Cantidad de Grupos
                  </label>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                    {[1, 2, 3, 4, 5, 6].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => {
                          setNumGroups(num);
                          // Sincronizar el checkbox antiguo por compatibilidad
                          setSplitIntoTwoCourts(num > 1);
                        }}
                        className={`py-2 px-3 rounded-lg border text-xs font-bold transition-all text-center ${
                          numGroups === num
                            ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {num === 1 ? 'Único' : `${num} Grupos`}
                      </button>
                    ))}
                  </div>
                  <span className="text-[10px] text-slate-500 block">
                    Los {equipos.length} equipos se distribuirán de forma equitativa en los grupos elegidos.
                  </span>
                </div>

                {/* 2. Tiempo que durará cada partido */}
                <div className="grid grid-cols-2 gap-4 border-t border-slate-200/60 pt-3">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Duración de Partido
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min={5}
                        max={180}
                        value={matchDuration === '' ? '' : matchDuration}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === '') {
                            setMatchDuration('');
                          } else {
                            const parsed = parseInt(val, 10);
                            if (!isNaN(parsed)) {
                              setMatchDuration(parsed);
                            }
                          }
                        }}
                        onBlur={() => {
                          if (matchDuration === '' || (typeof matchDuration === 'number' && matchDuration < 5)) {
                            setMatchDuration(5);
                          }
                        }}
                        className="w-full pl-3 pr-10 py-2 border border-slate-200 rounded-lg text-xs bg-white text-slate-800 font-semibold focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                      />
                      <span className="absolute right-3 top-2.5 text-[10px] font-bold text-slate-400">
                        min
                      </span>
                    </div>
                  </div>

                  {/* 3. Hora de inicio */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Hora de Inicio
                    </label>
                    <input
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value || '08:00')}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white text-slate-800 font-semibold focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="md:col-span-1 xl:col-span-3 flex flex-col justify-end">
                    <label className="flex items-center gap-2 cursor-pointer bg-slate-50 border border-slate-200 p-2.5 rounded-lg hover:bg-slate-100 transition-colors">
                      <input
                        type="checkbox"
                        checked={singleElimination}
                        onChange={(e) => setSingleElimination(e.target.checked)}
                        className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                      />
                      <span className="text-xs font-semibold text-slate-700">Modo Eliminación Simple (1 partido por equipo)</span>
                    </label>
                  </div>
                </div>

                {/* 4. Canchas disponibles */}
                <div className="space-y-1.5 border-t border-slate-200/60 pt-3">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    ¿En qué canchas se jugará?
                  </label>
                  <input
                    type="text"
                    value={customCanchas}
                    onChange={(e) => setCustomCanchas(e.target.value)}
                    placeholder="Ej. Cancha 1, Cancha 2, Cancha 3"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white text-slate-800 font-semibold placeholder:font-normal placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  />
                  <span className="text-[10px] text-slate-500 block leading-normal">
                    Separa las canchas por comas. Los grupos se asignarán a estas canchas de manera equitativa y los partidos empezarán simultáneamente a la hora indicada.
                  </span>
                </div>

                {/* 5. Reglas de Restricción */}
                <div className="space-y-3 border-t border-slate-200/60 pt-3">
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-amber-500" />
                      Reglas de Restricción (Opcional)
                    </label>
                    <span className="text-[10px] text-slate-500 block leading-normal">
                      Selecciona qué equipos tienen prohibido enfrentarse o estar en el mismo grupo.
                    </span>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <select
                      value={pairTeam1}
                      onChange={(e) => setPairTeam1(e.target.value)}
                      className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white text-slate-700 focus:outline-none focus:border-indigo-500"
                    >
                      <option value="">-- Seleccionar Equipo 1 --</option>
                      {equipos.map(e => (
                        <option key={`p1-${e.id}`} value={e.nombre} disabled={e.nombre === pairTeam2}>{e.nombre}</option>
                      ))}
                    </select>
                    <span className="text-xs font-bold text-slate-400 text-center">VS</span>
                    <select
                      value={pairTeam2}
                      onChange={(e) => setPairTeam2(e.target.value)}
                      className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white text-slate-700 focus:outline-none focus:border-indigo-500"
                    >
                      <option value="">-- Seleccionar Equipo 2 --</option>
                      {equipos.map(e => (
                        <option key={`p2-${e.id}`} value={e.nombre} disabled={e.nombre === pairTeam1}>{e.nombre}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => {
                        if (pairTeam1 && pairTeam2 && pairTeam1 !== pairTeam2) {
                          const exists = prohibitedPairs.some(p => 
                            (p.team1 === pairTeam1 && p.team2 === pairTeam2) ||
                            (p.team1 === pairTeam2 && p.team2 === pairTeam1)
                          );
                          if (!exists) {
                            setProhibitedPairs([...prohibitedPairs, { id: Date.now().toString(), team1: pairTeam1, team2: pairTeam2 }]);
                            setPairTeam1('');
                            setPairTeam2('');
                          } else {
                            showToast('Esta regla ya existe.', 'error');
                          }
                        }
                      }}
                      disabled={!pairTeam1 || !pairTeam2 || pairTeam1 === pairTeam2}
                      className="bg-slate-800 hover:bg-slate-900 text-white px-3 py-2 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                    >
                      Agregar Regla
                    </button>
                  </div>

                  {prohibitedPairs.length > 0 && (
                    <div className="mt-2 space-y-1.5">
                      {prohibitedPairs.map(pair => (
                        <div key={pair.id} className="flex items-center justify-between bg-red-50 border border-red-100 rounded-md px-3 py-1.5">
                          <span className="text-xs text-red-700 font-medium flex items-center gap-1.5">
                            <span className="truncate max-w-[120px] sm:max-w-[150px]">{pair.team1}</span>
                            <X className="w-3 h-3 text-red-400" />
                            <span className="truncate max-w-[120px] sm:max-w-[150px]">{pair.team2}</span>
                          </span>
                          <button
                            onClick={() => setProhibitedPairs(prohibitedPairs.filter(p => p.id !== pair.id))}
                            className="text-red-400 hover:text-red-600 p-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Sorteo por Parejas (Solo para 1 o 2 grupos) */}
                {numGroups <= 2 && (
                  <div className="flex items-center justify-between border-t border-slate-200/60 pt-3">
                    <div className="space-y-0.5">
                      <span className="text-xs font-bold text-slate-800 block">
                        Sorteo por Parejas en Ruleta
                      </span>
                      <span className="text-[10px] text-slate-500 block">
                        Balancea los grupos de inmediato sorteando de dos en dos.
                      </span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={sorteoPorPares}
                        onChange={(e) => setSorteoPorPares(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                  </div>
                )}
              </div>

              {/* Warnings and Info */}
              {equipos.length < 2 ? (
                <div className="p-3.5 bg-amber-50 border border-amber-100 rounded-lg flex items-start gap-2 text-amber-800 text-xs">
                  <Info className="w-4 h-4 shrink-0 mt-0.5" />
                  <p className="leading-relaxed">
                    Necesitas al menos 2 equipos para poder generar un fixture de encuentros.
                  </p>
                </div>
              ) : (
                <div className="p-3.5 bg-indigo-50 border border-indigo-100/50 rounded-lg flex items-start gap-2 text-indigo-800 text-xs">
                  <Check className="w-4 h-4 shrink-0 mt-0.5 text-indigo-600" />
                  <p className="leading-relaxed font-medium">
                    ¡Listo para programar! Se generará un rol donde todos juegan contra todos dentro de su grupo.
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col gap-2.5">
                {/* 1. Generar Fixture Automático (Principal) */}
                <button
                  onClick={handleGenerateFixtureAutomatic}
                  disabled={equipos.length < 2}
                  className="w-full bg-indigo-600 text-white font-bold py-3 px-4 rounded-xl shadow-md hover:bg-indigo-700 hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:bg-slate-300 disabled:shadow-none disabled:cursor-not-allowed"
                >
                  <Trophy className="w-4.5 h-4.5 text-amber-300" />
                  Generar Fixture de Grupos
                </button>

                {/* 2. Iniciar Ruleta (Opcional, solo si son 1 o 2 grupos) */}
                {numGroups <= 2 && (
                  <button
                    onClick={handleStartRaffle}
                    disabled={equipos.length < 2}
                    className="w-full border border-slate-200 text-slate-700 font-semibold py-2.5 px-4 rounded-xl hover:bg-slate-50 transition-all flex items-center justify-center gap-2 disabled:border-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                  >
                    <Flame className="w-4 h-4 text-amber-500" />
                    Sortear con Ruleta Animada
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Sorteo Animation Screen */}
          {isDrawing && (
            <div className="bg-slate-900 text-white rounded-2xl p-6 sm:p-10 shadow-2xl border border-slate-800 max-w-2xl mx-auto space-y-8 relative overflow-hidden">
              {/* Spinning cosmic glow background */}
              <div className="absolute -right-20 -top-20 w-80 h-80 rounded-full bg-indigo-600/10 blur-3xl" />
              <div className="absolute -left-20 -bottom-20 w-80 h-80 rounded-full bg-violet-600/10 blur-3xl" />

              <div className="text-center space-y-2 relative z-10">
                <span className="text-[10px] uppercase tracking-widest bg-indigo-500/20 text-indigo-300 px-3 py-1 rounded-full border border-indigo-500/30 font-semibold font-mono inline-block">
                  {waitingForNextStep ? 'Sorteo Pausado' : 'Sorteando Equipos en Tiempo Real'}
                </span>
                <h3 className="font-display font-extrabold text-2xl sm:text-3xl text-white">
                  {waitingForNextStep ? '¡Resultado del Sorteo!' : 'La Ruleta Deportiva'}
                </h3>
                <p className="text-xs text-slate-400">
                  {waitingForNextStep 
                    ? 'Revisa el resultado parcial de esta ronda del sorteo.' 
                    : 'Asignando aleatoriamente al próximo grupo de juego...'}
                </p>
              </div>

              {/* Spinning Board Card or Paused Result Card */}
              <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-8 text-center relative z-10 shadow-inner flex flex-col items-center justify-center min-h-[180px]">
                {waitingForNextStep ? (
                  <div className="space-y-6 w-full">
                    <span className="inline-block text-[10px] uppercase tracking-wider bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full border border-emerald-500/30 font-bold font-mono animate-pulse">
                      Último Sorteado
                    </span>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-12 w-full">
                      {/* First Team */}
                      {lastDrawnTeam && (
                        <div className="space-y-3 flex-1 bg-slate-950/40 p-4 rounded-xl border border-slate-700/50">
                          <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-indigo-500 to-indigo-600 flex items-center justify-center text-xl font-black mx-auto shadow-md shadow-indigo-500/20 text-white">
                            {lastDrawnTeam.charAt(0).toUpperCase()}
                          </div>
                          <div className="text-lg sm:text-xl font-display font-extrabold text-white tracking-tight animate-bounce">
                            {lastDrawnTeam}
                          </div>
                          <span className="inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                            {splitIntoTwoCourts ? 'Grupo A (Cancha 1)' : 'Grupo Único'}
                          </span>
                        </div>
                      )}

                      {/* Second Team */}
                      {lastDrawnTeam2 && (
                        <div className="space-y-3 flex-1 bg-slate-950/40 p-4 rounded-xl border border-slate-700/50">
                          <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-cyan-500 to-cyan-600 flex items-center justify-center text-xl font-black mx-auto shadow-md shadow-cyan-500/20 text-white">
                            {lastDrawnTeam2.charAt(0).toUpperCase()}
                          </div>
                          <div className="text-lg sm:text-xl font-display font-extrabold text-white tracking-tight animate-bounce">
                            {lastDrawnTeam2}
                          </div>
                          <span className="inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                            {splitIntoTwoCourts ? 'Grupo B (Cancha 2)' : 'Grupo Único'}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  currentSpinningTeam ? (
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-12 w-full">
                      {/* First Team */}
                      <motion.div
                        key={currentSpinningTeam}
                        initial={{ scale: 0.9, opacity: 0.8 }}
                        animate={{ scale: 1.05, opacity: 1 }}
                        className="space-y-3 flex-1"
                      >
                        <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-indigo-500 to-indigo-600 flex items-center justify-center text-xl font-black mx-auto shadow-md shadow-indigo-500/20 text-white animate-pulse">
                          {currentSpinningTeam.charAt(0).toUpperCase()}
                        </div>
                        <div className="text-lg sm:text-xl font-display font-extrabold text-indigo-300 tracking-tight">
                          {currentSpinningTeam}
                        </div>
                        {lastDrawnTeam === currentSpinningTeam && (
                          <span className="inline-block text-[10px] uppercase tracking-wider bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/30 font-bold">
                            {splitIntoTwoCourts ? 'Grupo A' : 'Asignado'}
                          </span>
                        )}
                      </motion.div>

                      {/* VS/Pair Divider */}
                      {currentSpinningTeam2 && (
                        <div className="text-slate-500 font-bold text-xs tracking-widest uppercase bg-slate-900/50 px-3 py-1.5 rounded-full border border-slate-700/40">
                          Pareja
                        </div>
                      )}

                      {/* Second Team */}
                      {currentSpinningTeam2 && (
                        <motion.div
                          key={currentSpinningTeam2}
                          initial={{ scale: 0.9, opacity: 0.8 }}
                          animate={{ scale: 1.05, opacity: 1 }}
                          className="space-y-3 flex-1"
                        >
                          <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-cyan-500 to-cyan-600 flex items-center justify-center text-xl font-black mx-auto shadow-md shadow-cyan-500/20 text-white animate-pulse">
                            {currentSpinningTeam2.charAt(0).toUpperCase()}
                          </div>
                          <div className="text-lg sm:text-xl font-display font-extrabold text-cyan-300 tracking-tight">
                            {currentSpinningTeam2}
                          </div>
                          {lastDrawnTeam2 === currentSpinningTeam2 && (
                            <span className="inline-block text-[10px] uppercase tracking-wider bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/30 font-bold">
                              {splitIntoTwoCourts ? 'Grupo B' : 'Asignado'}
                            </span>
                          )}
                        </motion.div>
                      )}
                    </div>
                  ) : (
                    <span className="text-slate-500 text-sm font-medium animate-pulse">
                      Inicializando cilindro de sorteo...
                    </span>
                  )
                )}
              </div>

              {/* Destination Group Indicator */}
              {splitIntoTwoCourts && currentSpinningTeam && !waitingForNextStep && (
                <div className="flex items-center justify-center gap-2 text-sm font-bold text-slate-300 border border-slate-800 bg-slate-950 px-4 py-2 rounded-xl w-max mx-auto">
                  <span>Destino Actual:</span>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-black ${
                    drawTargetGroup === 'A' 
                      ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40' 
                      : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  }`}>
                    {drawTargetGroup === 'A' ? 'Grupo A (Cancha 1)' : 'Grupo B (Cancha 2)'}
                  </span>
                </div>
              )}

              {/* Interaction Buttons during Sorteo Paused */}
              {waitingForNextStep && (
                <div className="flex flex-col sm:flex-row gap-3 justify-center relative z-10 pt-2">
                  <button
                    onClick={handleNextDrawStep}
                    className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold py-3.5 px-6 rounded-xl shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Dices className="w-5 h-5 text-emerald-200" />
                    Sortear Siguiente Equipo
                  </button>
                  <button
                    onClick={handleCompleteAutoDraw}
                    className="flex-1 bg-slate-800 hover:bg-slate-750 text-indigo-300 font-bold py-3.5 px-6 rounded-xl border border-indigo-500/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4 text-indigo-400" />
                    Sorteo Automático
                  </button>
                  <button
                    onClick={handleCancelOrResetDrawing}
                    className="sm:w-max bg-red-950/40 hover:bg-red-900/40 text-red-400 border border-red-900/50 font-semibold py-3.5 px-5 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Reiniciar
                  </button>
                </div>
              )}

              {/* Reset/Cancel button during Active Spinning */}
              {!waitingForNextStep && (
                <div className="text-center relative z-10">
                  <button
                    onClick={handleCancelOrResetDrawing}
                    className="text-xs text-slate-500 hover:text-red-400 hover:bg-red-500/10 border border-slate-800 hover:border-red-500/30 px-3.5 py-1.5 rounded-lg transition-all inline-flex items-center gap-1.5 font-medium cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Reiniciar Sorteo
                  </button>
                </div>
              )}

              {/* Progress and Teams lists inside drawing */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-4 border-t border-slate-800 relative z-10">
                <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800/80">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2 font-bold text-indigo-400">
                    <span>Grupo A (Cancha 1)</span>
                    <span className="bg-indigo-500/10 text-indigo-300 px-2 py-0.5 rounded-full">{groupAMembers.length}</span>
                  </div>
                  {groupAMembers.length === 0 ? (
                    <span className="text-slate-600 italic">Esperando sorteo...</span>
                  ) : (
                    <ul className="space-y-1 text-slate-300">
                      {groupAMembers.map((t, i) => (
                        <li key={i} className="flex items-center gap-1.5 font-medium truncate">
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                          {t}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {splitIntoTwoCourts && (
                  <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800/80">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2 font-bold text-cyan-400">
                      <span>Grupo B (Cancha 2)</span>
                      <span className="bg-cyan-500/10 text-cyan-300 px-2 py-0.5 rounded-full">{groupBMembers.length}</span>
                    </div>
                    {groupBMembers.length === 0 ? (
                      <span className="text-slate-600 italic">Esperando sorteo...</span>
                    ) : (
                      <ul className="space-y-1 text-slate-300">
                        {groupBMembers.map((t, i) => (
                          <li key={i} className="flex items-center gap-1.5 font-medium truncate">
                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                            {t}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Render Active Sorteado Fixture View */}
          {fixtureGenerated && !isDrawing && (
            <div className="space-y-6">
              {hasGenerationConflicts && (
                <div className="bg-orange-50 border border-orange-200 p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
                    <p className="text-sm font-medium text-orange-800">
                      <strong>Cruce detectado:</strong> Para evitar horas huecas, se forzó la programación de partidos en horarios ocupados por otros deportes.
                    </p>
                  </div>
                  <button
                    onClick={handleGenerateFixtureAutomatic}
                    className="shrink-0 px-4 py-2 bg-white hover:bg-orange-100 text-orange-700 border border-orange-300 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors shadow-xs"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Generar de Nuevo
                  </button>
                </div>
              )}

              {/* Quick Actions & Meta Header */}
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
                <div className="space-y-1">
                  <h3 className="font-display font-extrabold text-slate-900 text-lg sm:text-xl flex items-center gap-2">
                    <Award className="w-5.5 h-5.5 text-indigo-600" />
                    Fixture Sorteado Oficial
                  </h3>
                  <p className="text-xs text-slate-500">
                    Cada equipo juega exactamente 3 encuentros en canchas diferenciadas sin repetir rivales.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    onClick={() => {
                      setEditingMatches([...generatedMatches]);
                      setIsEditingFixture(true);
                    }}
                    className="px-3 py-2 border border-indigo-200 hover:bg-indigo-50 text-indigo-600 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    Editar Sorteo
                  </button>

                  <button
                    onClick={handleResetSorteo}
                    className="px-3 py-2 border border-red-200 hover:bg-red-50 text-red-600 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Eliminar Fixture
                  </button>

                  <button
                    onClick={handleExportCSV}
                    className="px-3 py-2 border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5 text-indigo-500" />
                    Descargar Excel
                  </button>

                  <button
                    onClick={handlePrintPDF}
                    className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 hover:shadow-sm transition-all"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    Descargar / Imprimir PDF
                  </button>
                </div>
              </div>

              {/* Group Distribution Visual Cards (Dynamic) */}
              {Object.keys(groupsFromMatches).length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {Object.entries(groupsFromMatches).map(([groupName, teamsList], idx) => {
                    const groupCourt = getGroupCourt(groupName);
                    // Colores temáticos elegantes para diferenciar los grupos
                    const borderColors = [
                      'border-indigo-200 bg-indigo-50/50 text-indigo-900',
                      'border-cyan-200 bg-cyan-50/50 text-cyan-900',
                      'border-emerald-200 bg-emerald-50/50 text-emerald-900',
                      'border-amber-200 bg-amber-50/50 text-amber-900'
                    ];
                    const themeClass = borderColors[idx % borderColors.length];
                    
                    return (
                      <div key={groupName} className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs flex flex-col justify-between">
                        <div className={`px-4 py-3 border-b flex items-center justify-between ${themeClass.split(' ')[1]}`}>
                          <div className="flex items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full ${
                              idx % 4 === 0 ? 'bg-indigo-600' :
                              idx % 4 === 1 ? 'bg-cyan-600' :
                              idx % 4 === 2 ? 'bg-emerald-600' : 'bg-amber-600'
                            }`} />
                            <span className="font-display font-bold text-xs sm:text-sm text-slate-800">
                              {groupName}
                            </span>
                          </div>
                          <span className="text-[10px] font-bold bg-white/80 px-2 py-0.5 rounded-full border border-slate-200/50 text-slate-600">
                            {teamsList.length} equipos
                          </span>
                        </div>
                        <div className="p-4 flex-1 space-y-3">
                          <div className="flex flex-wrap gap-1.5">
                            {teamsList.map((team, tIdx) => (
                              <span
                                key={tIdx}
                                className="inline-flex items-center gap-1 bg-slate-50 border border-slate-150 rounded-md px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
                              >
                                <Trophy className="w-3 h-3 text-slate-400 shrink-0" />
                                {team}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 text-[10px] font-semibold text-slate-500 flex items-center justify-between">
                          <span>Sede / Cancha:</span>
                          <span className="text-slate-700 font-bold bg-slate-200/60 px-1.5 py-0.5 rounded">
                            {groupCourt}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Matches List Grid with Live Score or Manual Editing */}
              <div className={`bg-white rounded-xl border overflow-hidden shadow-xs ${isEditingFixture ? 'border-amber-300 ring-2 ring-amber-100' : 'border-slate-200'}`}>
                <div className={`px-5 py-4 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${isEditingFixture ? 'bg-amber-50/50 border-amber-200' : 'border-slate-100'}`}>
                  <div className="space-y-1">
                    <h4 className="font-display font-bold text-slate-800 text-base flex items-center gap-1.5">
                      <ListOrdered className="w-4.5 h-4.5 text-indigo-600" />
                      {isEditingFixture ? 'Editar Rol de Encuentros' : 'Rol de Encuentros y Marcadores'}
                    </h4>
                    {isEditingFixture && (
                      <p className="text-xs text-amber-700 font-medium">
                        Estás modificando el fixture manualmente. Los conflictos de cruce y descanso con otros deportes se calcularán en tiempo real.
                      </p>
                    )}
                  </div>
                  
                  {isEditingFixture ? (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleCancelEditFixture}
                        className="px-3 py-1.5 border border-slate-200 hover:bg-white text-slate-600 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors shadow-xs"
                      >
                        <X className="w-3.5 h-3.5" />
                        Cancelar
                      </button>
                      <button
                        onClick={handleAddManualMatch}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition-all shadow-xs"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Añadir Partido
                      </button>
                      <button
                        onClick={handleSaveEditedFixture}
                        className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs hover:shadow-md"
                      >
                        <Check className="w-3.5 h-3.5" />
                        Guardar Cambios
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setEditingMatches([...generatedMatches]);
                          setIsEditingFixture(true);
                        }}
                        className="px-3.5 py-1.5 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        Editar Sorteo
                      </button>
                      <span className="text-xs text-slate-500 font-semibold bg-slate-100 px-3 py-1 rounded-full">
                        Sincronizado {soundEnabled ? '● Sonidos' : ''}
                      </span>
                    </div>
                  )}
                </div>

                <div className="w-full">
                  {(() => {
                    const matchesToRender = isEditingFixture ? editingMatches : generatedMatches;
                    const canchas = isEditingFixture 
                      ? ['Edición Manual'] 
                      : Array.from(new Set(matchesToRender.map(m => m.cancha)));

                    return canchas.map((canchaKey, tIdx) => {
                      const groupMatches = isEditingFixture 
                        ? matchesToRender 
                        : matchesToRender.filter(m => m.cancha === canchaKey);

                      return (
                        <div key={tIdx} className="mb-6">
                          <div className="bg-slate-800 text-white font-bold px-4 py-2 rounded-t-lg">
                            {isEditingFixture ? 'Cronograma en Edición' : `Cronograma - ${canchaKey}`}
                          </div>
                          <div className="overflow-x-auto border border-t-0 border-slate-200 rounded-b-lg">
                            <table className="w-full text-sm">
                              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                                <tr>
                                  <th className="py-2.5 px-4 text-center w-12">Nro</th>
                                  <th className="py-2.5 px-3 text-left w-20">Ronda</th>
                                  <th className="py-2.5 px-3 text-left w-24">Grupo</th>
                                  <th className="py-2.5 px-3 text-left w-24">Hora</th>
                                  <th className="py-2.5 px-3 text-left w-28">Cancha</th>
                                  <th className="py-2.5 px-3 text-right">Local</th>
                                  <th className="py-2.5 px-2 text-center w-24">Marcador</th>
                                  <th className="py-2.5 px-3 text-left">Visita</th>
                                  <th className="py-2.5 px-3 text-center w-24">
                                    {isEditingFixture ? 'Acción' : 'Estado'}
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {groupMatches.map((m, mappedIdx) => {
                                  const idx = isEditingFixture ? mappedIdx : matchesToRender.findIndex(x => x.id === m.id);
                                  const displayIdx = mappedIdx + 1;
                            const g1 = scores[m.id]?.g1 ?? '';
                            const g2 = scores[m.id]?.g2 ?? '';
                            const isPlayed = g1 !== '' && g2 !== '';

                            const conflicts1 = checkConflictsForTeam(m.equipo1, m.ronda, m.id, m.hora || '08:00');
                            const conflicts2 = checkConflictsForTeam(m.equipo2, m.ronda, m.id, m.hora || '08:00');

                            if (isEditingFixture) {
                              return (
                                <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                                  <td className="py-3 px-4 text-center font-mono text-slate-400 font-bold">
                                    {displayIdx}
                                  </td>
                                  <td className="py-3 px-3">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-slate-500 font-medium text-xs">Ronda</span>
                                      <input
                                        type="number"
                                        min={1}
                                        max={10}
                                        value={m.ronda}
                                        onChange={(e) => {
                                          const updated = [...editingMatches];
                                          updated[idx] = { ...updated[idx], ronda: parseInt(e.target.value) || 1 };
                                          setEditingMatches(updated);
                                        }}
                                        className="w-12 text-center py-1 border border-slate-200 rounded-md font-bold text-xs bg-white text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                      />
                                    </div>
                                  </td>
                                  <td className="py-3 px-3">
                                    <input
                                      type="text"
                                      value={m.grupo}
                                      onChange={(e) => {
                                        const updated = [...editingMatches];
                                        updated[idx] = { ...updated[idx], grupo: e.target.value };
                                        setEditingMatches(updated);
                                      }}
                                      placeholder="Grupo"
                                      className="w-24 px-2.5 py-1 border border-slate-200 rounded-md font-medium text-xs bg-white text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                    />
                                  </td>
                                  <td className="py-3 px-3">
                                    <input
                                      type="time"
                                      value={m.hora || '08:00'}
                                      onChange={(e) => {
                                        const updated = [...editingMatches];
                                        updated[idx] = { ...updated[idx], hora: e.target.value };
                                        setEditingMatches(updated);
                                      }}
                                      className="w-20 px-1.5 py-1 border border-slate-200 rounded-md font-semibold text-xs bg-white text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                    />
                                  </td>
                                  <td className="py-3 px-3">
                                    <input
                                      type="text"
                                      value={m.cancha}
                                      onChange={(e) => {
                                        const updated = [...editingMatches];
                                        updated[idx] = { ...updated[idx], cancha: e.target.value };
                                        setEditingMatches(updated);
                                      }}
                                      placeholder="Cancha"
                                      className="w-28 px-2.5 py-1 border border-slate-200 rounded-md font-medium text-xs bg-white text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                    />
                                  </td>
                                  <td className="py-3 px-3 text-right">
                                    <select
                                      value={m.equipo1}
                                      onChange={(e) => {
                                        const updated = [...editingMatches];
                                        updated[idx] = { ...updated[idx], equipo1: e.target.value };
                                        setEditingMatches(updated);
                                      }}
                                      className="w-40 px-2 py-1 border border-slate-200 rounded-md font-bold text-xs bg-white text-slate-800 focus:outline-none focus:border-indigo-500"
                                    >
                                      {equipos.map((eq, eIdx) => (
                                        <option key={`${eq.id || 'eq1'}-${eIdx}`} value={eq.nombre}>{eq.nombre}</option>
                                      ))}
                                      <option value="BYE_DUMMY">BYE (Descanso)</option>
                                    </select>
                                  </td>
                                  <td className="py-3 px-2 text-center text-slate-400 font-bold text-xs">
                                    VS
                                  </td>
                                  <td className="py-3 px-3 text-left">
                                    <select
                                      value={m.equipo2}
                                      onChange={(e) => {
                                        const updated = [...editingMatches];
                                        updated[idx] = { ...updated[idx], equipo2: e.target.value };
                                        setEditingMatches(updated);
                                      }}
                                      className="w-40 px-2 py-1 border border-slate-200 rounded-md font-bold text-xs bg-white text-slate-800 focus:outline-none focus:border-indigo-500"
                                    >
                                      {equipos.map((eq, eIdx) => (
                                        <option key={`${eq.id || 'eq2'}-${eIdx}`} value={eq.nombre}>{eq.nombre}</option>
                                      ))}
                                      <option value="BYE_DUMMY">BYE (Descanso)</option>
                                    </select>
                                  </td>
                                  <td className="py-3 px-3 text-center">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const updated = editingMatches.filter((_, mIdx) => mIdx !== idx);
                                        setEditingMatches(updated);
                                      }}
                                      className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                                      title="Eliminar partido"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </td>
                                </tr>
                              );
                            }

                            return (
                              <tr key={m.id} className="hover:bg-slate-50/50 transition-colors">
                                <td className="py-3.5 px-4 font-mono font-bold text-center text-slate-400">
                                  {displayIdx}
                                </td>
                                <td className="py-3.5 px-3">
                                  <span className="bg-indigo-50 text-indigo-700 border border-indigo-100 px-2 py-0.5 rounded-md font-semibold text-xs">
                                    Ronda {m.ronda}
                                  </span>
                                </td>
                                <td className="py-3.5 px-3 font-semibold text-slate-700">
                                  {m.grupo}
                                </td>
                                <td className="py-3.5 px-3">
                                  <span className="inline-flex items-center gap-1 bg-slate-100 border border-slate-200 text-slate-700 px-2 py-0.5 rounded-md font-bold text-xs font-mono">
                                    <Clock className="w-3 h-3 text-indigo-500 shrink-0" />
                                    {m.hora || '08:00'}
                                  </span>
                                </td>
                                <td className="py-3.5 px-3 text-slate-500 font-medium">
                                  {m.cancha}
                                </td>
                                <td className="py-3.5 px-3 text-right">
                                  <span className="font-bold text-slate-800">{m.equipo1}</span>
                                  <div className="space-y-1 mt-1 flex flex-col items-end">
                                    {conflicts1.map((c, cIdx) => (
                                      <div key={cIdx} className={`text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 w-max ${
                                        c.type === 'cruce' ? 'text-red-700 bg-red-50 border border-red-100' : 'text-amber-700 bg-amber-50 border border-amber-100'
                                      }`}>
                                        {c.type === 'cruce' ? <AlertTriangle className="w-3 h-3" /> : <Info className="w-3 h-3" />}
                                        <span>{c.message}</span>
                                      </div>
                                    ))}
                                  </div>
                                </td>
                                <td className="py-3.5 px-2 text-center">
                                  <div className="flex items-center justify-center gap-1">
                                    <input
                                      type="text"
                                      maxLength={3}
                                      value={g1}
                                      onChange={(e) => handleScoreChange(m.id, 'g1', e.target.value)}
                                      placeholder="-"
                                      className="w-10 text-center py-1 border border-slate-200 rounded-md font-black text-sm text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                    />
                                    <span className="font-bold text-slate-400">:</span>
                                    <input
                                      type="text"
                                      maxLength={3}
                                      value={g2}
                                      onChange={(e) => handleScoreChange(m.id, 'g2', e.target.value)}
                                      placeholder="-"
                                      className="w-10 text-center py-1 border border-slate-200 rounded-md font-black text-sm text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                    />
                                  </div>
                                </td>
                                <td className="py-3.5 px-3 text-left">
                                  <span className="font-bold text-slate-800">{m.equipo2}</span>
                                  <div className="space-y-1 mt-1 flex flex-col items-start">
                                    {conflicts2.map((c, cIdx) => (
                                      <div key={cIdx} className={`text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 w-max ${
                                        c.type === 'cruce' ? 'text-red-700 bg-red-50 border border-red-100' : 'text-amber-700 bg-amber-50 border border-amber-100'
                                      }`}>
                                        {c.type === 'cruce' ? <AlertTriangle className="w-3 h-3" /> : <Info className="w-3 h-3" />}
                                        <span>{c.message}</span>
                                      </div>
                                    ))}
                                  </div>
                                </td>
                                <td className="py-3.5 px-3 text-center">
                                  {isPlayed ? (
                                    <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                                      <Check className="w-3 h-3" /> Jugado
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-amber-700 bg-amber-100 px-2.5 py-0.5 rounded-full">
                                      Pendiente
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            </div>
          )}
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
    </div>
  );
}
