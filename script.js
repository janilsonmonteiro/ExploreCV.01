// script.js
let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  const btn = document.getElementById('installBtn');
  btn.style.display = 'block';

  btn.addEventListener('click', () => {
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then(choice => {
      console.log(choice.outcome);
      deferredPrompt = null;
    });
  });
}); 

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js")
      .then(reg => console.log("Service Worker registrado:", reg))
      .catch(err => console.log("Erro ao registrar SW:", err));
  });
}

const allCategories = [
    { id: "praias",        name: "Praias Paradisíacas" },
    { id: "desportos",     name: "Desportos Aquáticos" },
    { id: "natureza",      name: "Natureza & Aventura" },
    { id: "cultura",       name: "Cultura & Música" },
    { id: "gastronomia",   name: "Gastronomia Cabo-verdiana" },
    { id: "hoteis",        name: "Hotéis & Resorts" },
    { id: "ecologico",     name: "Turismo Ecológico" },
    { id: "eventos",       name: "Eventos & Festivais" }
];

let locationsDB = {};

let db;
let currentUser = null;
let tempProfile = {};
let selectedCategoryIds = [];
let currentExploreCategory = "";

async function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open("ExploreCV", 1);
        request.onupgradeneeded = (event) => {
            db = event.target.result;
            if (!db.objectStoreNames.contains("userData")) {
                db.createObjectStore("userData", { keyPath: "id" });
            }
        };
        request.onsuccess = (event) => {
            db = event.target.result;
            resolve();
        };
        request.onerror = () => reject(request.error);
    });
}

async function saveUserData(data) {
    return new Promise((resolve) => {
        const tx = db.transaction("userData", "readwrite");
        const store = tx.objectStore("userData");
        store.put({ id: "profile", ...data });
        tx.oncomplete = resolve;
    });
}

async function loadUserData() {
    return new Promise((resolve) => {
        const tx = db.transaction("userData", "readonly");
        const store = tx.objectStore("userData");
        const req = store.get("profile");
        req.onsuccess = () => resolve(req.result || null);
    });
}

async function loadLocations() {
    try {
        const response = await fetch("data.json");
        if (!response.ok) throw new Error("Erro no data.json");
        locationsDB = await response.json();
        console.log("Locais carregados:", Object.keys(locationsDB));
    } catch (err) {
        console.error("Falha ao carregar data.json:", err);
        locationsDB = {};
    }
}

function haversine(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2)**2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2)**2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

function playNotificationSound() {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 680; osc.type = "sine"; gain.gain.value = 0.6;
    osc.start();
    setTimeout(() => osc.stop(), 280);
    setTimeout(() => {
        const osc2 = ctx.createOscillator();
        osc2.connect(gain);
        osc2.frequency.value = 920;
        osc2.start();
        setTimeout(() => osc2.stop(), 220);
    }, 180);
}

async function showToast(message) {
    const toast = document.getElementById("toast");
    document.getElementById("toast-text").textContent = message;
    toast.classList.remove("hidden");
    setTimeout(() => toast.classList.add("hidden"), 3200);
}

function showNotification(title, body) {
    if (Notification.permission === "granted") {
        new Notification(title, { body, icon: "🌴" });
    } else {
        showToast(body);
    }
}

function hideAllPages() {
    document.querySelectorAll("section").forEach(s => s.classList.add("hidden"));
}

function showPage(pageId) {
    hideAllPages();
    document.getElementById(pageId).classList.remove("hidden");
}

function startSetup() {
    showPage("setup");
}

async function saveProfileAndGoToCategories() {
    const name = document.getElementById("name-input").value.trim();
    const age = parseInt(document.getElementById("age-input").value);
    const gender = document.getElementById("gender-input").value;
    const photo = document.getElementById("photo-preview").src;

    if (!name || !age || !gender) {
        alert("Preenche nome, idade e sexo");
        return;
    }

    tempProfile = { name, age, gender, photo };
    selectedCategoryIds = [];
    renderCategoriesGrid();
    showPage("categories");
}

function renderCategoriesGrid() {
    const container = document.getElementById("categories-grid");
    container.innerHTML = "";

    allCategories.forEach(cat => {
        const div = document.createElement("div");
        
        // Classes base + classe selected quando aplicável
        div.className = `
            bg-white border-2 border-gray-200 rounded-3xl 
            p-5 sm:p-6 cursor-pointer 
            hover:shadow-xl hover:border-gray-400 
            transition-all duration-200 text-center
            font-medium text-gray-800
            ${selectedCategoryIds.includes(cat.id) ? "selected" : ""}
        `.replace(/\s+/g, ' ').trim();  // limpa espaços extras

        div.innerHTML = `<p class="text-lg">${cat.name}</p>`;

        div.onclick = () => {
            if (selectedCategoryIds.includes(cat.id)) {
                selectedCategoryIds = selectedCategoryIds.filter(id => id !== cat.id);
            } else {
                selectedCategoryIds.push(cat.id);
            }
            renderCategoriesGrid();
            document.getElementById("proceed-categories-btn").disabled = 
                selectedCategoryIds.length === 0;
        };

        container.appendChild(div);
    });
}

