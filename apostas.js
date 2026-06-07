const SUPABASE_URL = "https://rximgiwpqmshqaducvla.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ4aW1naXdwcW1zaHFhZHVjdmxhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1MjgwNDYsImV4cCI6MjA5NjEwNDA0Nn0.O3Uy5fYgc7CedVThLza_yCvuM4wHd4IpHrXoCYW2w-I";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const saudacaoUser = document.getElementById('saudacao-user');
const btnLogout = document.getElementById('btn-logout');
const toast = document.getElementById('toast');

// Mapeamento para os títulos das divisões do Mata-Mata
const mapeamentoFases = {
    'R16': '16-Avos de Final',
    'OITAVAS': 'Oitavas de Final',
    'QUARTAS': 'Quartas de Final',
    'SEMI': 'Semifinais',
    'TERCEIRO': 'Disputa de 3º Lugar',
    'FINAL': 'Grande Final'
};

function showToast(mensagem, isError = false) {
    toast.innerText = mensagem;
    toast.className = `fixed bottom-5 right-5 text-white px-5 py-3 rounded-lg shadow-xl font-medium translate-y-0 opacity-100 transition-all duration-300 ${isError ? 'bg-red-600' : 'bg-emerald-600'}`;
    setTimeout(() => { toast.className = "fixed bottom-5 right-5 text-white px-5 py-3 rounded-lg shadow-xl font-medium translate-y-20 opacity-0 transition-all duration-300"; }, 3000);
}

async function verificarSessao() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) { window.location.href = "index.html"; return; }
    
    const { data: userData } = await supabaseClient.from('usuarios').select('nome').eq('id', session.user.id).single();
    if (userData) saudacaoUser.innerText = `Boa sorte nas apostas, ${userData.nome}!`;
    carregarJogosEApostas();
}

async function carregarJogosEApostas() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) return;

    // Detecta se o usuário está na página de grupos ou de finais
    const ehPaginaFinais = window.location.pathname.includes('apostas-finais.html');
    const tipoFaseFiltro = ehPaginaFinais ? 'mata_mata' : 'grupos';

    // Busca os jogos com relacionamentos
    let query = supabaseClient
        .from('jogos')
        .select(`
            *,
            time_a:paises!jogos_time_a_id_fkey(nome, sigla),
            time_b:paises!jogos_time_b_id_fkey(nome, sigla)
        `)
        .eq('tipo_fase', tipoFaseFiltro);

    if (ehPaginaFinais) {
        query = query.order('id', { ascending: true });
    } else {
        query = query.order('data_jogo', { ascending: true });
    }

    const { data: jogos, error: erroJogos } = await query;
    if (erroJogos) { console.error(erroJogos); return; }

    const { data: apostas } = await supabaseClient
        .from('apostas')
        .select('*')
        .eq('usuario_id', session.user.id);

    const mapaApostas = {};
    if (apostas) apostas.forEach(p => mapaApostas[p.jogo_id] = p);

    renderizarJogos(jogos, mapaApostas, ehPaginaFinais);
}

