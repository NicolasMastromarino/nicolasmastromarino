/**
 * The industries the city has a building for. Everything here is about what gets built for them,
 * written to be read in about twenty seconds: no invented numbers, no promises that cannot be checked.
 */
export type IndustryId = "hvac" | "roofing" | "plumbing" | "outdoor" | "solar" | "locksmith";
export type IconName = "phone" | "route" | "calendar" | "star" | "refresh" | "receipt" | "bell" | "layers" | "bolt" | "drop";

export type IndustryCopy = {
  name: string;
  /** who it is for, in a few words (the industry chooser) */
  who: string;
  tagline: string;
  /** what the owner already feels */
  pains: string[];
  /** what gets built, one line each */
  builds: { icon: IconName; title: string; text: string }[];
  /** the path of one job, from first contact to the next one */
  flow: string[];
  tools: string[];
  outcome: string;
};

export type Industry = {
  id: IndustryId;
  /** where the building stands in the world */
  x: number;
  z: number;
  /** "block": fills one 6 x 6 downtown block. "open": a levelled pad out of town, with its own plaza */
  site: "block" | "open";
  /** side of an open site's pad, in metres (14 when left out) */
  size?: number;
  /** height of the ground the building stands on (measured on the built scene) */
  ground: number;
  /** the point on the nearest road that the site's access lane runs to (open sites only) */
  lane?: { x: number; z: number };
  /** accent colour of the building and of its panel */
  color: string;
  en: IndustryCopy;
  es: IndustryCopy;
};

