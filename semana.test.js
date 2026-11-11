import test from 'node:test';
import assert from 'node:assert';
import { armarSemana, colorDe, lunesDe, ymd } from './semana.js';

const analisis = { id: 'facultad/analisis', nombre: 'Análisis', color: '#3e63dd' };
const datos = {
  generado: '2026-11-11T15:00:00-03:00',
  materias: [analisis],
  cursada: [{ materia: analisis.id, dia: 'viernes', inicio: '18:00', fin: '22:00' }],
  eventos: [
    { materia: analisis.id, titulo: 'Parcial', fecha: '2026-11-13', hora: '18:00' },
    { materia: analisis.id, titulo: 'Consulta', fecha: '2026-11-13', hora: '10:00' },
    { materia: analisis.id, titulo: 'Entrega', fecha: '2026-11-13' },
    { materia: analisis.id, titulo: 'Final', fecha: '2026-11-20', hora: '09:00' },
  ],
};
const lunes = (s) => { const [a, m, d] = s.split('-').map(Number); return new Date(a, m - 1, d); };

test('armarSemana devuelve 7 días de lunes a domingo', () => {
  const s = armarSemana(datos, lunes('2026-11-09'));
  assert.deepEqual(s.map(d => d.fecha), ['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15']);
  assert.deepEqual(s.map(d => d.dia), ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo']);
});

test('repite la cursada cada semana', () => {
  const cursada = (l) => armarSemana(datos, lunes(l))[4].items.filter(i => i.tipo === 'cursada');
  assert.equal(cursada('2026-11-09')[0].inicio, '18:00');
  assert.equal(cursada('2026-11-16')[0].inicio, '18:00');
  assert.equal(armarSemana(datos, lunes('2026-11-16'))[4].fecha, '2026-11-20');
});

test('solo incluye eventos de la semana', () => {
  const titulos = armarSemana(datos, lunes('2026-11-09')).flatMap(d => d.items).map(i => i.titulo).filter(Boolean);
  assert.equal(titulos.includes('Final'), false);
});

test('ordena todo el día, luego por hora, evento antes que cursada', () => {
  const v = armarSemana(datos, lunes('2026-11-09'))[4].items;
  assert.deepEqual(v.map(i => `${i.tipo} ${i.hora ?? i.inicio ?? '-'}`), ['evento -', 'evento 10:00', 'evento 18:00', 'cursada 18:00']);
  assert.equal(v[0].materia.nombre, 'Análisis');
});

test('semana que cruza de mes', () => {
  assert.equal(armarSemana(datos, lunes('2026-11-30'))[6].fecha, '2026-12-06');
});

test('lunesDe de un domingo es el lunes anterior', () => {
  assert.equal(ymd(lunesDe(new Date(2026, 10, 15, 23, 30))), '2026-11-09');
  assert.equal(ymd(lunesDe(new Date(2026, 10, 9, 0, 5))), '2026-11-09');
});

test('colorDe es estable para el mismo id y respeta color', () => {
  assert.equal(colorDe(analisis), '#3e63dd');
  const sin = { id: 'facultad/fisica', nombre: 'Física' };
  assert.match(colorDe(sin), /^#[0-9a-f]{6}$/);
  assert.equal(colorDe(sin), colorDe({ ...sin }));
});
