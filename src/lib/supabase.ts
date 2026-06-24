/// <reference types="vite/client" />
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Disciplina, Equipo, Match } from '../types';

// Read keys safely from environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Validate if they are actual values and not placeholders from .env.example
const isValidConfig =
  supabaseUrl &&
  supabaseAnonKey &&
  !supabaseUrl.includes('your-supabase-project') &&
  !supabaseAnonKey.includes('your-supabase-anon-key');

let supabase: SupabaseClient | null = null;

if (isValidConfig) {
  try {
    supabase = createClient(supabaseUrl, supabaseAnonKey);
  } catch (err) {
    console.error('Error al inicializar el cliente de Supabase:', err);
  }
}

export const isSupabaseConfigured = (): boolean => {
  return isValidConfig && supabase !== null;
};

export const getSupabaseConfig = () => {
  return {
    url: supabaseUrl,
    isConfigured: isValidConfig && supabase !== null,
  };
};

// --- Storage Key Constants for Local Mode Fallback ---
const LOCAL_DISCIPLINAS_KEY = 'campeonato_disciplinas';
const LOCAL_EQUIPOS_KEY = 'campeonato_equipos';

// Helper to generate a random UUID-like string for local storage fallback
const generateId = (): string => {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

// --- API Service Layer ---
export const db = {
  // === DISCIPLINAS ===
  async getDisciplinas(): Promise<Disciplina[]> {
    if (isSupabaseConfigured() && supabase) {
      const { data, error } = await supabase
        .from('disciplinas')
        .select('*')
        .order('nombre', { ascending: true });

      if (error) {
        console.error('Error fetching disciplinas from Supabase, falling back to local:', error);
        return this.getLocalDisciplinas();
      }
      return data || [];
    } else {
      return this.getLocalDisciplinas();
    }
  },

  async addDisciplina(nombre: string, descripcion?: string, canchas?: string): Promise<Disciplina> {
    const newDisc: Omit<Disciplina, 'creado_en'> = {
      id: generateId(),
      nombre,
      descripcion,
      canchas,
    };

    if (isSupabaseConfigured() && supabase) {
      const { data, error } = await supabase
        .from('disciplinas')
        .insert([{ nombre, descripcion, canchas }])
        .select();

      if (error) {
        console.error('Error inserting disc in Supabase, saving locally:', error);
        return this.saveLocalDisciplina(newDisc as Disciplina);
      }
      return data?.[0] || (newDisc as Disciplina);
    } else {
      return this.saveLocalDisciplina(newDisc as Disciplina);
    }
  },

  async updateDisciplina(id: string, nombre: string, descripcion?: string, canchas?: string): Promise<Disciplina> {
    if (isSupabaseConfigured() && supabase) {
      // Check if it's a UUID (Supabase uses UUID, our local generator can be anything)
      const isUUID = id.length === 36 && id.includes('-');
      if (isUUID) {
        const { data, error } = await supabase
          .from('disciplinas')
          .update({ nombre, descripcion, canchas })
          .eq('id', id)
          .select();

        if (error) {
          console.error('Error updating disc in Supabase:', error);
          throw error;
        }
        return data?.[0];
      }
    }
    
    // Local update fallback
    return this.updateLocalDisciplina(id, nombre, descripcion, canchas);
  },

  async deleteDisciplina(id: string): Promise<boolean> {
    if (isSupabaseConfigured() && supabase) {
      const isUUID = id.length === 36 && id.includes('-');
      if (isUUID) {
        const { error } = await supabase
          .from('disciplinas')
          .delete()
          .eq('id', id);

        if (error) {
          console.error('Error deleting disc in Supabase:', error);
          throw error;
        }
        return true;
      }
    }
    
    // Local delete
    this.deleteLocalDisciplina(id);
    return true;
  },

  // === EQUIPOS ===
  async getEquipos(disciplinaId: string): Promise<Equipo[]> {
    if (isSupabaseConfigured() && supabase) {
      const isUUID = disciplinaId.length === 36 && disciplinaId.includes('-');
      if (isUUID) {
        const { data, error } = await supabase
          .from('equipos')
          .select('*')
          .eq('disciplina_id', disciplinaId)
          .order('nombre', { ascending: true });

        if (error) {
          console.error('Error fetching equipos from Supabase:', error);
          return this.getLocalEquipos(disciplinaId);
        }
        return data || [];
      }
    }
    return this.getLocalEquipos(disciplinaId);
  },

  async addEquipo(disciplinaId: string, nombre: string, delegado?: string, contacto?: string): Promise<Equipo> {
    const newEqui: Omit<Equipo, 'creado_en'> = {
      id: generateId(),
      disciplina_id: disciplinaId,
      nombre,
      delegado,
      contacto,
    };

    if (isSupabaseConfigured() && supabase) {
      const isUUID = disciplinaId.length === 36 && disciplinaId.includes('-');
      if (isUUID) {
        const { data, error } = await supabase
          .from('equipos')
          .insert([{ disciplina_id: disciplinaId, nombre, delegado, contacto }])
          .select();

        if (error) {
          console.error('Error inserting equipo in Supabase:', error);
          return this.saveLocalEquipo(newEqui as Equipo);
        }
        return data?.[0] || (newEqui as Equipo);
      }
    }
    return this.saveLocalEquipo(newEqui as Equipo);
  },

  async updateEquipo(id: string, nombre: string, delegado?: string, contacto?: string): Promise<Equipo> {
    if (isSupabaseConfigured() && supabase) {
      const isUUID = id.length === 36 && id.includes('-');
      if (isUUID) {
        const { data, error } = await supabase
          .from('equipos')
          .update({ nombre, delegado, contacto })
          .eq('id', id)
          .select();

        if (error) {
          console.error('Error updating equipo in Supabase:', error);
          throw error;
        }
        return data?.[0];
      }
    }
    return this.updateLocalEquipo(id, nombre, delegado, contacto);
  },

  async deleteEquipo(id: string): Promise<boolean> {
    if (isSupabaseConfigured() && supabase) {
      const isUUID = id.length === 36 && id.includes('-');
      if (isUUID) {
        const { error } = await supabase
          .from('equipos')
          .delete()
          .eq('id', id);

        if (error) {
          console.error('Error deleting equipo in Supabase:', error);
          throw error;
        }
        return true;
      }
    }
    this.deleteLocalEquipo(id);
    return true;
  },

  // === LOCAL STORAGE HELPERS ===
  getLocalDisciplinas(): Disciplina[] {
    const stored = localStorage.getItem(LOCAL_DISCIPLINAS_KEY);
    if (!stored) {
      // Seed initial disciplines for a nice initial experience
      const defaultDisciplinas: Disciplina[] = [
        { id: '1', nombre: 'Fútbol 7', descripcion: 'Partidos de 2 tiempos de 15 minutos en cancha sintética.', canchas: 'Cancha 1, Cancha 2' },
        { id: '2', nombre: 'Básquetbol', descripcion: 'Partidos de 4 cuartos de 8 minutos en coliseo cerrado.', canchas: 'Cancha Principal' },
        { id: '3', nombre: 'Vóleibol Mixto', descripcion: 'Partidos al mejor de 3 sets de 21 puntos.', canchas: 'Cancha de Vóley 1' },
      ];
      localStorage.setItem(LOCAL_DISCIPLINAS_KEY, JSON.stringify(defaultDisciplinas));
      return defaultDisciplinas;
    }
    return JSON.parse(stored);
  },

  saveLocalDisciplina(disciplina: Disciplina): Disciplina {
    const list = this.getLocalDisciplinas();
    const createdItem = { ...disciplina, creado_en: new Date().toISOString() };
    list.push(createdItem);
    localStorage.setItem(LOCAL_DISCIPLINAS_KEY, JSON.stringify(list));
    return createdItem;
  },

  updateLocalDisciplina(id: string, nombre: string, descripcion?: string, canchas?: string): Disciplina {
    const list = this.getLocalDisciplinas();
    const index = list.findIndex(item => item.id === id);
    if (index === -1) throw new Error('Disciplina no encontrada localmente.');
    
    list[index] = {
      ...list[index],
      nombre,
      descripcion,
      canchas,
    };
    localStorage.setItem(LOCAL_DISCIPLINAS_KEY, JSON.stringify(list));
    return list[index];
  },

  deleteLocalDisciplina(id: string) {
    // Delete discipline
    const list = this.getLocalDisciplinas();
    const filtered = list.filter(item => item.id !== id);
    localStorage.setItem(LOCAL_DISCIPLINAS_KEY, JSON.stringify(filtered));

    // Also delete any cascade teams
    const teams = localStorage.getItem(LOCAL_EQUIPOS_KEY);
    if (teams) {
      const allTeams: Equipo[] = JSON.parse(teams);
      const remainingTeams = allTeams.filter(t => t.disciplina_id !== id);
      localStorage.setItem(LOCAL_EQUIPOS_KEY, JSON.stringify(remainingTeams));
    }
  },

  getLocalEquipos(disciplinaId: string): Equipo[] {
    const stored = localStorage.getItem(LOCAL_EQUIPOS_KEY);
    if (!stored) {
      // Seed default teams
      const defaultEquipos: Equipo[] = [
        { id: 'e1', disciplina_id: '1', nombre: 'Los Galácticos FC', delegado: 'Carlos Gómez', contacto: '+51 987 654 321' },
        { id: 'e2', disciplina_id: '1', nombre: 'Deportivo Rayo', delegado: 'Mario Vargas', contacto: '+51 912 345 678' },
        { id: 'e3', disciplina_id: '2', nombre: 'Titanes del Aro', delegado: 'Sofía Lanza', contacto: 'sofia@mail.com' },
        { id: 'e4', disciplina_id: '2', nombre: 'Águilas Doradas', delegado: 'Roberto Pérez', contacto: '934812323' },
        { id: 'e5', disciplina_id: '3', nombre: 'Súper Vóley', delegado: 'Patricia Ruiz', contacto: 'patty@voley.org' },
      ];
      localStorage.setItem(LOCAL_EQUIPOS_KEY, JSON.stringify(defaultEquipos));
      return defaultEquipos.filter(t => t.disciplina_id === disciplinaId);
    }
    const allTeams: Equipo[] = JSON.parse(stored);
    return allTeams.filter(t => t.disciplina_id === disciplinaId);
  },

  saveLocalEquipo(equipo: Equipo): Equipo {
    const stored = localStorage.getItem(LOCAL_EQUIPOS_KEY);
    const allTeams: Equipo[] = stored ? JSON.parse(stored) : [];
    const createdItem = { ...equipo, creado_en: new Date().toISOString() };
    allTeams.push(createdItem);
    localStorage.setItem(LOCAL_EQUIPOS_KEY, JSON.stringify(allTeams));
    return createdItem;
  },

  updateLocalEquipo(id: string, nombre: string, delegado?: string, contacto?: string): Equipo {
    const stored = localStorage.getItem(LOCAL_EQUIPOS_KEY);
    const allTeams: Equipo[] = stored ? JSON.parse(stored) : [];
    const index = allTeams.findIndex(t => t.id === id);
    if (index === -1) throw new Error('Equipo no encontrado localmente.');

    allTeams[index] = {
      ...allTeams[index],
      nombre,
      delegado,
      contacto,
    };
    localStorage.setItem(LOCAL_EQUIPOS_KEY, JSON.stringify(allTeams));
    return allTeams[index];
  },

  deleteLocalEquipo(id: string) {
    const stored = localStorage.getItem(LOCAL_EQUIPOS_KEY);
    if (stored) {
      const allTeams: Equipo[] = JSON.parse(stored);
      const filtered = allTeams.filter(t => t.id !== id);
      localStorage.setItem(LOCAL_EQUIPOS_KEY, JSON.stringify(filtered));
    }
  },

  async loadRealDataset(onProgress?: (message: string, percent: number) => void): Promise<void> {
    if (onProgress) onProgress('Preparando datos reales del campeonato...', 5);
    const realDisciplinas: Disciplina[] = [
      { id: 'real-1', nombre: 'Básquet Mixto', descripcion: 'Partidos de básquetbol en modalidad mixta.', canchas: 'Cancha Principal' },
      { id: 'real-2', nombre: 'Futsal Damas', descripcion: 'Futsal femenino. Tiempos rápidos de 10 minutos.', canchas: 'Cancha Futsal 1' },
      { id: 'real-3', nombre: 'Futsal Varones', descripcion: 'Futsal masculino competitivo. Tiempos rápidos de 10 minutos.', canchas: 'Cancha Futsal 2' },
      { id: 'real-4', nombre: 'Voley Mixto', descripcion: 'Vóley mixto. Sets rápidos a 15 puntos.', canchas: 'Cancha de Vóley' }
    ];

    const realEquipos: Equipo[] = [
      // Basquet Mixto (id: 'real-1')
      { id: 'eq-b1', disciplina_id: 'real-1', nombre: '1° Semestre A', delegado: 'Velazquez ramirez Diego Ar', contacto: 'S/ 260.00' },
      { id: 'eq-b2', disciplina_id: 'real-1', nombre: '2° Semestre Único', delegado: 'Condori Huisa Idaluz Dayan', contacto: 'S/ 170.00' },
      { id: 'eq-b3', disciplina_id: 'real-1', nombre: '3° Semestre A', delegado: 'Por asignar', contacto: 'S/ 260.00' },
      { id: 'eq-b4', disciplina_id: 'real-1', nombre: '5° Semestre A', delegado: 'Pachecca Sacaca Danitza', contacto: 'S/ 80.00' },
      { id: 'eq-b5', disciplina_id: 'real-1', nombre: '6° Semestre Único', delegado: 'Mullisaca Carcausto Noelia', contacto: 'S/ 170.00' },
      { id: 'eq-b6', disciplina_id: 'real-1', nombre: '7° Semestre A', delegado: 'Por asignar', contacto: 'S/ 160.00' },
      { id: 'eq-b7', disciplina_id: 'real-1', nombre: '8° Semestre A', delegado: 'Velazco Yordan', contacto: 'S/ 85.00' },
      { id: 'eq-b8', disciplina_id: 'real-1', nombre: '8° Semestre B', delegado: 'Por asignar', contacto: 'S/ 180.00' },
      { id: 'eq-b9', disciplina_id: 'real-1', nombre: '8° Semestre C', delegado: 'Acero Aguilar Maribel', contacto: 'S/ 50.00' },
      { id: 'eq-b10', disciplina_id: 'real-1', nombre: '10° Semestre A', delegado: 'Del Pilar Ponce Llaqui Ana R', contacto: 'S/ 170.00' },
      { id: 'eq-b11', disciplina_id: 'real-1', nombre: '10° Semestre B', delegado: 'Vela Santos Liz Evelin', contacto: 'S/ 160.00' },

      // Futsal Damas (id: 'real-2')
      { id: 'eq-d1', disciplina_id: 'real-2', nombre: '1° Semestre A', delegado: 'Velazquez ramirez Diego Ar', contacto: 'S/ 260.00' },
      { id: 'eq-d2', disciplina_id: 'real-2', nombre: '2° Semestre Único', delegado: 'Condori Huisa Idaluz Dayan', contacto: 'S/ 170.00' },
      { id: 'eq-d3', disciplina_id: 'real-2', nombre: '3° Semestre A', delegado: 'Por asignar', contacto: 'S/ 260.00' },
      { id: 'eq-d4', disciplina_id: 'real-2', nombre: '4° Semestre A', delegado: 'Joseph Gian poul pacara jar', contacto: 'S/ 90.00' },
      { id: 'eq-d5', disciplina_id: 'real-2', nombre: '4° Semestre B', delegado: 'Choque Nina Josephe Gonza', contacto: 'S/ 130.00' },
      { id: 'eq-d6', disciplina_id: 'real-2', nombre: '5° Semestre A', delegado: 'Pachecca Sacaca Danitza', contacto: 'S/ 80.00' },
      { id: 'eq-d7', disciplina_id: 'real-2', nombre: '5° Semestre B', delegado: 'Por asignar', contacto: 'S/ 130.00' },
      { id: 'eq-d8', disciplina_id: 'real-2', nombre: '6° Semestre Único', delegado: 'Mullisaca Carcausto Noelia', contacto: 'S/ 170.00' },
      { id: 'eq-d9', disciplina_id: 'real-2', nombre: '7° Semestre A', delegado: 'Por asignar', contacto: 'S/ 160.00' },
      { id: 'eq-d10', disciplina_id: 'real-2', nombre: '8° Semestre A', delegado: 'Velazco Yordan', contacto: 'S/ 85.00' },
      { id: 'eq-d11', disciplina_id: 'real-2', nombre: '8° Semestre B', delegado: 'Por asignar', contacto: 'S/ 180.00' },
      { id: 'eq-d12', disciplina_id: 'real-2', nombre: '8° Semestre C', delegado: 'Acero Aguilar Maribel', contacto: 'S/ 50.00' },
      { id: 'eq-d13', disciplina_id: 'real-2', nombre: '10° Semestre A', delegado: 'Del Pilar Ponce Llaqui Ana R', contacto: 'S/ 170.00' },
      { id: 'eq-d14', disciplina_id: 'real-2', nombre: '10° Semestre B', delegado: 'Vela Santos Liz Evelin', contacto: 'S/ 160.00' },

      // Futsal Varones (id: 'real-3')
      { id: 'eq-v1', disciplina_id: 'real-3', nombre: '1° Semestre A', delegado: 'Velazquez ramirez Diego Ar', contacto: 'S/ 260.00' },
      { id: 'eq-v2', disciplina_id: 'real-3', nombre: '2° Semestre Único', delegado: 'Condori Huisa Idaluz Dayan', contacto: 'S/ 170.00' },
      { id: 'eq-v3', disciplina_id: 'real-3', nombre: '3° Semestre A', delegado: 'Por asignar', contacto: 'S/ 260.00' },
      { id: 'eq-v4', disciplina_id: 'real-3', nombre: '4° Semestre B', delegado: 'Choque Nina Josephe Gonza', contacto: 'S/ 130.00' },
      { id: 'eq-v5', disciplina_id: 'real-3', nombre: '5° Semestre A', delegado: 'Pachecca Sacaca Danitza', contacto: 'S/ 80.00' },
      { id: 'eq-v6', disciplina_id: 'real-3', nombre: '5° Semestre B', delegado: 'Por asignar', contacto: 'S/ 130.00' },
      { id: 'eq-v7', disciplina_id: 'real-3', nombre: '6° Semestre Único', delegado: 'Mullisaca Carcausto Noelia', contacto: 'S/ 170.00' },
      { id: 'eq-v8', disciplina_id: 'real-3', nombre: '7° Semestre B', delegado: 'Por asignar', contacto: 'S/ 100.00' },
      { id: 'eq-v9', disciplina_id: 'real-3', nombre: '8° Semestre A', delegado: 'Velazco Yordan', contacto: 'S/ 85.00' },
      { id: 'eq-v10', disciplina_id: 'real-3', nombre: '8° Semestre B', delegado: 'Por asignar', contacto: 'S/ 180.00' },
      { id: 'eq-v11', disciplina_id: 'real-3', nombre: '8° Semestre C', delegado: 'Acero Aguilar Maribel', contacto: 'S/ 50.00' },
      { id: 'eq-v12', disciplina_id: 'real-3', nombre: '10° Semestre A', delegado: 'Del Pilar Ponce Llaqui Ana R', contacto: 'S/ 170.00' },
      { id: 'eq-v13', disciplina_id: 'real-3', nombre: '10° Semestre B', delegado: 'Vela Santos Liz Evelin', contacto: 'S/ 160.00' },
      { id: 'eq-v14', disciplina_id: 'real-3', nombre: 'Egresados', delegado: 'Ivan Chañi', contacto: 'S/ 45.00' },

      // Voley Mixto (id: 'real-4')
      { id: 'eq-vo1', disciplina_id: 'real-4', nombre: '1° Semestre A', delegado: 'Velazquez ramirez Diego Ar', contacto: 'S/ 260.00' },
      { id: 'eq-vo2', disciplina_id: 'real-4', nombre: '2° Semestre Único', delegado: 'Condori Huisa Idaluz Dayan', contacto: 'S/ 170.00' },
      { id: 'eq-vo3', disciplina_id: 'real-4', nombre: '3° Semestre A', delegado: 'Por asignar', contacto: 'S/ 260.00' },
      { id: 'eq-vo4', disciplina_id: 'real-4', nombre: '4° Semestre A', delegado: 'Joseph Gian poul pacara jar', contacto: 'S/ 90.00' },
      { id: 'eq-vo5', disciplina_id: 'real-4', nombre: '4° Semestre B', delegado: 'Choque Nina Josephe Gonza', contacto: 'S/ 130.00' },
      { id: 'eq-vo6', disciplina_id: 'real-4', nombre: '5° Semestre A', delegado: 'Pachecca Sacaca Danitza', contacto: 'S/ 80.00' },
      { id: 'eq-vo7', disciplina_id: 'real-4', nombre: '5° Semestre B', delegado: 'Por asignar', contacto: 'S/ 130.00' },
      { id: 'eq-vo8', disciplina_id: 'real-4', nombre: '6° Semestre Único', delegado: 'Mullisaca Carcausto Noelia', contacto: 'S/ 170.00' },
      { id: 'eq-vo9', disciplina_id: 'real-4', nombre: '7° Semestre A', delegado: 'Por asignar', contacto: 'S/ 160.00' },
      { id: 'eq-vo10', disciplina_id: 'real-4', nombre: '7° Semestre B', delegado: 'Por asignar', contacto: 'S/ 100.00' },
      { id: 'eq-vo11', disciplina_id: 'real-4', nombre: '8° Semestre A', delegado: 'Velazco Yordan', contacto: 'S/ 85.00' },
      { id: 'eq-vo12', disciplina_id: 'real-4', nombre: '8° Semestre B', delegado: 'Por asignar', contacto: 'S/ 180.00' },
      { id: 'eq-vo13', disciplina_id: 'real-4', nombre: '8° Semestre C', delegado: 'Acero Aguilar Maribel', contacto: 'S/ 50.00' },
      { id: 'eq-vo14', disciplina_id: 'real-4', nombre: '10° Semestre A', delegado: 'Del Pilar Ponce Llaqui Ana R', contacto: 'S/ 170.00' },
      { id: 'eq-vo15', disciplina_id: 'real-4', nombre: '10° Semestre B', delegado: 'Vela Santos Liz Evelin', contacto: 'S/ 160.00' }
    ];

    if (onProgress) onProgress('Guardando disciplinas y equipos en LocalStorage...', 15);
    localStorage.setItem(LOCAL_DISCIPLINAS_KEY, JSON.stringify(realDisciplinas));
    localStorage.setItem(LOCAL_EQUIPOS_KEY, JSON.stringify(realEquipos));

    // Clear matches to prevent mismatch with old teams
    realDisciplinas.forEach(d => {
      localStorage.removeItem(`campeonato_matches_${d.id}`);
      localStorage.removeItem(`campeonato_groupA_${d.id}`);
      localStorage.removeItem(`campeonato_groupB_${d.id}`);
      localStorage.removeItem(`campeonato_scores_${d.id}`);
    });

    if (isSupabaseConfigured() && supabase) {
      try {
        if (onProgress) onProgress('Borrando fixtures de partidos antiguos en Supabase...', 25);
        try {
          await supabase.from('partidos').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        } catch (_) {}

        if (onProgress) onProgress('Borrando grupos de partidos antiguos en Supabase...', 35);
        try {
          await supabase.from('fixture_grupos').delete().neq('disciplina_id', '00000000-0000-0000-0000-000000000000');
        } catch (_) {}

        if (onProgress) onProgress('Borrando equipos antiguos en Supabase...', 45);
        await supabase.from('equipos').delete().neq('id', '00000000-0000-0000-0000-000000000000');

        if (onProgress) onProgress('Borrando disciplinas antiguas en Supabase...', 55);
        await supabase.from('disciplinas').delete().neq('id', '00000000-0000-0000-0000-000000000000');

        if (onProgress) onProgress('Insertando disciplinas del campeonato (Básquet, Futsal, Vóley) en Supabase...', 65);
        const insertedDiscs = [];
        for (const disc of realDisciplinas) {
          const { data, error } = await supabase
            .from('disciplinas')
            .insert([{ nombre: disc.nombre, descripcion: disc.descripcion, canchas: disc.canchas }])
            .select();
          if (error) throw error;
          if (data?.[0]) {
            insertedDiscs.push({ oldId: disc.id, newId: data[0].id });
          }
        }

        if (onProgress) onProgress('Insertando equipos reales por disciplina en Supabase...', 80);
        const newEquiposToInsert = realEquipos.map(eq => {
          const discMap = insertedDiscs.find(d => d.oldId === eq.disciplina_id);
          return {
            disciplina_id: discMap ? discMap.newId : eq.disciplina_id,
            nombre: eq.nombre,
            delegado: eq.delegado,
            contacto: eq.contacto
          };
        });

        const { error: teamError } = await supabase.from('equipos').insert(newEquiposToInsert);
        if (teamError) throw teamError;

        if (onProgress) onProgress('¡Datos reales cargados correctamente en Supabase!', 100);
      } catch (err) {
        console.error('Error seeding Supabase:', err);
        throw err;
      }
    } else {
      if (onProgress) onProgress('¡Datos reales cargados correctamente de forma local!', 100);
    }
  },

  async getPartidos(disciplinaId: string): Promise<Match[]> {
    if (isSupabaseConfigured() && supabase) {
      const { data, error } = await supabase
        .from('partidos')
        .select('*')
        .eq('disciplina_id', disciplinaId)
        .order('ronda', { ascending: true });

      if (error) {
        console.error('Error fetching partidos, falling back to local:', error);
        return this.getLocalPartidos(disciplinaId);
      }
      return (data || []).map(p => ({
        id: p.id,
        equipo1: p.equipo1,
        equipo2: p.equipo2,
        cancha: p.cancha || '',
        grupo: p.grupo || '',
        ronda: p.ronda,
        hora: p.hora || '08:00',
        goles1: p.goles1 || '',
        goles2: p.goles2 || ''
      }));
    } else {
      return this.getLocalPartidos(disciplinaId);
    }
  },

  getLocalPartidos(disciplinaId: string): Match[] {
    const saved = localStorage.getItem(`campeonato_matches_${disciplinaId}`);
    if (!saved) return [];
    try {
      const matches = JSON.parse(saved) as Match[];
      const savedScores = localStorage.getItem(`campeonato_scores_${disciplinaId}`);
      const scores = savedScores ? JSON.parse(savedScores) : {};
      return matches.map(m => ({
        ...m,
        goles1: scores[m.id]?.g1 || '',
        goles2: scores[m.id]?.g2 || ''
      }));
    } catch (_) {
      return [];
    }
  },

  async savePartidos(disciplinaId: string, matches: Match[], scores: Record<string, { g1: string; g2: string }>): Promise<void> {
    // Local first
    localStorage.setItem(`campeonato_matches_${disciplinaId}`, JSON.stringify(matches));
    localStorage.setItem(`campeonato_scores_${disciplinaId}`, JSON.stringify(scores));

    if (isSupabaseConfigured() && supabase) {
      try {
        // Delete existing partidos
        await supabase.from('partidos').delete().eq('disciplina_id', disciplinaId);

        // Insert new ones
        if (matches.length > 0) {
          const toInsert = matches.map(m => ({
            id: m.id,
            disciplina_id: disciplinaId,
            equipo1: m.equipo1,
            equipo2: m.equipo2,
            cancha: m.cancha,
            grupo: m.grupo,
            ronda: m.ronda,
            hora: m.hora || '08:00',
            goles1: scores[m.id]?.g1 || m.goles1 || '',
            goles2: scores[m.id]?.g2 || m.goles2 || ''
          }));
          const { error } = await supabase.from('partidos').insert(toInsert);
          if (error) throw error;
        }
      } catch (err) {
        console.error('Error saving partidos to Supabase:', err);
      }
    }
  },

  async getFixtureGrupos(disciplinaId: string): Promise<{ grupoA: string[]; grupoB: string[] } | null> {
    if (isSupabaseConfigured() && supabase) {
      const { data, error } = await supabase
        .from('fixture_grupos')
        .select('*')
        .eq('disciplina_id', disciplinaId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching fixture_grupos, using local:', error);
        return this.getLocalFixtureGrupos(disciplinaId);
      }
      if (data) {
        return {
          grupoA: data.grupo_a || [],
          grupoB: data.grupo_b || []
        };
      }
    }
    return this.getLocalFixtureGrupos(disciplinaId);
  },

  getLocalFixtureGrupos(disciplinaId: string): { grupoA: string[]; grupoB: string[] } | null {
    const savedA = localStorage.getItem(`campeonato_groupA_${disciplinaId}`);
    const savedB = localStorage.getItem(`campeonato_groupB_${disciplinaId}`);
    if (savedA || savedB) {
      return {
        grupoA: savedA ? JSON.parse(savedA) : [],
        grupoB: savedB ? JSON.parse(savedB) : []
      };
    }
    return null;
  },

  async saveFixtureGrupos(disciplinaId: string, grupoA: string[], grupoB: string[]): Promise<void> {
    localStorage.setItem(`campeonato_groupA_${disciplinaId}`, JSON.stringify(grupoA));
    localStorage.setItem(`campeonato_groupB_${disciplinaId}`, JSON.stringify(grupoB));

    if (isSupabaseConfigured() && supabase) {
      try {
        const { error } = await supabase
          .from('fixture_grupos')
          .upsert({
            disciplina_id: disciplinaId,
            grupo_a: grupoA,
            grupo_b: grupoB
          }, { onConflict: 'disciplina_id' });
        if (error) throw error;
      } catch (err) {
        console.error('Error saving fixture_grupos to Supabase:', err);
      }
    }
  },

  async deletePartidosYGrupos(disciplinaId: string): Promise<void> {
    localStorage.removeItem(`campeonato_matches_${disciplinaId}`);
    localStorage.removeItem(`campeonato_groupA_${disciplinaId}`);
    localStorage.removeItem(`campeonato_groupB_${disciplinaId}`);
    localStorage.removeItem(`campeonato_scores_${disciplinaId}`);

    if (isSupabaseConfigured() && supabase) {
      try {
        await supabase.from('partidos').delete().eq('disciplina_id', disciplinaId);
        await supabase.from('fixture_grupos').delete().eq('disciplina_id', disciplinaId);
      } catch (err) {
        console.error('Error resetting fixture in Supabase:', err);
      }
    }
  },

  async testConnection(): Promise<{ success: boolean; message: string; details?: any }> {
    if (!isSupabaseConfigured() || !supabase) {
      return { 
        success: false, 
        message: 'Supabase no está configurado. Ve a "Ver Guía de Conexión" para ver cómo configurar las variables de entorno VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.' 
      };
    }
    try {
      // Intentamos hacer una consulta simple a la tabla 'disciplinas'
      const { data, error } = await supabase.from('disciplinas').select('id').limit(1);
      if (error) {
        return { 
          success: false, 
          message: `Error al consultar la tabla 'disciplinas'. Asegúrate de que las tablas estén creadas y las políticas RLS habilitadas. Detalles: ${error.message}`, 
          details: error 
        };
      }
      return { 
        success: true, 
        message: '¡Conexión exitosa! El cliente de Supabase responde y tiene acceso a la tabla "disciplinas".' 
      };
    } catch (err: any) {
      return { 
        success: false, 
        message: `Error de red al conectar con Supabase: ${err?.message || err}`, 
        details: err 
      };
    }
  },

  async getAllMatchesAcrossDisciplines(): Promise<(Match & { disciplina_id: string })[]> {
    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase.from('partidos').select('*');
        if (error) {
          console.error('Error fetching all matches:', error);
          return [];
        }
        return (data || []).map(p => ({
          id: p.id,
          disciplina_id: p.disciplina_id,
          equipo1: p.equipo1,
          equipo2: p.equipo2,
          cancha: p.cancha || '',
          grupo: p.grupo || '',
          ronda: p.ronda,
          hora: p.hora || '08:00',
          goles1: p.goles1 || '',
          goles2: p.goles2 || ''
        }));
      } catch (err) {
        console.error('Network error fetching all matches:', err);
        return [];
      }
    } else {
      // Intentar recolectar localmente
      const allMatches: (Match & { disciplina_id: string })[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('campeonato_matches_')) {
          const discId = key.replace('campeonato_matches_', '');
          try {
            const matches: Match[] = JSON.parse(localStorage.getItem(key) || '[]');
            matches.forEach(m => allMatches.push({ ...m, disciplina_id: discId }));
          } catch (e) {
            // ignorar parse error
          }
        }
      }
      return allMatches;
    }
  }
};
