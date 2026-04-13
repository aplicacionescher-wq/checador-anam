import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, collection, query, where, getDocs, onSnapshot, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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

// Reloj
setInterval(() => {
    const pTime = document.getElementById('current-time');
    if (pTime) pTime.innerText = new Date().toLocaleTimeString();
}, 1000);

// Login/Logout
document.getElementById('btn-login').addEventListener('click', async () => {
    const email = document.getElementById('email').value;
    const pass = document.getElementById('password').value;
    try { await signInWithEmailAndPassword(auth, email, pass); } catch (e) { alert("Error de acceso."); }
});
document.getElementById('btn-logout').addEventListener('click', () => signOut(auth));

// Monitor de Sesión
onAuthStateChanged(auth, async (user) => {
    if (user) {
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('main-panel').style.display = 'block';
        const userSnap = await getDoc(doc(db, "usuarios", user.uid));
        if (userSnap.exists()) {
            const data = userSnap.data();
            document.getElementById('user-info').innerText = `${data.nombre} (${data.area})`;
            if (data.rol === 'admin' || data.rol === 'supervisor') {
                document.getElementById('admin-section').style.display = 'block';
                document.getElementById('gestion-horarios').style.display = 'block';
                cargarListaEmpleados();
                escucharReportes(data.area, data.rol);
            }
        }
    } else {
        document.getElementById('login-screen').style.display = 'block';
        document.getElementById('main-panel').style.display = 'none';
    }
});

// Asistencia: Entrada y Salida
async function registrarAsistencia(tipo) {
    const user = auth.currentUser;
    const userSnap = await getDoc(doc(db, "usuarios", user.uid));
    const { horario_base, nombre, area } = userSnap.data();
    
    const ahora = new Date();
    const fechaHoy = ahora.toISOString().split('T')[0];
    const horaFormateada = ahora.getHours() + ":" + (ahora.getMinutes() < 10 ? '0' : '') + ahora.getMinutes();
    const docRef = doc(db, "asistencias", `${user.uid}_${fechaHoy}`);

    if (tipo === 'entrada') {
        let estado = (ahora.getHours() > horario_base || (ahora.getHours() === horario_base && ahora.getMinutes() > 15)) ? "Retardo" : "A tiempo";
        await setDoc(docRef, { uid: user.uid, nombre, area, fecha: fechaHoy, hora_entrada: horaFormateada, estado, justificacion: "" }, { merge: true });
        document.getElementById('status-msg').innerHTML = `<b style="color:green">Entrada: ${horaFormateada}</b>`;
    } else {
        await updateDoc(docRef, { hora_salida: horaFormateada });
        document.getElementById('status-msg').innerHTML = `<b style="color:red">Salida: ${horaFormateada}</b>`;
    }
}

document.getElementById('btn-check-in').addEventListener('click', () => registrarAsistencia('entrada'));
document.getElementById('btn-check-out').addEventListener('click', () => registrarAsistencia('salida'));

// Gestión de Horarios
async function cargarListaEmpleados() {
    const querySnapshot = await getDocs(collection(db, "usuarios"));
    const select = document.getElementById('select-empleado');
    select.innerHTML = '<option value="">Seleccionar Personal...</option>';
    querySnapshot.forEach((doc) => {
        let opt = document.createElement('option');
        opt.value = doc.id;
        opt.innerHTML = doc.data().nombre;
        select.appendChild(opt);
    });
}

document.getElementById('btn-asignar-horario').addEventListener('click', async () => {
    const uid = document.getElementById('select-empleado').value;
    const hora = parseInt(document.getElementById('select-hora').value);
    if (uid) {
        await updateDoc(doc(db, "usuarios", uid), { horario_base: hora });
        alert("Horario actualizado.");
    }
});

// Reportes y Justificaciones
function escucharReportes(area, rol) {
    const q = (rol === 'admin') ? collection(db, "asistencias") : query(collection(db, "asistencias"), where("area", "==", area));
    onSnapshot(q, (snap) => {
        const tbody = document.getElementById('report-body');
        tbody.innerHTML = "";
        snap.forEach((d) => {
            const r = d.data();
            tbody.innerHTML += `<tr>
                <td>${r.nombre}</td>
                <td>${r.hora_entrada || '-'}</td>
                <td>${r.hora_salida || '-'}</td>
                <td class="${r.estado === 'Retardo' ? 'retardo' : ''}">${r.estado}</td>
                <td>${r.justificacion || '<i>Pendiente</i>'}</td>
                <td><button onclick="window.justificar('${d.id}')" class="btn-small">Justificar</button></td>
            </tr>`;
        });
    });
}

window.justificar = async (id) => {
    const m = prompt("Motivo del alcance:");
    if (m) await updateDoc(doc(db, "asistencias", id), { justificacion: m });
};