async function saveCategoriesAndGoHome() {
    if (selectedCategoryIds.length === 0) return;
    
    const fullData = { ...tempProfile, selectedCategories: selectedCategoryIds };
    await saveUserData(fullData);
    currentUser = fullData;
    showHome();
}

function showHome() {
    showPage("home");
    
    document.getElementById("home-photo").src = currentUser.photo;
    document.getElementById("home-name").textContent = currentUser.name;
    document.getElementById("home-age-gender").textContent = `${currentUser.age} anos • ${currentUser.gender}`;
    
    document.getElementById("edit-name").value = currentUser.name;
    document.getElementById("edit-age").value = currentUser.age;
    document.getElementById("edit-gender").value = currentUser.gender;
    
    const container = document.getElementById("home-categories");
    container.innerHTML = "";
    currentUser.selectedCategories.forEach(id => {
        const cat = allCategories.find(c => c.id === id);
        if (cat) {
            const pill = document.createElement("div");
            pill.className = "bg-blue-100 text-blue-700 px-5 py-2 rounded-3xl text-sm font-medium";
            pill.textContent = cat.name;
            container.appendChild(pill);
        }
    });
}

async function saveEdit() {
    currentUser.name = document.getElementById("edit-name").value;
    currentUser.age = parseInt(document.getElementById("edit-age").value);
    currentUser.gender = document.getElementById("edit-gender").value;
    await saveUserData(currentUser);
    showToast("Perfil atualizado!");
    showHome();
}

function goToExplore() {
    if (currentUser.selectedCategories.length === 0) {
        showToast("Escolhe pelo menos uma categoria");
        return;
    }
    currentExploreCategory = currentUser.selectedCategories[0];
    renderExplorePage();
    showPage("explore");
}

function renderExplorePage() {
    const tabs = document.getElementById("category-tabs");
    tabs.innerHTML = "";
    
    currentUser.selectedCategories.forEach(id => {
        const cat = allCategories.find(c => c.id === id);
        if (!cat) return;
        const btn = document.createElement("button");
        btn.className = `px-6 py-3 rounded-3xl text-sm font-medium whitespace-nowrap transition ${id === currentExploreCategory ? "bg-black text-white" : "bg-gray-100 hover:bg-gray-200"}`;
        btn.textContent = cat.name;
        btn.onclick = () => {
            currentExploreCategory = id;
            renderExplorePage();
        };
        tabs.appendChild(btn);
    });
    
    const title = document.getElementById("current-category-title");
    const cat = allCategories.find(c => c.id === currentExploreCategory);
    title.textContent = cat ? cat.name : "";
    
    const iframe = document.getElementById("map-iframe");
    iframe.src = `https://www.google.com/maps?q=${encodeURIComponent(cat?.name || "Cabo Verde")}&output=embed`;
    
    const list = document.getElementById("points-list");
    list.innerHTML = "";
    
    const points = locationsDB[currentExploreCategory] || {};
    if (Object.keys(points).length === 0) {
        list.innerHTML = '<li class="text-gray-400 text-center py-8">Sem pontos nesta categoria ainda</li>';
        return;
    }
    
    Object.entries(points).forEach(([name, info]) => {
        const li = document.createElement("li");
        li.className = "flex justify-between items-center bg-gray-50 px-5 py-4 rounded-2xl";
        li.innerHTML = `
            <div>
                <p class="font-medium">${name}</p>
                <p class="text-xs text-gray-500">${info.ilha || "?"}</p>
            </div>
            <div class="text-right text-xs text-gray-600">
                <div>${info.lat.toFixed(5)}</div>
                <div>${info.lon.toFixed(5)}</div>
            </div>
        `;
        list.appendChild(li);
    });
}

