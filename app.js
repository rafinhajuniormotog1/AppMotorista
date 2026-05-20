// --- 1. DEFINIÇÃO DE VARIÁVEIS GLOBAIS DE ESTADO ---
var periodoAtual = 'semanal';
var dataBaseAncoragem = new Date();
var configsFixas = { media_km_litro: 10, preco_combustivel: 3.66 };
var dadosDoBanco = [];
var supabaseClient = null;
var somaMetasCustomizadasDoBanco = 3000.00;

var cBarras = null, cPizzaF = null, cPizzaG = null, cGastosBarras = null;

// --- 2. INICIALIZADOR SEGURO DO CLIENTE SUPABASE ---
function obterClienteSupabase() {
    if (supabaseClient) return supabaseClient;
    if (typeof SUPABASE_URL === 'undefined' || SUPABASE_URL.includes("SUA_URL_AQUI") || !SUPABASE_URL.startsWith("http")) return null;
    supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    return supabaseClient;
}

// --- 3. MÓDULO: CONFIGURAÇÕES FIXAS ---
async function configurarPainelConfigFixo() {
    const client = obterClienteSupabase();
    if (!client) return;
    try {
        const { data } = await client.from('configuracoes').select('*').eq('id', 1).single();
        if (data) {
            configsFixas = data;
            document.getElementById('cfg-media').value = data.media_km_litro;
            document.getElementById('cfg-preco').value = data.preco_combustivel;
        }
    } catch (e) { console.error(e); }
}

async function gravarConfiguracoesNuvem() {
    const client = obterClienteSupabase();
    if (!client) return;
    const media = parseFloat(document.getElementById('cfg-media').value) || 10;
    const preco = parseFloat(document.getElementById('cfg-preco').value) || 3.66;
    await client.from('configuracoes').upsert({ id: 1, media_km_litro: media, preco_combustivel: preco }, { onConflict: 'id' });
    alert("Parâmetros mecânicos updated!");
    window.parent.trocarDeAba('dashboard');
}

// --- 4. MÓDULO: LANÇAMENTO DIÁRIO (ATUALIZADO COM HORAS) ---
function configurarFormLancamento() {
    const campo = document.getElementById('campo-data');
    if(campo) {
        const hojeLocal = new Date();
        campo.value = `${hojeLocal.getFullYear()}-${String(hojeLocal.getMonth() + 1).padStart(2, '0')}-${String(hojeLocal.getDate()).padStart(2, '0')}`;
    }
    document.getElementById('form-lancamento').addEventListener('submit', async (e) => {
        e.preventDefault();
        const client = obterClienteSupabase();
        if (!client) return;
        const payload = {
            data: document.getElementById('campo-data').value,
            faturamento_uber: parseFloat(document.getElementById('val-uber').value) || 0,
            faturamento_99: parseFloat(document.getElementById('val-99').value) || 0,
            faturamento_particular: parseFloat(document.getElementById('val-particular').value) || 0,
            km_rodado: parseFloat(document.getElementById('val-km').value) || 0,
            horas_trabalhadas: parseFloat(document.getElementById('val-horas').value) || 0,
            gasto_alimento: parseFloat(document.getElementById('val-alimento').value) || 0,
            gasto_pedagio: parseFloat(document.getElementById('val-pedagio').value) || 0
        };
        await client.from('ganhos_gastos').upsert(payload, { onConflict: 'data' });
        alert("Lançamento inteligente salvo!");
        window.parent.trocarDeAba('dashboard');
    });
}

// --- 5. MÓDULO: DASHBOARD E FILTROS DE DATA ---
async function inicializarModuloDashboard() {
    const client = obterClienteSupabase();
    if (client) {
        const { data } = await client.from('configuracoes').select('*').eq('id', 1).single();
        if (data) configsFixas = data;
    }
    await processarFiltrosETelas();
}

