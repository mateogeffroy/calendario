// ponytail: armarSemana y colorDe están duplicadas en widget.js (Scriptable no importa módulos remotos); cambiar las dos.
const DIAS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
const PALETA = ['#3e63dd', '#30a46c', '#e5484d', '#b146c2', '#0894b3', '#c99a06', '#f76b15', '#d6409f'];

const dos = (n) => String(n).padStart(2, '0');

/** YYYY-MM-DD en hora local. */
export function ymd(d) {
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
}

/** Lunes 00:00 local de la semana de `fecha`. */
export function lunesDe(fecha) {
  const d = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

/** Color de la materia, o uno fijo de la paleta según su id. */
export function colorDe(materia) {
  if (materia.color) return materia.color;
  let h = 0;
  for (const c of materia.id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return PALETA[h % PALETA.length];
}

/** 7 días desde `lunes`, cada uno con sus eventos ordenados (sin hora primero). */
export function armarSemana(datos, lunes) {
  const materias = new Map(datos.materias.map(m => [m.id, m]));
  const dias = [];
  for (let n = 0; n < 7; n++) {
    const d = new Date(lunes.getFullYear(), lunes.getMonth(), lunes.getDate() + n);
    const fecha = ymd(d);
    const dia = DIAS[d.getDay()];
    const items = datos.eventos
      .filter(e => e.fecha === fecha && materias.has(e.materia))
      .map(e => ({ tipo: 'evento', ...e, materia: materias.get(e.materia) }));
    items.sort((a, b) => {
      const ha = a.hora ?? '', hb = b.hora ?? ''; // '' (todo el día) primero
      return ha === hb ? 0 : ha < hb ? -1 : 1;
    });
    dias.push({ fecha, dia, items });
  }
  return dias;
}