async function checkProximity() {
    if (!navigator.geolocation) return showToast("Geolocalização não suportada");
    
    showToast("A obter localização...");
    
    navigator.geolocation.getCurrentPosition(pos => {
        const userLat = pos.coords.latitude;
        const userLon = pos.coords.longitude;
        let close = [];
        
        for (let catId of currentUser.selectedCategories) {
            const points = locationsDB[catId] || {};
            for (let [name, info] of Object.entries(points)) {
                if (!info.lat || !info.lon) continue;
                const distKm = haversine(userLat, userLon, info.lat, info.lon);
                const distM = distKm * 1000;
                if (distM <= 200) {
                    close.push(`${name} — ~${Math.round(distM)}m`);
                }
            }
        }
        
        if (close.length > 0) {
            playNotificationSound();
            const msg = `Estás perto de:\n${close.join("\n")}`;
            showNotification("ExploreCV.1 – Perto de ti!", msg);
            showToast("Alerta enviado!");
        } else {
            showToast("Nada a menos de 200m no momento");
        }
    }, () => {
        showToast("Não foi possível obter localização");
    }, { enableHighAccuracy: true });
}

function logout() {
    if (confirm("Apagar dados e sair?")) {
        indexedDB.deleteDatabase("ExploreCV");
        location.reload();
    }
}

function previewPhoto(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = ev => document.getElementById("photo-preview").src = ev.target.result;
        reader.readAsDataURL(file);
    }
}

async function initApp() {
    await initDB();
    await loadLocations();

    if (Notification.permission === "default") {
        Notification.requestPermission();
    }

    const saved = await loadUserData();
    if (saved) {
        currentUser = saved;
        showHome();
    } else {
        showPage("landing");
    }
}

document.querySelectorAll(".catego").forEach((e)=>{
    
})


// Atualiza a foto automaticamente quando o utilizador escolhe uma nova
function previewEditPhoto(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(ev) {
        const newPhotoUrl = ev.target.result;
        
        // Atualiza as duas imagens visíveis
        document.getElementById("home-photo").src = newPhotoUrl;
        
        // Atualiza o objeto currentUser
        currentUser.photo = newPhotoUrl;
        
        // Salva imediatamente no IndexedDB
        saveUserData(currentUser).then(() => {
            showToast("Foto de perfil atualizada automaticamente!");
        }).catch(err => {
            console.error("Erro ao salvar foto:", err);
            showToast("Erro ao salvar a foto");
        });
    };
    reader.readAsDataURL(file);
}

// Abre a página de categorias no modo edição
function editCategories() {
    isEditingCategories = true;
    selectedCategoryIds = [...currentUser.selectedCategories]; // copia as atuais
    renderCategoriesGrid();
    showPage("categories");
}

// Atualiza o texto do botão conforme o modo (criação ou edição)
function updateProceedButton() {
    const btn = document.getElementById("proceed-categories-btn");
    if (!btn) return;
    
    btn.disabled = selectedCategoryIds.length === 0;
    
    if (isEditingCategories) {
        btn.textContent = "Salvar alterações nas categorias";
    } else {
        btn.textContent = "Salvar e ir para o perfil";
    }
}

// Salva categorias (tanto na criação inicial como na edição)
async function saveCategoriesAndGoHome() {
    if (selectedCategoryIds.length === 0) {
        showToast("Escolha pelo menos uma categoria");
        return;
    }

    if (isEditingCategories) {
        // Modo edição → atualiza o utilizador atual
        currentUser.selectedCategories = [...selectedCategoryIds];
        await saveUserData(currentUser);
        showToast("Categorias atualizadas com sucesso!");
        showHome();
    } else {
        // Modo criação inicial (caso ainda não tenha perfil)
        const profileData = {
            name: document.getElementById("name-input")?.value.trim() || currentUser?.name,
            age: parseInt(document.getElementById("age-input")?.value) || currentUser?.age,
            gender: document.getElementById("gender-input")?.value || currentUser?.gender,
            photo: document.getElementById("photo-preview")?.src || currentUser?.photo,
            selectedCategories: [...selectedCategoryIds]
        };
        await saveUserData(profileData);
        currentUser = profileData;
        showHome();
    }
}

let isEditingCategories = false;

function showHome() {
    showPage("home");

    document.getElementById("home-photo").src = currentUser.photo || "https://via.placeholder.com/128?text=👤";
    document.getElementById("home-name").textContent = currentUser.name || "Nome";
    document.getElementById("home-age-gender").textContent = `${currentUser.age || "?"} anos • ${currentUser.gender || "?"}`;

    document.getElementById("edit-name").value = currentUser.name || "";
    document.getElementById("edit-age").value = currentUser.age || "";
    document.getElementById("edit-gender").value = currentUser.gender || "Outro";

    // Mostra categorias
    const container = document.getElementById("home-categories");
    container.innerHTML = "";
    (currentUser.selectedCategories || []).forEach(id => {
        const cat = allCategories.find(c => c.id === id);
        if (cat) {
            const pill = document.createElement("div");
            pill.className = "bg-blue-50 text-blue-700 px-4 py-1.5 rounded-full text-sm font-medium";
            pill.textContent = cat.name;
            container.appendChild(pill);
        }
    });
}

window.onload = initApp;