// --- Global Variables ---
let map;
let wmsLayer;
let stationsData = []; 
let historyChart = null; 

// Daftar Station ID dan Label yang diminta (value: label)
// Kita tetap gunakan ini untuk dropdown Historical agar urutan dan label konsisten
const stationLabels = {
    "IBALAN23": "CSA HW6",
    "ITABAL9": "ROM 19",
    "ITABAL8": "ROM 20",
    "IBALAN17": "ROM 13",     
    "ITABAL14": "VP SABANG",
    "IBALAN16": "ROM 06",
    "ITABAL11": "ROM 09",     
    "ITABAL1": "LW BUMA",
    "ITABAL16": "VP KOMODO",
    "ITABAL5": "SP 2C WARA", 
    "ITABAL13": "SP 2C WARA", 
    "ITABAL12": "SP 3 WARA",
    "ITABAL15": "WCC",  
    "IBALAN22": "LAB PRG",
    "ITABAL10": "KM 67",    
    "ITABAL21": "KM 50",
    "ITABAL18": "KM 43",
    "IEASTB11": "KM 35",
    "IEASTB117": "KM 29",
    "IEASTB118": "KM 10",
    "ISOUTH1402": "QCKLS"
};
const targetStations = Object.keys(stationLabels); 

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    initMap();
    loadStationData();
    populateHistoricalDropdown(); 
    startRadarUpdater();
    switchTab('current');
});

// --- Tab Logic ---
function switchTab(tabName) {
    document.querySelectorAll('.page-section').forEach(el => el.classList.add('hidden'));
    document.getElementById(`page-${tabName}`).classList.remove('hidden');

    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('text-emerald-600', 'border-emerald-600');
        btn.classList.add('text-gray-500', 'border-transparent');
    });
    const activeBtn = document.getElementById(`tab-${tabName}`);
    activeBtn.classList.add('text-emerald-600', 'border-emerald-600');
    activeBtn.classList.remove('text-gray-500', 'border-transparent');

    if(tabName === 'current' && map) map.invalidateSize();
}

// --- Map & WMS Logic ---
function initMap() {
    map = L.map('map').setView([-2.2, 115.5], 10);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);
    updateWMSLayer();
}

function getWMSTimestamp() {
    const now = new Date();
    // Gunakan waktu UTC untuk logic rounding 5 menit
    const utcMin = now.getUTCMinutes();
    const remainder = utcMin % 10;
    const roundedMin = utcMin - remainder;
    now.setUTCMinutes(roundedMin);
    
    // Format untuk URL WMS (Harus tetap UTC agar sesuai nama layer BMKG)
    const yearUTC = now.getUTCFullYear();
    const monthUTC = String(now.getUTCMonth() + 1).padStart(2, '0');
    const dayUTC = String(now.getUTCDate()).padStart(2, '0');
    const hourUTC = String(now.getUTCHours()).padStart(2, '0');
    const minuteUTC = String(now.getUTCMinutes()).padStart(2, '0');

    // Format untuk Display Label (Gunakan Local Time)
    const yearLocal = now.getFullYear();
    const monthLocal = String(now.getMonth() + 1).padStart(2, '0');
    const dayLocal = String(now.getDate()).padStart(2, '0');
    const hourLocal = String(now.getHours()).padStart(2, '0');
    const minuteLocal = String(now.getMinutes()).padStart(2, '0');

    return {
        str: `${yearUTC}${monthUTC}${dayUTC}${hourUTC}${minuteUTC}`,
        display: `${dayLocal}-${monthLocal}-${yearLocal} ${hourLocal}:${minuteLocal} WITA`
    };
}
function updateWMSLayer() {
    const timeData = getWMSTimestamp();
    const layerName = `sidarma_mosaic_cmax:Indonesia_${timeData.str}`;
    document.getElementById('radar-timestamp').innerText = `Radar Time: ${timeData.display}`;

    if (wmsLayer) map.removeLayer(wmsLayer);

    wmsLayer = L.tileLayer.wms("https://radar.bmkg.go.id/sidarmageoserver", {
        layers: layerName,
        format: 'image/png',
        transparent: true,
        version: '1.1.0',
        styles: 'CMAX_dBZ',
        attribution: 'BMKG Radar',
        //opacity: 0.3 // Transparansi 70% (Opacity 30%)
    });
    wmsLayer.setOpacity(0.5);
    wmsLayer.addTo(map);
}