function renderizarJogos(jogos, mapaApostas, ehPaginaFinais) {
    const container = document.getElementById('container-jogos');
    const template = document.getElementById('template-jogo');
    if (!container || !template) return;
    container.innerHTML = ''; 

    let faseAtualRegistrada = "";

    jogos.forEach(jogo => {
        if (ehPaginaFinais && jogo.fase !== faseAtualRegistrada) {
            faseAtualRegistrada = jogo.fase;
            const tituloFase = mapeamentoFases[jogo.fase] || jogo.fase;
            
            const header = document.createElement('h3');
            header.className = "text-sm font-bold uppercase tracking-wider text-emerald-400 bg-gray-800/30 border border-gray-700/40 px-4 py-2.5 rounded-lg mt-6 mb-3 w-full";
            header.innerText = tituloFase;
            container.appendChild(header);
        }

        const aposta = mapaApostas ? mapaApostas[jogo.id] : null;
        const card = template.content.cloneNode(true);

        const dataLocal = new Date(jogo.data_jogo);
        card.querySelector('.data-jogo').innerText = dataLocal.toLocaleString('pt-BR', {
            weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
        }).replace(':', 'h').replace(' ', ' – ').toUpperCase();

        const badgeFifa = card.querySelector('.jogo-fifa-badge');
        if (badgeFifa) badgeFifa.innerText = `JOGO ${jogo.jogo_fifa}`;

        // TRAVA 1: BLOQUEIO POR HORÁRIO (1 HORA ANTES)
        const agora = new Date();
        const diferencaMinutos = (dataLocal - agora) / (1000 * 60);
        const tempoEsgotado = diferencaMinutos < 60;

        // TRAVA 2: CHAVEAMENTO DO MATA-MATA
        const timesDefinidos = !ehPaginaFinais || (jogo.time_a_id && jogo.time_b_id);
        const jogoLiberado = timesDefinidos && !tempoEsgotado;

        const campoTimeA = card.querySelector('.time-a');
        const campoTimeB = card.querySelector('.time-b');
        const campoSiglaA = card.querySelector('.sigla-a');
        const campoSiglaB = card.querySelector('.sigla-b');

        if (jogo.time_a_id && jogo.time_b_id) {
            campoTimeA.innerText = jogo.time_a?.nome || 'Time A';
            campoTimeB.innerText = jogo.time_b?.nome || 'Time B';
            if (campoSiglaA) campoSiglaA.innerText = jogo.time_a?.sigla || '';
            if (campoSiglaB) campoSiglaB.innerText = jogo.time_b?.sigla || '';
        } else {
            campoTimeA.innerText = jogo.time_a_placeholder || 'A definir';
            campoTimeB.innerText = jogo.time_b_placeholder || 'A definir';
            campoTimeA.classList.add('text-gray-500');
            campoTimeB.classList.add('text-gray-500');
            if (campoSiglaA) campoSiglaA.innerText = '';
            if (campoSiglaB) campoSiglaB.innerText = '';
        }

        if (jogo.gols_a !== null && jogo.gols_b !== null && aposta) {
            const pontos = calcularPontos(aposta.gols_a, aposta.gols_b, jogo.gols_a, jogo.gols_b);
            const statusBadge = card.querySelector('.status-badge');
            if (statusBadge) {
                statusBadge.innerText = `Pontos: ${pontos}`;
                statusBadge.className = "status-badge bg-emerald-900 text-emerald-400 text-[10px] px-2 py-1 rounded w-fit font-bold";
            }
        }

        const inputA = card.querySelector('.input-a');
        const inputB = card.querySelector('.input-b');
        const btnSalvar = card.querySelector('.btn-salvar');

        inputA.id = `golsA_${jogo.id}`;
        inputB.id = `golsB_${jogo.id}`;
        inputA.value = aposta?.gols_a ?? '';
        inputB.value = aposta?.gols_b ?? '';

        if (!jogoLiberado) {
            inputA.disabled = true;
            inputB.disabled = true;
            btnSalvar.disabled = true;

            inputA.className = "input-a w-12 h-10 bg-gray-800/50 border border-gray-700 text-center rounded-lg font-bold text-lg text-gray-600 cursor-not-allowed";
            inputB.className = "input-b w-12 h-10 bg-gray-800/50 border border-gray-700 text-center rounded-lg font-bold text-lg text-gray-600 cursor-not-allowed";
            btnSalvar.className = "btn-salvar ml-2 bg-gray-700 text-gray-500 font-bold px-4 py-2 rounded-lg cursor-not-allowed text-sm opacity-50";
            
            const statusBadge = card.querySelector('.status-badge');
            if (statusBadge && (jogo.gols_a === null || jogo.gols_b === null)) {
                if (tempoEsgotado) {
                    statusBadge.innerText = "🚨 Apostas encerradas (Limite de 1h antes do jogo expirado)";
                    statusBadge.className = "status-badge bg-red-950 text-red-400 text-[10px] px-2 py-1 rounded w-fit font-medium border border-red-900/50";
                } else {
                    statusBadge.innerText = "Apostas bloqueadas – Aguardando definição dos times";
                    statusBadge.className = "status-badge bg-gray-900 text-amber-500/70 text-[10px] px-2 py-1 rounded w-fit font-medium";
                }
            }
        }

        if (ehPaginaFinais && jogoLiberado) {
            const containerPenaltis = card.querySelector('.container-penaltis');
            const btnClassificaA = card.querySelector('.btn-classifica-a');
            const btnClassificaB = card.querySelector('.btn-classifica-b');

            if (containerPenaltis && btnClassificaA && btnClassificaB) {
                btnClassificaA.innerText = jogo.time_a_id ? (jogo.time_a?.sigla || "TIME A") : (jogo.time_a_placeholder || "A");
                btnClassificaB.innerText = jogo.time_b_id ? (jogo.time_b?.sigla || "TIME B") : (jogo.time_b_placeholder || "B");

                if (aposta?.penaltis_vencedor === 'A') {
                    btnClassificaA.className = "btn-classifica-a text-xs px-2.5 py-1 rounded bg-amber-500 text-gray-950 font-bold";
                    btnClassificaA.dataset.selecionado = "true";
                } else if (aposta?.penaltis_vencedor === 'B') {
                    btnClassificaB.className = "btn-classifica-b text-xs px-2.5 py-1 rounded bg-amber-500 text-gray-950 font-bold";
                    btnClassificaB.dataset.selecionado = "true";
                }

                const checarEmpate = () => {
                    if (inputA.value !== "" && inputB.value !== "" && inputA.value === inputB.value) {
                        containerPenaltis.classList.remove('hidden');
                    } else {
                        containerPenaltis.classList.add('hidden');
                        btnClassificaA.className = "btn-classifica-a text-xs px-2.5 py-1 rounded bg-gray-800 border border-gray-700 text-gray-300 font-medium";
                        btnClassificaB.className = "btn-classifica-b text-xs px-2.5 py-1 rounded bg-gray-800 border border-gray-700 text-gray-300 font-medium";
                        btnClassificaA.removeAttribute('data-selecionado');
                        btnClassificaB.removeAttribute('data-selecionado');
                    }
                };

                inputA.addEventListener('input', checarEmpate);
                inputB.addEventListener('input', checarEmpate);
                checarEmpate();

                btnClassificaA.onclick = () => {
                    btnClassificaA.className = "btn-classifica-a text-xs px-2.5 py-1 rounded bg-amber-500 text-gray-950 font-bold";
                    btnClassificaB.className = "btn-classifica-b text-xs px-2.5 py-1 rounded bg-gray-800 border border-gray-700 text-gray-300 font-medium";
                    btnClassificaA.dataset.selecionado = "true";
                    btnClassificaB.removeAttribute('data-selecionado');
                };

                btnClassificaB.onclick = () => {
                    btnClassificaB.className = "btn-classifica-b text-xs px-2.5 py-1 rounded bg-amber-500 text-gray-950 font-bold";
                    btnClassificaA.className = "btn-classifica-a text-xs px-2.5 py-1 rounded bg-gray-800 border border-gray-700 text-gray-300 font-medium";
                    btnClassificaB.dataset.selecionado = "true";
                    btnClassificaA.removeAttribute('data-selecionado');
                };
            }
        }

        if (jogoLiberado) {
            card.querySelector('.btn-salvar').onclick = (e) => {
                const cardElement = e.target.closest('.card-jogo');
                salvarAposta(jogo.id, cardElement, ehPaginaFinais);
            };
        }

        container.appendChild(card);
    });
}

