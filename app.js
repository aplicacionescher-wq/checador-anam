import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, collection, query, where, onSnapshot, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 1. Configuración de tu Proyecto
const firebaseConfig = {
  apiKey: "AIzaSyC6bo4zO4vUl7jbfm1sVS59GqoP3vJeyR0",
  authDomain: "checador-anam.firebaseapp.com",
  projectId: "checador-anam",
  storageBucket: "checador-anam.firebasestorage.app",
  messagingSenderId: "376706550668",
  appId: "1:376706550668:web:87e0e9f1cba7fcbe2824a9"
};

// 2. Inicialización
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- RELOJ EN TIEMPO REAL ---
setInterval(() => {
    const pTime = document.getElementById('current-time');
    if (pTime) pTime.innerText = new Date().toLocaleTimeString();
}, 1000);

// --- MANEJO DE LOGIN ---
const btnLogin = document.getElementById('btn-login');
if (btnLogin) {
    btnLogin.addEventListener('click', async () => {
        const email = document.getElementById('email').value;
        const pass = document.getElementById('password').value;
        try {
            await signInWithEmailAndPassword(auth, email, pass);
        } catch (e) {
            alert("Error de acceso: Verifica tus credenciales.");
        }
    });
}

// --- MANEJO DE LOGOUT ---
const btnLogout = document.getElementById('btn-logout');
if (btnLogout) {
    btnLogout.addEventListener('click', () => signOut(auth));
}

// --- MONITOR DE SESIÓN (ESTADO DEL USUARIO) ---
onAuthStateChanged(auth, async (user) => {
    const loginScreen = document.getElementById('login-screen');
    const mainPanel = document.getElementById('main-panel');
    const adminSection = document.getElementById('admin-section');

    if (user) {
        if (loginScreen) loginScreen.style.display = 'none';
        if (mainPanel) mainPanel.style.display = 'block';

        try {
            const userDoc = await getDoc(doc(db, "usuarios", user.uid));
            if (snapExists(userDoc)) {
                const data = userDoc.data();
                document.getElementById('user-info').innerText = `${data.nombre} | ${data.area}`;

                // Mostrar sección administrativa si es Admin o Supervisor
                if (data.rol === 'admin' || data.rol === 'supervisor') {
                    if (adminSection) adminSection.style.display = 'block';
                    escucharAsistencias(data.area, data.rol);
                }
            }
        } catch (error) {
            console.error("Error cargando perfil:", error);
        }
    } else {
        if (loginScreen) loginScreen.style.display = 'block';
        if (mainPanel) mainPanel.style.display = 'none';
        if (adminSection) adminSection.style.display = 'none';
    }
});

// Helper para verificar si el snap existe
function snapExists(snap) {
    return snap && typeof snap.exists === 'function' && snap.exists();
}

// --- REGISTRAR ASISTENCIA (LÓGICA DE 15 MIN) ---
const btnCheck = document.getElementById('btn-check');
if (btnCheck) {
    btnCheck.addEventListener('click', async () => {
        const user = auth.currentUser;
        if (!user) return;

        try {
            const userSnap = await getDoc(doc(db, "usuarios", user.uid));
            const { horario_base, nombre, area } = userSnap.data();

            const ahora = new Date();
            const horaActual = ahora.getHours();
            const minActual = ahora.getMinutes();
            const fechaHoy = ahora.toISOString().split('T')[0];

            // REGLA: Tolerancia de 15 minutos
            let estado = "A tiempo";
            if (horaActual > horario_base || (horaActual === horario_base && minActual > 15)) {
                estado = "Retardo";
            }

            // Guardar registro
            await setDoc(doc(db, "asistencias", `${user.uid}_${fechaHoy}`), {
                uid: user.uid,
                nombre: nombre,
                area: area,
                fecha: fechaHoy,
                hora_entrada: `${horaActual}:${minActual < 10 ? '0' + minActual : minActual}`,
                estado: estado,
                justificacion: "",
                timestamp: serverTimestamp()
            });

            const statusMsg = document.getElementById('status-msg');
            statusMsg.innerHTML = `<b style="color:${estado === 'A tiempo' ? 'green' : 'red'}">¡Registrado: ${estado}!</b>`;
        } catch (e) {
            console.error("Error al marcar:", e);
            alert("Hubo un problema al registrar tu entrada.");
        }
    });
}

// --- REPORTES EN TIEMPO REAL ---
function escucharAsistencias(areaUsuario, rolUsuario) {
    const asistenciasCol = collection(db, "asistencias");
    
    // Si es Admin ve todo, si es Supervisor solo su área
    const q = (rolUsuario === 'admin') 
        ? query(asistenciasCol) 
        : query(asistenciasCol, where("area", "==", areaUsuario));

    onSnapshot(q, (snapshot) => {
        const tbody = document.getElementById('report-body');
        if (!tbody) return;
        tbody.innerHTML = "";

        snapshot.forEach((docSnap) => {
            const res = docSnap.data();
            const fila = `
                <tr>
                    <td>${res.nombre}</td>
                    <td style="color:${res.estado === 'Retardo' ? 'red' : 'black'}"><b>${res.estado}</b></td>
                    <td>${res.justificacion || '<i>Sin justificación</i>'}</td>
                    <td>
                        <button class="btn-small" onclick="window.justificar('${docSnap.id}')">Justificar</button>
                    </td>
                </tr>
            `;
            tbody.innerHTML += fila;
        });
    }, (error) => {
        console.error("Error en el listener de reportes:", error);
    });
}

// --- FUNCIÓN PARA JUSTIFICAR (ALCANCES) ---
window.justificar = async (idAsistencia) => {
    const motivo = prompt("Ingrese la justificación para este registro:");
    if (motivo) {
        try {
            const docRef = doc(db, "asistencias", idAsistencia);
            await updateDoc(docRef, { 
                justificacion: motivo 
            });
            alert("Justificación guardada.");
        } catch (e) {
            alert("Error al guardar justificación.");
        }
    }
};