function startRadarUpdater() {
    setInterval(updateWMSLayer, 300000); // 5 menit
}

// --- Data Fetching & Processing ---

async function loadStationData() {
    try {
        // [MODIFIKASI] Source diganti ke stations.geojson
        const response = await fetch(`./data/stations.geojson?t=${new Date().getTime()}`);
        const geojson = await response.json();
        stationsData = geojson.features;

        // 1. Plot Station di Peta dengan Label
        L.geoJSON(geojson, {
            // Hanya plot station yang ada di targetStations (optional filter)
            // Note: Pastikan stations.geojson memiliki property stationID (case sensitive)
            filter: function(feature, layer) {
                // stations.geojson menggunakan properti "stationID" (uppercase ID)
                return targetStations.includes(feature.properties.stationID);
            },
            pointToLayer: function (feature, latlng) {
                return L.circleMarker(latlng, {
                    radius: 6,
                    fillColor: "#ff7800",
                    color: "#000",
                    weight: 1,
                    opacity: 1,
                    fillOpacity: 0.8
                });
            },
            onEachFeature: function (feature, layer) {
                // [MODIFIKASI] Label dari properti location
                if (feature.properties && feature.properties.location) {
                    // Tooltip (Label Permanen)
                    layer.bindTooltip(feature.properties.location, {
                        permanent: true,     
                        direction: 'top',    
                        className: 'map-label' 
                    });
                    
                    // Popup detail saat diklik
                    // Note: stations.geojson propertynya stationID, bukan stationId
                    layer.bindPopup(`
                        <b>${feature.properties.location}</b><br>
                        ID: ${feature.properties.stationID}
                    `);
                }
            }
        }).addTo(map);

        // Load Dashboard Cards
        loadCurrentDashboard();

    } catch (error) {
        console.error("Gagal memuat stations.geojson", error);
    }
}

// Populate Dropdown Historical
function populateHistoricalDropdown() {
    const select = document.getElementById('station-select');
    
    for (const id in stationLabels) {
        const label = stationLabels[id];
        const opt = document.createElement('option');
        opt.value = id;
        opt.text = `${label} (${id})`; 
        select.appendChild(opt);
    }

    select.addEventListener('change', (e) => {
        if(e.target.value) loadHistoricalChart(e.target.value);
    });
}

