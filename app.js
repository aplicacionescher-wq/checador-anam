import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, collection, query, where, getDocs, onSnapshot, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = { /* TUS DATOS AQUÍ */ };
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
let userCoords = null;

// --- GEOLOCALIZACIÓN ---
navigator.geolocation.watchPosition(p => {
    userCoords = { lat: p.coords.latitude, lng: p.coords.longitude };
    document.getElementById('geo-status').innerText = "📍 Ubicación validada";
    document.getElementById('geo-status').className = "status-ok";
}, () => { alert("Debes permitir el GPS para usar el checador"); });

// --- RELOJ ---
setInterval(() => {
    document.getElementById('live-clock').innerText = new Date().toLocaleTimeString();
    document.getElementById('live-date').innerText = new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
}, 1000);

// --- LÓGICA DEL CHECADOR ---
async function handleCheck(tipo) {
    const num = document.getElementById('emp-number').value;
    if (!num || !userCoords) return alert("Falta número o ubicación");

    const q = query(collection(db, "usuarios"), where("numero_empleado", "==", num));
    const snap = await getDocs(q);
    
    if (snap.empty) return alert("Empleado no existe");
    
    const uDoc = snap.docs[0];
    const uData = uDoc.data();
    const hoy = new Date();
    const diaName = DIAS[hoy.getDay() === 0 ? 6 : hoy.getDay()-1];
    const config = uData.horario_semanal?.[diaName] || { tipo: 'laboral', hora: 9 };

    if (config.tipo !== 'laboral') return alert(`Día ${config.tipo}: No requiere checar`);

    const fId = hoy.toISOString().split('T')[0];
    const hActual = hoy.getHours() + ":" + hoy.getMinutes().toString().padStart(2, '0');
    const ref = doc(db, "asistencias", `${uDoc.id}_${fId}`);

    if (tipo === 'in') {
        let est = (hoy.getHours() > config.hora || (hoy.getHours() == config.hora && hoy.getMinutes() > 15)) ? "Retardo" : "A tiempo";
        await setDoc(ref, { 
            nombre: uData.nombre, area: uData.area, entrada: hActual, 
            estado: est, geo: userCoords, fecha: fId, uid: uDoc.id 
        }, { merge: true });
    } else {
        await updateDoc(ref, { salida: hActual });
    }
    alert(`¡${tipo.toUpperCase()} EXITOSA!`);
}

document.getElementById('btn-in').onclick = () => handleCheck('in');
document.getElementById('btn-out').onclick = () => handleCheck('out');

// --- NAVEGACIÓN Y ADMIN ---
window.switchTab = (id) => {
    document.querySelectorAll('.tab-content').forEach(t => t.style.display = 'none');
    document.getElementById(id).style.display = 'block';
};

document.getElementById('btn-admin-access').onclick = () => {
    const m = prompt("Email admin:");
    const p = prompt("Password:");
    signInWithEmailAndPassword(auth, m, p).catch(() => alert("Error de acceso"));
};

onAuthStateChanged(auth, async (user) => {
    if (user) {
        const d = await getDoc(doc(db, "usuarios", user.uid));
        const p = d.data();
        if (p.rol === 'admin' || p.rol === 'supervisor') {
            document.getElementById('view-checador').style.display = 'none';
            document.getElementById('view-admin').style.display = 'block';
            initAdmin(p);
        }
    }
});

// Generador de Horarios
const grid = document.getElementById('grid-semana');
DIAS.forEach(d => {
    grid.innerHTML += `
        <div class="dia-row">
            <span>${d}</span>
            <select id="t-${d}"><option value="laboral">Laboral</option><option value="franco">Franco</option><option value="vacaciones">Vacaciones</option></select>
            <input type="number" id="h-${d}" value="9" style="width:45px">
        </div>`;
});
