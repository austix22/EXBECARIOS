import { adminUids } from "./firebase-config.js";
import { getFirebaseServices, isFirebaseConfigured } from "./firebase.js";

const status = document.querySelector("#admin-status");
const loginPanel = document.querySelector("#login-panel");
const managerPanel = document.querySelector("#manager-panel");
const loginForm = document.querySelector("#login-form");
const eventForm = document.querySelector("#event-form");
const eventList = document.querySelector("#admin-events");
const cancelEdit = document.querySelector("#cancel-edit");
const saveButton = document.querySelector("#save-event");
const signoutButton = document.querySelector("#signout-button");
const MAX_ADMIN_EVENTS = 50;
let services;
let authObserver;

function setStatus(message, isError = false) {
  status.textContent = message;
  status.classList.toggle("is-error", isError);
}

function resetForm() {
  eventForm.reset();
  document.querySelector("#event-id").value = "";
  document.querySelector("#save-event").innerHTML = 'Publicar evento <span aria-hidden="true">→</span>';
  cancelEdit.hidden = true;
}

function localDateInput(date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Costa_Rica",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

async function listEvents() {
  const { db } = services;
  const { collection, getDocs, limit, orderBy, query } = await import("https://www.gstatic.com/firebasejs/11.2.0/firebase-firestore.js");
  const eventsQuery = query(collection(db, "events"), orderBy("date", "desc"), limit(MAX_ADMIN_EVENTS));
  const snapshot = await getDocs(eventsQuery);
  const events = snapshot.docs.map((eventDoc) => {
    const data = eventDoc.data();
    if (!data.date?.toDate || typeof data.title !== "string") {
      throw new Error(`El evento ${eventDoc.id} tiene datos incompletos.`);
    }
    return { id: eventDoc.id, title: data.title, date: data.date.toDate() };
  });
  renderAdminEvents(events);
  setStatus("");
}

function renderAdminEvents(events) {
  eventList.replaceChildren();
  if (!events.length) {
    const empty = document.createElement("p");
    empty.className = "admin-hint";
    empty.textContent = "Todavía no hay eventos publicados.";
    eventList.append(empty);
    return;
  }

  for (const event of events) {
    const row = document.createElement("article");
    row.className = "admin-event-row";
    const copy = document.createElement("div");
    copy.className = "admin-event-copy";
    const title = document.createElement("strong");
    title.textContent = event.title;
    const date = document.createElement("span");
    date.textContent = new Intl.DateTimeFormat("es-CR", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Costa_Rica" }).format(event.date);
    copy.append(title, date);

    const actions = document.createElement("div");
    actions.className = "admin-event-actions";
    const edit = document.createElement("button");
    edit.type = "button";
    edit.textContent = "Editar";
    edit.addEventListener("click", () => editEvent(event.id));
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "delete-event";
    remove.textContent = "Eliminar";
    remove.addEventListener("click", () => deleteEvent(event.id, event.title));
    actions.append(edit, remove);
    row.append(copy, actions);
    eventList.append(row);
  }
}

async function editEvent(id) {
  try {
    const { db } = services;
    const { doc, getDoc } = await import("https://www.gstatic.com/firebasejs/11.2.0/firebase-firestore.js");
    const snapshot = await getDoc(doc(db, "events", id));
    if (!snapshot.exists()) {
      throw new Error("El evento ya no existe.");
    }
    const data = snapshot.data();
    document.querySelector("#event-id").value = id;
    document.querySelector("#event-title").value = data.title;
    document.querySelector("#event-date").value = localDateInput(data.date.toDate());
    document.querySelector("#event-location").value = data.location || "";
    document.querySelector("#event-description").value = data.description;
    saveButton.innerHTML = 'Guardar cambios <span aria-hidden="true">→</span>';
    cancelEdit.hidden = false;
    document.querySelector("#event-title").focus();
    setStatus("Editando evento.");
  } catch (error) {
    console.error("No se pudo abrir el evento para edición.", error);
    setStatus(error.message || "No se pudo cargar el evento.", true);
  }
}

async function deleteEvent(id, title) {
  if (!window.confirm(`¿Eliminar el evento “${title}”? Esta acción no se puede deshacer.`)) {
    return;
  }
  try {
    const { db } = services;
    const { deleteDoc, doc } = await import("https://www.gstatic.com/firebasejs/11.2.0/firebase-firestore.js");
    await deleteDoc(doc(db, "events", id));
    await listEvents();
    setStatus("Evento eliminado.");
  } catch (error) {
    console.error("No se pudo eliminar el evento.", error);
    setStatus("No se pudo eliminar el evento. Revisa el acceso a Firestore.", true);
  }
}

function showAdmin(isAdmin) {
  loginPanel.hidden = isAdmin;
  managerPanel.hidden = !isAdmin;
  if (isAdmin) {
    listEvents().catch((error) => {
      console.error("No se pudo cargar la lista de eventos.", error);
      setStatus("No se pudieron cargar los eventos. Revisa las reglas de Firestore.", true);
    });
  }
}

if (!isFirebaseConfigured) {
  loginForm.hidden = true;
  setStatus("Firebase no está configurado. Completa js/firebase-config.js antes de usar este panel.", true);
} else if (adminUids.length === 0) {
  loginForm.hidden = true;
  setStatus("Configura el UID del administrador en js/firebase-config.js y en las reglas de Firestore.", true);
} else {
  getFirebaseServices()
    .then(({ auth, db }) => {
      services = { auth, db };
      return import("https://www.gstatic.com/firebasejs/11.2.0/firebase-auth.js");
    })
    .then(({ onAuthStateChanged }) => {
      authObserver = onAuthStateChanged(services.auth, (user) => {
        if (user && adminUids.includes(user.uid)) {
          showAdmin(true);
          return;
        }
        showAdmin(false);
        if (user) {
          setStatus("Esta cuenta no está autorizada para administrar eventos.", true);
        }
      });
    })
    .catch((error) => {
      console.error("No se pudo iniciar Firebase Authentication.", error);
      setStatus("No se pudo iniciar la autenticación. Revisa la configuración de Firebase.", true);
    });
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!services) {
    setStatus("Firebase no está disponible.", true);
    return;
  }
  const button = loginForm.querySelector('button[type="submit"]');
  button.disabled = true;
  try {
    const { signInWithEmailAndPassword, signOut } = await import("https://www.gstatic.com/firebasejs/11.2.0/firebase-auth.js");
    const formData = new FormData(loginForm);
    const credential = await signInWithEmailAndPassword(services.auth, formData.get("email"), formData.get("password"));
    if (!adminUids.includes(credential.user.uid)) {
      await signOut(services.auth);
      setStatus("Esta cuenta no está autorizada para administrar eventos.", true);
      return;
    }
    setStatus("Sesión iniciada.");
  } catch (error) {
    console.error("No se pudo iniciar sesión.", error);
    setStatus("No se pudo iniciar sesión. Revisa el correo y la contraseña.", true);
  } finally {
    button.disabled = false;
  }
});

eventForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const user = services?.auth.currentUser;
  if (!user || !adminUids.includes(user.uid)) {
    setStatus("Inicia sesión con una cuenta autorizada para publicar eventos.", true);
    return;
  }

  const formData = new FormData(eventForm);
  const title = String(formData.get("title")).trim();
  const description = String(formData.get("description")).trim();
  const location = String(formData.get("location")).trim();
  const eventDate = new Date(`${String(formData.get("date"))}:00-06:00`);
  if (!title || !description || Number.isNaN(eventDate.getTime())) {
    setStatus("Completa el nombre, la fecha y la descripción con valores válidos.", true);
    return;
  }

  saveButton.disabled = true;
  try {
    const { db } = services;
    const { collection, doc, serverTimestamp, setDoc, Timestamp, updateDoc } = await import("https://www.gstatic.com/firebasejs/11.2.0/firebase-firestore.js");
    const eventData = {
      title,
      description,
      location,
      date: Timestamp.fromDate(eventDate),
      updatedAt: serverTimestamp(),
    };
    const eventId = String(formData.get("eventId"));
    if (eventId) {
      await updateDoc(doc(db, "events", eventId), eventData);
    } else {
      await setDoc(doc(collection(db, "events")), { ...eventData, createdAt: serverTimestamp() });
    }
    resetForm();
    await listEvents();
    setStatus(eventId ? "Cambios guardados." : "Evento publicado.");
  } catch (error) {
    console.error("No se pudo guardar el evento.", error);
    setStatus("No se pudo guardar el evento. Revisa las reglas de Firestore.", true);
  } finally {
    saveButton.disabled = false;
  }
});

cancelEdit.addEventListener("click", () => {
  resetForm();
  setStatus("");
});

signoutButton.addEventListener("click", async () => {
  try {
    const { auth } = services;
    const { signOut } = await import("https://www.gstatic.com/firebasejs/11.2.0/firebase-auth.js");
    await signOut(auth);
    setStatus("Sesión cerrada.");
  } catch (error) {
    console.error("No se pudo cerrar sesión.", error);
    setStatus("No se pudo cerrar la sesión.", true);
  }
});

window.addEventListener("pagehide", () => {
  if (authObserver) {
    authObserver();
  }
});