async function salvarAposta(jogoId, cardElement, ehPaginaFinais) {
    try {
        // RE-CHECAGEM DE SEGURANÇA EM TEMPO REAL
        const { data: jogo, error: errCheck } = await supabaseClient
            .from('jogos')
            .select('data_jogo')
            .eq('id', jogoId)
            .single();

        if (!errCheck && jogo) {
            const agora = new Date();
            const dataPartida = new Date(jogo.data_jogo);
            const diferencaMinutos = (dataPartida - agora) / (1000 * 60);

            if (diferencaMinutos < 60) {
                showToast("🚨 Prazo encerrado! As apostas fecham 1 hora antes do jogo.", true);
                setTimeout(() => { window.location.reload(); }, 2000);
                return; 
            }
        }

        const golsA = document.getElementById(`golsA_${jogoId}`).value;
        const golsB = document.getElementById(`golsB_${jogoId}`).value;
        const { data: { user } } = await supabaseClient.auth.getUser();

        // Objeto base limpo (Salva em qualquer fase do campeonato!)
        const dadosAposta = { 
            usuario_id: user.id, 
            jogo_id: jogoId, 
            gols_a: parseInt(golsA || 0), 
            gols_b: parseInt(golsB || 0) 
        };

        // CORREÇÃO CIRÚRGICA: Só insere a propriedade de pênaltis se for a página das finais
        if (ehPaginaFinais) {
            if (golsA !== "" && golsB !== "" && golsA === golsB) {
                const btnA = cardElement.querySelector('.btn-classifica-a');
                const btnB = cardElement.querySelector('.btn-classifica-b');
                
                if (btnA?.dataset.selecionado === "true") {
                    dadosAposta.penaltis_vencedor = 'A';
                } else if (btnB?.dataset.selecionado === "true") {
                    dadosAposta.penaltis_vencedor = 'B';
                } else {
                    showToast("Selecione quem se classifica nos pênaltis!", true);
                    return;
                }
            } else {
                dadosAposta.penaltis_vencedor = null;
            }
        }

        const { error } = await supabaseClient
            .from('apostas')
            .upsert(dadosAposta, { onConflict: 'usuario_id, jogo_id' });
        
        if (error) {
            console.error(error);
            showToast("Erro ao salvar", true);
        } else {
            showToast("Aposta salva com sucesso!");
        }

    } catch (e) {
        console.error(e);
        showToast("Erro crítico ao validar o horário da aposta.", true);
    }
}

btnLogout.addEventListener('click', async () => { 
    await supabaseClient.auth.signOut(); 
    window.location.href = "index.html"; 
});

document.addEventListener('DOMContentLoaded', verificarSessao);