export interface Disciplina {
  id: string;
  nombre: string;
  descripcion?: string;
  canchas?: string;
  creado_en?: string;
}

export interface Equipo {
  id: string;
  disciplina_id: string;
  nombre: string;
  delegado?: string;
  contacto?: string;
  creado_en?: string;
}

export interface Match {
  id: string;
  equipo1: string;
  equipo2: string;
  cancha: string;
  grupo: string;
  ronda: number;
  goles1?: string;
  goles2?: string;
  hora?: string;
}

export interface SupabaseConfig {
  url?: string;
  anonKey?: string;
  isConfigured: boolean;
}
