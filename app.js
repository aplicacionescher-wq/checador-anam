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

// --- NAVEGACIÓN ENTRE VISTAS ---
window.switchView = (viewId) => {
    ['view-checador', 'view-reportes', 'view-horarios'].forEach(id => {
        document.getElementById(id).style.display = (id === viewId) ? 'block' : 'none';
    });
};

// --- MONITOR DE SESIÓN Y PERMISOS ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('main-panel').style.display = 'block';
        
        const userSnap = await getDoc(doc(db, "usuarios", user.uid));
        if (userSnap.exists()) {
            const data = userSnap.data();
            document.getElementById('user-info').innerText = `${data.nombre} | Área: ${data.area}`;

            // Control de Botones de Gestión
            if (data.rol === 'admin') {
                document.getElementById('nav-admin').style.display = 'block';
                document.getElementById('nav-jefe').style.display = 'block';
                cargarPersonal(null); // Ver todos
                escucharReportes(null);
            } else if (data.rol === 'supervisor') {
                document.getElementById('nav-jefe').style.display = 'block';
                cargarPersonal(data.area); // Solo su área
            }
        }
    } else {
        document.getElementById('login-screen').style.display = 'block';
        document.getElementById('main-panel').style.display = 'none';
    }
});

// --- GENERAR INTERFAZ DE HORARIOS ---
const contenedorHorarios = document.getElementById('contenedor-semanal');
dias.forEach(dia => {
    contenedorHorarios.innerHTML += `
        <div class="dia-row">
            <span style="width:80px"><b>${dia}</b></span>
            <select id="tipo-${dia}" style="width:120px">
                <option value="laboral">Laboral</option>
                <option value="franco">Franco</option>
                <option value="inhabil">Inhábil</option>
                <option value="vacaciones">Vacaciones</option>
            </select>
            <input type="number" id="hora-${dia}" placeholder="HR (7-23)" style="width:70px">
        </div>`;
});

// --- CARGAR PERSONAL PARA EL JEFE ---
async function cargarPersonal(area) {
    const q = area ? query(collection(db, "usuarios"), where("area", "==", area)) : collection(db, "usuarios");
    const snap = await getDocs(q);
    const select = document.getElementById('select-empleado');
    select.innerHTML = '<option value="">Seleccione al trabajador...</option>';
    snap.forEach(d => {
        select.innerHTML += `<option value="${d.id}">${d.data().nombre}</option>`;
    });
}

// --- GUARDAR HORARIO SEMANAL ---
document.getElementById('btn-guardar-semana').addEventListener('click', async () => {
    const uid = document.getElementById('select-empleado').value;
    if (!uid) return alert("Selecciona un empleado primero");

    let horarioSemanal = {};
    dias.forEach(dia => {
        horarioSemanal[dia] = {
            tipo: document.getElementById(`tipo-${dia}`).value,
            hora: parseInt(document.getElementById(`hora-${dia}`).value) || 0
        };
    });

    await updateDoc(doc(db, "usuarios", uid), { horario_semanal: horarioSemanal });
    alert("Horario semanal actualizado correctamente");
});

// --- LÓGICA DE MARCACIÓN (CHECADOR) ---
async function procesarMarcaje(tipo) {
    const user = auth.currentUser;
    const userSnap = await getDoc(doc(db, "usuarios", user.uid));
    const userData = userSnap.data();
    
    const ahora = new Date();
    const hoyIdx = ahora.getDay() === 0 ? 6 : ahora.getDay() - 1;
    const nombreDia = dias[hoyIdx];
    
    const configDia = (userData.horario_semanal && userData.horario_semanal[nombreDia]) 
                      ? userData.horario_semanal[nombreDia] 
                      : { tipo: 'laboral', hora: 9 };

    if (configDia.tipo !== 'laboral') {
        return alert(`Hoy es tu día de: ${configDia.tipo.toUpperCase()}. No es necesario marcar.`);
    }

    const fechaId = ahora.toISOString().split('T')[0];
    const horaTexto = ahora.getHours() + ":" + (ahora.getMinutes() < 10 ? '0' : '') + ahora.getMinutes();
    const docRef = doc(db, "asistencias", `${user.uid}_${fechaId}`);

    if (tipo === 'entrada') {
        let estado = "A tiempo";
        if (ahora.getHours() > configDia.hora || (ahora.getHours() === configDia.hora && ahora.getMinutes() > 15)) {
            estado = "Retardo";
        }
        await setDoc(docRef, { 
            nombre: userData.nombre, 
            area: userData.area, 
            entrada: horaTexto, 
            estado: estado, 
            fecha: fechaId,
            uid: user.uid
        }, { merge: true });
        document.getElementById('status-msg').innerHTML = `<b style="color:green">Entrada registrada: ${horaTexto}</b>`;
    } else {
        await updateDoc(docRef, { salida: horaTexto });
        document.getElementById('status-msg').innerHTML = `<b style="color:red">Salida registrada: ${horaTexto}</b>`;
    }
}

document.getElementById('btn-check-in').onclick = () => procesarMarcaje('entrada');
document.getElementById('btn-check-out').onclick = () => procesarMarcaje('salida');

// --- REPORTES EN TIEMPO REAL ---
function escucharReportes(area) {
    const q = area ? query(collection(db, "asistencias"), where("area", "==", area)) : collection(db, "asistencias");
    onSnapshot(q, (snap) => {
        const tbody = document.getElementById('report-body');
        tbody.innerHTML = "";
        snap.forEach(docSnap => {
            const r = docSnap.data();
            tbody.innerHTML += `
                <tr>
                    <td>${r.nombre}</td>
                    <td>${r.entrada || '--'}/${r.salida || '--'}</td>
                    <td class="${r.estado === 'Retardo' ? 'retardo' : ''}">${r.estado}</td>
                    <td>${r.justificacion || '---'}</td>
                    <td><button onclick="window.justificar('${docSnap.id}')" class="btn-small">Justificar</button></td>
                </tr>`;
        });
    });
}

window.justificar = async (id) => {
    const m = prompt("Motivo de la justificación:");
    if (m) await updateDoc(doc(db, "asistencias", id), { justificacion: m });
};

// --- RELOJ Y LOGIN BÁSICO ---
setInterval(() => {
    const t = document.getElementById('current-time');
    if (t) t.innerText = new Date().toLocaleTimeString();
}, 1000);

document.getElementById('btn-login').onclick = async () => {
    const m = document.getElementById('email').value;
    const p = document.getElementById('password').value;
    try { await signInWithEmailAndPassword(auth, m, p); } catch(e) { alert("Acceso Denegado"); }
};
document.getElementById('btn-logout').onclick = () => signOut(auth);
