const SUPABASE_URL = "https://rximgiwpqmshqaducvla.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ4aW1naXdwcW1zaHFhZHVjdmxhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1MjgwNDYsImV4cCI6MjA5NjEwNDA0Nn0.O3Uy5fYgc7CedVThLza_yCvuM4wHd4IpHrXoCYW2w-I";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const saudacaoUser = document.getElementById('saudacao-user');
const btnLogout = document.getElementById('btn-logout');
const toast = document.getElementById('toast');

// Mapeamento amigável para os títulos das divisões do Mata-Mata
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

    // Detecta dinamicamente qual tela o usuário está acessando
    const ehPaginaFinais = window.location.pathname.includes('apostas-finais.html');
    const tipoFaseFiltro = ehPaginaFinais ? 'mata_mata' : 'grupos';

    // Monta a query filtrando pelo tipo de fase correspondente à página
    let query = supabaseClient
        .from('jogos')
        .select(`
            *,
            time_a:paises!jogos_time_a_id_fkey(nome, sigla),
            time_b:paises!jogos_time_b_id_fkey(nome, sigla)
        `)
        .eq('tipo_fase', tipoFaseFiltro);

    // Se forem as finais, ordena por ID sequencial para respeitar o chaveamento da árvore
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
        // Se for a página de finais, injeta os Headers Separadores de Fase dinamicamente antes do card
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

        // Tratamento da Data Local
        const dataLocal = new Date(jogo.data_jogo);
        card.querySelector('.data-jogo').innerText = dataLocal.toLocaleString('pt-BR', {
            weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
        }).replace(':', 'h').replace(' ', ' – ').toUpperCase();

        // Injeta a referência numérica FIFA (se o elemento existir na tela)
        const badgeFifa = card.querySelector('.jogo-fifa-badge');
        if (badgeFifa) badgeFifa.innerText = `JOGO ${jogo.jogo_fifa}`;

        // Lógica de Prioridade: Se houver time real no banco, exibe o time. Caso contrário, exibe placeholder.
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
            // Aplica os placeholders de chave (Ex: 1º Grupo A) salvos no seu banco de dados
            campoTimeA.innerText = jogo.time_a_placeholder || 'A definir';
            campoTimeB.innerText = jogo.time_b_placeholder || 'A definir';
            campoTimeA.classList.add('text-gray-500');
            campoTimeB.classList.add('text-gray-500');
            if (campoSiglaA) campoSiglaA.innerText = '';
            if (campoSiglaB) campoSiglaB.innerText = '';
        }

        // Exibir pontuação calculada se o jogo tiver resultado final lançado
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
        inputA.id = `golsA_${jogo.id}`;
        inputB.id = `golsB_${jogo.id}`;
        inputA.value = aposta?.gols_a ?? '';
        inputB.value = aposta?.gols_b ?? '';

        // LÓGICA DE PÊNALTIS (Exclusivo para o Mata-Mata)
        if (ehPaginaFinais) {
            const containerPenaltis = card.querySelector('.container-penaltis');
            const btnClassificaA = card.querySelector('.btn-classifica-a');
            const btnClassificaB = card.querySelector('.btn-classifica-b');

            if (containerPenaltis && btnClassificaA && btnClassificaB) {
                // Nomeia os botões com as siglas ou placeholders correspondentes
                btnClassificaA.innerText = jogo.time_a_id ? (jogo.time_a?.sigla || "TIME A") : (jogo.time_a_placeholder || "A");
                btnClassificaB.innerText = jogo.time_b_id ? (jogo.time_b?.sigla || "TIME B") : (jogo.time_b_placeholder || "B");

                // Restaura o estado visual se o usuário já tiver escolhido um vencedor nos pênaltis antes
                if (aposta?.penaltis_vencedor === 'A') {
                    btnClassificaA.className = "btn-classifica-a text-xs px-2.5 py-1 rounded bg-amber-500 text-gray-950 font-bold";
                    btnClassificaA.dataset.selecionado = "true";
                } else if (aposta?.penaltis_vencedor === 'B') {
                    btnClassificaB.className = "btn-classifica-b text-xs px-2.5 py-1 rounded bg-amber-500 text-gray-950 font-bold";
                    btnClassificaB.dataset.selecionado = "true";
                }

                // Exibe o painel de pênaltis caso os inputs de placar estejam empatados
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
                checarEmpate(); // Execução inicial preventiva

                // Listeners de clique para os botões de pênalti
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

        // Passa uma arrow function ou referência para o clique do botão salvar
        card.querySelector('.btn-salvar').onclick = (e) => {
            const cardElement = e.target.closest('.card-jogo');
            salvarAposta(jogo.id, cardElement, ehPaginaFinais);
        };

        container.appendChild(card);
    });
}

async function salvarAposta(jogoId, cardElement, ehPaginaFinais) {
    const golsA = document.getElementById(`golsA_${jogoId}`).value;
    const golsB = document.getElementById(`golsB_${jogoId}`).value;
    const { data: { user } } = await supabaseClient.auth.getUser();

    // Objeto padrão de payload para upsert
    const dadosAposta = { 
        usuario_id: user.id, 
        jogo_id: jogoId, 
        gols_a: parseInt(golsA || 0), 
        gols_b: parseInt(golsB || 0) 
    };

    // Se estivermos nas finais e houver empate no placar, valida e anexa quem passou nos pênaltis
    if (ehPaginaFinais && golsA !== "" && golsB !== "" && golsA === golsB) {
        const btnA = cardElement.querySelector('.btn-classifica-a');
        const btnB = cardElement.querySelector('.btn-classifica-b');
        
        if (btnA?.dataset.selecionado === "true") {
            dadosAposta.penaltis_vencedor = 'A';
        } else if (btnB?.dataset.selecionado === "true") {
            dadosAposta.penaltis_vencedor = 'B';
        } else {
            showToast("Por favor, selecione quem se classifica nos pênaltis!", true);
            return;
        }
    } else {
        dadosAposta.penaltis_vencedor = null; // Reseta se não for empate ou não for finais
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
}

btnLogout.addEventListener('click', async () => { 
    await supabaseClient.auth.signOut(); 
    window.location.href = "index.html"; 
});

document.addEventListener('DOMContentLoaded', verificarSessao);