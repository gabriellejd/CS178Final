document.addEventListener("DOMContentLoaded", function () {

    const map = L.map("map").setView([42.3601, -71.0589], 12);

    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        attribution: "&copy; OpenStreetMap &copy; CARTO"
    }).addTo(map);

    const stationLayer = L.layerGroup().addTo(map);

    function updateMap() {
        const form = document.getElementById("filter-form");
        const query = new URLSearchParams(new FormData(form)).toString();

        d3.json(`/data?${query}`).then(data => {
            stationLayer.clearLayers();

            data.forEach(d => {
                const isMedford = d.stop_name === 'Medford/Tufts';
                const avg = +d.avg_wait;
                const std = +d.std_dev;
                const count = +d.record_count;

                // Medford is Yellow, others are Green (good) or Red (bad)
                let color = avg > 600 ? "#ff4b4b" : "#00ff7f";
                if (isMedford) color = "#ffff00";

                // Faded opacity for sparse data (The "Desert" effect)
                const opacity = count < 15 ? 0.3 : 0.8;
                const radius = isMedford ? 15 : (std / 1000 + 4);

                L.circleMarker([+d.lat, +d.lon], {
                    radius: radius,
                    color: isMedford ? "#ffffff" : color,
                    fillColor: color,
                    fillOpacity: isMedford ? 1.0 : opacity,
                    weight: isMedford ? 3 : 1,
                    className: isMedford ? 'medford-pulse' : ''
                })
                .bindPopup(`
                    <div style="text-align:center;">
                        <b>${d.stop_name}</b><br>
                        Records: ${count}<br>
                        Avg Wait: ${(avg/60).toFixed(1)} min<br>
                        Variability: ${(std/60).toFixed(1)} min
                    </div>
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