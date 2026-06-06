const SUPABASE_URL = "https://rximgiwpqmshqaducvla.supabase.co"; 
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ4aW1naXdwcW1zaHFhZHVjdmxhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1MjgwNDYsImV4cCI6MjA5NjEwNDA0Nn0.O3Uy5fYgc7CedVThLza_yCvuM4wHd4IpHrXoCYW2w-I";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const containerRanking = document.getElementById('container-ranking');
const btnLogout = document.getElementById('btn-logout');
const saudacaoUser = document.getElementById('saudacao-user');

async function verificarSessao() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) { window.location.href = "index.html"; return; }
    
    const { data: user } = await supabaseClient.from('usuarios').select('nome').eq('id', session.user.id).single();
    if (user) saudacaoUser.innerText = `Olá, ${user.nome}!`;
    
    carregarRankingGeral(session.user.id);
}

async function carregarRankingGeral(usuarioLogadoId) {
    try {
        const { data: usuarios } = await supabaseClient.from('usuarios').select('id, nome');
        const { data: palpites } = await supabaseClient.from('palpites').select('usuario_id, jogo_id, gols_a, gols_b');
        const { data: jogos } = await supabaseClient.from('jogos').select('id, gols_a, gols_b').not('gols_a', 'is', null);

        const rankingCalculado = usuarios.map(usr => {
            let total = 0;
            palpites.filter(p => p.usuario_id === usr.id).forEach(p => {
                const jogoReal = jogos.find(j => j.id === p.jogo_id);
                if (jogoReal) {
                    total += calcularPontos(p.gols_a, p.gols_b, jogoReal.gols_a, jogoReal.gols_b);
                }
            });
            return { nome: usr.nome, id: usr.id, pontos_totais: total };
        });

        rankingCalculado.sort((a, b) => b.pontos_totais - a.pontos_totais);
        renderizarRanking(rankingCalculado, usuarioLogadoId);
    } catch (err) {
        console.error(err);
        containerRanking.innerHTML = `<tr><td colspan="3" class="py-8 text-center text-red-400">Erro ao carregar ranking.</td></tr>`;
    }
}

function renderizarRanking(ranking, usuarioLogadoId) {
    containerRanking.innerHTML = "";
    ranking.forEach((usr, index) => {
        const isMe = usr.id === usuarioLogadoId;
        const trHtml = `
            <tr class="${isMe ? 'bg-emerald-950/30 text-emerald-300 font-semibold' : ''} hover:bg-gray-700/20 transition-colors">
                <td class="py-4 text-center font-mono text-sm text-gray-400">${index + 1}º</td>
                <td class="py-4 font-medium">${usr.nome} ${isMe ? '<span class="text-xs bg-emerald-800 text-emerald-200 px-1.5 py-0.5 rounded ml-1 font-normal">Você</span>' : ''}</td>
                <td class="py-4 text-right font-mono font-bold text-amber-400">${usr.pontos_totais} pts</td>
            </tr>
        `;
        containerRanking.insertAdjacentHTML('beforeend', trHtml);
    });
}

btnLogout.addEventListener('click', async () => { await supabaseClient.auth.signOut(); window.location.href = "index.html"; });

verificarSessao();