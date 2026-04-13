import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, collection, query, where, getDocs, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// CONFIGURACIÓN DE TU PROYECTO (Obtenla en la consola de Firebase)
const firebaseConfig = {
  apiKey: "TU_API_KEY",
  authDomain: "TU_PROYECTO.firebaseapp.com",
  projectId: "TU_PROYECTO",
  storageBucket: "TU_PROYECTO.appspot.com",
  messagingSenderId: "TU_ID",
  appId: "TU_APP_ID"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- Manejo de Autenticación ---
document.getElementById('btn-login').addEventListener('click', async () => {
    const email = document.getElementById('email').value;
    const pass = document.getElementById('password').value;
    try {
        await signInWithEmailAndPassword(auth, email, pass);
    } catch (e) { alert("Error de acceso: " + e.message); }
});

document.getElementById('btn-logout').addEventListener('click', () => signOut(auth));

onAuthStateChanged(auth, async (user) => {
    if (user) {
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('main-panel').style.display = 'block';
        
        // Obtener datos del usuario (Rol y Horario)
        const userDoc = await getDoc(doc(db, "usuarios", user.uid));
        const userData = userDoc.data();
        document.getElementById('user-info').innerText = `${userData.nombre} (${userData.area})`;

        if (userData.rol === 'admin' || userData.rol === 'supervisor') {
            document.getElementById('admin-section').style.display = 'block';
        }
    } else {
        document.getElementById('login-screen').style.display = 'block';
        document.getElementById('main-panel').style.display = 'none';
    }
});

// --- Lógica de Marcaje con Tolerancia ---
document.getElementById('btn-check').addEventListener('click', async () => {
    const user = auth.currentUser;
    const userDoc = await getDoc(doc(db, "usuarios", user.uid));
    const { horario_base, nombre, area } = userDoc.data();

    const ahora = new Date();
    const horaActual = ahora.getHours();
    const minActual = ahora.getMinutes();
    
    // Regla: Si la hora es mayor al horario base O si es la hora justa pero pasaron 15 min
    let estado = "A tiempo";
    if (horaActual > horario_base || (horaActual === horario_base && minActual > 15)) {
        estado = "Retardo";
    }

    const fechaHoy = ahora.toISOString().split('T')[0];
    
    try {
        await setDoc(doc(db, "asistencias", `${user.uid}_${fechaHoy}`), {
            uid: user.uid,
            nombre,
            area,
            fecha: fechaHoy,
            hora_entrada: `${horaActual}:${minActual}`,
            estado,
            justificacion: "",
            aprobado: false,
            timestamp: serverTimestamp()
        });
        document.getElementById('status-msg').innerText = `¡Registrado como: ${estado}!`;
    } catch (e) { console.error(e); }
});
