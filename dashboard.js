const SUPABASE_URL = "https://rximgiwpqmshqaducvla.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ4aW1naXdwcW1zaHFhZHVjdmxhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1MjgwNDYsImV4cCI6MjA5NjEwNDA0Nn0.O3Uy5fYgc7CedVThLza_yCvuM4wHd4IpHrXoCYW2w-I";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const toast = document.getElementById('toast');

function showToast(message, isError = false) {
    toast.innerText = message;
    toast.className = `fixed bottom-5 right-5 text-white px-5 py-3 rounded-lg shadow-xl font-medium transition-all duration-300 ${isError ? 'bg-red-600' : 'bg-emerald-600'}`;
    toast.style.transform = 'translateY(0)';
    toast.style.opacity = '1';
    setTimeout(() => {
        toast.style.transform = 'translateY(20px)';
        toast.style.opacity = '0';
    }, 3000);
}

// Monitor de Autenticação Ativa
supabaseClient.auth.onAuthStateChange((event, session) => {
    if (!session) {
        window.location.href = "index.html";
    } else {
        carregarDadosDashboard(session.user.id);
    }
});

async function carregarDadosDashboard(uid) {
    try {
        // 1. Carrega dados de perfil do usuário (Retornado para 'pontos_totais' conforme o banco real)
        const { data: usuario, error: errUser } = await supabaseClient
            .from('usuarios')
            .select('nome, pontos_totais')
            .eq('id', uid)
            .single();

        if (errUser || !usuario) {
            showToast("Erro ao carregar dados do perfil.", true);
            document.getElementById('saudacao-user').innerText = "Bem-vindo, Jogador!";
            return;
        }

        // Injeta nome e a pontuação baseada na coluna oficial
        document.getElementById('saudacao-user').innerText = `Olá, ${usuario.nome}!`;
        document.getElementById('player-points').innerHTML = `${usuario.pontos_totais} <span class="text-xs font-normal text-gray-400">pts</span>`;
        
        // 2. Busca classificação geral usando 'pontos_totais' para o Top 5
        const { data: todosUsuarios, error: errRank } = await supabaseClient
            .from('usuarios')
            .select('id, nome, pontos_totais')
            .order('pontos_totais', { ascending: false });

        if (!errRank && todosUsuarios) {
            // Acha a posição real do usuário logado dentro do array geral
            const posicao = todosUsuarios.findIndex(u => u.id === uid) + 1;
            document.getElementById('player-rank').innerText = `#${posicao}`;

            // Renderização do Top 5
            const top5Container = document.getElementById('top5-container');
            top5Container.innerHTML = ''; 

            const top5 = todosUsuarios.slice(0, 5);
            
            top5.forEach((player, index) => {
                const isMe = player.id === uid ? 'bg-gray-700/40 font-semibold border-l-2 border-emerald-500' : '';
                const numPos = index + 1;
                
                let badge = `<span class="text-xs font-bold text-gray-500 w-6 text-center">${numPos}º</span>`;
                if (numPos === 1) badge = `<iconify-icon icon="lucide:medal" class="text-amber-400 text-lg w-6 text-center"></iconify-icon>`;
                if (numPos === 2) badge = `<iconify-icon icon="lucide:medal" class="text-gray-400 text-lg w-6 text-center"></iconify-icon>`;
                if (numPos === 3) badge = `<iconify-icon icon="lucide:medal" class="text-amber-700 text-lg w-6 text-center"></iconify-icon>`;

                // Texto corrigido com classes claras (text-white) para contraste perfeito no tema Dark
                const playerRow = `
                    <div class="flex items-center justify-between py-3 px-3 transition-colors ${isMe}">
                        <div class="flex items-center gap-3">
                            ${badge}
                            <span class="text-sm ${player.id === uid ? 'text-emerald-400' : 'text-gray-200'}">${player.nome}</span>
                        </div>
                        <span class="text-sm font-bold text-white">${player.pontos_totais} <span class="text-[10px] font-normal text-gray-500">pts</span></span>
                    </div>
                `;
                top5Container.insertAdjacentHTML('beforeend', playerRow);
            });
        }

        // 3. Monitor de jogos programados para o dia de hoje
        const hojeInicio = new Date(); hojeInicio.setHours(0,0,0,0);
        const hojeFim = new Date(); hojeFim.setHours(23,59,59,999);

        const { count, error: errJogos } = await supabaseClient
            .from('jogos')
            .select('*', { count: 'exact', head: true })
            .gte('data_jogo', hojeInicio.toISOString())
            .lte('data_jogo', hojeFim.toISOString());

        if (!errJogos && count > 0) {
            document.getElementById('pending-matches-text').innerText = `Fique atento! Temos ${count} partida(s) da Copa rodando hoje. Garanta seus pontos na tabela!`;
            document.getElementById('alert-container').classList.remove('hidden');
        }

    } catch (e) {
        console.error(e);
        showToast("Erro crítico na comunicação com o banco de dados.", true);
    }
}

// Lógica de logout
document.getElementById('btn-logout').addEventListener('click', async () => {
    const { error } = await supabaseClient.auth.signOut();
    if (error) showToast("Erro ao efetuar logout.", true);
});