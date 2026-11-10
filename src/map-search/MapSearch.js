/* ==========================================================================
   BẢN ĐỒ 3D THẾ GIỚI THỰC (MAP SEARCH 3D) - CONTROLLER
   - Sử dụng MapLibre GL JS WebGL 3D
   - 3D Buildings Extrusion, Ảnh vệ tinh thực tế Esri, Góc nghiêng pitch 65-85°
   - Tương tác tự nhiên: Kéo chuột / chạm vuốt 3D mượt mà
   - Giao diện tối giản, linh hoạt trên cả Desktop và Mobile
   - Tìm kiếm địa chỉ & Thẻ chi tiết có thể ẩn hiện theo ý muốn
   - Chế độ Toàn Cảnh (Zen Mode): Ẩn toàn bộ UI để ngắm cảnh trọn vẹn
   - Tự động xoay 360° (Orbit / Flycam view)
   - Xem Street View 360° thực tế tận mắt nhà cửa ngoài đời
   - Chỉ đường 3D
   ========================================================================== */

const MapSearch3D = (() => {
  let map = null;
  let isMapInitialized = false;
  let currentStyle = "satellite"; // "satellite" | "buildings3d" | "night3d"

  let userLocation = null; // [lng, lat]
  let userMarker = null;
  let destMarker = null;

  // Search & Navigation state
  let searchDebounceTimer = null;
  let searchCache = new Map();
  let selectedDestination = null;

  // Orbit & Zen state
  let isOrbiting = false;
  let orbitRafId = null;
  let isZenMode = false;

  // Map Styles definitions
  const SATELLITE_STYLE = {
    version: 8,
    sources: {
      "esri-satellite": {
        type: "raster",
        tiles: [
          "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        ],
        tileSize: 256,
        maxzoom: 19,
        attribution: "© Esri, Maxar, Earthstar Geographics"
      },
      "esri-labels": {
        type: "raster",
        tiles: [
          "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
        ],
        tileSize: 256,
        maxzoom: 19
      }
    },
    layers: [
      {
        id: "satellite-layer",
        type: "raster",
        source: "esri-satellite",
        minzoom: 0,
        maxzoom: 22
      },
      {
        id: "labels-layer",
        type: "raster",
        source: "esri-labels",
        minzoom: 0,
        maxzoom: 22
      }
    ]
  };

  const VECTOR_BUILDINGS_STYLE = "https://tiles.openfreemap.org/styles/bright";
  const NIGHT_STYLE = "https://tiles.openfreemap.org/styles/liberty";

  /* ==================== 1. KHỞI TẠO BẢN ĐỒ ==================== */
  function init() {
    if (isMapInitialized) return;

    const container = document.getElementById("map3dContainer");
    if (!container) return;

    if (typeof maplibregl === "undefined") {
      console.warn("MapLibre GL JS chưa được tải!");
      return;
    }

    // Tọa độ mặc định: Hà Nội [105.8542, 21.0285]
    const defaultCenter = [105.8542, 21.0285];

    map = new maplibregl.Map({
      container: "map3dContainer",
      style: SATELLITE_STYLE,
      center: defaultCenter,
      zoom: 16.5,
      pitch: 65, // Góc nghiêng 3D quan sát cảnh vật và chân trời
      bearing: -15, // Góc xoay hướng nhìn
      maxPitch: 85, // Cho phép nghiêng sát mặt đất như người đi bộ
      minPitch: 0,
      attributionControl: false
    });

    // Tùy chỉnh: Toàn bộ điều khiển Zoom & Tools được xử lý qua cụm nút FAB đồng bộ dark-mode,
    // không dùng NavigationControl mặc định để tránh chèn đè giao diện.
    map.on("load", () => {
      isMapInitialized = true;
      setup3DEnvironment();
      locateUser(false);
    });

    // Xử lý click trên bản đồ để chọn bất kỳ địa điểm nào
    map.on("click", (e) => {
      const { lng, lat } = e.lngLat;
      handleMapClick(lng, lat);
    });

    bindSearchInput();
  }

  /* Thiết lập môi trường 3D (3D Buildings) */
  function setup3DEnvironment() {
    if (!map) return;

    if (currentStyle === "buildings3d" || currentStyle === "night3d") {
      add3DBuildingsLayer();
    }
  }

  function add3DBuildingsLayer() {
    if (!map || map.getLayer("3d-buildings")) return;

    try {
      const style = map.getStyle();
      if (!style || !style.sources) return;

      const sourceId = Object.keys(style.sources).find(id => {
        const s = style.sources[id];
        return s.type === "vector";
      }) || "openmaptiles";

      map.addLayer({
        id: "3d-buildings",
        source: sourceId,
        "source-layer": "building",
        type: "fill-extrusion",
        minzoom: 14,
        paint: {
          "fill-extrusion-color": [
            "interpolate",
            ["linear"],
            ["get", "render_height"],
            0, currentStyle === "night3d" ? "#1e293b" : "#e2e8f0",
            30, currentStyle === "night3d" ? "#0284c7" : "#93c5fd",
            70, currentStyle === "night3d" ? "#6366f1" : "#60a5fa",
            120, currentStyle === "night3d" ? "#a855f7" : "#3b82f6",
            200, currentStyle === "night3d" ? "#ec4899" : "#2563eb"
          ],
          "fill-extrusion-height": [
            "coalesce",
            ["get", "render_height"],
            ["*", ["get", "levels"], 3.2],
            10
          ],
          "fill-extrusion-base": [
            "coalesce",
            ["get", "render_min_height"],
            0
          ],
          "fill-extrusion-opacity": 0.9
        }
      });
    } catch (err) {
      console.warn("Không thể tải lớp khối nhà 3D:", err);
    }
  }

  /* ==================== 2. CHUYỂN ĐỔI CHẾ ĐỘ 3D ==================== */
  function setMapStyle(styleType) {
    if (!map || styleType === currentStyle) return;
    currentStyle = styleType;

    document.querySelectorAll(".map3d-pill-btn").forEach(btn => {
      btn.classList.toggle("active", btn.getAttribute("data-style") === styleType);
    });

    if (styleType === "satellite") {
      map.setStyle(SATELLITE_STYLE);
    } else if (styleType === "buildings3d") {
      map.setStyle(VECTOR_BUILDINGS_STYLE);
    } else if (styleType === "night3d") {
      map.setStyle(NIGHT_STYLE);
    }

    map.once("style.load", () => {
      setup3DEnvironment();
      if (selectedDestination && userLocation) {
        draw3DRoute(selectedDestination.lng, selectedDestination.lat);
      }
    });
  }

  /* ==================== 3. ĐỊNH VỊ GPS VỊ TRÍ CỦA TÔI ==================== */
  function locateUser(flyTo = true) {
    if (!navigator.geolocation) {
      if (flyTo) alert("Trình duyệt không hỗ trợ Geolocation.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      pos => {
        const lng = pos.coords.longitude;
        const lat = pos.coords.latitude;
        userLocation = [lng, lat];

        if (userMarker) {
          userMarker.setLngLat(userLocation);
        } else if (map) {
          const el = document.createElement("div");
          el.className = "map3d-user-marker";
          const radar = document.createElement("div");
          radar.className = "map3d-user-radar";
          el.appendChild(radar);

          userMarker = new maplibregl.Marker({ element: el })
            .setLngLat(userLocation)
            .addTo(map);
        }

        if (flyTo && map) {
          stopOrbit();
          map.flyTo({
            center: userLocation,
            zoom: 17.5,
            pitch: 68,
            bearing: 0,
            duration: 2000,
            essential: true
          });
        }
      },
      err => {
        console.warn("Không thể lấy GPS người dùng:", err);
        if (flyTo) {
          alert("Không thể truy cập GPS vị trí hiện tại. Vui lòng cho phép quyền vị trí trên trình duyệt.");
        }
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  /* ==================== 4. ẨN HIỆN CỤM NÚT & TÌM KIẾM ==================== */
  function toggleFloatingActions(forceOpen) {
    const container = document.getElementById("map3dFloatingActions");
    const toggleBtn = document.getElementById("map3dFabToggle");
    if (!container) return;

    const isCollapsed = container.classList.contains("collapsed");
    const shouldCollapse = forceOpen !== undefined ? !forceOpen : !isCollapsed;

    if (shouldCollapse) {
      container.classList.add("collapsed");
      if (toggleBtn) {
        toggleBtn.innerHTML = `<i class="fi fi-rr-apps"></i>`;
        toggleBtn.title = "Hiện các nút chức năng";
      }
    } else {
      container.classList.remove("collapsed");
      if (toggleBtn) {
        toggleBtn.innerHTML = `<i class="fi fi-rr-angle-small-up"></i>`;
        toggleBtn.title = "Ẩn các nút chức năng";
      }
    }
  }

  function toggleSearch(forceOpen) {
    const modalBox = document.getElementById("map3dSearchModalBox");
    const input = document.getElementById("map3dSearchInput");
    const searchFab = document.getElementById("map3dFabSearch");

    if (!modalBox) return;

    const shouldOpen = forceOpen !== undefined ? forceOpen : !modalBox.classList.contains("open");

    if (shouldOpen) {
      modalBox.classList.add("open");
      if (searchFab) searchFab.classList.add("active");
      if (input) {
        setTimeout(() => input.focus(), 120);
      }
    } else {
      modalBox.classList.remove("open");
      if (searchFab) searchFab.classList.remove("active");
      const resultsBox = document.getElementById("map3dSearchResults");
      if (resultsBox) resultsBox.style.display = "none";
    }
  }

  function bindSearchInput() {
    const input = document.getElementById("map3dSearchInput");
    const clearBtn = document.getElementById("map3dSearchClearBtn");
    const resultsBox = document.getElementById("map3dSearchResults");
    const spinner = document.getElementById("map3dSearchSpinner");

    if (!input || !resultsBox) return;

    input.addEventListener("input", e => {
      const query = e.target.value.trim();
      if (clearBtn) clearBtn.style.display = query ? "flex" : "none";

      clearTimeout(searchDebounceTimer);
      if (query.length < 2) {
        resultsBox.style.display = "none";
        return;
      }

      searchDebounceTimer = setTimeout(() => {
        performSearch(query, resultsBox, spinner);
      }, 350);
    });

    if (clearBtn) {
      clearBtn.addEventListener("click", () => {
        input.value = "";
        clearBtn.style.display = "none";
        resultsBox.style.display = "none";
        input.focus();
      });
    }

    document.addEventListener("click", e => {
      if (!e.target.closest("#map3dSearchModalBox") && !e.target.closest("#map3dFabSearch")) {
        const resultsBox = document.getElementById("map3dSearchResults");
        if (resultsBox) resultsBox.style.display = "none";
      }
    });
  }

  async function performSearch(query, box, spinner) {
    if (spinner) spinner.style.display = "block";

    if (searchCache.has(query)) {
      renderSearchResults(searchCache.get(query), box);
      if (spinner) spinner.style.display = "none";
      return;
    }

    try {
      let results = [];
      const center = userLocation || (map ? [map.getCenter().lng, map.getCenter().lat] : [105.8542, 21.0285]);
      const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&lat=${center[1]}&lon=${center[0]}&limit=6`;

      const res = await fetch(photonUrl);
      if (res.ok) {
        const data = await res.json();
        if (data.features && data.features.length > 0) {
          results = data.features.map(f => ({
            lng: f.geometry.coordinates[0],
            lat: f.geometry.coordinates[1],
            name: f.properties.name || f.properties.street || query,
            detail: [f.properties.street, f.properties.district, f.properties.city, f.properties.state, f.properties.country].filter(Boolean).join(", ")
          }));
        }
      }

      if (results.length === 0) {
        const nomUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&countrycodes=vn`;
        const nomRes = await fetch(nomUrl);
        if (nomRes.ok) {
          const nomData = await nomRes.json();
          results = nomData.map(d => ({
            lng: parseFloat(d.lon),
            lat: parseFloat(d.lat),
            name: d.display_name.split(",")[0],
            detail: d.display_name
          }));
        }
      }

      searchCache.set(query, results);
      renderSearchResults(results, box);
    } catch (err) {
      console.warn("Lỗi tìm kiếm bản đồ:", err);
    } finally {
      if (spinner) spinner.style.display = "none";
    }
  }

  function renderSearchResults(results, box) {
    box.innerHTML = "";
    if (!results || results.length === 0) {
      box.innerHTML = `<div style="padding: 10px; color: #94a3b8; font-size: 12.5px; text-align: center;">Không tìm thấy địa điểm phù hợp</div>`;
      box.style.display = "block";
      return;
    }

    results.forEach(r => {
      const item = document.createElement("div");
      item.className = "map3d-search-item";
      item.innerHTML = `
        <i class="fi fi-rr-marker map3d-item-marker-icon"></i>
        <div class="map3d-item-content">
          <div class="map3d-item-title">${escapeHtml(r.name)}</div>
          <div class="map3d-item-detail">${escapeHtml(r.detail)}</div>
        </div>
      `;

      item.onclick = () => {
        box.style.display = "none";
        toggleSearch(false);
        selectDestination(r.lng, r.lat, r.name, r.detail);
      };

      box.appendChild(item);
    });

    box.style.display = "block";
  }

  /* ==================== 5. CHỌN ĐỊA ĐIỂM & BAY CAMERA 3D ==================== */
  function selectDestination(lng, lat, name, detail) {
    if (!map) return;
    stopOrbit();

    selectedDestination = { lng, lat, name, detail };

    if (destMarker) destMarker.remove();

    const el = document.createElement("div");
    el.className = "map3d-marker";
    el.innerHTML = `
      <div class="map3d-marker-pulse"></div>
      <div class="map3d-marker-pin"></div>
    `;

    destMarker = new maplibregl.Marker({ element: el })
      .setLngLat([lng, lat])
      .addTo(map);

    map.flyTo({
      center: [lng, lat],
      zoom: 17.5,
      pitch: 66,
      bearing: 35,
      duration: 2200,
      essential: true
    });

    showLocationCard(name, detail, lng, lat);
  }

  async function handleMapClick(lng, lat) {
    let name = "Vị trí đã chọn";
    let detail = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;

    selectDestination(lng, lat, name, detail);

    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.display_name) {
          name = data.name || data.display_name.split(",")[0];
          detail = data.display_name;
          showLocationCard(name, detail, lng, lat);
        }
      }
    } catch { }
  }

  /* ==================== 6. THẺ ĐỊA ĐIỂM (ẨN HIỆN & THU GỌN) ==================== */
  function showLocationCard(name, detail, lng, lat) {
    const card = document.getElementById("map3dLocationCard");
    const titleEl = document.getElementById("map3dCardTitle");
    const addressEl = document.getElementById("map3dCardAddress");
    const coordsEl = document.getElementById("map3dCardCoords");

    if (!card) return;

    if (titleEl) titleEl.textContent = name || "Địa điểm";
    if (addressEl) addressEl.textContent = detail || "";
    if (coordsEl) coordsEl.textContent = `📍 ${lat.toFixed(5)}°N, ${lng.toFixed(5)}°E`;

    card.classList.remove("minimized");
    card.style.display = "block";
    updateCardMinimizeIcon();
  }

  function toggleLocationCardMinimize() {
    const card = document.getElementById("map3dLocationCard");
    if (!card) return;
    card.classList.toggle("minimized");
    updateCardMinimizeIcon();
  }

  function updateCardMinimizeIcon() {
    const card = document.getElementById("map3dLocationCard");
    const btn = document.getElementById("map3dCardMinimizeBtn");
    if (!card || !btn) return;
    const isMin = card.classList.contains("minimized");
    btn.innerHTML = isMin ? `<i class="fi fi-rr-angle-small-up"></i>` : `<i class="fi fi-rr-angle-small-down"></i>`;
    btn.title = isMin ? "Mở rộng chi tiết" : "Thu gọn";
  }

  function closeLocationCard() {
    const card = document.getElementById("map3dLocationCard");
    if (card) card.style.display = "none";
  }

  /* ==================== 7. CHẾ ĐỘ TOÀN CẢNH (ZEN MODE) ==================== */
  function toggleZenMode() {
    const modal = document.getElementById("mapSearchModal");
    const zenFab = document.getElementById("map3dFabZen");
    if (!modal) return;

    isZenMode = !isZenMode;
    modal.classList.toggle("zen-mode", isZenMode);

    if (zenFab) {
      zenFab.classList.toggle("active-green", isZenMode);
      zenFab.title = isZenMode ? "Thoát chế độ toàn cảnh" : "Chế độ toàn cảnh ngắm nhìn";
    }

    setTimeout(() => {
      if (map) map.resize();
    }, 260);
  }

  /* ==================== 8. CHUYỂN GÓC NHÌN & XOAY 360° ==================== */
  function resetView() {
    if (!map) return;
    stopOrbit();
    const currentPitch = map.getPitch();
    if (currentPitch > 20) {
      map.easeTo({ pitch: 0, bearing: 0, duration: 1000 });
    } else {
      map.easeTo({ pitch: 66, bearing: -15, duration: 1000 });
    }
  }

  function toggleOrbit() {
    if (isOrbiting) {
      stopOrbit();
    } else {
      startOrbit();
    }
  }

  function startOrbit() {
    if (!map || isOrbiting) return;
    isOrbiting = true;

    const orbitFab = document.getElementById("map3dFabOrbit");
    if (orbitFab) orbitFab.classList.add("active");

    if (map.getPitch() < 55) {
      map.setPitch(65);
    }

    function step() {
      if (!isOrbiting || !map) return;
      const currentBearing = map.getBearing();
      map.setBearing((currentBearing + 0.22) % 360);
      orbitRafId = requestAnimationFrame(step);
    }

    orbitRafId = requestAnimationFrame(step);
  }

  function stopOrbit() {
    isOrbiting = false;
    if (orbitRafId) {
      cancelAnimationFrame(orbitRafId);
      orbitRafId = null;
    }
    const orbitFab = document.getElementById("map3dFabOrbit");
    if (orbitFab) orbitFab.classList.remove("active");
  }

  /* ==================== 9. STREET VIEW & CHỈ ĐƯỜNG 3D ==================== */
  function openStreetView(targetLng, targetLat) {
    const lng = targetLng || (selectedDestination ? selectedDestination.lng : map.getCenter().lng);
    const lat = targetLat || (selectedDestination ? selectedDestination.lat : map.getCenter().lat);

    const streetViewUrl = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lng}`;
    window.open(streetViewUrl, "_blank", "noopener,noreferrer");
  }

  async function draw3DRoute(destLng, destLat) {
    if (!userLocation) {
      alert("Vui lòng bật định vị GPS vị trí của bạn để tìm đường đi!");
      locateUser(false);
      return;
    }

    const [uLng, uLat] = userLocation;
    const url = `https://router.project-osrm.org/route/v1/driving/${uLng},${uLat};${destLng},${destLat}?overview=full&geometries=geojson`;

    try {
      const res = await fetch(url);
      const data = await res.json();

      if (!data.routes || data.routes.length === 0) {
        alert("Không tìm thấy đường đi khả dụng!");
        return;
      }

      const routeGeoJSON = data.routes[0].geometry;
      const distanceKm = (data.routes[0].distance / 1000).toFixed(1);
      const durationMin = Math.round(data.routes[0].duration / 60);

      if (map.getSource("3d-route")) {
        map.getSource("3d-route").setData(routeGeoJSON);
      } else {
        map.addSource("3d-route", {
          type: "geojson",
          data: routeGeoJSON
        });

        map.addLayer({
          id: "3d-route-glow",
          type: "line",
          source: "3d-route",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: { "line-color": "#38bdf8", "line-width": 10, "line-opacity": 0.5 }
        });

        map.addLayer({
          id: "3d-route-core",
          type: "line",
          source: "3d-route",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: { "line-color": "#2563eb", "line-width": 5, "line-opacity": 0.95 }
        });
      }

      const addressEl = document.getElementById("map3dCardAddress");
      if (addressEl) {
        addressEl.innerHTML = `🚗 Tuyến đường: <strong>${distanceKm} km</strong> (~${durationMin} phút)<br>${addressEl.innerHTML}`;
      }

      const coords = routeGeoJSON.coordinates;
      const bounds = coords.reduce((b, coord) => b.extend(coord), new maplibregl.LngLatBounds(coords[0], coords[0]));
      map.fitBounds(bounds, { padding: 50, pitch: 50, duration: 2000 });

    } catch (err) {
      console.error("Lỗi vẽ đường đi:", err);
      alert("Không thể tải tuyến đường, vui lòng thử lại sau.");
    }
  }

  /* ==================== 10. MỞ & ĐÓNG MODAL ==================== */
  function open() {
    const modal = document.getElementById("mapSearchModal");
    if (!modal) return;

    modal.style.display = "flex";
    modal.classList.add("active");

    if (!isMapInitialized) {
      setTimeout(() => {
        init();
      }, 50);
    } else if (map) {
      setTimeout(() => {
        map.resize();
      }, 100);
    }
  }

  function close() {
    const modal = document.getElementById("mapSearchModal");
    if (!modal) return;

    stopOrbit();
    if (isZenMode) toggleZenMode();
    modal.style.display = "none";
    modal.classList.remove("active");
  }

  function zoomIn() {
    if (map) map.zoomIn({ duration: 300 });
  }

  function zoomOut() {
    if (map) map.zoomOut({ duration: 300 });
  }

  function escapeHtml(text) {
    if (!text) return "";
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  /* PUBLIC APIS */
  return {
    init,
    open,
    close,
    setMapStyle,
    locateUser,
    toggleOrbit,
    openStreetView,
    draw3DRoute,
    toggleSearch,
    toggleFloatingActions,
    toggleLocationCardMinimize,
    closeLocationCard,
    toggleZenMode,
    resetView,
    zoomIn,
    zoomOut
  };
})();

// Export toàn cục
window.openMapSearchModal = () => MapSearch3D.open();
window.closeMapSearchModal = () => MapSearch3D.close();
window.MapSearch = MapSearch3D;
