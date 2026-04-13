import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, collection, query, where, getDocs, onSnapshot, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyC6bo4zO4vUl7jbfm1sVS59GqoP3vJeyR0",
    authDomain: "checador-anam.firebaseapp.com",
    projectId: "checador-anam",
    storageBucket: "checador-anam.firebasestorage.app",
    messagingSenderId: "376706550668",
    appId: "1:376706550668:web:87e0e9f1cba7fcbe2824a9"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const dias = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

// --- NAVEGACIÓN ---
window.switchView = (viewId) => {
    document.querySelectorAll('.view-content').forEach(v => v.style.display = 'none');
    document.getElementById(viewId).style.display = 'block';
};

// --- MONITOR DE SESIÓN ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('main-panel').style.display = 'block';
        
        const userSnap = await getDoc(doc(db, "usuarios", user.uid));
        if (userSnap.exists()) {
            const data = userSnap.data();
            document.getElementById('user-info').innerText = `${data.nombre} | ${data.area}`;

            if (data.rol === 'admin') {
                document.getElementById('nav-admin').style.display = 'block';
                document.getElementById('nav-jefe').style.display = 'block';
                cargarPersonal(null); 
                escucharReportes(null);
            } else if (data.rol === 'supervisor') {
                document.getElementById('nav-jefe').style.display = 'block';
                cargarPersonal(data.area);
                escucharReportes(data.area);
            }
        }
    } else {
        document.getElementById('login-screen').style.display = 'block';
        document.getElementById('main-panel').style.display = 'none';
    }
});

// --- GENERAR FILAS DE HORARIOS ---
const contenedorHorarios = document.getElementById('contenedor-semanal');
dias.forEach(dia => {
    contenedorHorarios.innerHTML += `
        <div class="dia-row">
            <span><b>${dia}</b></span>
            <select id="tipo-${dia}" style="width:100px">
                <option value="laboral">Laboral</option>
                <option value="franco">Franco</option>
                <option value="inhabil">Inhábil</option>
                <option value="vacaciones">Vacaciones</option>
            </select>
            <input type="number" id="hora-${dia}" placeholder="HR" style="width:60px">
        </div>`;
});

// --- LÓGICA DE GESTIÓN (JEFES) ---
async function cargarPersonal(area) {
    const q = area ? query(collection(db, "usuarios"), where("area", "==", area)) : collection(db, "usuarios");
    const snap = await getDocs(q);
    const select = document.getElementById('select-empleado');
    select.innerHTML = '<option value="">Seleccione al trabajador...</option>';
    snap.forEach(d => {
        if(d.data().rol !== 'admin') select.innerHTML += `<option value="${d.id}">${d.data().nombre}</option>`;
    });
}

document.getElementById('btn-guardar-semana').addEventListener('click', async () => {
    const uid = document.getElementById('select-empleado').value;
    if (!uid) return alert("Selecciona un empleado");
    let horarioSemanal = {};
    dias.forEach(dia => {
        horarioSemanal[dia] = {
            tipo: document.getElementById(`tipo-${dia}`).value,
            hora: parseInt(document.getElementById(`hora-${dia}`).value) || 0
        };
    });
    await updateDoc(doc(db, "usuarios", uid), { horario_semanal: horarioSemanal });
    alert("Horario guardado correctamente.");
});

// --- LÓGICA DE CHECADOR (TRABAJADORES) ---
async function checar(tipo) {
    const user = auth.currentUser;
    const userSnap = await getDoc(doc(db, "usuarios", user.uid));
    const userData = userSnap.data();
    
    const ahora = new Date();
    const hoyIdx = ahora.getDay() === 0 ? 6 : ahora.getDay() - 1;
    const nombreDia = dias[hoyIdx];
    const config = (userData.horario_semanal && userData.horario_semanal[nombreDia]) ? userData.horario_semanal[nombreDia] : {tipo:'laboral', hora:9};

    if (config.tipo !== 'laboral') return alert(`Hoy es tu día: ${config.tipo}. No es necesario checar.`);

    const fechaId = ahora.toISOString().split('T')[0];
    const horaTexto = ahora.getHours() + ":" + ahora.getMinutes().toString().padStart(2, '0');
    const docRef = doc(db, "asistencias", `${user.uid}_${fechaId}`);

    if (tipo === 'in') {
        let est = (ahora.getHours() > config.hora || (ahora.getHours() == config.hora && ahora.getMinutes() > 15)) ? "Retardo" : "A tiempo";
        await setDoc(docRef, { nombre: userData.nombre, area: userData.area, entrada: horaTexto, estado: est, fecha: fechaId, uid: user.uid }, {merge:true});
    } else {
        await updateDoc(docRef, { salida: horaTexto });
    }
    document.getElementById('status-msg').innerText = `Registrado: ${horaTexto}`;
}

document.getElementById('btn-check-in').onclick = () => checar('in');
document.getElementById('btn-check-out').onclick = () => checar('out');

// --- REPORTES Y JUSTIFICACIONES ---
function escucharReportes(area) {
    const q = area ? query(collection(db, "asistencias"), where("area", "==", area)) : collection(db, "asistencias");
    onSnapshot(q, (snap) => {
        const tbody = document.getElementById('report-body');
        tbody.innerHTML = "";
        snap.forEach(d => {
            const r = d.data();
            tbody.innerHTML += `<tr><td>${r.nombre}</td><td>${r.entrada || '--'}/${r.salida || '--'}</td><td>${r.estado}</td><td>${r.justificacion || ''}</td><td><button onclick="window.justificar('${d.id}')" class="btn-small">Justificar</button></td></tr>`;
        });
    });
}

window.justificar = async (id) => {
    const m = prompt("Motivo de la justificación:");
    if (m) await updateDoc(doc(db, "asistencias", id), { justificacion: m });
};

// --- RELOJ Y ACCESO ---
setInterval(() => { document.getElementById('current-time').innerText = new Date().toLocaleTimeString(); }, 1000);
document.getElementById('btn-login').onclick = async () => {
    try { await signInWithEmailAndPassword(auth, document.getElementById('email').value, document.getElementById('password').value); } catch(e) { alert("Error"); }
};
document.getElementById('btn-logout').onclick = () => signOut(auth);
