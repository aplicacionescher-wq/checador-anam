import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, collection, query, where, getDocs, onSnapshot, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = { /* TUS CREDENCIALES */ };
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

// 1. MANEJO DE VISTAS (Navegación Empresarial)
window.switchView = (id) => {
    document.querySelectorAll('.view-content').forEach(v => v.style.display = 'none');
    document.getElementById(id).style.display = 'block';
};

// 2. SEGURIDAD Y PERMISOS
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const userSnap = await getDoc(doc(db, "usuarios", user.uid));
        if (userSnap.exists()) {
            const profile = userSnap.data();
            setupUI(profile);
        }
    } else {
        showLogin();
    }
});

function setupUI(user) {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('main-panel').style.display = 'block';
    document.getElementById('user-display').innerText = `${user.nombre} | ${user.area}`;
    document.getElementById('navbar').style.display = 'flex';

    if (user.rol === 'admin' || user.rol === 'supervisor') {
        document.getElementById('nav-horarios').style.display = 'inline-block';
        initHorarios(user);
    }
    if (user.rol === 'admin') {
        document.getElementById('nav-reportes').style.display = 'inline-block';
        initReportes();
    }
}

// 3. LÓGICA DE REGISTRO (Entrada/Salida)
async function registrar(tipo) {
    const user = auth.currentUser;
    const snap = await getDoc(doc(db, "usuarios", user.uid));
    const data = snap.data();
    
    const ahora = new Date();
    const diaNombre = DIAS[ahora.getDay() === 0 ? 6 : ahora.getDay()-1];
    const configHoy = data.horario_semanal?.[diaNombre] || { tipo: 'laboral', hora: 9 };

    if (configHoy.tipo !== 'laboral') {
        alert(`Hoy es tu día ${configHoy.tipo}. No es necesario registrar.`);
        return;
    }

    const fechaId = ahora.toISOString().split('T')[0];
    const horaStr = ahora.getHours() + ":" + ahora.getMinutes().toString().padStart(2, '0');
    const asistenciaRef = doc(db, "asistencias", `${user.uid}_${fechaId}`);

    if (tipo === 'in') {
        let estatus = (ahora.getHours() > configHoy.hora || (ahora.getHours() == configHoy.hora && ahora.getMinutes() > 15)) ? "Retardo" : "A tiempo";
        await setDoc(asistenciaRef, {
            nombre: data.nombre,
            area: data.area,
            entrada: horaStr,
            fecha: fechaId,
            estatus: estatus,
            uid: user.uid
        }, { merge: true });
    } else {
        await updateDoc(asistenciaRef, { salida: horaStr });
    }
    document.getElementById('status-msg').innerText = `Registro exitoso: ${horaStr}`;
}

document.getElementById('btn-in').onclick = () => registrar('in');
document.getElementById('btn-out').onclick = () => registrar('out');

// 4. GESTIÓN SEMANAL (Para Jefes)
function initHorarios(jefe) {
    const contenedor = document.getElementById('semana-container');
    contenedor.innerHTML = "";
    DIAS.forEach(d => {
        contenedor.innerHTML += `
            <div class="row-dia">
                <span>${d}</span>
                <select id="t-${d}"><option value="laboral">Laboral</option><option value="franco">Franco</option><option value="vacaciones">Vacaciones</option></select>
                <input type="number" id="h-${d}" placeholder="Hora entrada" value="9">
            </div>`;
    });
    // Aquí cargarías la lista de empleados de la misma área
}

// 5. RELOJ EN TIEMPO REAL
setInterval(() => {
    document.getElementById('live-clock').innerText = new Date().toLocaleTimeString();
}, 1000);
