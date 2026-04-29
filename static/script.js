document.addEventListener("DOMContentLoaded", function () {

    const map = L.map("map").setView([42.3601, -71.0589], 12);

    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        attribution: "&copy; OpenStreetMap &copy; CARTO"
    }).addTo(map);

    const stationLayer = L.layerGroup().addTo(map);

    function getFilters() {
        const form = document.getElementById("filter-form");
        return new URLSearchParams(new FormData(form)).toString();
    }

    function updateMap() {
        const query = getFilters();

        d3.json(`/data?${query}`).then(data => {
            stationLayer.clearLayers();

            data.forEach(d => {
                const avg = +d.avg_wait;
                const std = +d.std_dev;

                const radius = std / 1000 + 2;
                const color = avg > 600 ? "#ff4b4b" : "#00ff7f";

                L.circleMarker([+d.lat, +d.lon], {
                    radius: radius,
                    color: color,
                    fillColor: color,
                    fillOpacity: 0.7
                })
                .bindPopup(`
                    <b>${d.stop_name}</b><br>
                    Avg: ${(avg/60).toFixed(1)} min<br>
                    Variability: ${(std/60).toFixed(1)} min
                `)
                .addTo(stationLayer);
            });
        });
    }

    document.getElementById("filter-form").addEventListener("submit", e => {
        e.preventDefault();
        updateMap();
    });

    document.getElementById("reset").addEventListener("click", () => {
        document.getElementById("filter-form").reset();
        updateMap();
    });

    updateMap();

});