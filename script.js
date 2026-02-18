document.addEventListener('DOMContentLoaded', () => {
    
    const API_URL = "https://script.google.com/macros/s/AKfycbyudJzFruCySDHW5QPwQZ8ppHiyVOqM__JOWUMJN3XICpngRwn5cd0eAe_v67zz7EBx/exec";
    let db = {};
    let scatterChart = null;
    const lineCharts = {};
    let mesActual = 1;
    const palette = ["#005d70", "#1ba29a", "#8dc63f", "#00aeef", "#e53935", "#fbc02d", "#8e44ad", "#d35400", "#2c3e50", "#16a085", "#27ae60", "#2980b9", "#c0392b", "#f39c12", "#7f8c8d"];

    function parseNum(val) {
        if (val === undefined || val === null || val === "") return 0;
        let s = val.toString().replace(',', '.').replace(/[^\d.-]/g, '');
        let n = parseFloat(s);
        return isNaN(n) ? 0 : n;
    }

    async function init() {
        try {
            const res = await fetch(API_URL);
            db = await res.json();
            populateWeeks();
            renderSidebar();
            renderCalendar();
            showMainPanel();
            document.getElementById('loader').style.display = 'none';
        } catch (e) { console.error(e); }
    }

    function populateWeeks() {
        const sel = document.getElementById('semana-select');
        let semanas = [...new Set(db.FACT_DATA.map(d => d.SEMANA))].filter(s => s);
        semanas.sort((a, b) => parseInt(a.replace('S', '')) - parseInt(b.replace('S', '')));
        semanas.forEach(s => {
            let opt = document.createElement('option');
            opt.value = s; opt.innerText = s.replace('S', '');
            sel.appendChild(opt);
        });
    }

    function updateScatterChart() {
        const ctx = document.getElementById('scatterChart').getContext('2d');
        const sem = document.getElementById('semana-select').value;
        const legendList = document.getElementById('legend-list');
        legendList.innerHTML = "";
        const filtrados = db.FACT_DATA.filter(d => d.SEMANA === sem);

        const datasets = filtrados.map((d, i) => {
            const color = palette[i % palette.length];
            const xVal = parseNum(d['KPI PRODUCTIVIDAD']);
            const yVal = parseNum(d['KPI DESEMPEÑO']);
            const nombre = d.NOMBRE || 'Sin nombre';

            legendList.innerHTML += `
                        <div class="legend-item" onclick="focusPoint(${i})">
                            <div class="color-dot" style="background:${color}"></div>
                            <span style="font-weight: bold;">${nombre}</span>
                        </div>
                    `;

            return {
                label: nombre,
                data: [{ x: xVal, y: yVal }],
                backgroundColor: color,
                pointRadius: 9,
                pointHoverRadius: 15
            };
        });

        if (scatterChart) scatterChart.destroy();
        scatterChart = new Chart(ctx, {
            type: 'scatter',
            data: { datasets },
            options: {
                maintainAspectRatio: false,
                layout: { padding: { top: 30, right: 20 } },
                scales: {
                    x: { min: -0.05, max: 1.05, title: { display: true, text: 'PRODUCTIVIDAD', font: { weight: 'bold' } }, ticks: { callback: (v) => v.toFixed(2) } },
                    y: { min: -0.05, max: 1.05, title: { display: true, text: 'DESEMPEÑO', font: { weight: 'bold' } }, ticks: { callback: (v) => v.toFixed(2) } }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: { callbacks: { label: (item) => `${item.dataset.label}: Prod ${item.raw.x.toFixed(2)}, Des ${item.raw.y.toFixed(2)}` } },
                    datalabels: { anchor: 'end', align: 'top', offset: 5, color: (ctx) => ctx.dataset.backgroundColor, font: { weight: 'bold', size: 10 }, formatter: (val, ctx) => ctx.dataset.label }
                }
            },
            plugins: [ChartDataLabels]
        });
    }

    function focusPoint(index) {
        if (!scatterChart) return;
        scatterChart.setActiveElements([{ datasetIndex: index, index: 0 }]);
        scatterChart.tooltip.setActiveElements([{ datasetIndex: index, index: 0 }], { x: 0, y: 0 });
        scatterChart.update();
    }

    // --- NAVEGACIÓN PANEL PRINCIPAL ---
    function showMainPanel() {
        document.getElementById('view-main').classList.add('active');
        document.getElementById('view-individual').classList.remove('active');

        // LOGICA TITULO PRINCIPAL
        document.getElementById('display-title').innerText = "TOP GRADING";
        document.getElementById('display-subtitle').innerText = ""; // Vacio
        document.getElementById('display-subtitle').style.display = "none";

        updateScatterChart();
    }

    // --- NAVEGACIÓN PANEL INDIVIDUAL ---
    function showIndividualPanel(n, p) {
        document.getElementById('view-main').classList.remove('active');
        document.getElementById('view-individual').classList.add('active');

        // NOMBRE DEL COLABORADOR
        document.getElementById('display-title').innerText = n;

        // FORMATO SUBTITULO: AREA DE ... | ROL
        const area = (p['AREA '] || p['AREA'] || '').trim().toUpperCase();
        const rol = (p['ROL'] || '').trim().toUpperCase();

        const areaTxt = area ? `AREA DE ${area}` : "SIN AREA";
        const rolTxt = rol ? ` | ${rol}` : "";

        document.getElementById('display-subtitle').style.display = "block";
        document.getElementById('display-subtitle').innerText = `${areaTxt}${rolTxt}`;

        // Cargar Datos
        const buscar = (tab, col) => (db[tab] || []).find(f => (f[col] || '').trim().toLowerCase() === n.trim().toLowerCase()) || {};
        document.getElementById('txt-amon').innerText = buscar('FACT_AMONESTACIONES', 'NOMBRES')['AMONESTACIONES TOTALES'] || 0;
        document.getElementById('txt-estrellas').innerText = buscar('FACT_ESTRELLAS', 'NOMBRE')['ESTRELLAS GANADAS'] || 0;

        const sems = ['S1', 'S2', 'S3', 'S4', 'S5', 'S6'];
        renderLine('chart1', buscar('FACT_PUNTUALIDAD', ''), sems, '#005d70');
        renderLine('chart2', buscar('FACT_AUTOAPRENDIZAKE', ''), sems, '#1ba29a');
        renderLine('chart3', buscar('FACT_FEEDBACK', ''), sems, '#8dc63f');
        renderLine('chart4', buscar('FACT_QQC', ''), sems, '#00aeef');
    }

    function moverMes(d) { mesActual = (mesActual + d + 12) % 12; renderCalendar(); }
    function renderCalendar() {
        const cuerpo = document.getElementById('cal-cuerpo');
        const nombres = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
        document.getElementById('cal-mes').innerText = nombres[mesActual] + " 2026";
        cuerpo.innerHTML = "";
        const primerDia = new Date(2026, mesActual, 1).getDay();
        const diasEnMes = new Date(2026, mesActual + 1, 0).getDate();
        for (let i = 0; i < primerDia; i++) {
            let d = document.createElement('div'); d.className = "day-box empty"; cuerpo.appendChild(d);
        }
        for (let i = 1; i <= diasEnMes; i++) {
            let d = document.createElement('div'); d.className = "day-box"; d.innerText = i; cuerpo.appendChild(d);
        }
    }

    function renderLine(id, row, labels, color) {
        const ctx = document.getElementById(id).getContext('2d');
        const data = labels.map(s => parseNum(row[s]));
        if (lineCharts[id]) lineCharts[id].destroy();
        lineCharts[id] = new Chart(ctx, {
            type: 'line',
            data: { labels, datasets: [{ data, borderColor: color, backgroundColor: color + '15', fill: true, tension: 0.4 }] },
            options: { maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { min: 0, max: 1.1, display: false }, x: { grid: { display: false }, ticks: { font: { size: 9 } } } } }
        });
    }

    function renderSidebar() {
        const cont = document.getElementById('lista-participantes');
        cont.innerHTML = "";
        db.DIM_COLABORADORES.forEach(p => {
            const n = p['NOMBRES Y APELLIDOS'];
            const d = document.createElement('div'); d.className = "nav-link"; d.innerHTML = `👤 ${n}`;
            d.onclick = () => {
                document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
                d.classList.add('active'); showIndividualPanel(n, p);
            };
            cont.appendChild(d);
        });
    }

    function toggleSidebar() {
        document.getElementById('sidebar').classList.toggle('hidden');
        document.getElementById('main-content').classList.toggle('expanded');
    }

    init();

});
