import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, collection, query, where, onSnapshot, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Configuración de Firebase corregida
const firebaseConfig = {
  apiKey: "AIzaSyC6bo4zO4vUl7jbfm1sVS59GqoP3vJeyR0",
  authDomain: "checador-anam.firebaseapp.com",
  projectId: "checador-anam",
  storageBucket: "checador-anam.firebasestorage.app",
  messagingSenderId: "376706550668",
  appId: "1:376706550668:web:87e0e9f1cba7fcbe2824a9"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Reloj en tiempo real
setInterval(() => {
    const ahora = new Date();
    const pTime = document.getElementById('current-time');
    if(pTime) pTime.innerText = ahora.toLocaleTimeString();
}, 1000);

// LOGIN
document.getElementById('btn-login').addEventListener('click', async () => {
    const email = document.getElementById('email').value;
    const pass = document.getElementById('password').value;
    try {
        await signInWithEmailAndPassword(auth, email, pass);
    } catch (e) { 
        alert("Error: Verifica tu correo y contraseña."); 
    }
});

// LOGOUT
document.getElementById('btn-logout').addEventListener('click', () => signOut(auth));

// MONITOR DE SESIÓN
onAuthStateChanged(auth, async (user) => {
    if (user) {
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('main-panel').style.display = 'block';
        
        const docRef = doc(db, "usuarios", user.uid);
        const snap = await getDoc(docRef);
        
        if (snap.exists()) {
            const data = snap.data();
            document.getElementById('user-info').innerText = `${data.nombre} | ${data.area}`;
            
            if (data.rol === 'admin' || data.rol === 'supervisor') {
                document.getElementById('admin-section').style.display = 'block';
                escucharAsistencias(data.area, data.rol);
            }
        }
    } else {
        document.getElementById('login-screen').style.display = 'block';
        document.getElementById('main-panel').style.display = 'none';
    }
});

// MARCAR ASISTENCIA
document.getElementById('btn-check').addEventListener('click', async () => {
    const user = auth.currentUser;
    const userDoc = await getDoc(doc(db, "usuarios", user.uid));
    const { horario_base, nombre, area } = userDoc.data();

    const ahora = new Date();
    const horaActual = ahora.getHours();
    const minActual = ahora.getMinutes();
    const fechaHoy = ahora.toISOString().split('T')[0];

    // Lógica de Tolerancia: 15 minutos
    let estado = "A tiempo";
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
        document.getElementById('status-msg').innerHTML = `<b style="color:var(--primary)">¡Registro Guardado: ${estado}!</b>`;
    } catch (e) { 
        console.error(e);
        alert("Error al registrar entrada."); 
    }
});

// LEER ASISTENCIAS EN TIEMPO REAL
function escucharAsistencias(area, rol) {
    const q = (rol === 'admin') 
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
                    <td>${res.justificacion || '<i>Pendiente</i>'}</td>
                    <td>
                        <button onclick="justificarAlcance('${docSnap.id}')" class="btn-small">Justificar</button>
                    </td>
                </tr>
            `;
            tbody.innerHTML += fila;
        });
    });
}

// Función global para el botón de la tabla
window.justificarAlcance = async (id) => {
    const motivo = prompt("Escriba la razón del alcance/justificación:");
    if (motivo) {
        const docRef = doc(db, "asistencias", id);
        await updateDoc(docRef, { justificacion: motivo });
    }
};
