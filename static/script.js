// document.addEventListener("DOMContentLoaded", function () {

//     const map = L.map("map").setView([42.3601, -71.0589], 12);

//     L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
//         attribution: "&copy; OpenStreetMap &copy; CARTO"
//     }).addTo(map);

//     const stationLayer = L.layerGroup().addTo(map);

//     function updateMap() {
//         const form = document.getElementById("filter-form");
//         const query = new URLSearchParams(new FormData(form)).toString();

//         d3.json(`/data?${query}`).then(data => {
//             stationLayer.clearLayers();

//             data.forEach(d => {
//                 const isMedford = d.stop_name === 'Medford/Tufts';
//                 const avg = +d.avg_wait;
//                 const std = +d.std_dev;
//                 const count = +d.record_count;

//                 // // Medford is Yellow, others are Green (good) or Red (bad)
//                 // let color = avg > 600 ? "#ff4b4b" : "#00ff7f";
//                 // if (isMedford) color = "#ffff00";
//                 let color = "#888888";

//                 if (d.cluster_label === "Reliable Service") {
//                     color = "#00ff7f";
//                 } else if (d.cluster_label === "Moderate Issues") {
//                     color = "#ffaa00";
//                 } else if (d.cluster_label === "Unreliable Service") {
//                     color = "#ff4b4b";
//                 }

//                 //if (isMedford) color = "#ffff00";

//                 // Faded opacity for sparse data (The "Desert" effect)
//                 const opacity = count < 15 ? 0.3 : 0.8;
//                 const radius = isMedford ? 15 : (std / 1000 + 4);

//                 L.circleMarker([+d.lat, +d.lon], {
//                     radius: radius,
//                     color: isMedford ? "#ffffff" : color,
//                     fillColor: color,
//                     fillOpacity: isMedford ? 1.0 : opacity,
//                     weight: isMedford ? 3 : 1,
//                     className: isMedford ? 'medford-pulse' : ''
//                 })
//                 // .bindPopup(`
//                 //     <div style="text-align:center;">
//                 //         <b>${d.stop_name}</b><br>
//                 //         Records: ${count}<br>
//                 //         Avg Wait: ${(avg/60).toFixed(1)} min<br>
//                 //         Variability: ${(std/60).toFixed(1)} min
//                 //     </div>
//                 // `)
//                 .bindPopup(`
//                     <div style="text-align:center;">
//                         <b>${d.stop_name}</b><br>
//                         Records: ${count}<br>
//                         Avg Wait: ${(avg/60).toFixed(1)} min<br>
//                         Variability: ${(std/60).toFixed(1)} min<br>
//                         <b>Cluster:</b> ${d.cluster_label}
//                     </div>
//                 `)
//                 .addTo(stationLayer);
//             });
//         });
//     }

//     document.getElementById("filter-form").addEventListener("submit", e => {
//         e.preventDefault();
//         updateMap();
//     });

//     document.getElementById("reset").addEventListener("click", () => {
//         document.getElementById("filter-form").reset();
//         updateMap();
//     });