async function alterarFiltro(tipo) {
    periodoAtual = tipo;
    dataBaseAncoragem = new Date();
    ['diario', 'semanal', 'mensal'].forEach(p => {
        const btn = document.getElementById(`btn-${p}`);
        if(btn) btn.className = "py-2 rounded-lg text-gray-500 transition";
    });
    document.getElementById(`btn-${tipo}`).className = "py-2 rounded-lg bg-white text-gray-900 shadow-sm transition";
    await processarFiltrosETelas();
}

async function navegarData(direcao) {
    if (periodoAtual === 'diario') dataBaseAncoragem.setDate(dataBaseAncoragem.getDate() + direcao);
    else if (periodoAtual === 'semanal') dataBaseAncoragem.setDate(dataBaseAncoragem.getDate() + (direcao * 7));
    else if (periodoAtual === 'mensal') dataBaseAncoragem.setMonth(dataBaseAncoragem.getMonth() + direcao);
    await processarFiltrosETelas();
}

async function definirDataEspecifica(dataTexto) {
    dataBaseAncoragem = new Date(dataTexto + 'T12:00:00');
    await processarFiltrosETelas();
}

async function definirMesEspecificoComSemanas(numeroMes) {
    periodoAtual = 'semanal'; 
    dataBaseAncoragem = new Date(dataBaseAncoragem.getFullYear(), numeroMes, 1, 12, 0, 0);
    await processarFiltrosETelas();
}

async function definirMesEspecificoFixo(numeroMes) {
    dataBaseAncoragem = new Date(dataBaseAncoragem.getFullYear(), numeroMes, 1, 12, 0, 0);
    await processarFiltrosETelas();
}

function formatarDataISO(instanciaData) {
    return `${instanciaData.getFullYear()}-${String(instanciaData.getMonth() + 1).padStart(2, '0')}-${String(instanciaData.getDate()).padStart(2, '0')}`;
}

function gerarSemanasDoMesCorrente(dataAlvo) {
    const ano = dataAlvo.getFullYear();
    const mes = dataAlvo.getMonth();
    const primeiroDiaMes = new Date(ano, mes, 1);
    const ultimoDiaMes = new Date(ano, mes + 1, 0);
    let semanas = [];
    let ponteiro = new Date(primeiroDiaMes);
    const diaSemana = ponteiro.getDay();
    ponteiro.setDate(ponteiro.getDate() + (diaSemana === 0 ? -6 : 1 - diaSemana));
    while(ponteiro <= ultimoDiaMes) {
        const seg = new Date(ponteiro);
        const dom = new Date(seg); dom.setDate(seg.getDate() + 6);
        semanas.push({ dataReferencia: formatarDataISO(seg), textoVisual: `${seg.toLocaleDateString('pt-BR', {day:'2-digit', month:'2-digit'})} até ${dom.toLocaleDateString('pt-BR', {day:'2-digit', month:'2-digit'})}` });
        ponteiro.setDate(ponteiro.getDate() + 7);
    }
    return semanas;
}

