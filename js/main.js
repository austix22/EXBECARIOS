import { isFirebaseConfigured, getFirebaseServices } from "./firebase.js";

const CACHE_DURATION_MS = 12 * 60 * 60 * 1000;
const MAX_PUBLIC_EVENTS = 6;
const MAX_IMAGE_DATA_LENGTH = 210000;
const eventsStatus = document.querySelector("#events-status");
const eventsList = document.querySelector("#events-list");

function setStatus(message, state = "") {
  eventsStatus.textContent = message;
  eventsStatus.className = `events-status${state ? ` is-${state}` : ""}`;
}

function cacheKey(projectId) {
  return `exbecarios-events-v2:${projectId}`;
}

function readCache(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "null");
    if (!value || !Number.isFinite(value.savedAt) || !Array.isArray(value.events)) {
      return null;
    }
    return value;
  } catch (error) {
    console.warn("No se pudo leer la caché local de eventos.", error);
    return null;
  }
}

function writeCache(key, events) {
  try {
    localStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), events }));
  } catch (error) {
    console.warn("No se pudo guardar la caché local de eventos.", error);
  }
}

function formatEventDate(isoDate) {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Uno de los eventos contiene una fecha inválida.");
  }
  return new Intl.DateTimeFormat("es-CR", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "America/Costa_Rica",
  }).format(date);
}

function renderEvents(events) {
  eventsList.replaceChildren();
  if (events.length === 0) {
    setStatus("Aún no hay eventos publicados. Vuelve pronto para conocer las próximas actividades.", "empty");
    return;
  }

  for (const event of events) {
    const card = document.createElement("article");
    card.className = "event-card";

    if (event.imageData) {
      const image = document.createElement("img");
      image.className = "event-image";
      image.src = event.imageData;
      image.alt = `Foto de ${event.title}`;
      image.loading = "lazy";
      image.decoding = "async";
      card.append(image);
    }

    const date = document.createElement("p");
    date.className = "event-date";
    date.textContent = formatEventDate(event.date);

    const title = document.createElement("h3");
    title.textContent = event.title;

    const description = document.createElement("p");
    description.textContent = event.description;

    card.append(date, title, description);
    if (event.location) {
      const location = document.createElement("p");
      location.className = "event-location";
      location.textContent = event.location;
      card.append(location);
    }
    eventsList.append(card);
  }

  setStatus("");
}

async function fetchEvents(db) {
  const [{ collection, getDocs, limit, orderBy, query, Timestamp, where }, { firebaseConfig }] = await Promise.all([
    import("https://www.gstatic.com/firebasejs/11.2.0/firebase-firestore.js"),
    import("./firebase-config.js"),
  ]);
  const key = cacheKey(firebaseConfig.projectId);
  const cached = readCache(key);
  if (cached && Date.now() - cached.savedAt < CACHE_DURATION_MS) {
    return cached.events;
  }

  const eventsQuery = query(
    collection(db, "events"),
    where("date", ">=", Timestamp.fromDate(new Date())),
    orderBy("date", "asc"),
    limit(MAX_PUBLIC_EVENTS),
  );
  const snapshot = await getDocs(eventsQuery);
  const events = snapshot.docs.map((eventDoc) => {
    const data = eventDoc.data();
    if (!data.date?.toDate || typeof data.title !== "string" || typeof data.description !== "string") {
      throw new Error(`El evento ${eventDoc.id} tiene datos incompletos.`);
    }
    if (data.imageData !== undefined && (
      typeof data.imageData !== "string"
      || data.imageData.length > MAX_IMAGE_DATA_LENGTH
      || !data.imageData.startsWith("data:image/jpeg;base64,")
    )) {
      throw new Error(`La foto del evento ${eventDoc.id} tiene un formato inválido.`);
    }
    return {
      title: data.title,
      description: data.description,
      location: typeof data.location === "string" ? data.location : "",
      date: data.date.toDate().toISOString(),
      imageData: data.imageData || "",
    };
  });
  writeCache(key, events);
  return events;
}

async function loadEvents() {
  if (!isFirebaseConfigured) {
    setStatus("La agenda estará disponible cuando se configure Firebase. Para información sobre actividades, escríbenos a exbecarios.japon.cr@gmail.com.", "error");
    return;
  }

  try {
    const { db } = await getFirebaseServices();
    renderEvents(await fetchEvents(db));
  } catch (error) {
    console.error("No se pudieron cargar los eventos de Firestore.", error);
    setStatus("No fue posible cargar los eventos en este momento. Inténtalo más tarde o contáctanos por correo.", "error");
  }
}

loadEvents();
