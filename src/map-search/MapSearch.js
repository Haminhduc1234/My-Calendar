/* ===============================
   MapSearch.js – FREE & PROD READY
   =============================== */

const MapSearch = (() => {
  let map;
  let userMarker;
  let destMarker;
  let routeLine;

  let userLocation = null; // [lat, lon]

  let searchCache = new Map();
  let activeIndex = -1;
  let lastResults = [];

  /* ========= INIT ========= */
  function init({ mapId, inputId, resultsId }) {
    initMap(mapId);
    bindSearch(inputId, resultsId);
    locateUser();
  }

  /* ========= MAP ========= */
  function initMap(mapId) {
    map = L.map(mapId).setView([21.0285, 105.8542], 13);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap"
    }).addTo(map);
  }

  function locateUser() {
    navigator.geolocation.getCurrentPosition(
      pos => {
        userLocation = [
          pos.coords.latitude,
          pos.coords.longitude
        ];

        userMarker = L.marker(userLocation)
          .addTo(map)
          .bindPopup("📍 Vị trí của bạn")
          .openPopup();

        map.setView(userLocation, 15);
      },
      err => {
        console.warn("Không lấy được GPS", err);
      },
      { enableHighAccuracy: true }
    );
  }

  /* ========= SEARCH ========= */
  function bindSearch(inputId, resultsId) {
    const input = document.getElementById(inputId);
    const box = document.getElementById(resultsId);

    input.addEventListener(
      "input",
      debounce(e => {
        searchAddress(e.target.value, box);
      }, 400)
    );

    input.addEventListener("keydown", e => {
      if (!lastResults.length) return;

      if (e.key === "ArrowDown") {
        activeIndex = (activeIndex + 1) % lastResults.length;
        highlight(box);
      }

      if (e.key === "ArrowUp") {
        activeIndex =
          (activeIndex - 1 + lastResults.length) %
          lastResults.length;
        highlight(box);
      }

      if (e.key === "Enter" && activeIndex >= 0) {
        selectResult(lastResults[activeIndex]);
        box.style.display = "none";
      }
    });
  }

  async function searchAddress(query, box) {
    query = normalize(query);
    if (query.length < 3 || !userLocation) {
      box.style.display = "none";
      return;
    }

    if (searchCache.has(query)) {
      renderResults(searchCache.get(query), box);
      return;
    }

    try {
      const results = await searchPhoton(query);
      searchCache.set(query, results);
      renderResults(results, box);
    } catch {
      const results = await searchNominatim(query);
      renderResults(results, box);
    }
  }

  /* ========= PHOTON ========= */
  async function searchPhoton(query) {
    const [lat, lon] = userLocation;
    const url =
      `https://photon.komoot.io/api/?q=${query}` +
      `&lat=${lat}&lon=${lon}&limit=8`;

    const res = await fetch(url);
    const data = await res.json();

    return data.features.map(f => ({
      lat: f.geometry.coordinates[1],
      lon: f.geometry.coordinates[0],
      name: f.properties.name || f.properties.street,
      detail: [
        f.properties.street,
        f.properties.city,
        f.properties.state
      ].filter(Boolean).join(", ")
    }));
  }

  /* ========= NOMINATIM ========= */
  async function searchNominatim(query) {
    const url =
      `https://nominatim.openstreetmap.org/search?` +
      `format=json&q=${query}&limit=5`;

    const res = await fetch(url);
    const data = await res.json();

    return data.map(d => ({
      lat: +d.lat,
      lon: +d.lon,
      name: d.display_name.split(",")[0],
      detail: d.display_name
    }));
  }

  /* ========= UI ========= */
  function renderResults(results, box) {
    box.innerHTML = "";
    lastResults = results;
    activeIndex = -1;

    if (!results.length) {
      box.style.display = "none";
      return;
    }

    results.forEach((r, i) => {
      const div = document.createElement("div");
      div.className = "search-item";
      div.innerHTML = `
        <strong>${r.name}</strong>
        <div class="sub">${r.detail}</div>
      `;

      div.onclick = () => {
        selectResult(r);
        box.style.display = "none";
      };

      box.appendChild(div);
    });

    box.style.display = "block";
  }

  function highlight(box) {
    [...box.children].forEach((el, i) => {
      el.classList.toggle("active", i === activeIndex);
    });
  }

  /* ========= SELECT ========= */
  function selectResult(r) {
    showDestination(r.lat, r.lon, r.name);
    drawRoute(r.lat, r.lon);
  }

  function showDestination(lat, lon, label) {
    if (destMarker) map.removeLayer(destMarker);

    destMarker = L.marker([lat, lon])
      .addTo(map)
      .bindPopup("📌 " + label)
      .openPopup();

    map.setView([lat, lon], 15);
  }

  /* ========= ROUTE ========= */
  async function drawRoute(destLat, destLon) {
    if (!userLocation) return;

    if (routeLine) map.removeLayer(routeLine);

    const [lat, lon] = userLocation;
    const url =
      `https://router.project-osrm.org/route/v1/driving/` +
      `${lon},${lat};${destLon},${destLat}` +
      `?overview=full&geometries=geojson`;

    const res = await fetch(url);
    const data = await res.json();

    routeLine = L.geoJSON(data.routes[0].geometry, {
      style: { weight: 5 }
    }).addTo(map);
  }

  /* ========= UTILS ========= */
  function debounce(fn, delay) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), delay);
    };
  }

  function normalize(str) {
    return str
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  /* ========= PUBLIC ========= */
  return { init };
})();
