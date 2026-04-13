import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, collection, query, where, onSnapshot, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyC6bo4zO4vUl7jbfm1sVS59GqoP3vJeyR0",
  authDomain: "checador-anam.firebaseapp.com",
  projectId: "checador-anam",
  storageBucket: "checador-anam.firebasestorage.app",
  mensajesSenderId: "376706550668",
  appId: "1:376706550668:web:87e0e9f1cba7fcbe2824a9"}; InicializarFirebase const app = initializeApp(firebaseConfig
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Actualizar reloj en pantalla
setInterval(() => {
    const ahora = new Date();
    document.getElementById('current-time').innerText = ahora.toLocaleTimeString();
}, 1000);

// LOGIN
document.getElementById('btn-login').addEventListener('click', async () => {
    const email = document.getElementById('email').value;
    const pass = document.getElementById('password').value;
    try {
        await signInWithEmailAndPassword(auth, email, pass);
    } catch (e) { alert("Usuario o contraseña incorrectos."); }
});

// LOGOUT
document.getElementById('btn-logout').addEventListener('click', () => signOut(auth));

// MONITOR DE ESTADO DE SESIÓN
onAuthStateChanged(auth, async (user) => {
    if (user) {
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('main-panel').style.display = 'block';
        cargarDatosUsuario(user.uid);
    } else {
        document.getElementById('login-screen').style.display = 'block';
        document.getElementById('main-panel').style.display = 'none';
    }
});

async function cargarDatosUsuario(uid) {
    const docRef = doc(db, "usuarios", uid);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
        const data = snap.data();
        document.getElementById('user-info').innerText = `${data.nombre} | ${data.area}`;
        if (data.rol === 'admin' || data.rol === 'supervisor') {
            document.getElementById('admin-section').style.display = 'block';
            cargarReportes(data.area, data.rol);
        }
    }
}

// MARCAR ASISTENCIA
document.getElementById('btn-check').addEventListener('click', async () => {
    const user = auth.currentUser;
    const userDoc = await getDoc(doc(db, "usuarios", user.uid));
    const { horario_base, nombre, area } = userDoc.data();

    const ahora = new Date();
    const horaActual = ahora.getHours();
    const minActual = ahora.getMinutes();
    const fechaHoy = ahora.toISOString().split('T')[0];

    let estado = "A tiempo";
    // Tolerancia de 15 minutos
    if (horaActual > horario_base || (horaActual === horario_base && minActual > 15)) {
        estado = "Retardo";
    }

    try {
        await setDoc(doc(db, "asistencias", `${user.uid}_${fechaHoy}`), {
            uid: user.uid,
            nombre,
            area,
            fecha: fechaHoy,
            hora_entrada: `${horaActual}:${minActual < 10 ? '0'+minActual : minActual}`,
            estado,
            justificacion: "",
            timestamp: serverTimestamp()
        });
        document.getElementById('status-msg').innerHTML = `<b style="color:green">Registro exitoso: ${estado}</b>`;
    } catch (e) { alert("Error al registrar."); }
});

// CARGAR REPORTES EN TIEMPO REAL
function cargarReportes(area, rol) {
    const q = rol === 'admin' 
        ? collection(db, "asistencias") 
        : query(collection(db, "asistencias"), where("area", "==", area));

    onSnapshot(q, (snapshot) => {
        const tbody = document.getElementById('report-body');
        tbody.innerHTML = "";
        snapshot.forEach((docSnap) => {
            const res = docSnap.data();
            const fila = `
                <tr>
                    <td>${res.nombre}</td>
                    <td class="${res.estado === 'Retardo' ? 'retardo' : ''}">${res.estado}</td>
                    <td>${res.justificacion || '<i>Sin justificar</i>'}</td>
                    <td>
                        <button onclick="justificar('${docSnap.id}')" class="btn-small">Justificar</button>
                    </td>
                </tr>
            `;
            tbody.innerHTML += fila;
        });
    });
}

// Función global para justificar (necesaria para el onclick del string)
window.justificar = async (id) => {
    const motivo = prompt("Ingrese la justificación:");
    if (motivo) {
        await updateDoc(doc(db, "asistencias", id), { justificacion: motivo });
    }
};
