// Metadatos del sistema de ranking: categorías, modalidades, calendario de fechas,
// tabla de puntos y reglamento. Fuente: "Torneo Nacional 2026 Sub15-Sub17-Sub19-Adulto
// 3 Fechas, para la conformación del Ranking Nacional" (FEDEBADCHILE).

const CATEGORIES = [
  { id: "Sub15", label: "Sub 15", color: "#eda100" },
  { id: "Sub17", label: "Sub 17", color: "#1baf7a" },
  { id: "Sub19", label: "Sub 19", color: "#eb6834" },
  { id: "Adulto", label: "Adulto", color: "#2a78d6" },
];

const MODALITIES = [
  { id: "Individuales Masculino", label: "Individual Masculino", short: "IM", doubles: false },
  { id: "Individuales Femenino", label: "Individual Femenino", short: "IF", doubles: false },
  { id: "Dobles Masculino", label: "Dobles Masculino", short: "DM", doubles: true },
  { id: "Dobles Femenino", label: "Dobles Femenino", short: "DF", doubles: true },
  { id: "Dobles Mixto", label: "Dobles Mixto", short: "DX", doubles: true },
];

const POINTS_TABLE = [
  { pos: "1°", label: "Campeón/a", points: 100 },
  { pos: "2°", label: "Subcampeón/a", points: 80 },
  { pos: "3°", label: "Tercer lugar", points: 60 },
  { pos: "4°", label: "Cuarto lugar (solo cuadros Round Robin)", points: 50 },
  { pos: "5°-8°", label: "Cuartos de final / 5°-8° lugar", points: 30 },
  { pos: "—", label: "Participación", points: 10 },
];

const FECHAS = [
  {
    numero: 1,
    nombre: "1ª Fecha — Torneo Nacional Juvenil-Adulto Santiago 2026",
    fechaTexto: "Miércoles 29 de abril al domingo 3 de mayo 2026",
    sede: "Centro de Entrenamiento Olímpico (CEO), Ñuñoa, Santiago",
    sedeCorta: "CEO, Santiago",
    estado: "completado",
    // `eventos` cuenta CUADROS DISPUTADOS, que es lo que reparte puntos. El
    // torneo inscribió 20 eventos, pero GD Sub15 (3 parejas) y GD Sub19 (sin
    // inscritas) nunca se armaron.
    eventos: 18,
    inscritos: 65,
    fuente: "Tournamentsoftware.com — Federación Chilena de Badminton",
    fuenteUrl: "https://www.tournamentsoftware.com/tournament/D252A3D7-3D1C-4B79-A53A-1B5F5BBF3F54",
  },
  {
    numero: 2,
    nombre: "2ª Fecha — Torneo Nacional Juvenil-Adulto Victoria 2026",
    fechaTexto: "Jueves 20 al domingo 23 de agosto 2026",
    sede: "Gimnasio Municipal Bernardo Muñoz, Victoria, Región de la Araucanía",
    sedeCorta: "Victoria, Araucanía",
    estado: "completado",
    // 17 cuadros de 20 eventos: XD Sub17 (2 parejas), BD Sub17 (2) y GD Sub17
    // (1) no alcanzaron cuadro.
    eventos: 17,
    inscritos: 68,
    fuente: "Tournamentsoftware.com — Federación Chilena de Badminton",
    fuenteUrl: "https://www.tournamentsoftware.com/tournament/A35095C0-BBEF-4957-94C0-3FED545B9328",
  },
  {
    numero: 3,
    nombre: "3ª Fecha y Premiación Anual",
    fechaTexto: "Miércoles 28 de octubre al domingo 1 de noviembre 2026",
    sede: "Por confirmar",
    estado: "proxima",
    eventos: null,
    inscritos: null,
  },
];

const CLUB_RULES = {
  base: 50,
  porAtleta: 1,
  oro: 7,
  plata: 5,
  bronce: 3,
  bonusMasDe10: 20,
  penalizacionNoPresentacion: -20,
  penalizacionBajaFueraDePlazo: -1,
};

const ATHLETE_RULES = {
  penalizacionInasistencia: -30,
  fechaMinimasObligatorias: 2, // obligatorio competir en 3, se acepta ausencia justificada en 1
};

const FEDERATION = {
  nombre: "Federación Chilena de Badminton",
  siglas: "FEDEBADCHILE",
  sede: "Centro de Entrenamiento Olímpico (CEO)",
  direccion: "Ramón Cruz 1176, Ñuñoa, Santiago, Chile",
  email: "gerente@fedebadchile.cl",
  web: "www.fedebadchile.cl",
  tournamentSoftwareUrl: "https://www.tournamentsoftware.com/find.aspx?a=7&q=83293451-5611-427b-8869-6d165cda269c",
  auspiciadores: [
    { nombre: "Comité Olímpico de Chile", url: "https://coch.cl/" },
    { nombre: "Team Chile" },
    { nombre: "Ministerio del Deporte", url: "https://www.mindep.cl/home" },
    { nombre: "Instituto Nacional de Deportes (IND)", url: "https://ind.cl/" },
  ],
  redesSociales: [
    { nombre: "Instagram", url: "https://www.instagram.com/fedebadchile?utm_source=ig_web_button_share_sheet&igsh=ZDNlZDc0MzIxNw==", icon: "instagram" },
    { nombre: "Facebook", url: "https://www.facebook.com/FEDEBADCHILE", icon: "facebook" },
  ],
  gerencia: [
    { nombre: "Sara Ortega V.", cargo: "Gerente" },
    { nombre: "Cristobal Conejero U.", cargo: "Coordinador Técnico" },
    { nombre: "Tomás Bernal R.", cargo: "Coordinador de Oficina" },
    { nombre: "Ivonne Palomo A.", cargo: "Coordinadora de Difusión" },
  ],
  directiva: [
    { nombre: "Helio Álvarez M.", cargo: "Presidente" },
    { nombre: "Andrés Trigo A.", cargo: "Director Secretario" },
    { nombre: "Valeska Vivar M.", cargo: "Directora Tesorera" },
  ],
};

const TIEBREAK_RULES = [
  "Mayor participación en las 3 fechas del circuito.",
  "Mayor número de primeros lugares (títulos).",
  "Mayor número de segundos lugares.",
  "Resultado directo entre los deportistas empatados (head-to-head).",
  "Mayor puntaje obtenido en el último evento disputado.",
];

const CLUB_TIEBREAK_RULES = [
  "Mayor número de medallas de oro.",
  "Mayor número de medallas de plata.",
  "Mayor número de medallas de bronce.",
];
