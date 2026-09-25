// src/types.ts

export type EstadoNumero = 'disponible' | 'reservado' | 'pagado';

export interface Comprador {
  nombre: string;
  telefono: string;
  vendedor: string;
  metodoPago: string;
  notas?: string;
  fechaRegistro: string;
}

export interface Numero {
  id: number; // 0 a 99
  estado: EstadoNumero;
  comprador?: Comprador;
}

export interface Ganador {
  premio: string;
  numero: number;
  compradorNombre: string;
  telefono: string;
  fecha: string;
}