import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, collection, query, where, getDocs, onSnapshot, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyC6bo4zO4vUl7jbfm1sVS59GqoP3vJeyR0",
  authDomain: "checador-anam.firebaseapp.com",
  databaseURL: "https://checador-anam-default-rtdb.firebaseio.com",
  projectId: "checador-anam",
  storageBucket: "checador-anam.firebasestorage.app",
  messagingSenderId: "376706550668",
  appId: "1:376706550668:web:87e0e9f1cba7fcbe2824a9"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
let userCoords = null;

// --- GEOLOCALIZACIÓN ---
navigator.geolocation.watchPosition(
    (p) => {
        userCoords = { lat: p.coords.latitude, lng: p.coords.longitude };
        document.getElementById('geo-status').innerText = "📍 Ubicación detectada correctamente";
        document.getElementById('geo-status').style.color = "green";
    },
    () => { document.getElementById('geo-status').innerText = "⚠️ Activa el GPS para checar"; }
);

// --- RELOJ ---
setInterval(() => {
    const ahora = new Date();
    document.getElementById('live-clock').innerText = ahora.toLocaleTimeString();
    document.getElementById('live-date').innerText = ahora.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}, 1000);

// --- CHECADOR (PARA EMPLEADOS) ---
async function procesarRegistro(tipo) {
    const num = document.getElementById('emp-number').value;
    const pin = document.getElementById('emp-pin').value;

    if (!num || !pin || !userCoords) return alert("Completa tus datos y activa el GPS");

    // Validar empleado
    const q = query(collection(db, "usuarios"), where("numero_empleado", "==", num), where("pin", "==", pin));
    const snap = await getDocs(q);

    if (snap.empty) return alert("Número de empleado o PIN incorrectos");

    const uDoc = snap.docs[0];
    const uData = uDoc.data();
    const hoy = new Date();
    const nombreDia = DIAS[hoy.getDay() === 0 ? 6 : hoy.getDay() - 1];
    
    // Obtener configuración de horario para hoy
    const configHoy = uData.horario_semanal?.[nombreDia] || { tipo: 'laboral', hora: 9 };

    if (configHoy.tipo !== 'laboral') return alert(`Hoy es tu día: ${configHoy.tipo.toUpperCase()}`);

    const fechaId = hoy.toISOString().split('T')[0];
    const horaTexto = hoy.getHours() + ":" + hoy.getMinutes().toString().padStart(2, '0');
    const docRef = doc(db, "asistencias", `${uDoc.id}_${fechaId}`);

    if (tipo === 'entrada') {
        let estatus = (hoy.getHours() > configHoy.hora || (hoy.getHours() == configHoy.hora && hoy.getMinutes() > 15)) ? "Retardo" : "A tiempo";
        await setDoc(docRef, {
            nombre: uData.nombre, area: uData.area, entrada: horaTexto,
            estado: estatus, geo: userCoords, fecha: fechaId, uid: uDoc.id
        }, { merge: true });
    } else {
        await updateDoc(docRef, { salida: horaTexto });
    }

    alert(`Registro de ${tipo} exitoso`);
    document.getElementById('emp-number').value = "";
    document.getElementById('emp-pin').value = "";
}

document.getElementById('btn-in').onclick = () => procesarRegistro('entrada');
document.getElementById('btn-out').onclick = () => procesarRegistro('salida');

// --- ACCESO ADMINISTRATIVO ---
document.getElementById('btn-open-admin').onclick = () => {
    const email = prompt("Correo de Administrador:");
    const pass = prompt("Contraseña:");
    if (email && pass) {
        signInWithEmailAndPassword(auth, email, pass).catch(() => alert("Credenciales inválidas"));
    }
};

onAuthStateChanged(auth, async (user) => {
    if (user) {
        const d = await getDoc(doc(db, "usuarios", user.uid));
        if (d.exists()) {
            const perfil = d.data();
            if (perfil.rol === 'admin' || perfil.rol === 'supervisor') {
                document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
                document.getElementById('view-admin').classList.add('active');
                initAdminPanel(perfil);
            }
        }
    }
});

document.getElementById('btn-logout').onclick = () => {
    signOut(auth).then(() => location.reload());
};

// --- PANEL DE CONTROL (ADMIN/JEFES) ---
window.showSection = (id) => {
    document.querySelectorAll('.admin-sec').forEach(s => s.style.display = 'none');
    document.getElementById(id).style.display = 'block';
};

function initAdminPanel(perfil) {
    // 1. Cargar Reportes (Si es Jefe, filtrar por área)
    const qReportes = (perfil.rol === 'admin') 
        ? collection(db, "asistencias") 
        : query(collection(db, "asistencias"), where("area", "==", perfil.area));

    onSnapshot(qReportes, (snap) => {
        const body = document.getElementById('report-table-body');
        body.innerHTML = "";
        snap.forEach(docSnap => {
            const r = docSnap.data();
            const mapLink = `https://www.google.com/maps?q=${r.geo.lat},${r.geo.lng}`;
            body.innerHTML += `
                <tr>
                    <td>${r.nombre}</td>
                    <td>${r.entrada || '--'} / ${r.salida || '--'}</td>
                    <td>${r.estado}</td>
                    <td><a href="${mapLink}" target="_blank">Ver Mapa</a></td>
                    <td>${r.justificacion || '<i>Pendiente</i>'}</td>
                    <td><button onclick="justificar('${docSnap.id}')" class="btn-secondary">Justificar</button></td>
                </tr>`;
        });
    });

    // 2. Cargar Personal para Horarios
    cargarListaPersonal(perfil);
}

async function cargarListaPersonal(perfil) {
    const q = (perfil.rol === 'admin') 
        ? collection(db, "usuarios") 
        : query(collection(db, "usuarios"), where("area", "==", perfil.area));
    
    const snap = await getDocs(q);
    const select = document.getElementById('select-staff');
    select.innerHTML = '<option value="">Seleccione personal...</option>';
    snap.forEach(d => {
        if(d.data().rol !== 'admin') select.innerHTML += `<option value="${d.id}">${d.data().nombre}</option>`;
    });
}

// Generar inputs de la semana
const grid = document.getElementById('grid-semana');
DIAS.forEach(dia => {
    grid.innerHTML += `
        <div class="dia-row">
            <span>${dia}</span>
            <select id="tipo-${dia}">
                <option value="laboral">Laboral</option>
                <option value="franco">Franco</option>
                <option value="vacaciones">Vacaciones</option>
            </select>
            <input type="number" id="hora-${dia}" value="9" style="width:50px">
        </div>`;
});

document.getElementById('btn-save-schedule').onclick = async () => {
    const uid = document.getElementById('select-staff').value;
    if (!uid) return alert("Selecciona un empleado");
    
    let horario = {};
    DIAS.forEach(dia => {
        horario[dia] = {
            tipo: document.getElementById(`tipo-${dia}`).value,
            hora: parseInt(document.getElementById(`hora-${dia}`).value)
        };
    });

    await updateDoc(doc(db, "usuarios", uid), { horario_semanal: horario });
    alert("Horario actualizado correctamente");
};

window.justificar = async (id) => {
    const motivo = prompt("Ingrese el motivo de la justificación:");
    if (m) await updateDoc(doc(db, "asistencias", id), { justificacion: motivo, estado: "Justificado" });
};
