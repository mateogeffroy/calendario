// Calendario: widget de Scriptable. Copiar este archivo a un script nuevo de Scriptable.
// La primera vez, correrlo dentro de la app para cargar el token.

const URL_DATOS = 'https://api.github.com/repos/mateogeffroy/codetion-datos/contents/calendario.json';
const URL_WEB = 'https://mateogeffroy.github.io/calendario/';
const K_TOKEN = 'calendario.token';
const fm = FileManager.local();
const COPIA = fm.joinPath(fm.documentsDirectory(), 'calendario.json');

const FONDO = new Color('#141416');
const TINTA = new Color('#f2f2f5');
const GRIS = new Color('#9a9aa3');
const SUAVE = new Color('#5c5c66');

// Parámetro del widget: vacío = eventos; "cursada" = horarios de cursada.
const DIAS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];

// ponytail: armarDias y colorDe repiten la lógica de semana.js (Scriptable no importa módulos remotos); cambiar las dos.
const PALETA = ['#3e63dd', '#30a46c', '#e5484d', '#b146c2', '#0894b3', '#c99a06', '#f76b15', '#d6409f'];
const dos = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;

function colorDe(materia) {
  if (materia.color) return materia.color;
  let h = 0;
  for (const c of materia.id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return PALETA[h % PALETA.length];
}

/** `cantidad` días desde hoy, cada uno con sus eventos (o su cursada) ordenados; sin hora primero. */
function armarDias(datos, desde, cantidad, modo) {
  const materias = new Map(datos.materias.map(m => [m.id, m]));
  const dias = [];
  for (let n = 0; n < cantidad; n++) {
    const d = new Date(desde.getFullYear(), desde.getMonth(), desde.getDate() + n);
    const fecha = ymd(d);
    const items = modo === 'cursada'
      ? datos.cursada
        .filter(c => c.dia === DIAS[d.getDay()] && materias.has(c.materia))
        .map(c => ({ tipo: 'cursada', ...c, hora: c.inicio, materia: materias.get(c.materia) }))
      : datos.eventos
        .filter(e => e.fecha === fecha && materias.has(e.materia))
        .map(e => ({ tipo: 'evento', ...e, materia: materias.get(e.materia) }));
    items.sort((a, b) => {
      const ha = a.hora ?? '', hb = b.hora ?? '';
      return ha === hb ? 0 : ha < hb ? -1 : 1;
    });
    dias.push({ fecha: d, items });
  }
  return dias;
}

async function pedirToken(mensaje) {
  const a = new Alert();
  a.title = 'Token de GitHub';
  a.message = mensaje ?? 'Fine-grained, solo codetion-datos, Contents: Read-only.';
  a.addSecureTextField('github_pat_…');
  a.addAction('Guardar');
  a.addCancelAction('Cancelar');
  if ((await a.present()) === -1) return false;
  const token = a.textFieldValue(0).trim();
  if (!token) return false;
  Keychain.set(K_TOKEN, token);
  return true;
}

/** { datos, aviso } o { error } */
async function cargar() {
  if (!Keychain.contains(K_TOKEN)) {
    if (config.runsInWidget || !(await pedirToken())) return { error: 'Abrí Scriptable para cargar el token' };
  }
  const req = new Request(URL_DATOS);
  req.headers = { Authorization: `Bearer ${Keychain.get(K_TOKEN)}`, Accept: 'application/vnd.github.raw' };
  let texto;
  try {
    texto = await req.loadString();
  } catch {
    return copia('sin conexión');
  }
  const status = req.response.statusCode;
  if ([401, 403, 404].includes(status)) {
    if (!config.runsInWidget && (await pedirToken('Token inválido o vencido. Pegá uno nuevo.'))) return cargar();
    return { error: 'Token vencido' };
  }
  if (status !== 200) return copia(`error ${status}`);
  try {
    const datos = JSON.parse(texto);
    fm.writeString(COPIA, texto);
    return { datos };
  } catch {
    return copia('datos inválidos');
  }
}

function copia(motivo) {
  if (!fm.fileExists(COPIA)) return { error: `Sin datos (${motivo})` };
  return { datos: JSON.parse(fm.readString(COPIA)), aviso: motivo };
}

function texto(stack, t, tam, color, negrita) {
  const x = stack.addText(t);
  x.font = negrita ? Font.semiboldSystemFont(tam) : Font.systemFont(tam);
  x.textColor = color;
  x.lineLimit = 1;
  return x;
}

function fila(stack, i, tam, lineas = 3) {
  const f = stack.addStack();
  f.spacing = 4;
  if (i.tipo === 'cursada') {
    f.topAlignContent();
    texto(f, '●', tam - 2, new Color(colorDe(i.materia)));
    const t = f.addStack();
    t.layoutVertically();
    const nombre = texto(t, i.materia.nombre, tam, TINTA, true);
    nombre.lineLimit = lineas;
    nombre.minimumScaleFactor = 0.8;
    const hora = texto(t, `${i.inicio}–${i.fin}${i.aula ? ` · ${i.aula}` : ''}`, tam - 1, GRIS);
    hora.minimumScaleFactor = 0.7;
    return;
  }
  f.centerAlignContent();
  texto(f, '●', tam - 2, new Color(colorDe(i.materia)));
  texto(f, i.hora ?? 'todo el día', tam, i.hora ? TINTA : GRIS, !!i.hora);
  texto(f, i.titulo, tam, TINTA, true);
  texto(f, i.materia.nombre, tam - 1, GRIS);
}

const nombreDia = (d) => d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric' });

/** Lo de hoy que no pasó: eventos de todo el día siempre; cursada hasta que termina. */
function pendientesDeHoy(items, ahora) {
  const hhmm = `${dos(ahora.getHours())}:${dos(ahora.getMinutes())}`;
  return items.filter(i => (i.tipo === 'cursada' ? i.fin > hhmm : !i.hora || i.hora >= hhmm));
}

function columna(padre, titulo, items, max, tam, vacio = 'Libre') {
  const c = padre.addStack();
  c.layoutVertically();
  c.spacing = 3;
  texto(c, titulo, tam - 1, GRIS, true);
  if (!items.length) texto(c, vacio, tam, SUAVE);
  for (const i of items.slice(0, max)) fila(c, i, tam);
  if (items.length > max) texto(c, `+${items.length - max} más`, tam - 1, SUAVE);
  return c;
}

const ABREV = { lunes: 'Lun', martes: 'Mar', miercoles: 'Mié', jueves: 'Jue', viernes: 'Vie', sabado: 'Sáb', domingo: 'Dom' };

/** Una columna por cada día de la semana con cursada (lunes a domingo), de ancho igual. */
function semanaCursada(w, datos, ahora, compacto) {
  const materias = new Map(datos.materias.map(m => [m.id, m]));
  const orden = [...DIAS.slice(1), DIAS[0]];
  const dias = orden.filter(d => datos.cursada.some(c => c.dia === d && materias.has(c.materia)));
  if (!compacto) {
    texto(w, 'Cursada', 14, TINTA, true);
    w.addSpacer(8);
  }
  if (!dias.length) {
    texto(w, 'Sin clases cargadas', 12, SUAVE);
    return;
  }
  const hoy = DIAS[ahora.getDay()];
  const ESPACIO = 6;
  // ponytail: ancho fijo pensado para el widget grande de un iPhone de 6,1"; ajustar ANCHO si se corta en otro modelo.
  const ANCHO = 310;
  const ancho = (ANCHO - ESPACIO * (dias.length - 1)) / dias.length;
  const columnas = w.addStack();
  columnas.topAlignContent();
  columnas.spacing = ESPACIO;
  for (const d of dias) {
    const col = columnas.addStack();
    col.layoutVertically();
    col.spacing = compacto ? 5 : 8;
    col.size = new Size(ancho, 0);
    texto(col, ABREV[d], 12, d === hoy ? TINTA : GRIS, true);
    const items = datos.cursada
      .filter(c => c.dia === d && materias.has(c.materia))
      .sort((a, b) => (a.inicio < b.inicio ? -1 : 1))
      .map(c => ({ tipo: 'cursada', ...c, materia: materias.get(c.materia) }));
    for (const i of items) fila(col, i, compacto ? 10 : 11, compacto ? 2 : 3);
    col.addSpacer();
  }
}

function crearWidget({ datos, aviso, error }, modo) {
  const w = new ListWidget();
  w.backgroundColor = FONDO;
  w.url = URL_WEB;
  w.refreshAfterDate = new Date(Date.now() + 30 * 60 * 1000);
  w.setPadding(14, 14, 14, 14);
  if (error) {
    texto(w, 'Calendario', 13, TINTA, true);
    w.addSpacer(6);
    texto(w, error, 12, GRIS).lineLimit = 3;
    return w;
  }
  const ahora = new Date();
  const familia = config.widgetFamily ?? 'large';
  if (familia === 'small') {
    const [hoy] = armarDias(datos, ahora, 1, modo);
    columna(w, modo === 'cursada' ? 'Cursada hoy' : 'Hoy', pendientesDeHoy(hoy.items, ahora), 3, 12, modo === 'cursada' ? 'Sin clases' : 'Libre');
  } else if (familia === 'medium' && modo === 'cursada') {
    semanaCursada(w, datos, ahora, true);
  } else if (familia === 'medium') {
    const [hoy, manana] = armarDias(datos, ahora, 2, modo);
    const vacio = modo === 'cursada' ? 'Sin clases' : 'Libre';
    const fila2 = w.addStack();
    fila2.topAlignContent();
    columna(fila2, 'Hoy', pendientesDeHoy(hoy.items, ahora), 4, 12, vacio);
    fila2.addSpacer(12);
    columna(fila2, 'Mañana', manana.items, 4, 12, vacio);
    fila2.addSpacer();
  } else if (modo === 'cursada') {
    semanaCursada(w, datos, ahora, false);
  } else {
    texto(w, 'Próximos 7 días', 14, TINTA, true);
    w.addSpacer(6);
    let lineas = 0;
    const MAX = familia === 'extraLarge' ? 18 : 16;
    for (const [n, d] of armarDias(datos, ahora, 7, modo).entries()) {
      const items = n === 0 ? pendientesDeHoy(d.items, ahora) : d.items;
      if (!items.length || lineas >= MAX) continue;
      texto(w, n === 0 ? 'Hoy' : nombreDia(d.fecha), 12, GRIS, true);
      for (const i of items.slice(0, MAX - lineas)) fila(w, i, 12);
      lineas += 1 + Math.min(items.length, MAX - lineas);
      w.addSpacer(4);
    }
    if (!lineas) texto(w, 'Semana libre', 12, SUAVE);
  }
  w.addSpacer();
  if (aviso) texto(w, aviso, 9, new Color('#c2410c'));
  return w;
}

let modo = (args.widgetParameter ?? '').trim().toLowerCase() === 'cursada' ? 'cursada' : 'eventos';
if (!config.runsInWidget) {
  const a = new Alert();
  a.title = 'Vista previa';
  a.addAction('Eventos');
  a.addAction('Cursada');
  modo = (await a.presentSheet()) === 1 ? 'cursada' : 'eventos';
}
const widget = crearWidget(await cargar(), modo);
if (config.runsInWidget) Script.setWidget(widget);
else await widget.presentLarge();
Script.complete();