// Dashboard Current
async function loadCurrentDashboard() {
    const container = document.getElementById('station-cards');
    container.innerHTML = ''; 
    
    const loopData = targetStations.map(id => ({ 
        stationId: id, 
        station: stationLabels[id],
        location: stationLabels[id] 
    }));

    const cardPromises = loopData.map(async (props) => {
        const stationId = props.stationId;
        const stationName = props.station;
        
        let lastData = { time: '-', rate: 'N/A', total: 'N/A' };
        let statusColor = 'bg-gray-100 border-gray-300'; 
        
        if (stationId) {
            try {
                const res = await fetch(`./data/${stationId}.csv?t=${new Date().getTime()}`);
                if(res.ok) {
                    const text = await res.text();
                    const lines = text.trim().split('\n');
                    if(lines.length > 1) {
                        const lastLine = lines[lines.length - 1];
                        const parts = lastLine.split(','); 
                        
                        // [MODIFIKASI] Parsing CSV: datetime, precipRate, precipTotal
                        const dt = parts[0];
                        const rate = parts[1]; 
                        const total = parts[2]; // Kolom ke-3
                        
                        lastData.time = dt;
                        lastData.rate = rate && !isNaN(parseFloat(rate)) ? parseFloat(rate).toFixed(1) : '0.0';
                        lastData.total = total && !isNaN(parseFloat(total)) ? parseFloat(total).toFixed(1) : '0.0';

                        const rateVal = parseFloat(rate);
                        if (!isNaN(rateVal)) {
                            if (rateVal === 0) statusColor = 'bg-white border-green-200';
                            else if (rateVal < 5) statusColor = 'bg-blue-50 border-blue-300';
                            else if (rateVal < 20) statusColor = 'bg-yellow-50 border-yellow-300';
                            else statusColor = 'bg-red-50 border-red-500';
                        }
                    }
                }
            } catch (e) {
                // Ignore
            }
        }

        return `
            <div class="rounded-lg border-l-4 shadow-sm p-4 flex flex-col justify-between ${statusColor}">
                <div>
                    <h3 class="font-bold text-slate-800 text-lg">${stationName}</h3>
                    <p class="text-xs text-slate-500 mb-2">ID: ${stationId}</p>
                </div>
                <div class="mt-2">
                    <div class="flex items-end justify-between">
                        <div>
                            <div class="flex items-end">
                                <span class="text-3xl font-bold text-slate-700">${lastData.rate}</span>
                                <span class="text-sm font-medium text-slate-500 mb-1 ml-1">mm/hr</span>
                            </div>
                        </div>
                        <div class="text-right">
                             <div class="flex flex-col items-end">
                                <span class="text-xs text-gray-500 uppercase tracking-wider">Daily</span>
                                <span class="text-lg font-bold text-slate-600">${lastData.total} <span class="text-xs font-normal">mm</span></span>
                            </div>
                        </div>
                    </div>
                    <p class="text-xs text-gray-400 mt-2 border-t pt-1 text-right">${lastData.time}</p>
                </div>
            </div>
        `;
    });

    const cardsHTML = await Promise.all(cardPromises);
    container.innerHTML = cardsHTML.join('');
}

// --- Historical Chart Logic (API FETCH) ---
async function loadHistoricalChart(stationId) {
    if (!stationId) return;
    
    // API URL
    const apiKey = 'e1f10a1e78da46f5b10a1e78da96f525';
    const url = `https://api.weather.com/v2/pws/dailysummary/7day?stationId=${stationId}&format=json&units=m&apiKey=${apiKey}`;

    const ctx = document.getElementById('historyChart').getContext('2d');
    if (historyChart) historyChart.destroy();
    
    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error("API Request Failed");
        
        const json = await res.json();
        
        if (!json.summaries) throw new Error("No Data");

        const labels = [];
        const dataPoints = [];

        json.summaries.forEach(day => {
            labels.push(day.obsTimeLocal.split(' ')[0]); 
            dataPoints.push(day.metric.precipTotal);     
        });

        const chartLabel = stationLabels[stationId] || stationId;
        renderChart(chartLabel, labels, dataPoints);

    } catch (e) {
        console.error(e);
        console.error(`Gagal mengambil data dari API Weather.com untuk station ${stationId}.`);
    }
}

function renderChart(label, labels, data) {
    const ctx = document.getElementById('historyChart').getContext('2d');

    historyChart = new Chart(ctx, {
        type: 'bar', 
        data: {
            labels: labels,
            datasets: [{
                label: `Daily Precipitation (mm/day) - ${label}`,
                data: data,
                backgroundColor: 'rgba(16, 185, 129, 0.6)', 
                borderColor: 'rgb(16, 185, 129)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    title: { display: true, text: 'Rainfall (mm)' }
                }
            },
            plugins: {
                title: {
                    display: true,
                    text: '7-Day Summary'
                }
            }
        }
    });
}

