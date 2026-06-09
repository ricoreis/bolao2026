// apostas.js - Motor centralizado e dinâmico
const SUPABASE_URL = "https://rximgiwpqmshqaducvla.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ4aW1naXdwcW1zaHFhZHVjdmxhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1MjgwNDYsImV4cCI6MjA5NjEwNDA0Nn0.O3Uy5fYgc7CedVThLza_yCvuM4wHd4IpHrXoCYW2w-I";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Variável global para armazenar as regras do banco
let configRegras = [];

const saudacaoUser = document.getElementById('saudacao-user');
const btnLogout = document.getElementById('btn-logout');
const toast = document.getElementById('toast');

// Carrega as regras do banco ao iniciar o bolão
async function carregarRegras() {
    const { data } = await supabaseClient.from('pontuacao').select('*');
    if (data) configRegras = data;
}

function showToast(mensagem) {
    const toast = document.getElementById('toast');
    if (toast) {
        toast.textContent = mensagem;
        
        // POSICIONAMENTO: top-5, right-5
        // ANIMAÇÃO: translate-y-[-20px] para surgir de cima (negativo)
        toast.className = "fixed top-5 right-5 z-[60] text-white px-5 py-3 rounded-lg shadow-xl font-medium bg-emerald-600 transition-all duration-300 opacity-100 translate-y-0";
        
        setTimeout(() => {
            // Ao esconder: volta para cima (translate-y-[-20px]) e opacidade 0
            toast.className = "fixed top-5 right-5 z-[60] text-white px-5 py-3 rounded-lg shadow-xl font-medium bg-emerald-600 transition-all duration-300 translate-y-[-20px] opacity-0";
        }, 3000);
    }
}
async function verificarSessao() {
    await carregarRegras(); 
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) { window.location.href = "index.html"; return; }
    
    const { data: userData } = await supabaseClient.from('usuarios').select('nome').eq('id', session.user.id).single();
    if (userData) saudacaoUser.innerText = `Olá, ${userData.nome}!`;
    carregarJogosEApostas();
}

