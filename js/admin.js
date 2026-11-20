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
const eventImageInput = document.querySelector("#event-image");
const imageHint = document.querySelector("#image-hint");
const imagePreviewWrap = document.querySelector("#image-preview-wrap");
const imagePreview = document.querySelector("#image-preview");
const removeImageButton = document.querySelector("#remove-image");
const MAX_ADMIN_EVENTS = 6;
const ADMIN_EVENTS_READ_LIMIT = MAX_ADMIN_EVENTS + 1;
const MAX_INPUT_IMAGE_BYTES = 20 * 1024 * 1024;
const MAX_EVENT_IMAGE_BYTES = 150 * 1024;
const MAX_IMAGE_DATA_LENGTH = 210000;
const MAX_EVENT_IMAGE_DIMENSION = 1600;
const DEFAULT_IMAGE_HINT = "Se optimiza automáticamente y se limita a 150 KB; se eliminan los metadatos.";
const ADMIN_USERNAME = "ADMIN345";
const ADMIN_EMAIL = "exbecarios.japon.cr@gmail.com";
let services;
let authObserver;
let publishedEventCount = 0;
let adminEventsLoaded = false;
let currentImageData = "";
let imageWasRemoved = false;
let imageSelectionId = 0;
let imageProcessing = Promise.resolve("");

function setStatus(message, isError = false) {
  status.textContent = message;
  status.classList.toggle("is-error", isError);
}

function showImagePreview(imageData) {
  if (imageData) {
    imagePreview.src = imageData;
    imagePreviewWrap.hidden = false;
    return;
  }
  imagePreview.removeAttribute("src");
  imagePreviewWrap.hidden = true;
}

function canvasToJpegBlob(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
        return;
      }
      reject(new Error("No se pudo optimizar la foto."));
    }, "image/jpeg", quality);
  });
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }
      reject(new Error("No se pudo preparar la foto optimizada."));
    };
    reader.onerror = () => reject(reader.error || new Error("No se pudo leer la foto optimizada."));
    reader.readAsDataURL(blob);
  });
}

async function compressEventImage(file) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    throw new Error("Elige una imagen JPG, PNG o WebP.");
  }
  if (file.size > MAX_INPUT_IMAGE_BYTES) {
    throw new Error("La foto original debe pesar menos de 20 MB.");
  }

  let bitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch (error) {
    throw new Error("No se pudo abrir la foto. Prueba con otra imagen.");
  }

  try {
    const initialScale = Math.min(1, MAX_EVENT_IMAGE_DIMENSION / Math.max(bitmap.width, bitmap.height));
    let width = Math.max(1, Math.round(bitmap.width * initialScale));
    let height = Math.max(1, Math.round(bitmap.height * initialScale));
    let quality = 0.86;

    while (true) {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) {
        throw new Error("El navegador no pudo preparar la foto.");
      }
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, width, height);
      context.drawImage(bitmap, 0, 0, width, height);

      const blob = await canvasToJpegBlob(canvas, quality);
      if (blob.size <= MAX_EVENT_IMAGE_BYTES) {
        return await blobToDataUrl(blob);
      }

      if (quality > 0.68) {
        quality = Math.max(0.68, quality - 0.06);
        continue;
      }
      if (Math.max(width, height) <= 640) {
        throw new Error("No se pudo reducir esta foto a 150 KB manteniendo una calidad visual adecuada.");
      }

      width = Math.max(1, Math.round(width * 0.85));
      height = Math.max(1, Math.round(height * 0.85));
      quality = 0.82;
    }
  } finally {
    bitmap.close();
  }
}

function clearImageState() {
  imageSelectionId += 1;
  eventImageInput.value = "";
  currentImageData = "";
  imageWasRemoved = false;
  imageProcessing = Promise.resolve("");
  imageHint.textContent = DEFAULT_IMAGE_HINT;
  showImagePreview("");
}

