const SUPABASE_URL = "https://rximgiwpqmshqaducvla.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ4aW1naXdwcW1zaHFhZHVjdmxhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1MjgwNDYsImV4cCI6MjA5NjEwNDA0Nn0.O3Uy5fYgc7CedVThLza_yCvuM4wHd4IpHrXoCYW2w-I";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const saudacaoUser = document.getElementById('saudacao-user');
const btnLogout = document.getElementById('btn-logout');
const toast = document.getElementById('toast');

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

    const { data: jogos, error: erroJogos } = await supabaseClient
        .from('jogos')
        .select(`
            *,
            time_a:paises!jogos_time_a_id_fkey(nome, sigla),
            time_b:paises!jogos_time_b_id_fkey(nome, sigla)
        `)
        .order('data_jogo', { ascending: true });

    if (erroJogos) { console.error(erroJogos); return; }

    const { data: apostas } = await supabaseClient
        .from('apostas')
        .select('*')
        .eq('usuario_id', session.user.id);

    const mapaApostas = {};
    if (apostas) apostas.forEach(p => mapaApostas[p.jogo_id] = p);

    renderizarJogos(jogos, mapaApostas);
}

function renderizarJogos(jogos, mapaApostas) {
    const container = document.getElementById('container-jogos');
    const template = document.getElementById('template-jogo');
    if (!container || !template) return;
    container.innerHTML = ''; 

    jogos.forEach(jogo => {
        const aposta = mapaApostas ? mapaApostas[jogo.id] : null;
        const card = template.content.cloneNode(true);

        const dataLocal = new Date(jogo.data_jogo);
        card.querySelector('.data-jogo').innerText = dataLocal.toLocaleString('pt-BR', {
            weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
        }).replace(':', 'h').replace(' ', ' – ').toUpperCase();

        card.querySelector('.time-a').innerText = jogo.time_a?.nome || 'Time A';
        card.querySelector('.sigla-a').innerText = jogo.time_a?.sigla || '';
        card.querySelector('.time-b').innerText = jogo.time_b?.nome || 'Time B';
        card.querySelector('.sigla-b').innerText = jogo.time_b?.sigla || '';

        // Exibir pontuação apenas se o jogo tiver resultado real
        if (jogo.gols_a !== null && jogo.gols_b !== null && aposta) {
            const pontos = calcularPontos(aposta.gols_a, aposta.gols_b, jogo.gols_a, jogo.gols_b);
            const statusBadge = card.querySelector('.status-badge');
            statusBadge.innerText = `Pontos: ${pontos}`;
            statusBadge.classList.add('bg-emerald-900', 'text-emerald-400');
        }

        const inputA = card.querySelector('.input-a');
        const inputB = card.querySelector('.input-b');
        inputA.id = `golsA_${jogo.id}`;
        inputB.id = `golsB_${jogo.id}`;
        inputA.value = aposta?.gols_a ?? '';
        inputB.value = aposta?.gols_b ?? '';

        card.querySelector('.btn-salvar').onclick = () => salvarAposta(jogo.id);
        container.appendChild(card);
    });
}

async function salvarAposta(jogoId) {
    const golsA = document.getElementById(`golsA_${jogoId}`).value;
    const golsB = document.getElementById(`golsB_${jogoId}`).value;
    const { data: { user } } = await supabaseClient.auth.getUser();

    const { error } = await supabaseClient
        .from('apostas')
        .upsert({ 
            usuario_id: user.id, 
            jogo_id: jogoId, 
            gols_a: parseInt(golsA || 0), 
            gols_b: parseInt(golsB || 0) 
        }, { onConflict: 'usuario_id, jogo_id' });
    
    if (error) showToast("Erro ao salvar", true);
    else showToast("Aposta salva!");
}

btnLogout.addEventListener('click', async () => { 
    await supabaseClient.auth.signOut(); 
    window.location.href = "index.html"; 
});

document.addEventListener('DOMContentLoaded', verificarSessao);