//     updateMap();
// });
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
            const colorMap = buildColorMap(data);

            data.forEach(d => {
                const isMedford = d.stop_name === 'Medford/Tufts';
                const avg = +d.avg_wait;
                const std = +d.std_dev;
                const count = +d.record_count;
                const color = avg > 600 ? "#ff4b4b" : "#00ff7f";
                const opacity = count < 15 ? 0.3 : 0.8;
                //const radius = isMedford ? 15 : (std / 1000 + 4);
                const radius = 4 + (std / 60) * 0.3;

                L.circleMarker([+d.lat, +d.lon], {
                    radius,
                    color: isMedford ? "#ffffff" : color,
                    fillColor: color,
                    fillOpacity: isMedford ? 1.0 : opacity,
                    weight: isMedford ? 3 : 1
                    //stopName: d.stop_name,          // <-- needed for highlight()
                    //className: isMedford ? 'medford-pulse' : ''
                })
                .bindPopup(`
                    <div style="text-align:center;">
                        <b>${d.stop_name}</b><br>
                        Records: ${count}<br>
                        Avg Wait: ${(avg/60).toFixed(1)} min<br>
                        Median Wait: ${(+d.median_wait/60).toFixed(1)} min<br>
                        Variability: ${(std/60).toFixed(1)} min<br>
                    </div>
                `)
                .on("mouseover", () => highlight(d.stop_name))
                .on("mouseout",  () => highlight(null))
                .addTo(stationLayer);
            });

            drawScatter(data, colorMap);
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


    const CLUSTER_COLORS = ["#00ff7f", "#aaff00", "#ffaa00", "#ff4b4b"];
    let highlightedStop = null;

    function buildColorMap(data) {
        const seen = {};
        data.forEach(d => { seen[d.cluster] = d.cluster_avg_wait; });
        const sorted = Object.entries(seen).sort((a, b) => a[1] - b[1]).map(e => +e[0]);
        const map = {};
        sorted.forEach((id, rank) => { map[id] = CLUSTER_COLORS[rank]; });
        return map;
    }

    function drawScatter(data, colorMap) {
        d3.select("#scatter").selectAll("*").remove();

        const margin = { top: 20, right: 20, bottom: 50, left: 55 };
        const width = document.getElementById("scatter").clientWidth - margin.left - margin.right;
        const height = 500 - margin.top - margin.bottom;

        const svg = d3.select("#scatter").append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

        const x = d3.scaleLinear()
            .domain([0, d3.max(data, d => +d.avg_wait) * 1.05])
            .range([0, width]);

        const y = d3.scaleLinear()
            .domain([0, d3.max(data, d => +d.std_dev) * 1.05])
            .range([height, 0]);

        svg.append("g").attr("transform", `translate(0,${height})`)
            .call(d3.axisBottom(x).tickFormat(d => `${(d/60).toFixed(0)}m`).ticks(5))
            .selectAll("text, line, path").style("stroke", "#ccc").style("fill", "#ccc");

        svg.append("g")
            .call(d3.axisLeft(y).tickFormat(d => `${(d/60).toFixed(0)}m`).ticks(4))
            .selectAll("text, line, path").style("stroke", "#ccc").style("fill", "#ccc");

        svg.append("text").attr("x", width / 2).attr("y", height + 40)
            .attr("text-anchor", "middle").style("fill", "#ccc").style("font-size", "14px")
            .text("Avg Wait");

        svg.append("text").attr("transform", "rotate(-90)").attr("x", -height / 2).attr("y", -42)
            .attr("text-anchor", "middle").style("fill", "#ccc").style("font-size", "14px")
            .text("Variability");

        svg.selectAll("circle").data(data).enter().append("circle")
            .attr("cx", d => x(+d.avg_wait))
            .attr("cy", d => y(+d.std_dev))
            .attr("r", 5)
            .attr("fill", d => colorMap[d.cluster] ?? "#aaa")
            .attr("opacity", 0.75)
            .attr("stroke", "#111")
            .attr("stroke-width", 1)
            .attr("data-stop", d => d.stop_name)
            .style("cursor", "pointer")
            .on("mouseover", function(event, d) { highlight(d.stop_name); })
            .on("mouseout", function() { highlight(null); });
    }

    function highlight(stopName) {
        highlightedStop = stopName;
        // Scatter dots
        d3.select("#scatter").selectAll("circle")
            .attr("opacity", d => !stopName || d.stop_name === stopName ? 1.0 : 0.15)
            .attr("r", d => d.stop_name === stopName ? 8 : 5);
        // Map markers
        stationLayer.eachLayer(layer => {
            const name = layer.options.stopName;
            layer.setStyle({
                fillOpacity: !stopName || name === stopName ? 0.9 : 0.15,
                opacity:     !stopName || name === stopName ? 1.0 : 0.2,
            });
        });
    }
    updateMap();

});