async function processarFiltrosETelas() {
    let ini, fim, textoTopo;
    let listaSemanasCalculadas = gerarSemanasDoMesCorrente(dataBaseAncoragem);
    let dataInicioSemanaAtivaStr = "";
    
    if (periodoAtual === 'diario') {
        ini = formatarDataISO(dataBaseAncoragem); fim = ini;
        textoTopo = dataBaseAncoragem.toLocaleDateString('pt-BR', {day:'2-digit', month:'short'});
    } else if (periodoAtual === 'semanal') {
        const c = new Date(dataBaseAncoragem);
        const diaSemana = c.getDay();
        const seg = new Date(c); seg.setDate(c.getDate() + (diaSemana === 0 ? -6 : 1 - diaSemana));
        const dom = new Date(seg); dom.setDate(seg.getDate() + 6);
        ini = formatarDataISO(seg); fim = formatarDataISO(dom);
        dataInicioSemanaAtivaStr = ini; textoTopo = ""; 
    } else {
        ini = formatarDataISO(new Date(dataBaseAncoragem.getFullYear(), dataBaseAncoragem.getMonth(), 1));
        fim = formatarDataISO(new Date(dataBaseAncoragem.getFullYear(), dataBaseAncoragem.getMonth() + 1, 0));
        textoTopo = dataBaseAncoragem.toLocaleDateString('pt-BR', {month:'long'});
    }

    if (window.parent && typeof window.parent.atualizarTextoDataTopo === 'function') {
        window.parent.atualizarTextoDataTopo(textoTopo, periodoAtual, dataBaseAncoragem.getMonth(), listaSemanasCalculadas, dataInicioSemanaAtivaStr);
    }

    const client = obterClienteSupabase();
    if (client) {
        // 1. Puxa os dados de ganhos e gastos da tabela
        const { data } = await client.from('ganhos_gastos').select('*').gte('data', ini).lte('data', fim).order('data', { ascending: true });
        dadosDoBanco = data || [];

        // 2. ORDEM CORRIGIDA COM AWAIT: Espera as metas carregarem antes de mandar o app calcular tudo
        if (periodoAtual === 'mensal') {
            const { data: metaMensalSalva } = await client.from('metas_mensais').select('valor_meta').eq('mes_index', dataBaseAncoragem.getMonth()).maybeSingle();
            somaMetasCustomizadasDoBanco = metaMensalSalva ? parseFloat(metaMensalSalva.valor_meta) : 12000.00;
        } else {
            const { data: metas } = await client.from('metas_diarias').select('valor_meta').gte('data', ini).lte('data', fim);
            
            let somaMeta = 0;
            if (metas && metas.length > 0) {
                metas.forEach(m => somaMeta += parseFloat(m.valor_meta));
                let diasNoPeriodo = (periodoAtual === 'diario') ? 1 : 7;
                let diasFaltantes = diasNoPeriodo - metas.length;
                if (diasFaltantes > 0) {
                    let padrao = (periodoAtual === 'diario') ? 500.00 : 428.57;
                    somaMeta += (diasFaltantes * padrao);
                }
            } else {
                somaMeta = (periodoAtual === 'diario') ? 500.00 : 3000.00;
            }
            somaMetasCustomizadasDoBanco = somaMeta;
        }
    }
    
    // Dispara a montagem das telas só após a variável "somaMetasCustomizadasDoBanco" estar totalmente preenchida
    montarMatematicaEGraficos();
}