async function carregarJogosEApostas() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) return;

    const ehPaginaFinais = window.location.pathname.includes('apostas-finais.html');

    let query = supabaseClient
        .from('jogos')
        .select(`
            *,
            fase:fases(nome),
            time_a:paises!jogos_time_a_id_fkey(nome, sigla),
            time_b:paises!jogos_time_b_id_fkey(nome, sigla)
        `);

    if (ehPaginaFinais) {
        query = query.gt('fase_id', 1).order('fase_id', { ascending: true }).order('data_jogo', { ascending: true });
    } else {
        query = query.eq('fase_id', 1).order('data_jogo', { ascending: true });
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
        if (ehPaginaFinais && jogo.fase?.nome !== faseAtualRegistrada) {
            faseAtualRegistrada = jogo.fase?.nome;
            const header = document.createElement('h3');
            header.className = "text-sm font-bold uppercase tracking-wider text-emerald-400 bg-gray-800/30 border border-gray-700/40 px-4 py-2.5 rounded-lg mt-6 mb-3 w-full";
            header.innerText = faseAtualRegistrada || "Mata-Mata";
            container.appendChild(header);
        }

        const aposta = mapaApostas ? mapaApostas[jogo.id] : null;
        const card = template.content.cloneNode(true);
        const cardElement = card.querySelector('.card-jogo');

        const dataLocal = new Date(jogo.data_jogo);
        card.querySelector('.data-jogo').innerText = dataLocal.toLocaleString('pt-BR', {
            weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
        }).replace(':', 'h').replace(' ', ' – ').toUpperCase();

        card.querySelector('.time-a').innerText = jogo.time_a?.nome || jogo.time_a_placeholder || 'A definir';
        card.querySelector('.time-b').innerText = jogo.time_b?.nome || jogo.time_b_placeholder || 'A definir';

        const inputA = card.querySelector('.input-a');
        const inputB = card.querySelector('.input-b');
        const btnSalvar = card.querySelector('.btn-salvar');

        inputA.id = `golsA_${jogo.id}`;
        inputB.id = `golsB_${jogo.id}`;
        inputA.value = aposta?.gols_a ?? '';
        inputB.value = aposta?.gols_b ?? '';

        // Cálculo dinâmico com Multiplicador
        if (jogo.gols_a !== null && jogo.gols_b !== null && aposta) {
            // Se fase_id > 1 (Mata-mata), multiplicador é 2, senão é 1
            const multiplicador = (jogo.fase_id > 1) ? 2 : 1;
            
            // Chama a função global calcularPontos (definida em regras.js)
            const pontos = calcularPontos(aposta.gols_a, aposta.gols_b, jogo.gols_a, jogo.gols_b, configRegras, multiplicador);
            
            const divInfo = document.createElement('div');
            divInfo.className = "mt-3 p-2 bg-gray-950/50 rounded text-center text-xs";
            divInfo.innerHTML = `
                <div class="text-gray-400">Placar Oficial: ${jogo.gols_a} x ${jogo.gols_b}</div>
                <div class="font-bold text-emerald-400 mt-1">Pontos: ${pontos} ${multiplicador > 1 ? '(Dobrado!)' : ''}</div>
            `;
            cardElement.appendChild(divInfo);
        }

        const agora = new Date();
        if ((dataLocal - agora) / (1000 * 60) < 60) {
            inputA.disabled = true; inputB.disabled = true; btnSalvar.disabled = true;
            inputA.classList.add("opacity-50", "cursor-not-allowed");
            inputB.classList.add("opacity-50", "cursor-not-allowed");
            btnSalvar.className = "btn-salvar ml-2 bg-gray-700 text-gray-500 font-bold px-4 py-2 rounded-lg cursor-not-allowed text-sm";
        } else {
            btnSalvar.onclick = (e) => salvarAposta(jogo.id, cardElement, ehPaginaFinais);
        }

        // --- Lógica de Pênaltis (Injeção Cirúrgica) ---
        const containerPenaltis = card.querySelector('.container-penaltis');
        if (containerPenaltis && ehPaginaFinais && jogo.fase_id > 1) {
            // 1. Configura os nomes dos radios para serem únicos por jogo
            const radioA = card.querySelector('.radio-penaltis-a'); // Ajuste o nome da classe se necessário
            const radioB = card.querySelector('.radio-penaltis-b');
            card.querySelector('.nome-time-a').innerText = jogo.time_a?.nome || 'Time A';
            card.querySelector('.nome-time-b').innerText = jogo.time_b?.nome || 'Time B';

            if (radioA && radioB) {
                radioA.name = `penaltis_${jogo.id}`;
                radioB.name = `penaltis_${jogo.id}`;
                radioA.value = jogo.time_a_id;
                radioB.value = jogo.time_b_id;

                // 2. Visibilidade baseada no empate
                const checkEmpate = () => {
                    const vA = inputA.value;
                    const vB = inputB.value;
                    if (vA !== '' && vB !== '' && vA === vB) {
                        containerPenaltis.classList.remove('hidden');
                    } else {
                        containerPenaltis.classList.add('hidden');
                    }
                };

                // 3. Monitora os inputs já existentes
                inputA.addEventListener('input', checkEmpate);
                inputB.addEventListener('input', checkEmpate);
                checkEmpate(); // Estado inicial

                // 4. Carrega seleção prévia
                if (aposta?.penaltis_vencedor_id) {
                    const radioSel = card.querySelector(`input[value="${aposta.penaltis_vencedor_id}"]`);
                    if (radioSel) radioSel.checked = true;
                }
            }
        }

        container.appendChild(card);
    });
}

async function salvarAposta(jogoId, cardElement, ehPaginaFinais) {
    try {
        const { data: { user } } = await supabaseClient.auth.getUser();
        const inputA = cardElement.querySelector('.input-a');
        const inputB = cardElement.querySelector('.input-b');
        const golsA = parseInt(inputA.value || 0);
        const golsB = parseInt(inputB.value || 0);

        const dadosAposta = { 
            usuario_id: user.id, 
            jogo_id: jogoId, 
            gols_a: golsA, 
            gols_b: golsB 
        };

        if (ehPaginaFinais) {
            // Verifica se o jogo é um empate
            const ehEmpate = (inputA.value !== '' && inputB.value !== '' && golsA === golsB);
            
            if (ehEmpate) {
                // Se é empate, tenta pegar a escolha do radio
                const radio = cardElement.querySelector(`input[name="penaltis_${jogoId}"]:checked`);
                dadosAposta.penaltis_vencedor_id = radio ? parseInt(radio.value) : null;
            } else {
                // SE NÃO É EMPATE, FORÇA O NULL
                dadosAposta.penaltis_vencedor_id = null;
            }
        }

        const { error } = await supabaseClient.from('apostas').upsert(dadosAposta, { onConflict: 'usuario_id, jogo_id' });
        
        if (error) {
            console.error("Erro Supabase:", error);
            showToast("Erro ao salvar.", true);
        } else {
            showToast("Aposta salva!");
        }
    } catch (e) { 
        console.error(e);
        showToast("Erro ao processar.", true); 
    }
}

btnLogout.addEventListener('click', async () => { await supabaseClient.auth.signOut(); window.location.href = "index.html"; });
document.addEventListener('DOMContentLoaded', verificarSessao);