export const INDUSTRIES: Industry[] = [
  {
    id: "hvac",
    x: -90, // in the stadium's northeast car park: arenas run on cooling
    z: 18,
    site: "open",
    ground: 0.4,
    lane: { x: -90, z: 4 }, // north to the highway
    color: "#7fd4ff",
    en: {
      name: "HVAC",
      who: "Heating and cooling contractors",
      tagline: "The call comes in at 7 pm in July. Nothing should slip.",
      pains: [
        "Evening and weekend calls go to voicemail, and the customer calls the next company.",
        "The same job gets typed into the CRM, the dispatch board and the invoice.",
        "Tune-ups and renewals depend on someone remembering to call.",
        "Quotes sit unanswered after the visit.",
      ],
      builds: [
        { icon: "phone", title: "Instant response to every call and form", text: "A missed call gets a text back in seconds, and the lead lands in the CRM with its source." },
        { icon: "route", title: "Dispatch that updates itself", text: "Jobs flow from the CRM to your field software, and the status flows back." },
        { icon: "refresh", title: "Maintenance plans on autopilot", text: "Spring and fall tune-up campaigns, reminders and renewals, sent without anyone remembering." },
        { icon: "star", title: "Reviews after every job", text: "The request goes out when the job closes, not whenever someone has time." },
      ],
      flow: ["Call or form", "CRM", "Dispatch", "Job done", "Invoice", "Review"],
      tools: ["GoHighLevel", "Kickserv", "Zapier", "Stripe", "Twilio"],
      outcome: "One pipeline from the first call to the paid invoice, so the office stops chasing and the technicians stop waiting.",
    },
    es: {
      name: "HVAC (calefacción y aire)",
      who: "Empresas de calefacción y aire",
      tagline: "La llamada entra a las 7 de la tarde en pleno julio. Nada debería perderse.",
      pains: [
        "Las llamadas de la noche y del fin de semana van al buzón, y el cliente llama a la competencia.",
        "El mismo trabajo se carga en el CRM, en el tablero de despacho y en la factura.",
        "Los mantenimientos y las renovaciones dependen de que alguien se acuerde de llamar.",
        "Los presupuestos quedan sin respuesta después de la visita.",
      ],
      builds: [
        { icon: "phone", title: "Respuesta inmediata a cada llamada y formulario", text: "Una llamada perdida recibe un mensaje en segundos, y el contacto entra al CRM con su origen." },
        { icon: "route", title: "Despacho que se actualiza solo", text: "Los trabajos pasan del CRM a tu software de campo, y el estado vuelve." },
        { icon: "refresh", title: "Planes de mantenimiento en automático", text: "Campañas de revisión de primavera y otoño, recordatorios y renovaciones, sin que nadie tenga que acordarse." },
        { icon: "star", title: "Reseñas después de cada trabajo", text: "El pedido sale cuando cierra el trabajo, no cuando alguien tiene tiempo." },
      ],
      flow: ["Llamada o formulario", "CRM", "Despacho", "Trabajo hecho", "Factura", "Reseña"],
      tools: ["GoHighLevel", "Kickserv", "Zapier", "Stripe", "Twilio"],
      outcome: "Un solo circuito desde la primera llamada hasta la factura cobrada: la oficina deja de perseguir y los técnicos dejan de esperar.",
    },
  },
  {
    id: "roofing",
    x: -114, // on the northwestern outskirts, in the fields by the roundabout
    z: -60,
    site: "open",
    ground: 0.42,
    lane: { x: -114, z: -44 }, // south to the northern avenue
    color: "#ff8a6a",
    en: {
      name: "Roofers",
      who: "Roofing and storm-repair crews",
      tagline: "A storm hits and the phone melts. Every lead still needs an answer.",
      pains: [
        "Estimates go cold a few days after the inspection.",
        "After a storm the phone floods, and nobody can answer everyone.",
        "Permits, insurance and scheduling steps get lost in text threads.",
        "Happy homeowners are rarely asked for a review or a referral.",
      ],
      builds: [
        { icon: "bell", title: "Follow-up until it is a yes or a no", text: "Text and email sequences after every estimate, stopping the moment the homeowner replies." },
        { icon: "layers", title: "Storm-season lead routing", text: "Auto-replies, a clear queue and booking links, so the surge does not bury the good leads." },
        { icon: "calendar", title: "Job status for the homeowner", text: "An update at each stage: inspection, materials, crew day, clean-up." },
        { icon: "star", title: "Reviews and referrals", text: "Asked at the right moment, with a link that takes one tap." },
      ],
      flow: ["Lead", "Inspection", "Estimate", "Follow-up", "Contract", "Job updates", "Review"],
      tools: ["GoHighLevel", "Zapier", "Google Sheets", "Stripe"],
      outcome: "Fewer estimates lost to silence, a calmer office in storm season, and a steady trickle of reviews.",
    },
    es: {
      name: "Techistas (roofers)",
      who: "Techistas y cuadrillas de reparación",
      tagline: "Llega una tormenta y el teléfono explota. Cada contacto necesita una respuesta.",
      pains: [
        "Los presupuestos se enfrían a los pocos días de la inspección.",
        "Después de una tormenta el teléfono se llena y no se puede atender a todos.",
        "Los permisos, el seguro y la agenda se pierden entre hilos de mensajes.",
        "A los clientes contentos casi nunca se les pide una reseña o una recomendación.",
      ],
      builds: [
        { icon: "bell", title: "Seguimiento hasta el sí o el no", text: "Secuencias de mensajes y correos después de cada presupuesto, que se detienen cuando el cliente responde." },
        { icon: "layers", title: "Ordenar los contactos en temporada de tormentas", text: "Respuestas automáticas, una cola clara y enlaces para agendar, para que la ola no entierre a los buenos contactos." },
        { icon: "calendar", title: "Estado del trabajo para el cliente", text: "Un aviso en cada etapa: inspección, materiales, día de cuadrilla, limpieza." },
        { icon: "star", title: "Reseñas y recomendaciones", text: "Se piden en el momento justo, con un enlace que se abre con un toque." },
      ],
      flow: ["Contacto", "Inspección", "Presupuesto", "Seguimiento", "Contrato", "Avance del trabajo", "Reseña"],
      tools: ["GoHighLevel", "Zapier", "Google Sheets", "Stripe"],
      outcome: "Menos presupuestos perdidos por el silencio, una oficina más tranquila en temporada de tormentas y un goteo constante de reseñas.",
    },
  },
  {
    id: "plumbing",
    x: -32, // a block of the southern quarter, between the CRM tower and the houses
    z: 56,
    site: "block",
    ground: 0.03,
    color: "#a9b6ff",
    en: {
      name: "Plumbing & electrical",
      who: "Plumbers and electricians",
      tagline: "A burst pipe and a routine check-up should not wait in the same line.",
      pains: [
        "Emergencies and routine jobs look the same when they come in.",
        "Technicians' schedules change all day, and the office relays it by phone.",
        "Invoices go out days late, and payments are chased by hand.",
        "Past customers are never reminded that service is due.",
      ],
      builds: [
        { icon: "bolt", title: "Urgent or routine, sorted on arrival", text: "Intake questions route emergencies to the front of the queue and the rest to scheduling." },
        { icon: "calendar", title: "Booking that matches the technicians", text: "Customers pick a slot, the technician's calendar and the job record stay in sync." },
        { icon: "receipt", title: "Invoice and payment follow-up", text: "The invoice leaves when the job closes, and reminders go out until it is paid." },
        { icon: "refresh", title: "Service reminders", text: "Past customers hear from you when a check-up or a renewal comes due." },
      ],
      flow: ["Call", "Triage", "Booking", "Visit", "Invoice", "Reminder"],
      tools: ["GoHighLevel", "Kickserv", "Airtable", "Stripe", "Zapier"],
      outcome: "Emergencies answered first, a schedule everyone can see, and invoices that arrive and get paid on time.",
    },
    es: {
      name: "Plomería y electricidad",
      who: "Plomeros y electricistas",
      tagline: "Una tubería rota y una revisión de rutina no deberían esperar en la misma fila.",
      pains: [
        "Las emergencias y los trabajos de rutina entran iguales.",
        "La agenda de los técnicos cambia todo el día y la oficina la avisa por teléfono.",
        "Las facturas salen con días de atraso y los pagos se persiguen a mano.",
        "Los clientes anteriores nunca reciben un aviso de que toca un servicio.",
      ],
      builds: [
        { icon: "bolt", title: "Urgente o de rutina, ordenado al entrar", text: "Preguntas de ingreso que mandan las emergencias al frente y el resto a la agenda." },
        { icon: "calendar", title: "Reservas que coinciden con los técnicos", text: "El cliente elige un horario y el calendario del técnico y la ficha del trabajo quedan sincronizados." },
        { icon: "receipt", title: "Factura y seguimiento de pago", text: "La factura sale al cerrar el trabajo y los recordatorios siguen hasta que se paga." },
        { icon: "refresh", title: "Recordatorios de servicio", text: "Los clientes anteriores reciben tu mensaje cuando toca una revisión o una renovación." },
      ],
      flow: ["Llamada", "Clasificación", "Reserva", "Visita", "Factura", "Recordatorio"],
      tools: ["GoHighLevel", "Kickserv", "Airtable", "Stripe", "Zapier"],
      outcome: "Las emergencias se atienden primero, la agenda la ve todo el equipo y las facturas llegan y se cobran a tiempo.",
    },
  },
  {
    id: "outdoor",
    x: -118, // out in the meadow beside the western farm
    z: 92,
    site: "open",
    ground: 0.37,
    lane: { x: -118, z: 68 }, // north to the southern avenue
    color: "#9ed98a",
    en: {
      name: "Landscaping & cleaning",
      who: "Lawn, garden and cleaning services",
      tagline: "Recurring work runs on routine. The routine should run itself.",
      pains: [
        "Recurring clients are billed by hand every month.",
        "Route and crew changes live in group chats.",
        "Seasonal upsells are forgotten until the season is over.",
        "Clients cancel quietly, without anyone having talked to them.",
      ],
      builds: [
        { icon: "receipt", title: "Recurring billing and contracts", text: "Plans, renewals and payments handled in one place, charged on schedule." },
        { icon: "route", title: "Crew and route notifications", text: "The crew gets the day's list, and the client gets a heads-up before the visit." },
        { icon: "calendar", title: "Seasonal offers on a calendar", text: "Spring clean-ups, aeration, deep cleans: offered to the right people at the right time." },
        { icon: "drop", title: "A check-in before they leave", text: "A short message after a missed visit or a low rating, so a problem becomes a conversation." },
      ],
      flow: ["Quote", "Contract", "Schedule", "Service", "Recurring invoice", "Check-in"],
      tools: ["GoHighLevel", "Airtable", "Stripe", "Google Sheets", "Zapier"],
      outcome: "Predictable monthly revenue, crews that know the plan, and clients who feel looked after.",
    },
    es: {
      name: "Paisajismo y limpieza",
      who: "Servicios de jardín, césped y limpieza",
      tagline: "El trabajo recurrente vive de la rutina. La rutina tendría que andar sola.",
      pains: [
        "Los clientes recurrentes se facturan a mano todos los meses.",
        "Los cambios de ruta y de cuadrilla viven en chats grupales.",
        "Las ofertas de temporada se olvidan hasta que la temporada ya pasó.",
        "Los clientes se van en silencio, sin que nadie haya hablado con ellos.",
      ],
      builds: [
        { icon: "receipt", title: "Cobro recurrente y contratos", text: "Planes, renovaciones y pagos en un solo lugar, cobrados en fecha." },
        { icon: "route", title: "Avisos a la cuadrilla y a la ruta", text: "La cuadrilla recibe la lista del día y el cliente un aviso antes de la visita." },
        { icon: "calendar", title: "Ofertas de temporada con calendario", text: "Limpiezas de primavera, aireado, limpiezas profundas: ofrecidas a quien corresponde, en el momento justo." },
        { icon: "drop", title: "Un contacto antes de que se vayan", text: "Un mensaje corto después de una visita perdida o de una nota baja, para que un problema se vuelva una conversación." },
      ],
      flow: ["Presupuesto", "Contrato", "Agenda", "Servicio", "Factura recurrente", "Seguimiento"],
      tools: ["GoHighLevel", "Airtable", "Stripe", "Google Sheets", "Zapier"],
      outcome: "Ingresos mensuales predecibles, cuadrillas que conocen el plan y clientes que se sienten atendidos.",
    },
  },
  {
    id: "solar",
    x: -62, // south of the city, beside the southern avenue: a farm needs room
    z: 110,
    site: "open",
    size: 24,
    ground: 0.35,
    lane: { x: -44, z: 110 }, // east to the southern avenue
    color: "#ffd84a",
    en: {
      name: "Solar installers",
      who: "Solar and energy installers",
      tagline: "A solar sale takes months. No lead should go cold along the way.",
      pains: [
        "Leads from ads and referrals wait days for a call back, and the quote goes to whoever answered first.",
        "Surveys, permits, inspection and installation are tracked in different places.",
        "Proposals go quiet for weeks and nobody follows up.",
        "Happy customers are rarely asked for a referral.",
      ],
      builds: [
        { icon: "bell", title: "Fast first reply and basic qualification", text: "Every new lead gets an answer in minutes, and a few questions that sort serious buyers from browsers." },
        { icon: "calendar", title: "Site survey booking", text: "The customer picks a slot, and the surveyor's calendar and the project record stay in sync." },
        { icon: "layers", title: "Project status from permit to switch-on", text: "One pipeline shows where each job stands, and the customer hears about each stage without a phone call." },
        { icon: "star", title: "Referrals asked at the right moment", text: "A short request once the system is live, when the customer is happiest." },
      ],
      flow: ["Lead", "Qualification", "Survey", "Proposal", "Contract", "Permit", "Install", "Referral"],
      tools: ["GoHighLevel", "Zapier", "Airtable", "Stripe", "Google Sheets"],
      outcome: "Fewer proposals lost to silence, a pipeline everyone can read, and referrals that are asked for instead of hoped for.",
    },
    es: {
      name: "Instaladores solares",
      who: "Instaladores de energía solar",
      tagline: "Una venta solar lleva meses. Ningún contacto debería enfriarse en el camino.",
      pains: [
        "Los contactos de anuncios y recomendaciones esperan días una respuesta, y el presupuesto se lo lleva quien contestó primero.",
        "Las visitas técnicas, los permisos, la inspección y la instalación se siguen en lugares distintos.",
        "Las propuestas quedan en silencio durante semanas y nadie hace seguimiento.",
        "A los clientes contentos casi nunca se les pide una recomendación.",
      ],
      builds: [
        { icon: "bell", title: "Primera respuesta rápida y calificación básica", text: "Cada contacto nuevo recibe respuesta en minutos y unas preguntas que separan a quien va en serio de quien solo mira." },
        { icon: "calendar", title: "Reserva de la visita técnica", text: "El cliente elige un horario y el calendario del técnico y la ficha del proyecto quedan sincronizados." },
        { icon: "layers", title: "Estado del proyecto del permiso a la puesta en marcha", text: "Un solo tablero muestra en qué punto está cada obra, y el cliente se entera de cada etapa sin llamar." },
        { icon: "star", title: "Recomendaciones pedidas en el momento justo", text: "Un pedido corto cuando el sistema ya funciona, que es cuando el cliente está más contento." },
      ],
      flow: ["Contacto", "Calificación", "Visita técnica", "Propuesta", "Contrato", "Permiso", "Instalación", "Recomendación"],
      tools: ["GoHighLevel", "Zapier", "Airtable", "Stripe", "Google Sheets"],
      outcome: "Menos propuestas perdidas por el silencio, un tablero que todos pueden leer y recomendaciones que se piden en lugar de esperarlas.",
    },
  },
  {
    id: "locksmith",
    x: -32, // the block just north of the plumbers
    z: 48,
    site: "block",
    ground: 0.03,
    color: "#c58aff",
    en: {
      name: "Locksmith",
      who: "Locksmiths and 24/7 lockout services",
      tagline: "A lockout does not wait for business hours. The first answer wins the job.",
      pains: [
        "After-hours calls and texts go unanswered, and the customer dials the next number.",
        "Details taken over the phone are retyped into the job sheet and the invoice.",
        "Customers are never told when the technician is on the way.",
        "A one-off job ends there: no thank-you, no review request.",
      ],
      builds: [
        { icon: "phone", title: "Every call and text answered, day or night", text: "A missed call gets an instant text back that collects the address and the problem." },
        { icon: "route", title: "Dispatch with live status", text: "The nearest technician gets the job, and the customer receives an on-the-way message." },
        { icon: "receipt", title: "Invoice and payment at close", text: "The invoice leaves the moment the job closes, with a link to pay." },
        { icon: "star", title: "Review request after each job", text: "A short message once the door is open, when the customer is most grateful." },
      ],
      flow: ["Call", "Triage", "Dispatch", "On the way", "Job done", "Invoice", "Review"],
      tools: ["GoHighLevel", "Zapier", "Kickserv", "Stripe", "Google Sheets"],
      outcome: "After-hours calls answered, customers who know when help is coming, and a steady stream of reviews.",
    },
    es: {
      name: "Cerrajería",
      who: "Cerrajeros y servicios de apertura 24/7",
      tagline: "Una puerta cerrada no espera al horario comercial. Quien responde primero se queda con el trabajo.",
      pains: [
        "Las llamadas y mensajes fuera de horario quedan sin respuesta, y el cliente marca el siguiente número.",
        "Los datos que se toman por teléfono se vuelven a escribir en la orden de trabajo y en la factura.",
        "Al cliente nunca se le avisa cuándo viene el técnico.",
        "Un trabajo suelto termina ahí: sin agradecimiento y sin pedido de reseña.",
      ],
      builds: [
        { icon: "phone", title: "Cada llamada y mensaje atendido, de día o de noche", text: "Una llamada perdida recibe al instante un texto que pide la dirección y el problema." },
        { icon: "route", title: "Despacho con estado en vivo", text: "El técnico más cercano recibe el trabajo y el cliente un aviso de que va en camino." },
        { icon: "receipt", title: "Factura y cobro al cerrar", text: "La factura sale en el momento en que se cierra el trabajo, con un enlace para pagar." },
        { icon: "star", title: "Pedido de reseña después de cada trabajo", text: "Un mensaje corto cuando la puerta ya está abierta, que es cuando el cliente está más agradecido." },
      ],
      flow: ["Llamada", "Clasificación", "Despacho", "En camino", "Trabajo hecho", "Factura", "Reseña"],
      tools: ["GoHighLevel", "Zapier", "Kickserv", "Stripe", "Google Sheets"],
      outcome: "Llamadas fuera de horario atendidas, clientes que saben cuándo llega la ayuda y un flujo constante de reseñas.",
    },
  },
];

/** the access lane of an open site: its centre and size (w along x, d along z), from the plaza edge to the road */
export function laneOf(ind: Industry): { x: number; z: number; w: number; d: number } | null {
  if (!ind.lane) return null;
  const half = (ind.size ?? 14) / 2; // half the plaza
  const reach = 2.4; // it ends inside the road's edge, so no gap shows
  const dx = ind.lane.x - ind.x;
  const dz = ind.lane.z - ind.z;
  if (Math.abs(dz) >= Math.abs(dx)) {
    const s = Math.sign(dz);
    const a = ind.z + s * half;
    const b = ind.lane.z - s * reach;
    return { x: ind.x, z: (a + b) / 2, w: 3.6, d: Math.abs(b - a) + 0.4 };
  }
  const s = Math.sign(dx);
  const a = ind.x + s * half;
  const b = ind.lane.x - s * reach;
  return { x: (a + b) / 2, z: ind.z, w: Math.abs(b - a) + 0.4, d: 3.6 };
}

export const industryById =(id: string) => INDUSTRIES.find((i) => i.id === id);
