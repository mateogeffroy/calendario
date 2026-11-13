// Fichajes: widget chico de Scriptable con horas hechas / totales de hoy, la semana y el mes.
// Lee <página>/fichajes.json del repo de datos de termo; se actualiza cuando termo sube cambios.
// Parámetro del widget: carpeta de la página de trabajo (por defecto "aloise").
// Usa el mismo token que el widget de calendario; si no está, correrlo una vez dentro de la app.

const PAGINA = (args.widgetParameter ?? '').trim() || 'aloise';
const URL_DATOS = `https://api.github.com/repos/mateogeffroy/codetion-datos/contents/${PAGINA}/fichajes.json`;
const K_TOKEN = 'calendario.token';
const fm = FileManager.local();
const COPIA = fm.joinPath(fm.documentsDirectory(), `fichajes-${PAGINA}.json`);

const FONDO = new Color('#141416');
const TINTA = new Color('#f2f2f5');
const GRIS = new Color('#9a9aa3');
const PISTA = new Color('#2c2c32');
const ACENTO = new Color('#e0a800');
const LISTO = new Color('#30a46c');

const JORNADA = 4 * 3600;
const OBJETIVO_MES = 80 * 3600;
const NO = 'no';

// ponytail: estas cuentas repiten resumen() de termo/src/fichajes.ts (Scriptable no importa módulos); cambiar las dos.
const dos = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
const deClave = (k) => { const [a, m, d] = k.split('-').map(Number); return new Date(a, m - 1, d); };
const sumarDias = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const esHabil = (d) => d.getDay() % 6 !== 0;
const horas = (v) => (typeof v === 'number' ? v : 0);

function semanaDe(hoy) {
  const lunes = sumarDias(hoy, -((hoy.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i));
}

function resumen(f, hoy) {
  const k = ymd(hoy);
  const claves = semanaDe(hoy).map(ymd);
  const semana = Object.entries(f.dias).filter(([c]) => claves.includes(c));
  const saldoPrevio = semana
    .filter(([c, v]) => v !== NO && c < k)
    .reduce((s, [c, v]) => s + v - (esHabil(deClave(c)) ? JORNADA : 0), 0);
  const habiles = semanaDe(hoy).filter(d => esHabil(d) && f.dias[ymd(d)] !== NO).length;
  const mes = Object.entries(f.dias).filter(([c]) => c.slice(0, 7) === k.slice(0, 7)).map(([, v]) => v);
  return {
    dia: { hecho: horas(f.dias[k]), total: esHabil(hoy) && f.dias[k] !== NO ? Math.max(JORNADA - saldoPrevio, 0) : 0 },
    semana: { hecho: semana.reduce((s, [, v]) => s + horas(v), 0), total: habiles * JORNADA },
    mes: { hecho: mes.reduce((s, v) => s + horas(v), 0), total: OBJETIVO_MES - mes.filter(v => v === NO).length * JORNADA },
  };
}

const hm = (s) => `${Math.floor(s / 3600)}:${dos(Math.floor((s % 3600) / 60))}`;

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

/** { datos, aviso } o { error }. Sin red usa la última copia. */
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
  if (status === 401 || status === 403) {
    if (!config.runsInWidget && (await pedirToken('Token inválido o vencido. Pegá uno nuevo.'))) return cargar();
    return { error: 'Token vencido' };
  }
  if (status === 404) return { error: `No hay ${PAGINA}/fichajes.json` };
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
  try {
    const datos = JSON.parse(fm.readString(COPIA));
    if (datos && typeof datos.dias === 'object') return { datos, aviso: motivo };
  } catch {
    // sin copia o copia corrupta
  }
  return { error: `Sin datos (${motivo})` };
}

function texto(stack, t, tam, color, negrita) {
  const x = stack.addText(t);
  x.font = negrita ? Font.semiboldMonospacedSystemFont(tam) : Font.systemFont(tam);
  x.textColor = color;
  x.lineLimit = 1;
  x.minimumScaleFactor = 0.7;
  return x;
}

// ponytail: ancho fijo para el widget chico de un iPhone de 6,1"; ajustar si la barra se corta en otro modelo.
const ANCHO_BARRA = 128;

function fila(w, etiqueta, { hecho, total }) {
  const cabecera = w.addStack();
  cabecera.centerAlignContent();
  texto(cabecera, etiqueta, 11, GRIS);
  cabecera.addSpacer();
  texto(cabecera, total ? `${hm(hecho)}/${hm(total)}` : hm(hecho), 13, TINTA, true);
  w.addSpacer(3);
  const pista = w.addStack();
  pista.size = new Size(ANCHO_BARRA, 4);
  pista.cornerRadius = 2;
  pista.backgroundColor = PISTA;
  const p = total ? Math.min(hecho / total, 1) : 0;
  if (p > 0) {
    const barra = pista.addStack();
    barra.size = new Size(Math.max(ANCHO_BARRA * p, 4), 4);
    barra.cornerRadius = 2;
    barra.backgroundColor = p >= 1 ? LISTO : ACENTO;
  }
  pista.addSpacer();
}

function crearWidget({ datos, aviso, error }) {
  const w = new ListWidget();
  w.backgroundColor = FONDO;
  w.setPadding(12, 14, 12, 14);
  w.refreshAfterDate = new Date(Date.now() + 15 * 60 * 1000); // iOS decide el momento real
  texto(w, 'Fichajes', 12, TINTA, true);
  w.addSpacer(8);
  if (error) {
    texto(w, error, 11, GRIS).lineLimit = 3;
    return w;
  }
  const r = resumen(datos, new Date());
  fila(w, 'Hoy', r.dia);
  w.addSpacer(8);
  fila(w, 'Semana', r.semana);
  w.addSpacer(8);
  fila(w, 'Mes', r.mes);
  w.addSpacer();
  if (aviso) texto(w, aviso, 9, new Color('#c2410c'));
  return w;
}

const widget = crearWidget(await cargar());
if (config.runsInWidget) Script.setWidget(widget);
else await widget.presentSmall();
Script.complete();