// --- 6. PROCESSAMENTO DE LAYOUTS E GRÁFICOS PERSONALIZADOS ---
function montarMatematicaEGraficos() {
    let u = 0, p99 = 0, part = 0, alim = 0, ped = 0, comb = 0, kmTotal = 0, horasTotal = 0;
    
    let labelsFaturamento = [];
    let valoresFaturamento = [];
    
    let dadosCombustivelBarras = [];
    let dadosAlimentoBarras = [];
    let dadosPedagioBarras = [];
    let labelsGastosBarras = [];

    let semanasDoMes = gerarSemanasDoMesCorrente(dataBaseAncoragem);
    let faturamentoPorSemana = semanasDoMes.map(() => 0);
    let combPorSemana = semanasDoMes.map(() => 0);
    let alimPorSemana = semanasDoMes.map(() => 0);
    let pedPorSemana = semanasDoMes.map(() => 0);

    const diasDaSemanaTexto = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

    dadosDoBanco.forEach(i => {
        const ub = parseFloat(i.faturamento_uber) || 0;
        const p9 = parseFloat(i.faturamento_99) || 0;
        const pt = parseFloat(i.faturamento_particular) || 0;
        const al = parseFloat(i.gasto_alimento) || 0;
        const pd = parseFloat(i.gasto_pedagio) || 0;
        const km = parseFloat(i.km_rodado) || 0;
        const hr = parseFloat(i.horas_trabalhadas) || 0;
        
        u += ub; p99 += p9; part += pt; alim += al; ped += pd; kmTotal += km; horasTotal += hr;
        
        const media = configsFixas.media_km_litro > 0 ? configsFixas.media_km_litro : 10;
        const cbDia = (km / media) * configsFixas.preco_combustivel;
        comb += cbDia;

        const partesData = i.data.split('-');
        const dataObjeto = new Date(parseInt(partesData[0]), parseInt(partesData[1]) - 1, parseInt(partesData[2]), 12, 0, 0);

        if (periodoAtual === 'semanal') {
            labelsFaturamento.push(diasDaSemanaTexto[dataObjeto.getDay()]);
            valoresFaturamento.push(ub + p9 + pt);

            labelsGastosBarras.push(diasDaSemanaTexto[dataObjeto.getDay()]);
            dadosCombustivelBarras.push(cbDia);
            dadosAlimentoBarras.push(al);
            dadosPedagioBarras.push(pd);
        } 
        else if (periodoAtual === 'mensal') {
            semanasDoMes.forEach((sem, idx) => {
                const partesSem = sem.dataReferencia.split('-');
                const dataInicioSemana = new Date(parseInt(partesSem[0]), parseInt(partesSem[1]) - 1, parseInt(partesSem[2]), 12, 0, 0);
                
                const dataFimSemana = new Date(dataInicioSemana);
                dataFimSemana.setDate(dataFimSemana.getDate() + 6);
                
                if (dataObjeto >= dataInicioSemana && dataObjeto <= dataFimSemana) {
                    faturamentoPorSemana[idx] += (ub + p9 + pt);
                    combPorSemana[idx] += cbDia;
                    alimPorSemana[idx] += al;
                    pedPorSemana[idx] += pd;
                }
            });
        } 
        else {
            labelsFaturamento.push(`${partesData[2]}/${partesData[1]}`);
            valoresFaturamento.push(ub + p9 + pt);
        }
    });

    if (periodoAtual === 'mensal') {
        semanasDoMes.forEach((sem, idx) => {
            labelsFaturamento.push(`Semana ${idx + 1}`);
            valoresFaturamento.push(faturamentoPorSemana[idx]);

            labelsGastosBarras.push(`Semana ${idx + 1}`);
            dadosCombustivelBarras.push(combPorSemana[idx]);
            dadosAlimentoBarras.push(alimPorSemana[idx]);
            dadosPedagioBarras.push(pedPorSemana[idx]);
        });
    }

    const bruto = u + p99 + part;
    const gastos = alim + ped + comb;
    const lucro = bruto - gastos;

    // --- REESTRUTURAÇÃO DINÂMICA DO PAINEL DE MÉTRICAS OPERACIONAIS DO TOPO ---
    const containerMetricas = document.getElementById('painel-metricas-topo');
    if (containerMetricas) {
        if (periodoAtual === 'diario') {
            const mediaPorKm = kmTotal > 0 ? (bruto / kmTotal) : 0;
            const mediaPorHora = horasTotal > 0 ? (bruto / horasTotal) : 0;

            containerMetricas.className = "grid grid-cols-2 gap-3";
            containerMetricas.innerHTML = `
                <div class="bg-white p-3 rounded-2xl shadow-sm border border-gray-100 text-center">
                    <span class="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">KM Rodado</span>
                    <h3 class="text-base font-black text-gray-900 mt-0.5">${kmTotal.toFixed(1).replace('.', ',')} km</h3>
                </div>
                <div class="bg-white p-3 rounded-2xl shadow-sm border border-gray-100 text-center">
                    <span class="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Média R$/KM</span>
                    <h3 class="text-base font-black text-emerald-600 mt-0.5">R$ ${mediaPorKm.toFixed(2).replace('.', ',')}</h3>
                </div>
                <div class="bg-white p-3 rounded-2xl shadow-sm border border-gray-100 text-center">
                    <span class="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Horas Trab.</span>
                    <h3 class="text-base font-black text-gray-900 mt-0.5">${horasTotal.toFixed(1).replace('.', ',')} h</h3>
                </div>
                <div class="bg-white p-3 rounded-2xl shadow-sm border border-gray-100 text-center">
                    <span class="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Faturamento/H</span>
                    <h3 class="text-base font-black text-blue-600 mt-0.5">R$ ${mediaPorHora.toFixed(2).replace('.', ',')}</h3>
                </div>
            `;
        } else {
            containerMetricas.className = "grid grid-cols-2 gap-3";
            containerMetricas.innerHTML = `
                <div class="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 text-center">
                    <span class="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">KM no Período</span>
                    <h3 class="text-xl font-black text-gray-900 mt-0.5">${kmTotal.toFixed(1).replace('.', ',')} km</h3>
                </div>
                <div class="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 text-center">
                    <span class="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">Horas no Período</span>
                    <h3 class="text-xl font-black text-gray-900 mt-0.5">${horasTotal.toFixed(1).replace('.', ',')} h</h3>
                </div>
            `;
        }
    }

    // Atualização dos Cards Financeiros Principais
    const txtFaturamento = document.getElementById('txt-faturamento-total');
    if (txtFaturamento) txtFaturamento.innerText = "R$ " + bruto.toFixed(2).replace('.',',');
    const txtGastos = document.getElementById('txt-gastos-total');
    if (txtGastos) txtGastos.innerText = "R$ " + gastos.toFixed(2).replace('.',',');
    const txtLucro = document.getElementById('txt-lucro-total');
    if (txtLucro) txtLucro.innerText = "R$ " + lucro.toFixed(2).replace('.',',');

    // Definição da variável fb com trava de segurança anti-divisão por zero
    const fb = bruto || 1;

    const fPart = document.getElementById('legenda-part-valor');
    if(fPart) fPart.innerText = ((part/fb)*100).toFixed(0) + "%";
    const f99 = document.getElementById('legenda-99-valor');
    if(f99) f99.innerText = ((p99/fb)*100).toFixed(0) + "%";
    const fUber = document.getElementById('legenda-uber-valor');
    if(fUber) fUber.innerText = ((u/fb)*100).toFixed(0) + "%";

    // Cálculo e renderização da Meta de Faturamento Bruto Real do Banco
    const metaAlvo = somaMetasCustomizadasDoBanco;
    const pMeta = Math.min((bruto / metaAlvo) * 100, 100).toFixed(0);
    
    const txtPorc = document.getElementById('txt-meta-porcentagem');
    if(txtPorc) txtPorc.innerText = pMeta + "% batida";
    const bProgresso = document.getElementById('barra-meta-progresso');
    if(bProgresso) bProgresso.style.width = pMeta + "%";
    const txtAlvo = document.getElementById('txt-meta-alvo');
    if(txtAlvo) txtAlvo.innerText = "Alvo Bruto: R$ " + metaAlvo.toFixed(2).replace('.', ',');
    const txtAtual = document.getElementById('txt-meta-atual');
    if(txtAtual) txtAtual.innerText = "Faturado: R$ " + bruto.toFixed(2).replace('.', ',');

    if (periodoAtual === 'diario') {
        const gBarras = document.getElementById('container-grafico-barras');
        if(gBarras) gBarras.classList.add('hidden');
        const gPizza = document.getElementById('container-gastos-pizza');
        if(gPizza) gPizza.classList.remove('hidden');
        const gGBar = document.getElementById('container-gastos-barras');
        if(gGBar) gGBar.classList.add('hidden');
        
        const bFat = document.getElementById('badge-faturamento-tipo');
        if(bFat) bFat.innerText = "Hoje";
        const bMeta = document.getElementById('badge-meta-tipo');
        if(bMeta) bMeta.innerText = "Meta Diária Faturamento";

        const lComb = document.getElementById('legenda-comb-valor');
        if(lComb) lComb.innerText = "R$ " + comb.toFixed(2).replace('.',',');
        const lAlim = document.getElementById('legenda-alim-valor');
        if(lAlim) lAlim.innerText = "R$ " + alim.toFixed(2).replace('.',',');
        const lPed = document.getElementById('legenda-ped-valor');
        if(lPed) lPed.innerText = "R$ " + ped.toFixed(2).replace('.',',');
    } else {
        const gBarras = document.getElementById('container-grafico-barras');
        if(gBarras) gBarras.classList.remove('hidden');
        const gPizza = document.getElementById('container-gastos-pizza');
        if(gPizza) gPizza.classList.add('hidden');
        const gGBar = document.getElementById('container-gastos-barras');
        if(gGBar) gGBar.classList.add('hidden');
        
        const bFat = document.getElementById('badge-faturamento-tipo');
        const bMeta = document.getElementById('badge-meta-tipo');
        if (periodoAtual === 'semanal') {
            if(bFat) bFat.innerText = "Semana";
            if(bMeta) bMeta.innerText = "Meta Semanal Faturamento";
        } else {
            if(bFat) bFat.innerText = "Mês Inteiro";
            if(bMeta) bMeta.innerText = "Meta Mensal Faturamento";
        }
    }

    // --- RE-CONSTRUÇÃO VISUAL DOS GRÁFICOS (CHART.JS) ---
    if (cBarras) cBarras.destroy();
    if (cPizzaF) cPizzaF.destroy();
    if (cPizzaG) cPizzaG.destroy();
    if (cGastosBarras) cGastosBarras.destroy();

    const ctxBarras = document.getElementById('chart-faturamento-barras');
    if (ctxBarras) {
        cBarras = new Chart(ctxBarras.getContext('2d'), {
            type: 'bar',
            data: { labels: labelsFaturamento.length ? labelsFaturamento : ['Sem dados'], datasets: [{ data: valoresFaturamento.length ? valoresFaturamento : [0], backgroundColor: '#84cc16', borderRadius: 4 }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
        });
    }

    const ctxPizzaF = document.getElementById('chart-faturamento-pizza');
    if (ctxPizzaF) {
        cPizzaF = new Chart(ctxPizzaF.getContext('2d'), {
            type: 'pie',
            data: { datasets: [{ data: [part, p99, u], backgroundColor: ['#10b981', '#84cc16', '#4ade80'] }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
        });
    }

    const ctxPizzaG = document.getElementById('chart-gastos-pizza');
    if (ctxPizzaG && periodoAtual === 'diario') {
        cPizzaG = new Chart(ctxPizzaG.getContext('2d'), {
            type: 'pie',
            data: { datasets: [{ data: [comb, alim, ped], backgroundColor: ['#f43f5e', '#fb923c', '#f59e0b'] }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
        });
    }

    const ctxGastosBarras = document.getElementById('chart-gastos-barras');
    if (ctxGastosBarras && periodoAtual !== 'diario') {
        cGastosBarras = new Chart(ctxGastosBarras.getContext('2d'), {
            type: 'bar',
            data: {
                labels: labelsGastosBarras,
                datasets: [
                    { label: 'Gasolina', data: dadosCombustivelBarras, backgroundColor: '#f43f5e' },
                    { label: 'Alimento', data: dadosAlimentoBarras, backgroundColor: '#fb923c' },
                    { label: 'Pedágio', data: dadosPedagioBarras, backgroundColor: '#f59e0b' }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: { x: { stacked: true }, y: { stacked: true } },
                plugins: { legend: { display: true, position: 'top', labels: { boxWidth: 10, font: { size: 10 } } } }
            }
        });
    }
}