function resetForm() {
  eventForm.reset();
  document.querySelector("#event-id").value = "";
  document.querySelector("#save-event").innerHTML = 'Publicar evento <span aria-hidden="true">→</span>';
  cancelEdit.hidden = true;
  clearImageState();
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
  const eventsQuery = query(collection(db, "events"), orderBy("date", "desc"), limit(ADMIN_EVENTS_READ_LIMIT));
  const snapshot = await getDocs(eventsQuery);
  publishedEventCount = snapshot.size;
  adminEventsLoaded = true;
  const events = snapshot.docs.map((eventDoc) => {
    const data = eventDoc.data();
    if (!data.date?.toDate || typeof data.title !== "string") {
      throw new Error(`El evento ${eventDoc.id} tiene datos incompletos.`);
    }
    return {
      id: eventDoc.id,
      title: data.title,
      date: data.date.toDate(),
      imageData: typeof data.imageData === "string" ? data.imageData : "",
    };
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

    if (event.imageData) {
      const thumbnail = document.createElement("img");
      thumbnail.className = "admin-event-thumbnail";
      thumbnail.src = event.imageData;
      thumbnail.alt = "";
      thumbnail.loading = "lazy";
      copy.prepend(thumbnail);
    }

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
    if (data.imageData !== undefined && (
      typeof data.imageData !== "string"
      || data.imageData.length > MAX_IMAGE_DATA_LENGTH
      || !data.imageData.startsWith("data:image/jpeg;base64,")
    )) {
      throw new Error("La foto guardada tiene un formato inválido.");
    }
    document.querySelector("#event-id").value = id;
    document.querySelector("#event-title").value = data.title;
    document.querySelector("#event-date").value = localDateInput(data.date.toDate());
    document.querySelector("#event-location").value = data.location || "";
    document.querySelector("#event-description").value = data.description;
    imageSelectionId += 1;
    eventImageInput.value = "";
    imageProcessing = Promise.resolve("");
    currentImageData = data.imageData || "";
    imageWasRemoved = false;
    imageHint.textContent = currentImageData
      ? "Foto actual. Sube otra para reemplazarla o quítala."
      : DEFAULT_IMAGE_HINT;
    showImagePreview(currentImageData);
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

eventImageInput.addEventListener("change", () => {
  const file = eventImageInput.files && eventImageInput.files[0];
  imageSelectionId += 1;
  const selectionId = imageSelectionId;

  if (!file) {
    imageProcessing = Promise.resolve("");
    imageHint.textContent = currentImageData && !imageWasRemoved
      ? "Foto actual. Sube otra para reemplazarla o quítala."
      : DEFAULT_IMAGE_HINT;
    showImagePreview(currentImageData);
    return;
  }

  imageHint.textContent = "Optimizando foto…";
  imageProcessing = compressEventImage(file)
    .then((imageData) => {
      if (selectionId !== imageSelectionId) {
        return "";
      }
      imageWasRemoved = false;
      imageHint.textContent = `Foto optimizada: ${Math.round(imageData.length * 0.75 / 1024)} KB.`;
      showImagePreview(imageData);
      return imageData;
    })
    .catch((error) => {
      if (selectionId === imageSelectionId) {
        eventImageInput.value = "";
        imageHint.textContent = error.message || "No se pudo optimizar la foto.";
        setStatus(imageHint.textContent, true);
        showImagePreview(currentImageData);
      }
      return "";
    });
});

removeImageButton.addEventListener("click", () => {
  imageSelectionId += 1;
  eventImageInput.value = "";
  imageProcessing = Promise.resolve("");
  currentImageData = "";
  imageWasRemoved = true;
  imageHint.textContent = "La foto se quitará al guardar los cambios.";
  showImagePreview("");
});

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
    const login = String(formData.get("username")).trim();
    const email = login.toUpperCase() === ADMIN_USERNAME ? ADMIN_EMAIL : login;
    const credential = await signInWithEmailAndPassword(services.auth, email, formData.get("password"));
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

  const eventId = String(formData.get("eventId"));
  if (!eventId && !adminEventsLoaded) {
    setStatus("Espera a que termine de cargar la lista de eventos antes de publicar.", true);
    return;
  }
  if (!eventId && publishedEventCount >= MAX_ADMIN_EVENTS) {
    setStatus("Ya hay seis publicaciones. Elimina una antes de agregar otra.", true);
    return;
  }

  saveButton.disabled = true;
  try {
    const selectedImage = eventImageInput.files && eventImageInput.files[0];
    const newImageData = selectedImage ? await imageProcessing : "";
    if (selectedImage && !newImageData) {
      throw new Error("Espera a que la foto termine de optimizarse o elige otra.");
    }

    const { db } = services;
    const { collection, deleteField, doc, serverTimestamp, setDoc, Timestamp, updateDoc } = await import("https://www.gstatic.com/firebasejs/11.2.0/firebase-firestore.js");
    const eventData = {
      title,
      description,
      location,
      date: Timestamp.fromDate(eventDate),
      updatedAt: serverTimestamp(),
    };
    if (newImageData) {
      eventData.imageData = newImageData;
    } else if (eventId && imageWasRemoved) {
      eventData.imageData = deleteField();
    }

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
    setStatus(error.message || "No se pudo guardar el evento. Revisa las reglas de Firestore.", true);
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
